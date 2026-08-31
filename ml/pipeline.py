#!/usr/bin/env python3
"""
CareTwin real-data pipeline.
Loads the base paper's EDT-Datasets (Momand et al., 2025), cleans/validates them,
reproduces the paper's EDA, trains a real Bi-LSTM HR forecaster and sleep-stage
models, computes Markov/Bayesian sleep transitions, and exports compact JSON
(real distributions, metrics, predictions, replay streams) for the web app.
"""
import json, time, warnings, math
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
np.random.seed(42)

import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get("EDT_SRC", os.path.join(HERE, "EDT-Datasets"))
OUT = os.environ.get("EDT_OUT", os.path.join(HERE, "..", "public", "data"))

def jsan(o):
    if isinstance(o, (np.integer,)): return int(o)
    if isinstance(o, (np.floating,)): return round(float(o), 5)
    if isinstance(o, np.ndarray): return o.tolist()
    if isinstance(o, dict): return {k: jsan(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [jsan(v) for v in o]
    return o

report = {}
t0 = time.time()

def norm_level(s):
    s = str(s).strip().lower()
    return {"awake": "wake", "asleep": None, "unknown": None, "nan": None}.get(s, s)

# ------------------------------------------------------------------ LOAD
print("Loading real datasets ...")
hr = pd.read_csv(f"{SRC}/Heart_rate_dataset.csv")
hr["ts"] = pd.to_datetime(hr["date"] + " " + hr["time"], format="%Y-%m-%d %H:%M:%S", errors="coerce")
hr = hr.dropna(subset=["ts", "bpm"]).sort_values("ts").reset_index(drop=True)
hr["bpm"] = pd.to_numeric(hr["bpm"], errors="coerce")
hr = hr.dropna(subset=["bpm"])
hr = hr[(hr.bpm >= 30) & (hr.bpm <= 220)]

fused = pd.read_csv(f"{SRC}/Spo2_heart_sleep_dataset.csv")
fused["ts"] = pd.to_datetime(fused["dateTime"], format="%m/%d/%y %H:%M", errors="coerce")
fused = fused.dropna(subset=["ts"]).sort_values("ts").reset_index(drop=True)

spo2 = pd.read_csv(f"{SRC}/SpO2_data.csv")
spo2["ts"] = pd.to_datetime(spo2["dateTime"], format="%m/%d/%Y %H:%M", errors="coerce")
spo2 = spo2.dropna(subset=["ts"])

hrsleep = pd.read_csv(f"{SRC}/Heartrate_sleep_data.csv")
hrsleep["ts"] = pd.to_datetime(hrsleep["dateTime"], format="%m/%d/%y %H:%M", errors="coerce")
hrsleep["level"] = hrsleep["level"].map(norm_level)
hrsleep = hrsleep.dropna(subset=["ts"])

with open(f"{SRC}/Sleep_data.json") as f:
    raw = f.read()
try:
    recs = json.loads(raw)
except json.JSONDecodeError:
    import re
    recs = [{"dateTime": d, "level": l} for d, l in
            re.findall(r'"dateTime"\s*:\s*"([^"]+)"\s*,\s*"level"\s*:\s*"([^"]+)"', raw)]
    print(f"  (sleep json truncated; recovered {len(recs)} records via regex)")
sleepjson = pd.DataFrame(recs)
sleepjson["ts"] = pd.to_datetime(sleepjson["dateTime"], errors="coerce")
sleepjson["level"] = sleepjson["level"].map(norm_level)
sleepjson = sleepjson.dropna(subset=["ts", "level"]).sort_values("ts").reset_index(drop=True)

# ------------------------------------------------------------------ CLEAN / VALIDATE (paper's DataOps)
spo2_raw_n = len(spo2)
spo2["spo2_value"] = pd.to_numeric(spo2["spo2_value"], errors="coerce")
spo2_valid = spo2[(spo2.spo2_value >= 70) & (spo2.spo2_value <= 100)].copy()  # physiological range check
spo2_removed = spo2_raw_n - len(spo2_valid)

fused["spo2_value"] = pd.to_numeric(fused["spo2_value"], errors="coerce")
fused["bpm"] = pd.to_numeric(fused["bpm"], errors="coerce")
fused["level"] = fused["level"].map(norm_level)
fused_clean = fused[(fused.spo2_value >= 70) & (fused.spo2_value <= 100) & fused.bpm.between(30, 220)].dropna(subset=["bpm", "spo2_value", "level"]).copy()

report["dataset"] = {
    "source": "Momand et al., IEEE Access 2025 — EDT-Datasets (github.com/mommand/EDT-Datasets)",
    "device": "Fitbit Sense 2",
    "hr_records": len(hr),
    "hr_date_start": str(hr.ts.min().date()), "hr_date_end": str(hr.ts.max().date()),
    "hr_cadence_sec": int(hr.ts.diff().dt.total_seconds().median()),
    "spo2_records_raw": spo2_raw_n, "spo2_records_valid": len(spo2_valid),
    "spo2_artifacts_removed": spo2_removed,
    "spo2_artifact_pct": round(100 * spo2_removed / spo2_raw_n, 1),
    "fused_records": len(fused_clean),
    "sleep_minutes": len(sleepjson),
}
print("  HR:", len(hr), "| SpO2 valid:", len(spo2_valid), "removed", spo2_removed,
      "| fused:", len(fused_clean), "| sleep min:", len(sleepjson))

# ------------------------------------------------------------------ EDA
def hist(series, lo, hi, bins):
    c, edges = np.histogram(series.dropna(), bins=bins, range=(lo, hi))
    centers = (edges[:-1] + edges[1:]) / 2
    return {"centers": [round(float(x), 1) for x in centers], "counts": [int(v) for v in c]}

eda = {}
eda["hr_overall"] = hist(hr.bpm, 40, 160, 40)
eda["hr_summary"] = {"mean": hr.bpm.mean(), "median": hr.bpm.median(),
                     "p5": hr.bpm.quantile(.05), "p95": hr.bpm.quantile(.95),
                     "min": hr.bpm.min(), "max": hr.bpm.max()}

# HR by sleep vs awake (from hr+sleep minute data)
hrsleep["bpm"] = pd.to_numeric(hrsleep["bpm"], errors="coerce")
hrsleep2 = hrsleep.dropna(subset=["bpm", "level"])
asleep = hrsleep2[hrsleep2.level != "wake"].bpm
awake = hrsleep2[hrsleep2.level == "wake"].bpm
eda["hr_sleep_vs_wake"] = {
    "sleep": hist(asleep, 40, 140, 34), "wake": hist(awake, 40, 140, 34),
    "sleep_mean": asleep.mean(), "wake_mean": awake.mean(),
}

# SpO2 distribution + hypoxemia severity (clinical thresholds from paper Table 9)
eda["spo2_hist"] = hist(spo2_valid.spo2_value, 80, 100, 40)
sv = spo2_valid.spo2_value
eda["spo2_severity"] = {
    "normal>=95": int((sv >= 95).sum()),
    "mild 90-94": int(((sv >= 90) & (sv < 95)).sum()),
    "moderate 88-89": int(((sv >= 88) & (sv < 90)).sum()),
    "severe <88": int((sv < 88).sum()),
}

# Sleep stage class distribution (from sleep json)
sd = sleepjson.level.value_counts()
eda["sleep_dist"] = {k: int(v) for k, v in sd.items()}
eda["sleep_dist_pct"] = {k: round(100 * v / sd.sum(), 1) for k, v in sd.items()}

# Correlation BPM / SpO2 / sleep level (paper Table 7)
lvl_order = {"deep": 0, "light": 1, "rem": 2, "restless": 3, "wake": 4}
fc = fused_clean.copy()
fc["level_code"] = fc.level.map(lvl_order)
fc = fc.dropna(subset=["level_code"])
corr = fc[["bpm", "spo2_value", "level_code"]].corr(method="pearson")
eda["correlation"] = {"labels": ["BPM", "SpO2", "SleepLevel"],
                      "matrix": [[round(float(corr.iloc[i, j]), 2) for j in range(3)] for i in range(3)]}
report["eda"] = eda
print("  EDA done. sleep dist:", eda["sleep_dist_pct"])

# ------------------------------------------------------------------ HR FORECAST: real LSTM vs Bi-LSTM
import torch, torch.nn as nn
torch.manual_seed(42)
print("Training HR forecasters (real LSTM vs Bi-LSTM) ...")

series = hr.bpm.values.astype(np.float32)
# standardize (paper trains on normalized data)
mu, sd_ = series.mean(), series.std()
z = (series - mu) / sd_
W = 32
MAXW = 120000
# build contiguous windows, cap for CPU speed
N = len(z) - W - 1
idx = np.arange(N)
if N > MAXW:
    idx = np.sort(np.random.choice(N, MAXW, replace=False))
X = np.stack([z[i:i + W] for i in idx]).astype(np.float32)[:, :, None]
y = z[idx + W].astype(np.float32)
# temporal split 80/20
cut = int(len(X) * 0.8)
Xtr, Xte = torch.tensor(X[:cut]), torch.tensor(X[cut:])
ytr, yte = torch.tensor(y[:cut]), torch.tensor(y[cut:])
report["hr_model"] = {"window": W, "train_n": int(cut), "test_n": int(len(X) - cut), "std_bpm": round(float(sd_), 2), "mean_bpm": round(float(mu), 2)}

class Fore(nn.Module):
    def __init__(self, bi):
        super().__init__()
        self.lstm = nn.LSTM(1, 64, num_layers=2, batch_first=True, dropout=0.2, bidirectional=bi)
        self.fc = nn.Linear(64 * (2 if bi else 1), 1)
    def forward(self, x):
        o, _ = self.lstm(x)
        return self.fc(o[:, -1, :]).squeeze(-1)

def train_eval(bi, name):
    m = Fore(bi); opt = torch.optim.Adam(m.parameters(), 1e-3); lossf = nn.MSELoss()
    ds = torch.utils.data.TensorDataset(Xtr, ytr)
    dl = torch.utils.data.DataLoader(ds, batch_size=512, shuffle=True)
    for ep in range(6):
        m.train()
        for xb, yb in dl:
            opt.zero_grad(); l = lossf(m(xb), yb); l.backward(); opt.step()
    m.eval()
    with torch.no_grad():
        pred = m(Xte)
        mse = float(((pred - yte) ** 2).mean())
        mae = float((pred - yte).abs().mean())
        rmse_bpm = float(math.sqrt(mse) * sd_)
    print(f"    {name}: MSE={mse:.4f} MAE={mae:.4f} RMSE={rmse_bpm:.2f} bpm")
    return m, mse, mae, rmse_bpm, pred.numpy()

lstm_m, lstm_mse, lstm_mae, lstm_rmse, lstm_pred = train_eval(False, "LSTM")
bi_m, bi_mse, bi_mae, bi_rmse, bi_pred = train_eval(True, "Bi-LSTM")

report["hr_model"].update({
    "lstm": {"mse": round(lstm_mse, 4), "mae": round(lstm_mae, 4), "rmse_bpm": round(lstm_rmse, 2)},
    "bilstm": {"mse": round(bi_mse, 4), "mae": round(bi_mae, 4), "rmse_bpm": round(bi_rmse, 2)},
    "paper_bilstm": {"mse": 0.2944, "mae": 0.3410},
})
# actual-vs-pred sample for chart (real held-out test, a contiguous slice)
s0 = 0
sample = slice(s0, s0 + 220)
report["hr_model"]["sample"] = {
    "actual": [round(float(v), 3) for v in yte.numpy()[sample]],
    "lstm": [round(float(v), 3) for v in lstm_pred[sample]],
    "bilstm": [round(float(v), 3) for v in bi_pred[sample]],
    "actual_bpm": [round(float(v * sd_ + mu), 1) for v in yte.numpy()[sample]],
    "bilstm_bpm": [round(float(v * sd_ + mu), 1) for v in bi_pred[sample]],
}

# ------------------------------------------------------------------ SLEEP STAGE classification
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix
from imblearn.over_sampling import SMOTE
print("Training sleep-stage classifier (real) ...")

fc2 = fused_clean.copy()
fc2["hour"] = fc2.ts.dt.hour + fc2.ts.dt.minute / 60.0
classes = ["deep", "light", "rem", "wake", "restless"]
fc2 = fc2[fc2.level.isin(classes)]
Xs = fc2[["bpm", "spo2_value", "hour"]].values
ys = fc2.level.values
Xtr2, Xte2, ytr2, yte2 = train_test_split(Xs, ys, test_size=0.2, random_state=42, stratify=ys)

rf = RandomForestClassifier(n_estimators=200, max_depth=16, random_state=42, n_jobs=-1)
rf.fit(Xtr2, ytr2)
pr = rf.predict(Xte2)
acc = accuracy_score(yte2, pr); f1m = f1_score(yte2, pr, average="macro")
present = [c for c in classes if c in np.unique(np.concatenate([yte2, pr]))]
cm = confusion_matrix(yte2, pr, labels=present)
print(f"    RandomForest: acc={acc:.3f} macroF1={f1m:.3f}")

# SMOTE augmentation effect (stand-in for the GAN-augmentation argument)
minority = fc2.level.value_counts().idxmin()
try:
    sm = SMOTE(random_state=42, k_neighbors=3)
    Xtr_s, ytr_s = sm.fit_resample(Xtr2, ytr2)
    rf2 = RandomForestClassifier(n_estimators=200, max_depth=16, random_state=42, n_jobs=-1)
    rf2.fit(Xtr_s, ytr_s)
    pr2 = rf2.predict(Xte2)
    rec_before = ((pr == minority) & (yte2 == minority)).sum() / max(1, (yte2 == minority).sum())
    rec_after = ((pr2 == minority) & (yte2 == minority)).sum() / max(1, (yte2 == minority).sum())
    acc2 = accuracy_score(yte2, pr2)
except Exception as e:
    rec_before = rec_after = acc2 = 0; print("    SMOTE skipped:", e)

# temporal-context model: add rolling physiological features (recent trend), no label leakage
present_seq = [c for c in classes if c in fc2.level.unique()]
fcx = fc2.sort_values("ts").reset_index(drop=True)
fcx["bpm_roll"] = fcx.bpm.rolling(5, min_periods=1).mean()
fcx["spo2_roll"] = fcx.spo2_value.rolling(5, min_periods=1).mean()
fcx["bpm_d"] = fcx.bpm.diff().fillna(0)
fcx["spo2_d"] = fcx.spo2_value.diff().fillna(0)
Xt = fcx[["bpm", "spo2_value", "hour", "bpm_roll", "spo2_roll", "bpm_d", "spo2_d"]].values
yt = fcx.level.values
Xtr3, Xte3, ytr3, yte3 = train_test_split(Xt, yt, test_size=0.2, random_state=42, stratify=yt)
rf3 = RandomForestClassifier(n_estimators=300, max_depth=20, random_state=42, n_jobs=-1).fit(Xtr3, ytr3)
pr3 = rf3.predict(Xte3)
acc_t = accuracy_score(yte3, pr3); f1_t = f1_score(yte3, pr3, average="macro")
cm_t = confusion_matrix(yte3, pr3, labels=present_seq)
print(f"    Temporal RF: acc={acc_t:.3f} macroF1={f1_t:.3f}")

report["sleep_model"] = {
    "classes": present, "seq_classes": present_seq,
    "rf_instant_acc": round(float(acc), 3), "rf_instant_f1": round(float(f1m), 3),
    "rf_temporal_acc": round(float(acc_t), 3), "rf_temporal_f1": round(float(f1_t), 3),
    "confusion": cm_t.tolist(),
    "paper_lstm_acc": 0.92,
    "imbalance": {c: round(100 * (fc2.level == c).mean(), 1) for c in classes if c in fc2.level.unique()},
    "minority_class": minority,
    "smote": {"recall_before": round(float(rec_before), 3), "recall_after": round(float(rec_after), 3),
              "acc_before": round(float(acc), 3), "acc_after": round(float(acc2), 3)},
}
print(f"    SMOTE minority({minority}) recall: {rec_before:.2f} -> {rec_after:.2f}")

# ------------------------------------------------------------------ SLEEP TRANSITIONS (Markov + Bayesian)
print("Computing sleep transition matrices ...")
seq = sleepjson.level.tolist()
tstates = ["deep", "light", "rem", "wake"]
si = {s: i for i, s in enumerate(tstates)}
counts = np.zeros((4, 4))
for a, b in zip(seq, seq[1:]):
    if a in si and b in si:
        counts[si[a], si[b]] += 1
markov = counts / counts.sum(axis=1, keepdims=True).clip(min=1)
alpha = 5.0
bayes = (counts + alpha) / (counts.sum(axis=1, keepdims=True) + alpha * 4)
# next-step prediction accuracy from markov argmax
correct = tot = 0
for a, b in zip(seq, seq[1:]):
    if a in si and b in si:
        tot += 1
        if tstates[int(np.argmax(markov[si[a]]))] == b: correct += 1
report["transitions"] = {
    "states": tstates,
    "markov": [[round(float(x), 2) for x in row] for row in markov],
    "bayesian": [[round(float(x), 2) for x in row] for row in bayes],
    "next_step_acc": round(correct / max(1, tot), 3),
}

# ------------------------------------------------------------------ REAL REPLAY STREAMS for live monitor
print("Building real replay streams ...")
# a continuous fused night segment (bpm + spo2 + sleep) that contains a real low-SpO2 event
fc_sorted = fused_clean.sort_values("ts").reset_index(drop=True)
# find a window with a dip
best_start, best_min = 0, 100
seg_len = 300
for start in range(0, max(1, len(fc_sorted) - seg_len), 25):
    w = fc_sorted.spo2_value.iloc[start:start + seg_len]
    if w.min() < best_min:
        best_min, best_start = w.min(), start
seg = fc_sorted.iloc[best_start:best_start + seg_len]
monitor = {
    "bpm": [int(round(v)) for v in seg.bpm.values],
    "spo2": [round(float(v), 1) for v in seg.spo2_value.values],
    "level": list(seg.level.values),
    "start": str(seg.ts.iloc[0]), "min_spo2": round(float(best_min), 1),
}
# a continuous high-resolution HR segment (5s cadence) for the ECG/heart
hr_seg = hr[(hr.ts >= hr.ts.iloc[len(hr)//3]) ].head(720)  # ~1hr at 5s
monitor["hr_fine"] = [int(round(v)) for v in hr_seg.bpm.values]

# ------------------------------------------------------------------ WRITE
with open(f"{OUT}/analysis.json", "w") as f:
    json.dump(jsan(report), f, separators=(",", ":"))
with open(f"{OUT}/monitor.json", "w") as f:
    json.dump(jsan(monitor), f, separators=(",", ":"))

import os
print(f"\nWrote analysis.json ({os.path.getsize(OUT+'/analysis.json')//1024} KB) and monitor.json ({os.path.getsize(OUT+'/monitor.json')//1024} KB)")
print(f"Done in {time.time()-t0:.1f}s")
print("\n=== HEADLINE NUMBERS ===")
print("HR forecast  LSTM  MSE", report["hr_model"]["lstm"]["mse"], "| Bi-LSTM MSE", report["hr_model"]["bilstm"]["mse"], "(paper Bi-LSTM 0.2944)")
print("Sleep instant RF acc", report["sleep_model"]["rf_instant_acc"], "| +temporal ctx acc", report["sleep_model"]["rf_temporal_acc"], "(paper LSTM 0.92)")
print("Sleep transition next-step acc", report["transitions"]["next_step_acc"])
print("SpO2 artifacts removed", report["dataset"]["spo2_artifacts_removed"], f"({report['dataset']['spo2_artifact_pct']}%)")
