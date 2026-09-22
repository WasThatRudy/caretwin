"""Train an LSTM sleep-stage classifier on [bpm, spo2, hour] windows."""
import os, json, argparse
import numpy as np
import torch
import torch.nn as nn
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix

from data import load_all, sleep_windows
from models import SleepLSTM

DEVICE = "cpu" if os.environ.get("CARETWIN_CPU") else ("cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu"))


def main(a):
    os.makedirs(a.out, exist_ok=True)
    print(f"[sleep] device={DEVICE}")
    _, fused, _ = load_all(a.src)
    X, y, classes = sleep_windows(fused, L=a.window)
    rng = np.random.default_rng(42)
    perm = rng.permutation(len(X)); cut = int(0.8 * len(X))
    tr, te = perm[:cut], perm[cut:]
    Xtr, ytr = torch.tensor(X[tr]), torch.tensor(y[tr])
    Xte, yte = torch.tensor(X[te]), torch.tensor(y[te])
    # class weights to counter imbalance
    counts = np.bincount(y[tr], minlength=len(classes))
    w = torch.tensor(len(y[tr]) / (len(classes) * np.maximum(counts, 1)), dtype=torch.float32).to(DEVICE)

    m = SleepLSTM(len(classes)).to(DEVICE)
    opt = torch.optim.Adam(m.parameters(), 1e-3)
    lossf = nn.CrossEntropyLoss(weight=w)
    dl = torch.utils.data.DataLoader(torch.utils.data.TensorDataset(Xtr, ytr), batch_size=a.batch, shuffle=True)
    for ep in range(a.epochs):
        m.train()
        for xb, yb in dl:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            opt.zero_grad(); loss = lossf(m(xb), yb); loss.backward(); opt.step()
        if (ep + 1) % max(1, a.epochs // 5) == 0:
            print(f"    epoch {ep+1}/{a.epochs}  loss {loss.item():.3f}")
    m.eval()
    with torch.no_grad():
        pred = m(Xte.to(DEVICE)).argmax(1).cpu().numpy()
    acc = accuracy_score(yte.numpy(), pred); f1 = f1_score(yte.numpy(), pred, average="macro")
    cm = confusion_matrix(yte.numpy(), pred, labels=list(range(len(classes))))

    out = {"classes": classes, "window": a.window, "acc": round(float(acc), 3),
           "macro_f1": round(float(f1), 3), "confusion": cm.tolist(),
           "paper_lstm_acc": 0.92, "device": DEVICE}
    json.dump(out, open(os.path.join(a.out, "sleep_metrics.json"), "w"), indent=2)
    torch.save(m.state_dict(), os.path.join(a.out, "sleep_lstm.pt"))

    plt.figure(figsize=(4.6, 4))
    plt.imshow(cm, cmap="Blues"); plt.colorbar(fraction=0.046)
    plt.xticks(range(len(classes)), classes); plt.yticks(range(len(classes)), classes)
    for i in range(len(classes)):
        for j in range(len(classes)):
            plt.text(j, i, cm[i, j], ha="center", va="center", color="#333", fontsize=9)
    plt.xlabel("predicted"); plt.ylabel("true"); plt.title(f"Sleep stage — acc {acc:.2f}")
    plt.tight_layout(); plt.savefig(os.path.join(a.out, "fig_sleep_confusion.png"), dpi=140); plt.close()

    print(f"[sleep] acc {acc:.3f}  macroF1 {f1:.3f}  (paper LSTM 0.92)")
    return out


def parse():
    p = argparse.ArgumentParser()
    p.add_argument("--src", default="./EDT-Datasets")
    p.add_argument("--out", default="./results")
    p.add_argument("--epochs", type=int, default=40)
    p.add_argument("--window", type=int, default=10)
    p.add_argument("--batch", type=int, default=128)
    p.add_argument("--smoke", action="store_true")
    a = p.parse_args()
    if a.smoke:
        a.epochs, a.batch = 2, 128
    return a


if __name__ == "__main__":
    main(parse())
