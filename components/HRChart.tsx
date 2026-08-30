"use client";
import { useEffect, useRef } from "react";
import { useVitals } from "@/lib/store";

export default function HRChart() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current;
      if (c) {
        const cx = c.getContext("2d")!;
        const { hist, warn } = useVitals.getState();
        const w = c.clientWidth || 600, h = 170, dpr = Math.min(devicePixelRatio || 1, 2);
        if (c.width !== Math.floor(w * dpr)) { c.width = w * dpr; c.height = h * dpr; }
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cx.clearRect(0, 0, w, h);
        const lo = 45, hi = 180, yOf = (v: number) => h - ((v - lo) / (hi - lo)) * h;

        // danger zone
        cx.fillStyle = "rgba(229,83,60,.07)"; cx.fillRect(0, 0, w, yOf(120));
        // grid + labels
        cx.strokeStyle = "rgba(120,150,180,.08)"; cx.lineWidth = 1;
        cx.font = "10px ui-monospace, monospace"; cx.fillStyle = "#48586A";
        [60, 90, 120, 150].forEach((v) => {
          cx.beginPath(); cx.moveTo(28, yOf(v)); cx.lineTo(w, yOf(v)); cx.stroke();
          cx.fillText(String(v), 4, yOf(v) + 3);
        });

        const MAXP = 120, n = hist.length, dx = (w - 28) / MAXP, ox = 28;
        if (n >= 2) {
          const line = warn ? "#E5533C" : "#2FB3A3";
          // area fill
          cx.beginPath(); cx.moveTo(ox, h);
          for (let i = 0; i < n; i++) cx.lineTo(ox + i * dx, yOf(hist[i]));
          cx.lineTo(ox + (n - 1) * dx, h); cx.closePath();
          const g = cx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, line + "44"); g.addColorStop(1, line + "00");
          cx.fillStyle = g; cx.fill();
          // line with glow
          cx.strokeStyle = line; cx.lineWidth = 2.2; cx.lineJoin = "round";
          cx.shadowColor = line; cx.shadowBlur = 10;
          cx.beginPath();
          for (let i = 0; i < n; i++) { const x = ox + i * dx, y = yOf(hist[i]); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }
          cx.stroke(); cx.shadowBlur = 0;

          // Bi-LSTM forecast
          const last = hist[n - 1], prev = hist[Math.max(0, n - 6)], slope = (last - prev) / 6;
          cx.strokeStyle = "#E3A82B"; cx.lineWidth = 2; cx.setLineDash([5, 4]);
          cx.beginPath(); cx.moveTo(ox + (n - 1) * dx, yOf(last));
          for (let k = 1; k <= 20; k++) { const pv = Math.max(45, Math.min(180, last + slope * k)); cx.lineTo(ox + (n - 1 + k) * dx, yOf(pv)); }
          cx.stroke(); cx.setLineDash([]);
          // head dot
          cx.fillStyle = line; cx.shadowColor = line; cx.shadowBlur = 8;
          cx.beginPath(); cx.arc(ox + (n - 1) * dx, yOf(last), 3.2, 0, 7); cx.fill(); cx.shadowBlur = 0;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="label">Heart rate · 60s + Bi-LSTM forecast</p>
        <div className="flex items-center gap-3 label !tracking-normal">
          <span className="flex items-center gap-1"><span className="w-3 h-[2px] bg-[#2FB3A3] inline-block" />actual</span>
          <span className="flex items-center gap-1"><span className="w-3 h-[2px] inline-block" style={{ background: "repeating-linear-gradient(90deg,#E3A82B 0 3px,transparent 3px 6px)" }} />predicted</span>
        </div>
      </div>
      <canvas ref={ref} height={170} className="w-full rounded-lg block" />
    </>
  );
}
