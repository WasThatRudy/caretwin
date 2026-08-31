# CareTwin — ML pipeline

`pipeline.py` reproduces every number shown in the app, directly from the base paper's
published dataset (Momand et al., IEEE Access 2025).

## What it does

1. Loads and validates the real HR / SpO₂ / sleep records (physiological range checks, timestamp alignment).
2. Reproduces the exploratory analysis (distributions, sleep-vs-wake HR, class imbalance, BPM↔SpO₂ correlation).
3. Trains a real **LSTM** and **Bi-LSTM** heart-rate forecaster (PyTorch) and reports held-out MSE / MAE / RMSE.
4. Trains sleep-stage classifiers (instantaneous and temporal-context) and a **SMOTE** augmentation comparison.
5. Computes **Markov (MLE)** and **Bayesian (Dirichlet)** sleep-transition matrices.
6. Exports `../public/data/analysis.json` and `../public/data/monitor.json` consumed by the web app.

## Run

```bash
# 1. get the dataset
git clone https://github.com/mommand/EDT-Datasets.git ml/EDT-Datasets

# 2. install and run
python -m venv .venv && source .venv/bin/activate
pip install -r ml/requirements.txt
python ml/pipeline.py
```

Outputs are written back into `public/data/`, so the site always reflects the latest run.
Training is CPU-only and takes ~2 minutes.

## Headline results (this run)

| Task | Result | Base paper |
|---|---|---|
| HR forecast (Bi-LSTM) | RMSE 1.86 bpm, MSE 0.0109 | MSE 0.2944 |
| HR forecast (LSTM) | RMSE 1.95 bpm, MSE 0.0119 | 0.3256 |
| Sleep stage (temporal RF) | 79.2% acc | LSTM 92% |
| Sleep transitions (next-step) | 95.3% | ≈96% |
| SpO₂ artifacts removed | 17.6% of raw | — |

Numbers are honest and reproducible; where the task setup differs from the paper it is noted in the app.
