import { Section } from "./ui";

const ITEMS = [
  {
    t: "Device-agnostic ingestion",
    base: "Validated on a single Fitbit Sense 2.",
    add: "A device-agnostic pipeline that ingests Fitbit, Apple Watch, or Samsung Health streams through the same validation and fusion stage.",
    ev: "planned",
  },
  {
    t: "Generative augmentation",
    base: "Class imbalance handled only with SMOTE.",
    add: "A conditional GAN to synthesise minority-class physiology, both balancing training and reducing exposure of real records. We quantify the target with a SMOTE baseline first.",
    ev: "Fig. 10–11",
  },
  {
    t: "Hybrid edge / cloud",
    base: "Centralised cloud processing after batch sync.",
    add: "Lightweight inference (the ~2 MB LSTM models, SpO₂ thresholding) runs on-device for instant alerts; only GAN training and the language model stay in the cloud.",
    ev: "Fig. 6",
  },
  {
    t: "Guideline-grounded guidance",
    base: "Generic GPT-4o feedback, weakest on clinical appropriateness.",
    add: "Recommendations grounded in the clinical SpO₂ thresholds used throughout, with a self-hosted medical LLM as the privacy-preserving end state.",
    ev: "Monitor",
  },
];

export default function MethodSection() {
  return (
    <Section id="method" eyebrow="Contribution" title="What CareTwin adds, and what&rsquo;s proven"
      intro={<>The base paper is a strong foundation. Our four extensions target its stated limitations &mdash; and each is
        anchored to real evidence on this page rather than a claim.</>}>
      <div className="grid md:grid-cols-2 gap-3">
        {ITEMS.map((it) => (
          <div key={it.t} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold">{it.t}</h3>
              <span className="mono text-[11px] px-2 py-0.5 rounded-full border"
                style={{ color: it.ev === "planned" ? "var(--mute)" : "var(--accent)", borderColor: it.ev === "planned" ? "var(--line)" : "rgba(53,184,166,.4)" }}>
                {it.ev === "planned" ? "planned" : `evidence · ${it.ev}`}
              </span>
            </div>
            <div className="grid grid-cols-[16px_1fr] gap-x-2 gap-y-2 text-[13px]">
              <span className="text-[var(--mute)]">—</span>
              <span className="muted">{it.base}</span>
              <span className="text-[var(--accent)]">+</span>
              <span className="dim">{it.add}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="cap mt-5 max-w-[70ch]">
        Review 1 scope: the data pipeline, exploratory analysis, and the forecasting, sleep, and transition models are
        implemented and evaluated above on the real dataset. The GAN, multi-device ingestion, and on-device deployment
        are the design targets for the build phase &mdash; grounded in the baselines shown here.
      </p>
    </Section>
  );
}
