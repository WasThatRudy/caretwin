"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useVitals } from "@/lib/store";
import VitalTiles from "./VitalTiles";
import HRChart from "./HRChart";
import DataFlow from "./DataFlow";
import AlertFeed from "./AlertFeed";
import EcgStrip from "./EcgStrip";

const HeartTwin = dynamic(() => import("./HeartTwin"), { ssr: false });

function Clock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const f = () => setT(new Date().toLocaleTimeString());
    f(); const id = setInterval(f, 1000); return () => clearInterval(id);
  }, []);
  return <span className="mono tnum text-[.72rem] text-[#9FB0C0]">{t}</span>;
}

function Panel({ label, right, children, className = "", sheen = false }: {
  label?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; sheen?: boolean;
}) {
  return (
    <div className={`glass ${sheen ? "sheen glass-hi" : ""} p-4 ${className}`}>
      {(label || right) && (
        <div className="flex items-center justify-between mb-3">
          {label && <p className="label">{label}</p>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export default function Dashboard() {
  const tick = useVitals((s) => s.tick);
  const hr = useVitals((s) => s.hr);
  const warn = useVitals((s) => s.warn);

  useEffect(() => {
    const id = setInterval(() => tick(), 500);
    return () => clearInterval(id);
  }, [tick]);

  const accent = warn ? "#E5533C" : "#2FB3A3";

  return (
    <>
      <div className="bg-stage" />
      <div className="bg-grid" />

      {/* top bar */}
      <header className="sticky top-0 z-20 border-b border-[rgba(150,180,210,.08)]"
              style={{ background: "rgba(7,11,17,.6)", backdropFilter: "blur(14px)" }}>
        <div className="max-w-[1280px] mx-auto flex items-center gap-3.5 px-5 py-3">
          <div className="w-9 h-9 rounded-xl grid place-items-center text-lg glow-teal"
               style={{ background: "linear-gradient(135deg,#2FB3A3,#0E8A7D)" }}>🫀</div>
          <div>
            <h1 className="text-[1.05rem] font-bold tracking-tight leading-none">CareTwin</h1>
            <div className="label mt-1">Elderly Digital Twin · live monitor</div>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden sm:flex mono text-[.64rem] px-2.5 py-1 rounded-full border border-[rgba(47,179,163,.28)] text-[#2FB3A3] items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2FB3A3]" /> EDGE
            </span>
            <span className="hidden sm:flex mono text-[.64rem] px-2.5 py-1 rounded-full border border-[rgba(227,155,43,.28)] text-[#E3A82B] items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E3A82B]" /> CLOUD
            </span>
            <Clock />
            <span className="mono text-[.66rem] px-2.5 py-1 rounded-full border border-[rgba(150,180,210,.14)] text-[#9FB0C0] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3FB27F] pulse-dot" style={{ boxShadow: "0 0 8px #3FB27F" }} /> LIVE
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-5 py-4 flex flex-col gap-4">
        {/* patient + ECG banner */}
        <Panel sheen right={<span className={`mono tnum text-[.78rem] ${warn ? "text-[#E5533C]" : "text-[#2FB3A3]"}`}>{Math.round(hr)} bpm</span>}
               label="Lead II · continuous ECG"
               className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full grid place-items-center text-sm" style={{ background: "rgba(150,180,210,.08)" }}>👤</div>
            <div>
              <div className="text-[.92rem] font-semibold leading-none">Ramesh K.</div>
              <div className="label mt-1">74y · Male · Home care</div>
            </div>
          </div>
          <EcgStrip height={92} />
        </Panel>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
          {/* left column */}
          <div className="flex flex-col gap-4">
            <Panel label="Vitals · real-time">
              <VitalTiles />
              <div className="mt-4"><HRChart /></div>
            </Panel>
            <Panel><DataFlow /></Panel>
          </div>

          {/* right column */}
          <div className="flex flex-col gap-4">
            <Panel label="Digital twin · anatomical heart" className="relative overflow-hidden"
                   right={<span className="label !tracking-normal text-[#6E7E8F]">drag to rotate</span>}>
              <div className="relative rounded-xl overflow-hidden" style={{ boxShadow: "inset 0 0 60px rgba(0,0,0,.6)" }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 42%, ${accent}22, transparent 62%)`, transition: "background .5s" }} />
                <div className="w-full h-[320px]">
                  <HeartTwin />
                </div>
                {/* HUD corners */}
                <div className="absolute left-3 top-3 label">◉ TWIN · SYNCED</div>
                <div className="absolute right-3 bottom-3 text-right">
                  <div className={`mono tnum text-[1.9rem] font-bold leading-none ${warn ? "text-[#E5533C]" : "text-[#2FB3A3]"}`} style={{ textShadow: `0 0 18px ${accent}77` }}>{Math.round(hr)}</div>
                  <div className="label">bpm · live</div>
                </div>
                <div className="absolute left-3 bottom-3 label" style={{ color: warn ? "#E5533C" : "#3FB27F" }}>{warn ? "● ANOMALY" : "● NOMINAL"}</div>
              </div>
            </Panel>
            <Panel label="Alerts & AI recommendations"><AlertFeed /></Panel>
          </div>
        </div>

        <div className="text-center label py-2">
          CareTwin prototype · Next.js + react-three-fiber · simulated data · not a medical device
        </div>
      </main>
    </>
  );
}
