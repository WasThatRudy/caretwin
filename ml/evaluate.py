"""Test every trained CareTwin model on held-out data and produce the report figures.

Run after run_all.py (it reuses the saved checkpoints and the same splits):
  python evaluate.py --src EDT-Datasets --res results
Writes results/eval/eval_metrics.json and results/eval/fig_eval_*.png.
"""
import os, re, json, math, argparse
import numpy as np
import torch
import torch.nn as nn
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from scipy.stats import wasserstein_distance
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (accuracy_score, f1_score, recall_score, balanced_accuracy_score,
                             precision_recall_fscore_support, confusion_matrix)
from imblearn.over_sampling import SMOTE

from data import load_all, hr_windows, sleep_windows, gan_windows, SLEEP_CLASSES
from models import Forecaster, SleepLSTM, Generator
import train_gan

DEVICE = "cpu" if os.environ.get("CARETWIN_CPU") else ("cuda" if torch.cuda.is_available() else "cpu")
SEEDS = [0, 1, 2]

# ---- figure style (validated reference palette; baselines in neutral gray) ----
BLUE, ORANGE, AQUA, YELLOW = "#2a78d6", "#eb6834", "#1baf7a", "#eda100"
GRAY, INK, INK2, SURF = "#9b9a95", "#0b0b0b", "#52514e", "#fcfcfb"
SEQ = LinearSegmentedColormap.from_list("seq", ["#f4f8fd", "#cde2fb", "#86b6ef", "#2a78d6", "#1c5cab", "#0d366b"])
plt.rcParams.update({
    "figure.facecolor": SURF, "axes.facecolor": SURF, "savefig.facecolor": SURF,
    "axes.edgecolor": "#c9c8c3", "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "text.color": INK, "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": "#e8e7e3", "grid.linewidth": 0.8, "axes.axisbelow": True,
    "font.size": 9.5, "axes.titlesize": 10.5, "axes.titleweight": "bold", "legend.frameon": False,
    "lines.linewidth": 2,
})


def save(fig, out, name):
    fig.tight_layout()
    fig.savefig(os.path.join(out, name), dpi=160)
    plt.close(fig)


def load_model(model, path):
    model.load_state_dict(torch.load(path, map_location=DEVICE))
    return model.to(DEVICE).eval()


# ---------------------------------------------------------------- forecaster
def eval_forecaster(hr, res, out):
    fm = json.load(open(os.path.join(res, "forecaster_metrics.json")))
    X, y, mu, sd = hr_windows(hr, W=fm["window"], cap=fm["train_n"] + fm["test_n"])
    Xte, yte = X[fm["train_n"]:], y[fm["train_n"]:]
    preds = {"persistence": Xte[:, -1, 0]}  # naive baseline: next reading = last reading
    for name, bi in [("lstm", False), ("bilstm", True)]:
        m = load_model(Forecaster(bi=bi), os.path.join(res, f"forecaster_{name}.pt"))
        with torch.no_grad():
            preds[name] = np.concatenate([m(torch.tensor(Xte[i:i + 8192], device=DEVICE)).cpu().numpy()
                                          for i in range(0, len(Xte), 8192)])
    act = yte * sd + mu
    metrics = {}
    for name, p in preds.items():
        e = (p - yte) * sd
        metrics[name] = {
            "mse_std": round(float(((p - yte) ** 2).mean()), 4),
            "rmse_bpm": round(float(np.sqrt((e ** 2).mean())), 3),
            "mae_bpm": round(float(np.abs(e).mean()), 3),
            "r2": round(float(1 - ((p - yte) ** 2).sum() / ((yte - yte.mean()) ** 2).sum()), 4),
            "within_5bpm": round(float((np.abs(e) <= 5).mean()), 4),
        }
    names = {"persistence": "Persistence (last value)", "lstm": "LSTM", "bilstm": "Bi-LSTM"}
    colors = {"persistence": GRAY, "lstm": BLUE, "bilstm": ORANGE}

    # RMSE / MAE comparison
    fig, ax = plt.subplots(figsize=(6.4, 2.8))
    keys = ["persistence", "lstm", "bilstm"]
    yy = np.arange(len(keys))
    ax.barh(yy + 0.19, [metrics[k]["rmse_bpm"] for k in keys], 0.36, color=[colors[k] for k in keys], label="RMSE")
    ax.barh(yy - 0.19, [metrics[k]["mae_bpm"] for k in keys], 0.36, color=[colors[k] for k in keys], alpha=0.45, label="MAE")
    for i, k in enumerate(keys):
        ax.text(metrics[k]["rmse_bpm"] + 0.03, i + 0.19, f"RMSE {metrics[k]['rmse_bpm']:.2f}", va="center", fontsize=8.5, color=INK2)
        ax.text(metrics[k]["mae_bpm"] + 0.03, i - 0.19, f"MAE {metrics[k]['mae_bpm']:.2f}", va="center", fontsize=8.5, color=INK2)
    ax.set_yticks(yy, [names[k] for k in keys]); ax.grid(axis="y", visible=False)
    ax.set_xlabel("error on held-out test windows (bpm, lower is better)")
    ax.set_xlim(0, max(metrics[k]["rmse_bpm"] for k in keys) * 1.3)
    ax.set_title(f"HR forecast error, {len(yte):,} test windows")
    save(fig, out, "fig_eval_forecast_error.png")

    # residual distribution + predicted vs actual
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(9.2, 3.5))
    bins = np.arange(-10.5, 11.5, 1.0)  # HR is recorded in whole bpm, so 1-bpm bins
    for k in keys:
        e = (preds[k] - yte) * sd
        a1.hist(e[np.abs(e) <= 10.5], bins=bins, histtype="step", lw=1.8, color=colors[k],
                weights=np.full((np.abs(e) <= 10.5).sum(), 1 / len(e)),
                label=f"{names[k]}: {metrics[k]['within_5bpm']:.1%} within ±5 bpm")
    a1.set_xlabel("prediction error (bpm), |error| ≤ 10 shown"); a1.set_ylabel("share of test windows")
    a1.set_ylim(0, a1.get_ylim()[1] * 1.45)  # headroom so the legend clears the bars
    a1.set_title("Error distribution"); a1.legend(fontsize=7.5, loc="upper right")
    pb = preds["bilstm"] * sd + mu
    hb = a2.hexbin(act, pb, gridsize=60, cmap=SEQ, mincnt=1, bins="log", linewidths=0)
    lo, hi = np.percentile(act, [0.2, 99.8])
    a2.plot([lo, hi], [lo, hi], color=INK2, lw=1, ls="--")
    a2.set_xlim(lo, hi); a2.set_ylim(lo, hi)
    a2.set_xlabel("actual HR (bpm)"); a2.set_ylabel("Bi-LSTM predicted HR (bpm)")
    a2.set_title(f"Bi-LSTM predicted vs actual, R² {metrics['bilstm']['r2']:.3f}")
    fig.colorbar(hb, ax=a2, fraction=0.046, label="windows (log)")
    save(fig, out, "fig_eval_forecast_residuals.png")

    # learning curves (train + val) parsed from the training log, if present
    log = os.path.join(res, "train_log.txt")
    if os.path.exists(log):
        rows = re.findall(r"epoch (\d+)/(\d+)\s+train ([\d.]+)\s+val ([\d.]+)", open(log, encoding="utf-8", errors="ignore").read())
        E = int(rows[0][1]) if rows else 0
        if len(rows) >= 2 * E > 0:
            fig, ax = plt.subplots(figsize=(6.4, 3.3))
            for j, k in enumerate(["lstm", "bilstm"]):
                r = rows[j * E:(j + 1) * E]
                ep = [int(x[0]) for x in r]
                ax.plot(ep, [float(x[2]) for x in r], color=colors[k], ls="--", lw=1.5, label=f"{names[k]} train")
                ax.plot(ep, [float(x[3]) for x in r], color=colors[k], marker="o", ms=4, label=f"{names[k]} validation")
            ax.set_xlabel("epoch"); ax.set_ylabel("MSE (standardized HR)")
            ax.set_title("HR forecaster learning curves"); ax.legend(fontsize=8, ncol=2)
            save(fig, out, "fig_eval_forecast_learning.png")

    return {"test_n": int(len(yte)), "std_bpm": round(sd, 2), "models": metrics}


# ---------------------------------------------------------------- sleep LSTM
def train_sleep_lstm(Xtr, ytr, n_classes, epochs=40, batch=128, seed=42):
    torch.manual_seed(seed)
    counts = np.bincount(ytr, minlength=n_classes)
    w = torch.tensor(len(ytr) / (n_classes * np.maximum(counts, 1)), dtype=torch.float32, device=DEVICE)
    m = SleepLSTM(n_classes).to(DEVICE)
    opt = torch.optim.Adam(m.parameters(), 1e-3); lossf = nn.CrossEntropyLoss(weight=w)
    dl = torch.utils.data.DataLoader(torch.utils.data.TensorDataset(torch.tensor(Xtr), torch.tensor(ytr)), batch_size=batch, shuffle=True)
    for _ in range(epochs):
        m.train()
        for xb, yb in dl:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            opt.zero_grad(); lossf(m(xb), yb).backward(); opt.step()
    return m.eval()


def cls_report(y, p, n):
    pr, rc, f1, sup = precision_recall_fscore_support(y, p, labels=list(range(n)), zero_division=0)
    return {"acc": round(float(accuracy_score(y, p)), 4), "macro_f1": round(float(f1_score(y, p, average="macro", zero_division=0)), 4),
            "balanced_acc": round(float(balanced_accuracy_score(y, p)), 4),
            "per_class": {SLEEP_CLASSES[i]: {"precision": round(float(pr[i]), 3), "recall": round(float(rc[i]), 3),
                                             "f1": round(float(f1[i]), 3), "support": int(sup[i])} for i in range(n)}}


def eval_sleep(fused, res, out):
    X, y, classes = sleep_windows(fused, L=10)
    n = len(classes)
    rng = np.random.default_rng(42)
    perm = rng.permutation(len(X)); cut = int(0.8 * len(X)); te = perm[cut:]
    m = load_model(SleepLSTM(n), os.path.join(res, "sleep_lstm.pt"))
    with torch.no_grad():
        p = m(torch.tensor(X[te], device=DEVICE)).argmax(1).cpu().numpy()
    rand = cls_report(y[te], p, n)
    cm = confusion_matrix(y[te], p, labels=list(range(n)))
    maj = int(np.bincount(y[perm[:cut]]).argmax())
    majority = cls_report(y[te], np.full(len(te), maj), n)

    # stricter check: chronological split (train on the first 80% of time, test on the last 20%),
    # so overlapping windows can never sit on both sides of the split
    c = int(0.8 * len(X)); L = 10
    mc = train_sleep_lstm(X[:c - L], y[:c - L], n)
    with torch.no_grad():
        pc = mc(torch.tensor(X[c:], device=DEVICE)).argmax(1).cpu().numpy()
    chrono = cls_report(y[c:], pc, n)
    chrono_majority = cls_report(y[c:], np.full(len(X) - c, int(np.bincount(y[:c - L]).argmax())), n)

    # row-normalized confusion matrix
    cmn = cm / cm.sum(1, keepdims=True).clip(min=1)
    fig, ax = plt.subplots(figsize=(4.8, 4.2))
    im = ax.imshow(cmn, cmap=SEQ, vmin=0, vmax=1); ax.grid(False)
    for i in range(n):
        for j in range(n):
            ax.text(j, i, f"{cmn[i, j]:.2f}\n({cm[i, j]})", ha="center", va="center", fontsize=8.5,
                    color="white" if cmn[i, j] > 0.55 else INK)
    ax.set_xticks(range(n), classes); ax.set_yticks(range(n), classes)
    ax.set_xlabel("predicted stage"); ax.set_ylabel("true stage")
    ax.set_title(f"Sleep LSTM, recall per stage (acc {rand['acc']:.2f})")
    fig.colorbar(im, ax=ax, fraction=0.046, label="share of true stage")
    save(fig, out, "fig_eval_sleep_confusion_norm.png")

    # per-class P/R/F1 + split comparison
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(9.6, 3.5), gridspec_kw={"width_ratios": [1.35, 1]})
    x = np.arange(n); wdt = 0.26
    for k, (key, col) in enumerate([("precision", BLUE), ("recall", ORANGE), ("f1", AQUA)]):
        a1.bar(x + (k - 1) * wdt, [rand["per_class"][c][key] for c in classes], wdt * 0.92, color=col, label=key.upper() if key == "f1" else key.capitalize())
    a1.set_xticks(x, [f"{c}\n(n={rand['per_class'][c]['support']})" for c in classes]); a1.set_ylim(0, 1.05)
    a1.set_title("Per-stage scores, random split"); a1.legend(fontsize=8, ncol=3, loc="upper right")
    groups = [("Majority\nbaseline", majority, GRAY), ("LSTM\nrandom split", rand, BLUE), ("LSTM\nchronological", chrono, ORANGE)]
    xx = np.arange(2)
    for k, (lab, r, col) in enumerate(groups):
        vals = [r["acc"], r["macro_f1"]]
        a2.bar(xx + (k - 1) * 0.27, vals, 0.25, color=col, label=lab.replace("\n", " "))
        for xi, v in zip(xx, vals):
            a2.text(xi + (k - 1) * 0.27, v + 0.015, f"{v:.2f}", ha="center", fontsize=8, color=INK2)
    a2.set_xticks(xx, ["accuracy", "macro-F1"]); a2.set_ylim(0, 1.05)
    a2.set_title("Against baseline and a stricter split"); a2.legend(fontsize=7.5, loc="upper right")
    save(fig, out, "fig_eval_sleep_scores.png")

    return {"random_split": rand, "random_split_majority_baseline": majority,
            "chronological_split": chrono, "chronological_majority_baseline": chrono_majority,
            "confusion_random_split": cm.tolist()}


# ---------------------------------------------------------------- transitions
def eval_transitions(sleep, res):
    tr = json.load(open(os.path.join(res, "transitions.json")))
    seq = [s for s in sleep.level.tolist()]
    pairs = [(a, b) for a, b in zip(seq, seq[1:]) if a in SLEEP_CLASSES and b in SLEEP_CLASSES]
    persist = sum(a == b for a, b in pairs) / max(1, len(pairs))
    changes = [(a, b) for a, b in pairs if a != b]
    M = np.array(tr["markov"])
    # how well the chain ranks the destination when the stage actually changes
    si = {s: i for i, s in enumerate(SLEEP_CLASSES)}
    hit = 0
    for a, b in changes:
        row = M[si[a]].copy(); row[si[a]] = -1
        hit += int(SLEEP_CLASSES[int(row.argmax())] == b)
    return {"markov_next_step_acc": tr["next_step_acc"], "persistence_baseline_acc": round(persist, 4),
            "n_pairs": len(pairs), "n_stage_changes": len(changes),
            "markov_top1_destination_given_change": round(hit / max(1, len(changes)), 4)}


# ---------------------------------------------------------------- GAN fidelity
def eval_gan_fidelity(fused, res, out):
    cfg = json.load(open(os.path.join(res, "gan_config.json")))
    stats, T, classes = cfg["stats"], cfg["T"], cfg["classes"]
    train_gan.ZDIM = cfg["zdim"]
    G = load_model(Generator(cfg["zdim"], len(classes), T), os.path.join(res, "gan_generator.pt"))
    Xw, Cw, _, _ = gan_windows(fused, T=T)
    rb = np.clip(Xw[:, :, 0] * stats["bsd"] + stats["bmu"], 35, 180)
    rs = np.clip(Xw[:, :, 1] * stats["ssd"] + stats["smu"], 70, 100)
    np.random.seed(0); torch.manual_seed(0)
    fid, syn = {}, {}
    for ci, c in enumerate(classes):
        _, _, sb, ss = train_gan.synth(G, ci, 2000, stats, T)
        syn[c] = (sb, ss)
        m = Cw == ci
        fid[c] = {
            "real_windows": int(m.sum()),
            "bpm_mean_real": round(float(rb[m].mean()), 2), "bpm_mean_synth": round(float(sb.mean()), 2),
            "bpm_std_real": round(float(rb[m].std()), 2), "bpm_std_synth": round(float(sb.std()), 2),
            "spo2_mean_real": round(float(rs[m].mean()), 2), "spo2_mean_synth": round(float(ss.mean()), 2),
            "bpm_wasserstein": round(float(wasserstein_distance(rb[m].ravel(), sb.ravel())), 3),
            "spo2_wasserstein": round(float(wasserstein_distance(rs[m].ravel(), ss.ravel())), 3),
            "abs_minute_change_real": round(float(np.abs(np.diff(rb[m], axis=1)).mean()), 3),
            "abs_minute_change_synth": round(float(np.abs(np.diff(sb, axis=1)).mean()), 3),
        }

    # train-on-synthetic / test-on-real (TSTR) vs train-on-real / test-on-real (TRTR), window level,
    # chronological split so overlapping real windows never cross it
    feats = lambda b, s: np.concatenate([b, s, b.mean(1, keepdims=True), b.std(1, keepdims=True), s.mean(1, keepdims=True)], 1)
    Freal = feats(rb, rs); cut = int(0.8 * len(Freal))
    Ftr, ytr, Fte, yte = Freal[:cut - T], Cw[:cut - T], Freal[cut:], Cw[cut:]
    counts = np.bincount(ytr, minlength=len(classes))
    np.random.seed(1); torch.manual_seed(1)
    Fs, ys = [], []
    for ci in range(len(classes)):
        _, _, sb, ss = train_gan.synth(G, ci, int(max(counts[ci], 1)), stats, T)
        Fs.append(feats(sb, ss)); ys.append(np.full(len(sb), ci))
    rf = lambda: RandomForestClassifier(n_estimators=200, max_depth=16, random_state=42, n_jobs=-1, class_weight="balanced")
    p_trtr = rf().fit(Ftr, ytr).predict(Fte)
    p_tstr = rf().fit(np.concatenate(Fs), np.concatenate(ys)).predict(Fte)
    tstr = {k: {"macro_f1": round(float(f1_score(yte, p, average="macro", zero_division=0)), 4),
                "balanced_acc": round(float(balanced_accuracy_score(yte, p)), 4),
                "acc": round(float(accuracy_score(yte, p)), 4)} for k, p in [("train_real", p_trtr), ("train_synthetic", p_tstr)]}

    # distributions per stage, real vs synthetic
    fig, axs = plt.subplots(2, 4, figsize=(11, 4.9))
    for ci, c in enumerate(classes):
        m = Cw == ci
        for row, (r, s, lab, bins) in enumerate([(rb[m], syn[c][0], "HR (bpm)", np.linspace(40, 110, 50)),
                                                 (rs[m], syn[c][1], "SpO₂ (%)", np.linspace(84, 100, 40))]):
            ax = axs[row, ci]
            ax.hist(r.ravel(), bins=bins, density=True, color=BLUE, alpha=0.35, label="real")
            ax.hist(s.ravel(), bins=bins, density=True, histtype="step", lw=1.8, color=ORANGE, label="GAN")
            ax.set_yticks([]); ax.set_xlabel(lab)
            if row == 0:
                ax.set_title(f"{c} (n={int(m.sum())} windows)")
            if ci == 0 and row == 0:
                ax.legend(fontsize=8)
    fig.suptitle("Conditional WGAN-GP: real vs synthetic distributions per sleep stage", fontweight="bold", fontsize=10.5)
    save(fig, out, "fig_eval_gan_distributions.png")

    # example sequences per stage
    fig, axs = plt.subplots(1, 4, figsize=(11, 2.9), sharey=True)
    rng = np.random.default_rng(3)
    for ci, c in enumerate(classes):
        ax = axs[ci]; idx = np.where(Cw == ci)[0]
        for k, j in enumerate(rng.choice(idx, 4, replace=False)):
            ax.plot(rb[j], color=BLUE, lw=1.2, alpha=0.8, label="real" if k == 0 else None)
        for k in range(4):
            ax.plot(syn[c][0][k], color=ORANGE, lw=1.2, alpha=0.9, ls="--", label="GAN" if k == 0 else None)
        ax.set_title(c); ax.set_xlabel("minute")
    axs[0].set_ylabel("HR (bpm)"); axs[0].legend(fontsize=8)
    fig.suptitle("16-minute HR sequences: real (solid) vs GAN (dashed)", fontweight="bold", fontsize=10.5)
    save(fig, out, "fig_eval_gan_examples.png")
    return {"per_stage": fid, "tstr": tstr}, G, stats, T, classes


# ---------------------------------------------------------------- augmentation study
def eval_augmentation(fused, G, stats, T, classes, out):
    enc = {c: i for i, c in enumerate(classes)}
    f = fused[fused.level.isin(classes)]
    Xr = np.stack([f.bpm.values, f.spo2_value.values, f.ts.dt.hour.values / 24.0], 1).astype("float32")
    yr = f.level.map(enc).values
    Xtr, Xte, ytr, yte = train_test_split(Xr, yr, test_size=0.2, random_state=42, stratify=yr)  # same split as train_gan.py
    freq = np.bincount(yr, minlength=len(classes)) / len(yr)
    minority = [i for i in range(len(classes)) if freq[i] < 0.15]
    counts = np.bincount(ytr, minlength=len(classes)); n_major = int(counts.max())

    def fit_eval(Xa, ya, cw=None):
        p = RandomForestClassifier(n_estimators=200, max_depth=16, random_state=42, n_jobs=-1, class_weight=cw).fit(Xa, ya).predict(Xte)
        rec = recall_score(yte, p, labels=list(range(len(classes))), average=None, zero_division=0)
        return {"acc": float(accuracy_score(yte, p)), "macro_f1": float(f1_score(yte, p, average="macro", zero_division=0)),
                "balanced_acc": float(balanced_accuracy_score(yte, p)),
                **{f"recall_{classes[i]}": float(rec[i]) for i in range(len(classes))}}

    def gan_aug(rows_per_class, seed):
        np.random.seed(seed); torch.manual_seed(seed)
        Xa, ya = [Xtr], [ytr]
        for ci in minority:
            need = rows_per_class(ci)
            if need <= 0:
                continue
            fx, fy, _, _ = train_gan.synth(G, ci, math.ceil(need / T), stats, T)
            Xa.append(fx[:need]); ya.append(fy[:need])
        return np.concatenate(Xa), np.concatenate(ya)

    def agg(runs):
        return {k: {"mean": round(float(np.mean([r[k] for r in runs])), 4), "std": round(float(np.std([r[k] for r in runs])), 4)} for k in runs[0]}

    one = lambda r: {k: {"mean": round(v, 4), "std": 0.0} for k, v in r.items()}
    methods = {"real_only": one(fit_eval(Xtr, ytr)),
               "class_weighted": one(fit_eval(Xtr, ytr, cw="balanced"))}
    Xs, ys = SMOTE(random_state=42, sampling_strategy={ci: n_major for ci in minority}).fit_resample(Xtr, ytr)
    methods["smote_parity"] = one(fit_eval(Xs, ys))
    methods["gan_parity"] = agg([fit_eval(*gan_aug(lambda ci: n_major - counts[ci], s)) for s in SEEDS])
    methods["gan_default_3000"] = agg([fit_eval(*gan_aug(lambda ci: 3000 * T, s)) for s in SEEDS])

    levels = [0, 25, 50, 100, 200, 400, 800, 1600, 3000]
    sweep = []
    for L in levels:
        runs = [fit_eval(Xtr, ytr)] if L == 0 else [fit_eval(*gan_aug(lambda ci: L * T, s)) for s in SEEDS]
        sweep.append({"sequences_per_class": L, "rows_per_class": L * T, **agg(runs)})
        print(f"    sweep {L:5d} seq/class  macroF1 {sweep[-1]['macro_f1']['mean']:.3f}  acc {sweep[-1]['acc']['mean']:.3f}")

    mn = [classes[i] for i in minority]
    labels = {"real_only": "Real only", "class_weighted": "Class-weighted RF", "smote_parity": "SMOTE (to parity)",
              "gan_parity": "GAN (to parity)", "gan_default_3000": "GAN (3000 seq/class)"}
    colors = {"real_only": GRAY, "class_weighted": BLUE, "smote_parity": AQUA, "gan_parity": ORANGE, "gan_default_3000": YELLOW}
    metrics_shown = [f"recall_{c}" for c in mn] + ["macro_f1", "balanced_acc", "acc"]
    mlabels = [f"{c} recall" for c in mn] + ["macro-F1", "balanced acc", "accuracy"]
    fig, ax = plt.subplots(figsize=(10, 3.9))
    x = np.arange(len(metrics_shown)); keys = list(labels); wdt = 0.16
    for k, key in enumerate(keys):
        ax.bar(x + (k - 2) * wdt, [methods[key][m]["mean"] for m in metrics_shown], wdt * 0.9,
               yerr=[methods[key][m]["std"] for m in metrics_shown], capsize=2, error_kw={"lw": 0.8, "ecolor": INK2},
               color=colors[key], label=labels[key])
    ax.set_xticks(x, mlabels); ax.set_ylim(0, 1.0)
    ax.set_title("Minority-class augmentation: GAN vs SMOTE vs baselines (RandomForest, held-out real test set)")
    ax.legend(fontsize=8, ncol=5, loc="upper center", bbox_to_anchor=(0.5, -0.1))
    save(fig, out, "fig_eval_aug_methods.png")

    fig, ax = plt.subplots(figsize=(7.4, 3.9))
    xs = np.arange(len(levels))
    for key, lab, col in [("macro_f1", "macro-F1", BLUE)] + [(f"recall_{c}", f"{c} recall", cc) for c, cc in zip(mn, [ORANGE, AQUA])] + [("acc", "accuracy", YELLOW)]:
        mean = np.array([s[key]["mean"] for s in sweep]); sd = np.array([s[key]["std"] for s in sweep])
        ax.plot(xs, mean, marker="o", ms=4.5, color=col, label=lab)
        ax.fill_between(xs, mean - sd, mean + sd, color=col, alpha=0.15, lw=0)
    par = np.mean([(n_major - counts[ci]) / T for ci in minority])
    ax.axvline(np.interp(par, levels, xs), color=INK2, lw=1, ls=":")
    ax.text(np.interp(par, levels, xs) + 0.08, 0.97, f"parity ≈ {par:.0f}", fontsize=8, color=INK2, va="top")
    ax.set_xticks(xs, [str(L) for L in levels]); ax.set_ylim(0, 1.0)
    ax.set_xlabel(f"synthetic sequences added per minority class (×{T} rows each)")
    ax.set_title("How much synthetic data helps (mean ± sd over 3 seeds)"); ax.legend(fontsize=8, ncol=2)
    save(fig, out, "fig_eval_aug_sweep.png")

    return {"minority_classes": mn, "train_counts": {classes[i]: int(counts[i]) for i in range(len(classes))},
            "test_n": int(len(yte)), "seeds": SEEDS, "methods": methods, "sweep": sweep}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--src", default="./EDT-Datasets")
    p.add_argument("--res", default="./results")
    a = p.parse_args()
    out = os.path.join(a.res, "eval"); os.makedirs(out, exist_ok=True)
    print(f"[eval] device={DEVICE}")
    hr, fused, sleep = load_all(a.src)
    R = {"device": DEVICE}
    print("[eval] forecaster ..."); R["forecaster"] = eval_forecaster(hr, a.res, out)
    print("[eval] sleep LSTM ..."); R["sleep"] = eval_sleep(fused, a.res, out)
    print("[eval] transitions ..."); R["transitions"] = eval_transitions(sleep, a.res)
    print("[eval] GAN fidelity ..."); R["gan_fidelity"], G, stats, T, classes = eval_gan_fidelity(fused, a.res, out)
    print("[eval] augmentation study ..."); R["augmentation"] = eval_augmentation(fused, G, stats, T, classes, out)
    json.dump(R, open(os.path.join(out, "eval_metrics.json"), "w"), indent=2)
    print(json.dumps({"forecaster": R["forecaster"]["models"], "sleep_acc": R["sleep"]["random_split"]["acc"],
                      "sleep_chrono_acc": R["sleep"]["chronological_split"]["acc"], "transitions": R["transitions"],
                      "tstr": R["gan_fidelity"]["tstr"],
                      "aug": {k: {m: v[m]["mean"] for m in ("macro_f1", "acc")} for k, v in R["augmentation"]["methods"].items()}}, indent=2))
    print(f"[eval] figures + eval_metrics.json in {out}/")


if __name__ == "__main__":
    main()
