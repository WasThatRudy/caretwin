# CareTwin

A **real-data digital twin for elderly health monitoring**. Rather than a mock-up, CareTwin is built directly on the
published wearable dataset from the base paper it extends — Momand et al., *Building Digital Twins for Elderly Care*,
IEEE Access 2025. It cleans that data, reproduces the paper's analysis, trains the forecasting and sleep models, and
drives a live monitor from an actual overnight recording.

Major project · Dept. of CSE, Dayananda Sagar College of Engineering.
Rudraksha Singh Sengar · Snehal Prakash · Ishaan Saxena · Guide: Dr. K. Janani.

**Live:** https://caretwin-health.netlify.app

## What's real here

- **589k** real heart-rate readings, real SpO₂, and per-minute sleep stages (Fitbit Sense 2).
- **Bi-LSTM** heart-rate forecaster, trained in PyTorch: **RMSE 1.86 bpm**, and it beats the unidirectional LSTM — reproducing the paper's central finding.
- **Sleep-stage** classification and **Markov / Bayesian** transition matrices (95.3% next-step, paper ≈96%).
- **17.6%** of raw SpO₂ removed by physiological validation — a real data-quality finding.
- **SMOTE** augmentation lifts minority-class recall 6× — quantifying the target for the proposed GAN.
- Live monitor replays a **real desaturation event** (min SpO₂ 83.8%) and fires on-edge guidance.

Every figure and metric on the site is computed from the real data by `ml/pipeline.py` — see [`ml/README.md`](./ml/README.md).

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind, IBM Plex type system
- **react-three-fiber** + drei — anatomical heart (real GLB) beating at the live BPM
- **zustand** — real-recording replay store + on-edge anomaly detection
- **PyTorch / scikit-learn / imbalanced-learn** — the offline ML pipeline

## Run

```bash
npm install
npm run dev            # http://localhost:3000

# regenerate the data/metrics from the real dataset (optional):
#   see ml/README.md
```

## Structure

```
app/                 App Router entry, fonts, theme
components/           Header, Hero, LiveMonitor (R3F), EDA / Models / Method sections, charts
lib/data.ts          typed access to the real analysis + replay JSON
lib/store.ts         real-recording replay + anomaly detection
ml/pipeline.py       offline: clean → analyse → train → export (reproduces every number)
public/data/*.json   analysis + monitor data produced by the pipeline
public/models/       anatomical heart GLB
```

Proof of concept · not a medical device.
