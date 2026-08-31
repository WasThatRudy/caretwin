import { analysis } from "@/lib/data";
import { Section, Stat } from "./ui";

export default function DatasetSection() {
  const d = analysis.dataset;
  return (
    <Section id="dataset" eyebrow="Provenance" title="The data is real, and cited"
      intro={<>Every number on this page comes from the base paper&rsquo;s own published dataset. No synthetic
        placeholders. This is the ground truth we validate, model, and monitor against.</>}>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="card p-5 md:col-span-1">
          <div className="eyebrow !text-[var(--mute)] mb-2">Source</div>
          <p className="text-[14px] dim leading-relaxed">
            Momand, Mongkolnam, Chan, Charoenkitkarn, Pal. <i>Building Digital Twins for Elderly Care: An End-to-End
            Framework from Data Acquisition to Modeling.</i> IEEE Access, vol. 13, 2025.
          </p>
          <a href="https://github.com/mommand/EDT-Datasets" target="_blank" rel="noreferrer"
             className="inline-block mt-3 mono text-[12px]">github.com/mommand/EDT-Datasets ↗</a>
        </div>
        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <Stat label="Heart-rate readings" value={d.hr_records.toLocaleString()} sub={`${d.hr_date_start} → ${d.hr_date_end}`} />
          <Stat label="Fused BPM+SpO₂+sleep" value={d.fused_records.toLocaleString()} sub="per-minute, aligned" />
          <Stat label="Sleep-stage minutes" value={d.sleep_minutes.toLocaleString()} sub="labelled stages" />
          <Stat label="Device" value={d.device} sub="consumer-grade wearable" />
        </div>
      </div>

      <div className="card p-5 mt-3">
        <div className="eyebrow !text-[var(--mute)] mb-3">DataOps · validation applied</div>
        <div className="grid sm:grid-cols-3 gap-5">
          <div>
            <div className="mono tnum text-[22px] font-semibold text-[var(--bad)]">{d.spo2_artifacts_removed.toLocaleString()}</div>
            <p className="cap mt-1">SpO₂ readings failed the physiological range check ([70,100]%) and were removed
              &mdash; <b>{d.spo2_artifact_pct}%</b> of the raw {d.spo2_records_raw.toLocaleString()}.</p>
          </div>
          <div>
            <div className="mono tnum text-[22px] font-semibold">{d.spo2_records_valid.toLocaleString()}</div>
            <p className="cap mt-1">valid SpO₂ readings retained after cleaning, used for the distribution and
              hypoxemia analysis.</p>
          </div>
          <div>
            <div className="mono tnum text-[22px] font-semibold">timestamp</div>
            <p className="cap mt-1">HR, SpO₂ and sleep streams are parsed, range-checked, and aligned on a common
              minute timeline before modelling.</p>
          </div>
        </div>
        <p className="cap mt-4 pt-3 hair-soft">This mirrors the paper&rsquo;s data-management pipeline. The large
          artifact fraction is itself a finding: it quantifies why consumer-grade SpO₂ needs validation before use.</p>
      </div>
    </Section>
  );
}
