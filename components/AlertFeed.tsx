"use client";
import { useVitals } from "@/lib/store";

const style: Record<string, { bar: string; chip: string; label: string; icon: string }> = {
  ok:    { bar: "#3FB27F", chip: "rgba(63,178,127,.14)", label: "STABLE",   icon: "✓" },
  warnl: { bar: "#E39B2B", chip: "rgba(227,155,43,.16)", label: "WARNING",  icon: "!" },
  crit:  { bar: "#E5533C", chip: "rgba(229,83,60,.18)",  label: "CRITICAL", icon: "‼" },
};

export default function AlertFeed() {
  const alerts = useVitals((s) => s.alerts);
  return (
    <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto pr-1">
      {alerts.map((a) => {
        const st = style[a.cls];
        return (
          <div key={a.id} className="animate-slidein rounded-xl overflow-hidden relative"
               style={{ background: "rgba(11,18,26,.6)", border: "1px solid rgba(150,180,210,.09)" }}>
            <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: st.bar, boxShadow: `0 0 12px ${st.bar}` }} />
            <div className="pl-4 pr-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="mono text-[.6rem] px-1.5 py-0.5 rounded font-bold tracking-wider" style={{ background: st.chip, color: st.bar }}>
                  {st.icon} {st.label}
                </span>
                <span className="mono text-[.6rem] text-[#48586A]">{a.time}</span>
              </div>
              <div className="mt-1.5 text-[.84rem] text-[#D6DEE7]" dangerouslySetInnerHTML={{ __html: a.msg }} />
              <div className="mt-2 px-2.5 py-2 rounded-lg text-[.78rem] text-[#CBD6E0] relative overflow-hidden"
                   style={{ background: "linear-gradient(180deg, rgba(47,179,163,.10), rgba(47,179,163,.04))", border: "1px solid rgba(47,179,163,.22)" }}>
                <span className="mono text-[.58rem] font-bold text-[#2FB3A3] tracking-widest">◈ CARETWIN AI</span>
                <div className="mt-1" dangerouslySetInnerHTML={{ __html: a.ai }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
