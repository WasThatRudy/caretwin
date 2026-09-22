"""Train LSTM and Bi-LSTM heart-rate forecasters on the real HR series."""
import os, json, argparse, math, time
import numpy as np
import torch
import torch.nn as nn
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from data import load_all, hr_windows
from models import Forecaster

DEVICE = "cpu" if os.environ.get("CARETWIN_CPU") else ("cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu"))


def run(model, Xtr, ytr, Xte, yte, epochs, batch, lr=1e-3):
    m = model.to(DEVICE)
    opt = torch.optim.Adam(m.parameters(), lr)
    lossf = nn.MSELoss()
    dl = torch.utils.data.DataLoader(torch.utils.data.TensorDataset(Xtr, ytr), batch_size=batch, shuffle=True)
    hist = []
    for ep in range(epochs):
        m.train(); tot = 0.0
        for xb, yb in dl:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            opt.zero_grad(); loss = lossf(m(xb), yb); loss.backward(); opt.step()
            tot += loss.item() * xb.size(0)
        m.eval()
        with torch.no_grad():
            pred = m(Xte.to(DEVICE)).cpu()
            val = float(((pred - yte) ** 2).mean())
        hist.append({"epoch": ep + 1, "train_mse": tot / len(Xtr), "val_mse": val})
        print(f"    epoch {ep+1}/{epochs}  train {hist[-1]['train_mse']:.4f}  val {val:.4f}")
    return m, hist, pred.numpy()


def main(a):
    os.makedirs(a.out, exist_ok=True)
    print(f"[forecaster] device={DEVICE}")
    hr, _, _ = load_all(a.src)
    X, y, mu, sd = hr_windows(hr, W=a.window, cap=a.max_windows)
    cut = int(len(X) * 0.8)
    Xtr, Xte = torch.tensor(X[:cut]), torch.tensor(X[cut:])
    ytr, yte = torch.tensor(y[:cut]), torch.tensor(y[cut:])
    print(f"[forecaster] windows={len(X)} train={cut} test={len(X)-cut} std_bpm={sd:.2f}")

    out = {"window": a.window, "std_bpm": round(sd, 2), "mean_bpm": round(mu, 2),
           "train_n": cut, "test_n": len(X) - cut, "device": DEVICE, "models": {}}
    curves = {}
    preds = {}
    for name, bi in [("lstm", False), ("bilstm", True)]:
        print(f"  training {name} ...")
        torch.manual_seed(42)
        m, hist, pred = run(Forecaster(bi=bi), Xtr, ytr, Xte, yte, a.epochs, a.batch)
        mse = float(((torch.tensor(pred) - yte) ** 2).mean())
        mae = float((torch.tensor(pred) - yte).abs().mean())
        out["models"][name] = {"mse": round(mse, 4), "mae": round(mae, 4), "rmse_bpm": round(math.sqrt(mse) * sd, 2)}
        curves[name] = hist
        preds[name] = pred
        torch.save(m.state_dict(), os.path.join(a.out, f"forecaster_{name}.pt"))

    out["paper_bilstm"] = {"mse": 0.2944, "mae": 0.3410}
    json.dump(out, open(os.path.join(a.out, "forecaster_metrics.json"), "w"), indent=2)

    # figure: validation loss curves
    plt.figure(figsize=(6, 3.4))
    for name in curves:
        plt.plot([h["epoch"] for h in curves[name]], [h["val_mse"] for h in curves[name]], marker="o", label=f"{name} (val)")
    plt.xlabel("epoch"); plt.ylabel("val MSE (standardized)"); plt.title("HR forecaster — validation loss")
    plt.legend(); plt.tight_layout(); plt.savefig(os.path.join(a.out, "fig_forecaster_loss.png"), dpi=140); plt.close()

    # figure: actual vs predicted (bpm)
    n = min(220, len(yte)); s = slice(0, n)
    act = yte.numpy()[s] * sd + mu
    prd = preds["bilstm"][s] * sd + mu
    plt.figure(figsize=(7, 3.2))
    plt.plot(act, color="#0E8A7D", lw=1.6, label="actual")
    plt.plot(prd, color="#E0A13A", lw=1.4, ls="--", label="Bi-LSTM predicted")
    plt.xlabel("test step"); plt.ylabel("heart rate (bpm)"); plt.title(f"Actual vs Bi-LSTM (RMSE {out['models']['bilstm']['rmse_bpm']} bpm)")
    plt.legend(); plt.tight_layout(); plt.savefig(os.path.join(a.out, "fig_forecaster_pred.png"), dpi=140); plt.close()

    print(f"[forecaster] LSTM MSE {out['models']['lstm']['mse']}  Bi-LSTM MSE {out['models']['bilstm']['mse']}  (paper 0.2944)")
    return out


def parse():
    p = argparse.ArgumentParser()
    p.add_argument("--src", default="./EDT-Datasets")
    p.add_argument("--out", default="./results")
    p.add_argument("--epochs", type=int, default=8)
    p.add_argument("--window", type=int, default=32)
    p.add_argument("--max-windows", type=int, default=200000)
    p.add_argument("--batch", type=int, default=512)
    p.add_argument("--smoke", action="store_true")
    a = p.parse_args()
    if a.smoke:
        a.epochs, a.max_windows, a.batch = 1, 3000, 256
    return a


if __name__ == "__main__":
    main(parse())
