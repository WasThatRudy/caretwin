"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useMonitor, MONITOR_META } from "@/lib/store";
import VitalTiles from "./VitalTiles";
import LiveTrend from "./LiveTrend";
import AlertFeed from "./AlertFeed";
import MonitorControls from "./MonitorControls";
import EcgStrip from "./EcgStrip";

const HeartTwin = dynamic(() => import("./HeartTwin"), { ssr: false });

export default function LiveMonitor() {
  const tick = useMonitor((s) => s.tick);
  const bpm = useMonitor((s) => s.bpm);
  const level = useMonitor((s) => s.level);
  const warn = useMonitor((s) => s.warn);

  useEffect(() => {
    const id = setInterval(() => tick(), 800);
    return () => clearInterval(id);
  }, [tick]);

  return (
    <section id="monitor" className="max-w-[1120px] mx-auto px-5 md:px-8 py-12 scroll-mt-16">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-7">
        <div>
          <div className="eyebrow mb-2">Live monitor · real overnight recording</div>
          <h2 className="section-title">Digital twin, driven by the actual data</h2>
        </div>
        <div className="text-[12px] mono text-[var(--faint)]">
          replaying {MONITOR_META.N} min from {MONITOR_META.start.slice(0, 10)} · min SpO₂ {MONITOR_META.minSpo2}%
        </div>
      </div>

      <div className="grid lg:grid-cols-[5fr_7fr] gap-4">
        {/* 3D heart stage */}
        <div className="card overflow-hidden relative" style={{ background: "#090C11" }}>
          <div className="relative h-[300px]">
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 42%, ${warn ? "rgba(224,92,70,.14)" : "rgba(53,184,166,.12)"}, transparent 62%)` }} />
            <HeartTwin />
            <div className="absolute left-3 top-3 mono text-[10px] tracking-widest text-[var(--faint)]">◉ TWIN · SYNCED</div>
            <div className="absolute left-3 bottom-3 mono text-[10px] tracking-widest" style={{ color: warn ? "#E05C46" : "#4BB07E" }}>
              {warn ? "● ANOMALY" : "● NOMINAL"} · {level.toUpperCase()}
            </div>
            <div className="absolute right-3 bottom-3 text-right">
              <div className="mono tnum text-[30px] font-semibold leading-none" style={{ color: warn ? "#E05C46" : "#35B8A6" }}>{Math.round(bpm)}</div>
              <div className="eyebrow !text-[var(--faint)]">bpm · live</div>
            </div>
          </div>
          <div className="px-3 pb-3 pt-1 border-t border-[var(--line)]">
            <EcgStrip height={76} />
          </div>
        </div>

        {/* vitals + trend + controls */}
        <div className="flex flex-col gap-4">
          <VitalTiles />
          <div className="card p-4"><LiveTrend /></div>
          <div className="card p-3.5"><MonitorControls /></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[5fr_7fr] gap-4 mt-4">
        <div className="card p-4">
          <div className="eyebrow !text-[var(--mute)] mb-2">How it works</div>
          <p className="cap leading-relaxed">
            The twin replays a real Fitbit Sense 2 recording minute-by-minute. Heart rate drives the 3D model and the
            rhythm strip; an on-edge detector watches the 5-minute SpO₂ mean against clinical thresholds and raises
            guidance when it crosses into hypoxemia. Use <b>Jump to desaturation event</b> to see a real dip fire.
          </p>
        </div>
        <div className="card p-4">
          <div className="eyebrow !text-[var(--mute)] mb-3">Alerts &amp; AI guidance</div>
          <AlertFeed />
        </div>
      </div>
    </section>
  );
}
