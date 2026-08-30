"use client";
import { useVitals } from "@/lib/store";

const NODES = [
  { label: "Wearable", tier: "in" },
  { label: "DataOps", tier: "edge" },
  { label: "Twin models", tier: "edge" },
  { label: "Anomaly", tier: "edge" },
  { label: "LLM", tier: "cloud" },
  { label: "Dashboard", tier: "in" },
] as const;

const tint: Record<string, string> = { in: "#8DA0B4", edge: "#2FB3A3", cloud: "#E3A82B" };

function Connector({ color, i }: { color: string; i: number }) {
  return (
    <div className="relative flex-1 h-[2px] mx-1 rounded" style={{ background: "rgba(120,150,180,.14)" }}>
      <span className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}`, animation: `flow 2.4s linear ${i * 0.3}s infinite` }} />
      <style>{`@keyframes flow{0%{left:0;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:100%;opacity:0}}`}</style>
    </div>
  );
}

export default function DataFlow() {
  const trigger = useVitals((s) => s.trigger);
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="label">Data pipeline · edge → cloud</p>
        <div className="flex items-center gap-3 label !tracking-normal">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#2FB3A3" }} />edge</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#E3A82B" }} />cloud</span>
        </div>
      </div>

      <div className="flex items-center">
        {NODES.map((n, i) => (
          <div key={n.label} className="flex items-center" style={{ flex: i === NODES.length - 1 ? "0 0 auto" : "1 1 0" }}>
            <div className="shrink-0 px-2.5 py-1.5 rounded-lg mono text-[.62rem] whitespace-nowrap border"
              style={{ color: tint[n.tier], borderColor: `${tint[n.tier]}44`, background: `${tint[n.tier]}12` }}>
              {n.label}
            </div>
            {i < NODES.length - 1 && <Connector color={tint[NODES[i + 1].tier]} i={i} />}
          </div>
        ))}
      </div>

      <div className="flex gap-2.5 flex-wrap mt-4">
        <button onClick={() => trigger("spo2")}
          className="group flex items-center gap-2 font-semibold text-[.82rem] text-[#EAF1F8] px-3.5 py-2 rounded-xl border border-[rgba(229,83,60,.35)] transition-all hover:glow-danger hover:bg-[rgba(229,83,60,.12)]"
          style={{ background: "rgba(229,83,60,.06)" }}>
          <span className="w-2 h-2 rounded-full bg-[#E5533C] pulse-dot" /> Simulate SpO₂ drop
        </button>
        <button onClick={() => trigger("hr")}
          className="group flex items-center gap-2 font-semibold text-[.82rem] text-[#EAF1F8] px-3.5 py-2 rounded-xl border border-[rgba(229,83,60,.35)] transition-all hover:glow-danger hover:bg-[rgba(229,83,60,.12)]"
          style={{ background: "rgba(229,83,60,.06)" }}>
          <span className="w-2 h-2 rounded-full bg-[#E5533C] pulse-dot" /> Simulate HR spike
        </button>
        <button onClick={() => trigger("reset")}
          className="font-semibold text-[.82rem] text-[#9FB0C0] px-3.5 py-2 rounded-xl border border-[rgba(150,180,210,.18)] transition-all hover:border-[#2FB3A3] hover:text-[#2FB3A3]">
          ↺ Reset
        </button>
      </div>
    </>
  );
}
