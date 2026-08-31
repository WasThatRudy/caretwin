"use client";
import { useMonitor } from "@/lib/store";

function Spark({ data, color, lo, hi }: { data: number[]; color: string; lo?: number; hi?: number }) {
  if (data.length < 2) return <svg viewBox="0 0 100 26" className="w-full h-[26px]" />;
  const mn = lo ?? Math.min(...data), mx = hi ?? Math.max(...data), rng = mx - mn || 1;
  const n = data.length;
  const X = (i: number) => (i / (n - 1)) * 100;
  const Y = (v: number) => 24 - ((Math.max(mn, Math.min(mx, v)) - mn) / rng) * 22;
  const line = data.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  const area = `${line}L100,26L0,26Z`;
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="w-full h-[26px]">
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Ring({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, (value - 80) / 20));
  const R = 24, Cc = 2 * Math.PI * R;
  const col = value < 88 ? "#E05C46" : value < 92 ? "#E0A13A" : "#35B8A6";
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" className="shrink-0">
      <circle cx="29" cy="29" r={R} fill="none" stroke="rgba(120,150,180,.12)" strokeWidth="5" />
      <circle cx="29" cy="29" r={R} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={Cc} strokeDashoffset={Cc * (1 - pct)} transform="rotate(-90 29 29)"
        style={{ transition: "stroke-dashoffset .4s ease, stroke .3s" }} />
      <text x="29" y="33" textAnchor="middle" className="mono tnum" fontSize="14" fontWeight="600" fill="#E7ECF2">{Math.round(value)}</text>
    </svg>
  );
}

export default function VitalTiles() {
  const { bpm, spo2, roll, level, bpmHist, spo2Hist, warn } = useMonitor();
  const sev = roll < 88 ? "severe" : roll < 90 ? "moderate" : roll < 95 ? "mild" : "normal";
  const sevCol = roll < 88 ? "#E05C46" : roll < 92 ? "#E0A13A" : "#4BB07E";
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="card p-3.5">
        <div className="eyebrow !text-[var(--mute)] flex items-center justify-between">
          Heart rate
          <span className="w-1.5 h-1.5 rounded-full blink" style={{ background: warn ? "#E05C46" : "#35B8A6" }} />
        </div>
        <div className="mono tnum text-[28px] font-semibold leading-none mt-1.5">{Math.round(bpm)}<span className="text-[12px] font-normal muted ml-1">bpm</span></div>
        <div className="mt-2"><Spark data={bpmHist} color="#35B8A6" lo={45} hi={95} /></div>
      </div>

      <div className="card p-3.5 flex items-center gap-3">
        <Ring value={spo2} />
        <div className="min-w-0">
          <div className="eyebrow !text-[var(--mute)]">SpO₂</div>
          <div className="mono tnum text-[22px] font-semibold leading-none mt-1">{spo2.toFixed(0)}<span className="text-[11px] font-normal muted ml-0.5">%</span></div>
          <div className="mono text-[11px] mt-1" style={{ color: sevCol }}>{sev} · 5-min {roll.toFixed(0)}%</div>
        </div>
      </div>

      <div className="card p-3.5">
        <div className="eyebrow !text-[var(--mute)]">Sleep stage</div>
        <div className="text-[20px] font-semibold mt-1.5 capitalize">{level}</div>
        <div className="flex gap-1 mt-2.5">
          {["deep", "light", "rem", "wake"].map((s) => (
            <span key={s} className="h-1.5 flex-1 rounded-full" style={{ background: s === level ? "#35B8A6" : "rgba(120,150,180,.12)" }} title={s} />
          ))}
        </div>
      </div>

      <div className="card p-3.5">
        <div className="eyebrow !text-[var(--mute)]">SpO₂ trend</div>
        <div className="mono tnum text-[16px] font-semibold mt-1.5" style={{ color: sevCol }}>{roll.toFixed(1)}%</div>
        <div className="mt-1"><Spark data={spo2Hist} color={sevCol} lo={82} hi={99} /></div>
      </div>
    </div>
  );
}
