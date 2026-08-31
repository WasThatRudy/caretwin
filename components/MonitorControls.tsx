"use client";
import { useMonitor, MONITOR_META } from "@/lib/store";

export default function MonitorControls() {
  const { playing, speed, idx, setPlaying, setSpeed, jumpToEvent } = useMonitor();
  const pct = (idx / MONITOR_META.N) * 100;
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <button onClick={() => setPlaying(!playing)}
        className="text-[13px] font-medium px-3 py-1.5 rounded-lg border border-[var(--line)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition">
        {playing ? "❚❚ Pause" : "▶ Play"}
      </button>
      <div className="flex rounded-lg border border-[var(--line)] overflow-hidden">
        {[1, 4].map((s) => (
          <button key={s} onClick={() => setSpeed(s)}
            className={`text-[12px] mono px-2.5 py-1.5 transition ${speed === s ? "bg-[var(--accent)] text-[#08120F]" : "text-[var(--mute)] hover:text-[var(--ink)]"}`}>
            {s}×
          </button>
        ))}
      </div>
      <button onClick={jumpToEvent}
        className="text-[13px] font-medium px-3 py-1.5 rounded-lg border border-[color:rgba(224,92,70,.4)] text-[var(--ink-dim)] hover:text-[var(--bad)] hover:border-[var(--bad)] transition">
        ⟲ Jump to desaturation event
      </button>
      <div className="flex-1 min-w-[120px] flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-[var(--line)] overflow-hidden">
          <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
        </div>
        <span className="mono text-[11px] text-[var(--faint)] tnum">{MONITOR_META.recTime(idx)}</span>
      </div>
    </div>
  );
}
