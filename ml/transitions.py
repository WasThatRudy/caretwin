"""Markov (MLE) and Bayesian (Dirichlet) sleep-stage transition matrices."""
import os, json, argparse
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from data import load_all, SLEEP_CLASSES


def main(a):
    os.makedirs(a.out, exist_ok=True)
    _, _, sleep = load_all(a.src)
    seq = sleep.level.tolist()
    si = {s: i for i, s in enumerate(SLEEP_CLASSES)}
    counts = np.zeros((4, 4))
    for x, y in zip(seq, seq[1:]):
        if x in si and y in si:
            counts[si[x], si[y]] += 1
    markov = counts / counts.sum(1, keepdims=True).clip(min=1)
    alpha = 5.0
    bayes = (counts + alpha) / (counts.sum(1, keepdims=True) + alpha * 4)
    correct = tot = 0
    for x, y in zip(seq, seq[1:]):
        if x in si and y in si:
            tot += 1
            if SLEEP_CLASSES[int(markov[si[x]].argmax())] == y:
                correct += 1
    out = {"states": SLEEP_CLASSES, "markov": markov.round(3).tolist(),
           "bayesian": bayes.round(3).tolist(), "next_step_acc": round(correct / max(1, tot), 3)}
    json.dump(out, open(os.path.join(a.out, "transitions.json"), "w"), indent=2)

    for name, M, cmap in [("markov", markov, "GnBu"), ("bayesian", bayes, "BuPu")]:
        plt.figure(figsize=(4.2, 3.8)); plt.imshow(M, cmap=cmap, vmin=0, vmax=1); plt.colorbar(fraction=0.046)
        plt.xticks(range(4), SLEEP_CLASSES); plt.yticks(range(4), SLEEP_CLASSES)
        for i in range(4):
            for j in range(4):
                plt.text(j, i, f"{M[i,j]:.2f}", ha="center", va="center", fontsize=9,
                         color="#111" if M[i, j] > 0.5 else "#444")
        plt.xlabel("next stage"); plt.ylabel("current stage"); plt.title(f"{name} transitions")
        plt.tight_layout(); plt.savefig(os.path.join(a.out, f"fig_transitions_{name}.png"), dpi=140); plt.close()

    print(f"[transitions] next-step acc {out['next_step_acc']} (paper ~0.96)")
    return out


def parse():
    p = argparse.ArgumentParser()
    p.add_argument("--src", default="./EDT-Datasets")
    p.add_argument("--out", default="./results")
    p.add_argument("--smoke", action="store_true")
    return p.parse_args()


if __name__ == "__main__":
    main(parse())
