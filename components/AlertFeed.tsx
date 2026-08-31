"use client";
import { useMonitor } from "@/lib/store";

const tone: Record<string, { c: string; label: string }> = {
  ok: { c: "#4BB07E", label: "STABLE" },
  warn: { c: "#E0A13A", label: "WARNING" },
  crit: { c: "#E05C46", label: "CRITICAL" },
};

export default function AlertFeed() {
  const alerts = useMonitor((s) => s.alerts);
  return (
    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
      {alerts.map((a) => {
        const t = tone[a.cls];
        return (
          <div key={a.id} className="fade-up rounded-lg border border-[var(--line)] bg-[var(--panel-2)] overflow-hidden">
            <div className="px-3 py-2.5 border-l-2" style={{ borderColor: t.c }}>
              <div className="flex items-center justify-between">
                <span className="mono text-[10.5px] font-semibold tracking-wider" style={{ color: t.c }}>{t.label}</span>
                <span className="mono text-[10.5px] text-[var(--faint)]">{a.time} · rec</span>
              </div>
              <div className="text-[13.5px] font-medium mt-1">{a.title}</div>
              <div className="text-[12.5px] dim mt-0.5">{a.msg}</div>
              <div className="mt-2 px-2.5 py-2 rounded-md border border-[color:rgba(53,184,166,.22)]" style={{ background: "rgba(53,184,166,.06)" }}>
                <span className="mono text-[10px] font-semibold tracking-widest text-[var(--accent)]">CARETWIN AI · GUIDANCE</span>
                <div className="text-[12.5px] dim mt-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: a.ai }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
