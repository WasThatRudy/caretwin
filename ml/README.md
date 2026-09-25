# CareTwin — ML training package

All models are trained on the base paper's **real, published dataset**
(Momand et al., IEEE Access 2025 — [EDT-Datasets](https://github.com/mommand/EDT-Datasets)):
~589k heart-rate readings, SpO₂, and per-minute sleep stages from a Fitbit Sense 2.

Everything here is CPU-runnable but is meant for a **CUDA GPU** (or free Google Colab GPU).
Nothing large needs to live on a laptop — clone, train on the GPU, commit the results.

## Fastest path — Google Colab (no local setup)

1. Open `CareTwin_Training.ipynb` in [Colab](https://colab.research.google.com/).
2. Runtime → Change runtime type → **T4 GPU**.
3. Runtime → **Run all**. It clones the dataset, trains every model, shows the
   figures, and zips `results/` for download. ~10–15 min on a T4.

## Local GPU

```bash
git clone https://github.com/WasThatRudy/caretwin.git && cd caretwin
git clone https://github.com/mommand/EDT-Datasets.git ml/EDT-Datasets
python -m venv .venv && source .venv/bin/activate
pip install -r ml/requirements.txt

cd ml
python run_all.py --src EDT-Datasets --out results          # full run
python run_all.py --src EDT-Datasets --out results --smoke  # 10-second sanity check
```

Run a single stage:

```bash
python train_forecaster.py --src EDT-Datasets --out results   # LSTM + Bi-LSTM HR forecast
python train_sleep.py      --src EDT-Datasets --out results   # LSTM sleep-stage classifier
python train_gan.py        --src EDT-Datasets --out results   # conditional WGAN-GP + augmentation
python transitions.py      --src EDT-Datasets --out results   # Markov + Bayesian transitions
```

> On Apple Silicon, WGAN-GP's gradient penalty (double backward) is unsupported on the MPS
> backend — set `CARETWIN_CPU=1` to force CPU. CUDA is unaffected.

## Files

| File | What it does |
|---|---|
| `data.py` | load + validate + window the real datasets (shared) |
| `models.py` | `Forecaster` (LSTM/Bi-LSTM), `SleepLSTM`, conditional `Generator`/`Discriminator` (WGAN-GP) |
| `train_forecaster.py` | trains LSTM & Bi-LSTM next-step HR forecaster |
| `train_sleep.py` | trains the LSTM sleep-stage classifier |
| `train_gan.py` | **conditional WGAN-GP** + the real augmentation experiment (our contribution) |
| `transitions.py` | Markov (MLE) + Bayesian (Dirichlet) sleep transitions |
| `run_all.py` | runs everything, writes `results/summary.json` |
| `evaluate.py` | tests every saved model on held-out data (baselines, stricter split, GAN fidelity, GAN vs SMOTE) and writes `results/eval/` |
| `pipeline.py` | lightweight variant that also exports the web app's `public/data/*.json` |

## Outputs (in `results/`)

- **Checkpoints:** `forecaster_lstm.pt`, `forecaster_bilstm.pt`, `sleep_lstm.pt`, `gan_generator.pt`
- **Metrics:** `forecaster_metrics.json`, `sleep_metrics.json`, `gan_metrics.json`, `transitions.json`, `summary.json`
- **Figures:** loss curves, actual-vs-predicted HR, sleep confusion matrix, transition heatmaps,
  GAN training loss, synthetic samples, and the **minority-recall augmentation** bar chart.

After a GPU run, commit the figures and JSON (small); the `.pt` checkpoints are git-ignored by default.

**Latest GPU run and test results: see [RESULTS.md](RESULTS.md).**

## What the run demonstrates (Review 2)

1. Real Bi-LSTM **beats** the unidirectional LSTM on HR forecasting — the paper's core finding.
2. A real sleep-stage LSTM and the Markov/Bayesian transition models (≈95% next-step).
3. A **conditional GAN** that synthesises per-stage physiology, and a controlled experiment
   showing synthetic minority data changes classifier recall — the augmentation contribution
   the base paper left to future work (it used only SMOTE).
