import { analysis } from "@/lib/data";
import { Stat, Pill } from "./ui";

export default function Hero() {
  const d = analysis.dataset, hr = analysis.hr_model, t = analysis.transitions;
  return (
    <section id="top" className="max-w-[1120px] mx-auto px-5 md:px-8 pt-16 pb-10">
      <div className="eyebrow mb-3">DSCE · Dept. of CSE · Major Project</div>
      <h1 className="text-[clamp(30px,5vw,46px)] font-semibold leading-[1.05] tracking-[-0.02em] max-w-[16ch]">
        A digital twin for elderly care, built on <span className="text-[var(--accent)]">real</span> physiological data.
      </h1>
      <p className="mt-5 max-w-[62ch] text-[16px] dim leading-relaxed">
        CareTwin extends the elderly digital-twin framework of Momand et al. (IEEE Access, 2025). Rather than a mock-up,
        it is built directly on that paper&rsquo;s published wearable dataset: {d.hr_records.toLocaleString()} heart-rate
        readings, SpO₂, and per-minute sleep stages from a {d.device}. We clean the data, reproduce the paper&rsquo;s
        analysis, train the forecasting and sleep models, and drive a live monitor from an actual overnight recording.
      </p>
      <div className="flex flex-wrap gap-2 mt-5">
        <Pill tone="accent">EDT-Datasets · Momand 2025</Pill>
        <Pill>{d.device}</Pill>
        <Pill>{d.hr_date_start} → {d.hr_date_end}</Pill>
        <Pill tone="good">real data, honest metrics</Pill>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-9">
        <Stat label="HR records" value={(d.hr_records / 1000).toFixed(0) + "k"} sub="real, seconds-cadence" />
        <Stat label="Bi-LSTM forecast" value={hr.bilstm.rmse_bpm + " bpm"} sub={<>RMSE · beats LSTM ({hr.lstm.rmse_bpm})</>} accent />
        <Stat label="Sleep transitions" value={(t.next_step_acc * 100).toFixed(1) + "%"} sub="next-step · paper ≈96%" />
        <Stat label="SpO₂ artifacts" value={d.spo2_artifact_pct + "%"} sub="removed by validation" />
      </div>
    </section>
  );
}
