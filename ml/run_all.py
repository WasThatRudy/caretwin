"""Run the full CareTwin training pipeline and collect a results summary.

  python ml/run_all.py --src ml/EDT-Datasets --out ml/results
  python ml/run_all.py --smoke      # tiny/fast sanity run on CPU
"""
import os, json, argparse, time, types
import train_forecaster, train_sleep, train_gan, transitions


def sub(a, **over):
    d = vars(a).copy(); d.update(over); return types.SimpleNamespace(**d)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--src", default="./EDT-Datasets")
    p.add_argument("--out", default="./results")
    p.add_argument("--smoke", action="store_true")
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)
    t0 = time.time()

    S = a.smoke
    base = dict(src=a.src, out=a.out, smoke=S)
    fc = train_forecaster.main(sub(a, epochs=1 if S else 8, window=32,
                                   max_windows=3000 if S else 200000, batch=256 if S else 512, **base))
    sl = train_sleep.main(sub(a, epochs=2 if S else 40, window=10, batch=128, **base))
    gn = train_gan.main(sub(a, epochs=3 if S else 300, batch=128, T=16, synth=200 if S else 3000, **base))
    tr = transitions.main(sub(a, **base))

    summary = {
        "hr_forecast": fc["models"], "hr_paper": fc["paper_bilstm"],
        "sleep": {"acc": sl["acc"], "macro_f1": sl["macro_f1"], "paper": sl["paper_lstm_acc"]},
        "gan_augmentation": gn["augmentation"],
        "transitions": {"next_step_acc": tr["next_step_acc"]},
        "runtime_sec": round(time.time() - t0, 1), "smoke": S,
    }
    json.dump(summary, open(os.path.join(a.out, "summary.json"), "w"), indent=2)
    print("\n==== SUMMARY ====")
    print(json.dumps(summary, indent=2))
    print(f"\nArtifacts in {a.out}/ : checkpoints (.pt), metrics (.json), figures (.png)")


if __name__ == "__main__":
    main()
