import { analysis } from "@/lib/data";
import { Section, Figure } from "./ui";
import { LineCompare, Heatmap, BarCat, Legend, C } from "./charts";

function Row({ cells, head }: { cells: React.ReactNode[]; head?: boolean }) {
  return (
    <div className={`grid grid-cols-4 ${head ? "eyebrow !text-[var(--mute)]" : "text-[13px] mono tnum"} py-2 px-3 ${head ? "" : "hair-soft"}`}>
      {cells.map((c, i) => <div key={i} className={i === 0 ? "!normal-case tracking-normal font-sans text-[var(--ink-dim)]" : "text-right"}>{c}</div>)}
    </div>
  );
}

export default function ModelsSection() {
  const hm = analysis.hr_model, sm = analysis.sleep_model, tr = analysis.transitions;
  return (
    <Section id="models" eyebrow="Models &amp; results" title="Trained on the data, measured honestly"
      intro={<>Real models, real held-out evaluation. Where our numbers differ from the paper we say so &mdash; the point
        is a faithful, reproducible baseline, not a leaderboard.</>}>

      {/* HR forecasting */}
      <div className="grid lg:grid-cols-[7fr_5fr] gap-3">
        <Figure n="Fig. 6" title="Heart-rate forecast — actual vs. Bi-LSTM"
          caption={<>Held-out test slice ({hm.test_n.toLocaleString()} windows). The Bi-LSTM tracks the real signal to
            <b> {hm.bilstm.rmse_bpm} bpm</b> RMSE.</>}>
          <div className="mb-2"><Legend items={[{ name: "actual", color: C.teal }, { name: "Bi-LSTM predicted", color: C.amber, dashed: true }]} /></div>
          <LineCompare height={220} yfmt={(v) => v.toFixed(0)}
            series={[{ name: "actual", color: C.teal, data: hm.sample.actual_bpm }, { name: "pred", color: C.amber, dashed: true, data: hm.sample.bilstm_bpm }]} />
        </Figure>
        <Figure n="Tbl. 1" title="Forecast metrics"
          caption={<>Bi-LSTM improves on the unidirectional LSTM on every metric &mdash; reproducing the paper&rsquo;s
            central finding. Absolute MSE differs because our task is next-step on a standardized, seconds-cadence series.</>}>
          <div className="rounded-lg border border-[var(--line)] overflow-hidden">
            <Row head cells={["model", "MSE", "MAE", "RMSE"]} />
            <Row cells={["LSTM", hm.lstm.mse, hm.lstm.mae, hm.lstm.rmse_bpm]} />
            <Row cells={[<span key="b" className="text-[var(--accent)]">Bi-LSTM</span>, <b key="1">{hm.bilstm.mse}</b>, <b key="2">{hm.bilstm.mae}</b>, <b key="3">{hm.bilstm.rmse_bpm}</b>]} />
            <Row cells={[<span key="p" className="!text-[var(--mute)]">paper Bi-LSTM</span>, hm.paper_bilstm.mse, hm.paper_bilstm.mae, "—"]} />
          </div>
          <p className="cap mt-3">RMSE reported in bpm for interpretability; MSE/MAE on standardized values (σ = {hm.std_bpm} bpm).</p>
        </Figure>
      </div>

      {/* Sleep classification */}
      <div className="grid lg:grid-cols-[5fr_7fr] gap-3 mt-3">
        <Figure n="Fig. 7" title="Sleep-stage confusion (temporal model)"
          caption={<>Held-out test. Light sleep is recovered well; minority stages suffer under imbalance &mdash; visible
            as the sparse off-diagonal for <b>wake</b> and <b>rem</b>.</>}>
          <div className="flex justify-center"><Heatmap matrix={sm.confusion} rows={sm.seq_classes} cols={sm.seq_classes} base={C.blue} fmt={(v) => String(v)} /></div>
        </Figure>
        <Figure n="Tbl. 2" title="Sleep-stage accuracy"
          caption={<>Physiology alone (BPM + SpO₂ + time) is weakly predictive of exact stage &mdash; consistent with the
            weak stage correlations in Fig. 5. Adding recent-trend context lifts accuracy toward the paper&rsquo;s sequence LSTM.</>}>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["instantaneous RF", sm.rf_instant_acc, sm.rf_instant_f1, false],
              ["+ temporal context", sm.rf_temporal_acc, sm.rf_temporal_f1, true],
              ["paper LSTM", sm.paper_lstm_acc, null, false],
            ].map(([label, acc, f1, hi]: any) => (
              <div key={label} className="card p-4">
                <div className="eyebrow !text-[var(--mute)] mb-2">{label}</div>
                <div className={`mono tnum text-[24px] font-semibold ${hi ? "text-[var(--accent)]" : ""}`}>{(acc * 100).toFixed(1)}%</div>
                <div className="cap mt-1">{f1 != null ? `macro-F1 ${f1.toFixed(2)}` : "reported"}</div>
              </div>
            ))}
          </div>
        </Figure>
      </div>

      {/* Transitions */}
      <div className="grid lg:grid-cols-2 gap-3 mt-3">
        <Figure n="Fig. 8" title="Sleep-stage transitions — Markov (MLE)"
          caption={<>Strong diagonal: stages persist minute-to-minute. Next-step prediction accuracy
            <b> {(tr.next_step_acc * 100).toFixed(1)}%</b> (paper ≈ 96%).</>}>
          <div className="flex justify-center"><Heatmap matrix={tr.markov} rows={tr.states} cols={tr.states} base={C.teal} /></div>
        </Figure>
        <Figure n="Fig. 9" title="Sleep-stage transitions — Bayesian (Dirichlet, α=5)"
          caption={<>Dirichlet smoothing spreads probability into rare transitions, giving a more stable matrix in low-data
            regimes &mdash; the paper&rsquo;s robustness argument, reproduced.</>}>
          <div className="flex justify-center"><Heatmap matrix={tr.bayesian} rows={tr.states} cols={tr.states} base={C.violet} /></div>
        </Figure>
      </div>

      {/* Imbalance + augmentation */}
      <div className="grid lg:grid-cols-2 gap-3 mt-3">
        <Figure n="Fig. 10" title="Class imbalance (fused set)"
          caption={<>The minority <b>{sm.minority_class}</b> class is only {sm.imbalance[sm.minority_class]}% of samples &mdash;
            the core problem augmentation exists to solve.</>}>
          <BarCat height={200} items={Object.entries(sm.imbalance).map(([k, v], i) => ({ label: k, value: v, color: [C.blue, C.teal, C.violet, C.amber][i % 4] }))} />
        </Figure>
        <Figure n="Fig. 11" title="Augmentation effect — minority recall"
          caption={<>SMOTE (a stand-in for our proposed GAN augmentation) lifts recall on the rare <b>{sm.minority_class}</b>
            class from {(sm.smote.recall_before * 100).toFixed(0)}% to <b>{(sm.smote.recall_after * 100).toFixed(0)}%</b>, at a
            {" "}{((sm.smote.acc_before - sm.smote.acc_after) * 100).toFixed(1)}-pt cost to overall accuracy &mdash; the
            precision/recall trade-off, quantified on real data.</>}>
          <BarCat height={200} maxOverride={0.3}
            items={[
              { label: "recall before", value: sm.smote.recall_before, color: C.slate },
              { label: "recall after", value: sm.smote.recall_after, color: C.teal },
            ]} />
        </Figure>
      </div>
    </Section>
  );
}
