"use client";
import { useEffect, useRef, useState } from "react";
import { useVitals } from "@/lib/store";

function useTrail(value: number, n = 40) {
  const ref = useRef<number[]>([]);
  ref.current = [...ref.current, value].slice(-n);
  return ref.current;
}

function AnimatedNumber({ value, digits = 0 }: { value: number; digits?: number }) {
  const [disp, setDisp] = useState(value);
  const cur = useRef(value);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      cur.current += (value - cur.current) * 0.2;
      if (Math.abs(value - cur.current) < 0.1) cur.current = value;
      setDisp(cur.current);
      if (cur.current !== value) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{disp.toFixed(digits)}</>;
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!; const cx = c.getContext("2d")!;
    const w = c.clientWidth || 80, h = 30, dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = w * dpr; c.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, w, h);
    if (data.length < 2) return;
    const lo = Math.min(...data), hi = Math.max(...data), rng = hi - lo || 1;
    const dx = w / (data.length - 1);
    const y = (v: number) => h - 3 - ((v - lo) / rng) * (h - 6);
    cx.beginPath(); cx.moveTo(0, h);
    data.forEach((v, i) => cx.lineTo(i * dx, y(v)));
    cx.lineTo(w, h); cx.closePath();
    const grad = cx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + "55"); grad.addColorStop(1, color + "00");
    cx.fillStyle = grad; cx.fill();
    cx.beginPath();
    data.forEach((v, i) => (i ? cx.lineTo(i * dx, y(v)) : cx.moveTo(i * dx, y(v))));
    cx.strokeStyle = color; cx.lineWidth = 1.5; cx.stroke();
  }, [data, color]);
  return <canvas ref={ref} className="w-full block" style={{ height: 30 }} />;
}

function Ring({ value, warn }: { value: number; warn: boolean }) {
  const pct = Math.max(0, Math.min(1, (value - 80) / 20)); // 80..100 -> 0..1
  const R = 26, C = 2 * Math.PI * R;
  const col = warn ? "#E5533C" : value < 94 ? "#E39B2B" : "#2FB3A3";
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(120,150,180,.14)" strokeWidth="6" />
      <circle cx="32" cy="32" r={R} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dashoffset .5s ease, stroke .4s ease", filter: `drop-shadow(0 0 5px ${col}aa)` }} />
      <text x="32" y="36" textAnchor="middle" className="mono tnum" fontSize="15" fontWeight="700" fill="#EAF1F8">{Math.round(value)}</text>
    </svg>
  );
}

const HeartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.9-10-9.2C.3 8.6 1.8 5 5.2 5c2 0 3.3 1.1 4.1 2.3.8-1.2 2.1-2.3 4.1-2.3 3.4 0 4.9 3.6 3.2 6.8C19.5 16.1 12 21 12 21z"/></svg>
);

export default function VitalTiles() {
  const { hr, spo2, hrv, sleep, hist } = useVitals();
  const hrvTrail = useTrail(hrv);
  const warnHR = hr > 120, warnSpO2 = spo2 < 90;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Heart rate */}
      <div className={`glass rounded-2xl p-4 relative overflow-hidden ${warnHR ? "glow-danger" : ""}`}>
        <div className="flex items-center justify-between">
          <span className="label flex items-center gap-1.5"><span className={warnHR ? "text-[#E5533C]" : "text-[#2FB3A3]"}><HeartIcon /></span>Heart rate</span>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: warnHR ? "#E5533C" : "#2FB3A3", animation: "ping-ring 1.2s cubic-bezier(0,0,.2,1) infinite" }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: warnHR ? "#E5533C" : "#2FB3A3" }} />
          </span>
        </div>
        <div className={`mono tnum font-bold leading-none mt-2 text-[2.2rem] ${warnHR ? "text-[#E5533C]" : "text-[#EAF1F8]"}`}>
          <AnimatedNumber value={hr} /><span className="text-[.8rem] font-normal text-[#6E7E8F] ml-1">bpm</span>
        </div>
        <div className="mt-2 -mb-1"><Spark data={hist.slice(-40)} color={warnHR ? "#E5533C" : "#2FB3A3"} /></div>
      </div>

      {/* SpO2 with ring */}
      <div className={`glass rounded-2xl p-4 flex items-center gap-3 ${warnSpO2 ? "glow-danger" : ""}`}>
        <Ring value={spo2} warn={warnSpO2} />
        <div>
          <div className="label">SpO&#8322;</div>
          <div className={`mono tnum font-bold leading-none mt-1 text-[1.7rem] ${warnSpO2 ? "text-[#E5533C]" : "text-[#EAF1F8]"}`}>
            <AnimatedNumber value={spo2} /><span className="text-[.72rem] font-normal text-[#6E7E8F] ml-0.5">%</span>
          </div>
          <div className="label mt-1 !tracking-wide" style={{ color: warnSpO2 ? "#E5533C" : spo2 < 94 ? "#E39B2B" : "#3FB27F" }}>
            {warnSpO2 ? "hypoxemia" : spo2 < 94 ? "borderline" : "normal"}
          </div>
        </div>
      </div>

      {/* Sleep */}
      <div className="glass rounded-2xl p-4">
        <div className="label">Sleep stage</div>
        <div className="font-bold text-[1.5rem] mt-2 tracking-tight">{sleep}</div>
        <div className="flex gap-1 mt-3">
          {["Awake", "Light", "Deep", "REM"].map((s) => (
            <span key={s} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: s === sleep ? "#2FB3A3" : "rgba(120,150,180,.14)" }} />
          ))}
        </div>
      </div>

      {/* HRV */}
      <div className="glass rounded-2xl p-4">
        <div className="label">HRV</div>
        <div className="mono tnum font-bold leading-none mt-2 text-[2.2rem]">
          <AnimatedNumber value={hrv} /><span className="text-[.8rem] font-normal text-[#6E7E8F] ml-1">ms</span>
        </div>
        <div className="mt-2 -mb-1"><Spark data={hrvTrail} color="#8A9BF0" /></div>
      </div>
    </div>
  );
}
