"""Shared data loading / cleaning / windowing for the CareTwin training package.

All models are trained on the base paper's published dataset:
Momand et al., IEEE Access 2025 — github.com/mommand/EDT-Datasets.
"""
import os, json, re
import numpy as np
import pandas as pd

SLEEP_CLASSES = ["deep", "light", "rem", "wake"]


def _norm_level(s):
    s = str(s).strip().lower()
    return {"awake": "wake", "asleep": None, "unknown": None, "nan": None}.get(s, s)


def load_all(src):
    """Load and validate HR, fused (BPM+SpO2+sleep) and sleep-stage records."""
    hr = pd.read_csv(os.path.join(src, "Heart_rate_dataset.csv"))
    hr["ts"] = pd.to_datetime(hr["date"] + " " + hr["time"], format="%Y-%m-%d %H:%M:%S", errors="coerce")
    hr["bpm"] = pd.to_numeric(hr["bpm"], errors="coerce")
    hr = hr.dropna(subset=["ts", "bpm"]).sort_values("ts")
    hr = hr[(hr.bpm >= 30) & (hr.bpm <= 220)].reset_index(drop=True)

    fused = pd.read_csv(os.path.join(src, "Spo2_heart_sleep_dataset.csv"))
    fused["ts"] = pd.to_datetime(fused["dateTime"], format="%m/%d/%y %H:%M", errors="coerce")
    fused["bpm"] = pd.to_numeric(fused["bpm"], errors="coerce")
    fused["spo2_value"] = pd.to_numeric(fused["spo2_value"], errors="coerce")
    fused["level"] = fused["level"].map(_norm_level)
    fused = fused[(fused.spo2_value.between(70, 100)) & (fused.bpm.between(30, 220))]
    fused = fused.dropna(subset=["ts", "bpm", "spo2_value", "level"]).sort_values("ts").reset_index(drop=True)

    raw = open(os.path.join(src, "Sleep_data.json")).read()
    try:
        recs = json.loads(raw)
    except json.JSONDecodeError:  # the published file is slightly truncated
        recs = [{"dateTime": d, "level": l} for d, l in
                re.findall(r'"dateTime"\s*:\s*"([^"]+)"\s*,\s*"level"\s*:\s*"([^"]+)"', raw)]
    sleep = pd.DataFrame(recs)
    sleep["ts"] = pd.to_datetime(sleep["dateTime"], errors="coerce")
    sleep["level"] = sleep["level"].map(_norm_level)
    sleep = sleep.dropna(subset=["ts", "level"]).sort_values("ts").reset_index(drop=True)
    return hr, fused, sleep


def hr_windows(hr, W=32, cap=200000, seed=42):
    """Sliding windows for next-step HR forecasting, standardized."""
    s = hr.bpm.values.astype("float32")
    mu, sd = float(s.mean()), float(s.std())
    z = (s - mu) / sd
    N = len(z) - W - 1
    idx = np.arange(N)
    rng = np.random.default_rng(seed)
    if N > cap:
        idx = np.sort(rng.choice(N, cap, replace=False))
    X = np.stack([z[i:i + W] for i in idx]).astype("float32")[:, :, None]
    y = z[idx + W].astype("float32")
    return X, y, mu, sd


def sleep_windows(fused, L=10):
    """Short sequences of [bpm_z, spo2_z, hour] -> stage of the last minute."""
    f = fused[fused.level.isin(SLEEP_CLASSES)].sort_values("ts").reset_index(drop=True)
    enc = {c: i for i, c in enumerate(SLEEP_CLASSES)}
    bpm, spo2 = f.bpm.values.astype("float32"), f.spo2_value.values.astype("float32")
    hour = (f.ts.dt.hour.values / 24.0).astype("float32")
    bz = (bpm - bpm.mean()) / (bpm.std() + 1e-6)
    sz = (spo2 - spo2.mean()) / (spo2.std() + 1e-6)
    feat = np.stack([bz, sz, hour], 1).astype("float32")
    lab = f.level.map(enc).values.astype("int64")
    X = np.stack([feat[i:i + L] for i in range(len(feat) - L)]).astype("float32")
    return X, lab[L:], SLEEP_CLASSES


def gan_windows(fused, T=16):
    """Contiguous (T,2) windows of (bpm_z, spo2_z) conditioned on the window's dominant sleep stage."""
    f = fused[fused.level.isin(SLEEP_CLASSES)].sort_values("ts").reset_index(drop=True)
    enc = {c: i for i, c in enumerate(SLEEP_CLASSES)}
    bpm, spo2 = f.bpm.values.astype("float32"), f.spo2_value.values.astype("float32")
    bmu, bsd = float(bpm.mean()), float(bpm.std() + 1e-6)
    smu, ssd = float(spo2.mean()), float(spo2.std() + 1e-6)
    bz, sz = (bpm - bmu) / bsd, (spo2 - smu) / ssd
    lab = f.level.map(enc).values
    Xs, Cs = [], []
    for i in range(len(bz) - T):
        seg = lab[i:i + T]
        Cs.append(int(np.bincount(seg, minlength=4).argmax()))
        Xs.append(np.stack([bz[i:i + T], sz[i:i + T]], 1))
    X = np.array(Xs, dtype="float32")
    C = np.array(Cs, dtype="int64")
    stats = {"bmu": bmu, "bsd": bsd, "smu": smu, "ssd": ssd}
    return X, C, SLEEP_CLASSES, stats
