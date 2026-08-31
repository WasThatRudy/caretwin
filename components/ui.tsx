import type { ReactNode } from "react";

export function Section({ id, eyebrow, title, intro, children }:
  { id?: string; eyebrow: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="max-w-[1120px] mx-auto px-5 md:px-8 py-14 scroll-mt-16">
      <div className="max-w-[680px]">
        <div className="eyebrow mb-2.5">{eyebrow}</div>
        <h2 className="section-title">{title}</h2>
        {intro && <p className="mt-3 text-[15px] dim leading-relaxed">{intro}</p>}
      </div>
      <div className="mt-9">{children}</div>
    </section>
  );
}

export function Figure({ n, title, caption, children, wide }:
  { n?: string; title: string; caption?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <figure className={`card p-5 m-0 ${wide ? "" : ""}`}>
      <figcaption className="mb-4">
        <div className="flex items-baseline gap-2">
          {n && <span className="mono text-[11px] text-[var(--accent)] font-medium">{n}</span>}
          <span className="text-[14px] font-semibold">{title}</span>
        </div>
      </figcaption>
      {children}
      {caption && <p className="cap mt-4 pt-3 hair-soft">{caption}</p>}
    </figure>
  );
}

export function Stat({ label, value, sub, accent }:
  { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="eyebrow !text-[var(--mute)] mb-2">{label}</div>
      <div className={`mono tnum text-[26px] font-semibold leading-none ${accent ? "text-[var(--accent)]" : ""}`}>{value}</div>
      {sub && <div className="cap mt-1.5">{sub}</div>}
    </div>
  );
}

export function Pill({ children, tone = "mute" }: { children: ReactNode; tone?: "mute" | "good" | "warn" | "bad" | "accent" }) {
  const c: Record<string, string> = {
    mute: "var(--mute)", good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)", accent: "var(--accent)",
  };
  return (
    <span className="mono text-[11px] px-2 py-0.5 rounded-full border" style={{ color: c[tone], borderColor: `${c[tone]}55` }}>
      {children}
    </span>
  );
}
