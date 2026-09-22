"""Conditional WGAN-GP that synthesises per-stage (bpm, spo2) sequences, plus a
real augmentation experiment: does synthetic minority data improve a classifier?

This is CareTwin's core contribution over the base paper (which used only SMOTE)."""
import os, json, argparse
import numpy as np
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, recall_score

from data import load_all, gan_windows, SLEEP_CLASSES
from models import Generator, Discriminator, gradient_penalty

DEVICE = "cpu" if os.environ.get("CARETWIN_CPU") else ("cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu"))
ZDIM = 32


def train_gan(X, C, ncond, T, epochs, batch, n_critic=5, gp_lambda=10.0):
    G = Generator(ZDIM, ncond, T).to(DEVICE)
    D = Discriminator(ncond, T).to(DEVICE)
    og = torch.optim.Adam(G.parameters(), 1e-4, betas=(0.5, 0.9))
    od = torch.optim.Adam(D.parameters(), 1e-4, betas=(0.5, 0.9))
    Xt = torch.tensor(X, device=DEVICE); Ct = torch.tensor(C, device=DEVICE)
    N = len(Xt); hist = []
    for ep in range(epochs):
        perm = torch.randperm(N, device=DEVICE)
        dloss = gloss = 0.0; steps = 0
        for i in range(0, N - batch, batch):
            idx = perm[i:i + batch]; real = Xt[idx]; c = Ct[idx]
            # critic
            for _ in range(n_critic):
                z = torch.randn(real.size(0), ZDIM, device=DEVICE)
                fake = G(z, c).detach()
                gp = gradient_penalty(D, real, fake, c, DEVICE)
                ld = D(fake, c).mean() - D(real, c).mean() + gp_lambda * gp
                od.zero_grad(); ld.backward(); od.step()
            # generator
            z = torch.randn(real.size(0), ZDIM, device=DEVICE)
            lg = -D(G(z, c), c).mean()
            og.zero_grad(); lg.backward(); og.step()
            dloss += ld.item(); gloss += lg.item(); steps += 1
        hist.append({"epoch": ep + 1, "d_loss": dloss / max(1, steps), "g_loss": gloss / max(1, steps)})
        print(f"    epoch {ep+1}/{epochs}  D {hist[-1]['d_loss']:.3f}  G {hist[-1]['g_loss']:.3f}")
    return G, D, hist


def synth(G, cls, n, stats, T):
    G.eval()
    with torch.no_grad():
        z = torch.randn(n, ZDIM, device=DEVICE)
        c = torch.full((n,), cls, dtype=torch.long, device=DEVICE)
        seq = G(z, c).cpu().numpy()
    bpm = np.clip(seq[:, :, 0] * stats["bsd"] + stats["bmu"], 35, 180)
    spo2 = np.clip(seq[:, :, 1] * stats["ssd"] + stats["smu"], 70, 100)
    hours = np.random.uniform(0, 6, size=(n, T)) / 24.0
    feats = np.stack([bpm.reshape(-1), spo2.reshape(-1), hours.reshape(-1)], 1).astype("float32")
    return feats, np.full(feats.shape[0], cls), bpm, spo2


def main(a):
    os.makedirs(a.out, exist_ok=True)
    print(f"[gan] device={DEVICE}")
    _, fused, _ = load_all(a.src)
    X, C, classes, stats = gan_windows(fused, T=a.T)
    print(f"[gan] windows={len(X)} T={a.T} conditions={classes}")
    G, D, hist = train_gan(X, C, len(classes), a.T, a.epochs, a.batch)
    torch.save(G.state_dict(), os.path.join(a.out, "gan_generator.pt"))
    json.dump({"stats": stats, "classes": classes, "T": a.T, "zdim": ZDIM}, open(os.path.join(a.out, "gan_config.json"), "w"), indent=2)

    # ---- augmentation experiment (RandomForest, per-timestep) ----
    enc = {c: i for i, c in enumerate(classes)}
    f = fused[fused.level.isin(classes)]
    Xr = np.stack([f.bpm.values, f.spo2_value.values, f.ts.dt.hour.values / 24.0], 1).astype("float32")
    yr = f.level.map(enc).values
    Xtr, Xte, ytr, yte = train_test_split(Xr, yr, test_size=0.2, random_state=42, stratify=yr)
    freq = np.bincount(yr, minlength=len(classes)) / len(yr)
    minority = [i for i in range(len(classes)) if freq[i] < 0.15]

    rf = RandomForestClassifier(n_estimators=200, max_depth=16, random_state=42, n_jobs=-1).fit(Xtr, ytr)
    pr_b = rf.predict(Xte)
    acc_b = accuracy_score(yte, pr_b)
    rec_b = recall_score(yte, pr_b, labels=minority, average=None, zero_division=0)

    Xa, ya, samples = [Xtr], [ytr], {}
    for ci in minority:
        fx, fy, bpm, spo2 = synth(G, ci, a.synth, stats, a.T)
        Xa.append(fx); ya.append(fy); samples[classes[ci]] = (bpm, spo2)
    rf2 = RandomForestClassifier(n_estimators=200, max_depth=16, random_state=42, n_jobs=-1)
    rf2.fit(np.concatenate(Xa), np.concatenate(ya))
    pr_a = rf2.predict(Xte)
    acc_a = accuracy_score(yte, pr_a)
    rec_a = recall_score(yte, pr_a, labels=minority, average=None, zero_division=0)

    aug = {
        "minority_classes": [classes[i] for i in minority],
        "recall_before": {classes[minority[k]]: round(float(rec_b[k]), 3) for k in range(len(minority))},
        "recall_after": {classes[minority[k]]: round(float(rec_a[k]), 3) for k in range(len(minority))},
        "acc_before": round(float(acc_b), 3), "acc_after": round(float(acc_a), 3),
        "synth_per_class": a.synth,
    }
    json.dump({"loss": hist, "augmentation": aug}, open(os.path.join(a.out, "gan_metrics.json"), "w"), indent=2)

    # figures
    plt.figure(figsize=(6, 3.2))
    plt.plot([h["epoch"] for h in hist], [h["d_loss"] for h in hist], label="critic")
    plt.plot([h["epoch"] for h in hist], [h["g_loss"] for h in hist], label="generator")
    plt.xlabel("epoch"); plt.ylabel("loss"); plt.title("Conditional WGAN-GP training"); plt.legend()
    plt.tight_layout(); plt.savefig(os.path.join(a.out, "fig_gan_loss.png"), dpi=140); plt.close()

    if samples:
        k = list(samples.keys())[0]; bpm, spo2 = samples[k]
        plt.figure(figsize=(6, 3.2))
        for r in range(min(6, len(bpm))):
            plt.plot(bpm[r], color="#0E8A7D", alpha=0.6, lw=1)
        plt.xlabel("minute"); plt.ylabel("synthetic bpm"); plt.title(f"Synthetic '{k}' HR sequences (generator)")
        plt.tight_layout(); plt.savefig(os.path.join(a.out, "fig_gan_samples.png"), dpi=140); plt.close()

    labels = aug["minority_classes"]; x = np.arange(len(labels))
    plt.figure(figsize=(5.4, 3.4))
    plt.bar(x - 0.2, [aug["recall_before"][c] for c in labels], 0.4, label="real only", color="#8391A2")
    plt.bar(x + 0.2, [aug["recall_after"][c] for c in labels], 0.4, label="real + GAN", color="#35B8A6")
    plt.xticks(x, labels); plt.ylabel("recall"); plt.ylim(0, 1)
    plt.title(f"Minority recall (acc {acc_b:.2f} → {acc_a:.2f})"); plt.legend()
    plt.tight_layout(); plt.savefig(os.path.join(a.out, "fig_gan_augmentation.png"), dpi=140); plt.close()

    print(f"[gan] augmentation minority recall {list(aug['recall_before'].values())} -> {list(aug['recall_after'].values())}")
    return {"loss": hist, "augmentation": aug}


def parse():
    p = argparse.ArgumentParser()
    p.add_argument("--src", default="./EDT-Datasets")
    p.add_argument("--out", default="./results")
    p.add_argument("--epochs", type=int, default=300)
    p.add_argument("--batch", type=int, default=128)
    p.add_argument("--T", type=int, default=16)
    p.add_argument("--synth", type=int, default=3000)
    p.add_argument("--smoke", action="store_true")
    a = p.parse_args()
    if a.smoke:
        a.epochs, a.batch, a.synth = 3, 128, 200
    return a


if __name__ == "__main__":
    main(parse())
