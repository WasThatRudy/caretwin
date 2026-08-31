"use client";
import { useEffect, useRef } from "react";
import { useMonitor } from "@/lib/store";

// Real replayed HR + SpO2 over the trailing window of the recording.
export default function LiveTrend() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, cx = c.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      const { bpmHist, spo2Hist } = useMonitor.getState();
      const w = c.clientWidth || 600, h = 150, dpr = Math.min(devicePixelRatio || 1, 2);
      if (c.width !== Math.floor(w * dpr)) { c.width = w * dpr; c.height = h * dpr; }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, w, h);
      const mL = 30, mR = 34, mT = 8, mB = 18, pw = w - mL - mR, ph = h - mT - mB;
      // SpO2 danger band (<90) on right axis 82..100
      const sY = (v: number) => mT + (1 - (Math.max(82, Math.min(100, v)) - 82) / 18) * ph;
      cx.fillStyle = "rgba(224,92,70,.06)"; cx.fillRect(mL, sY(90), pw, mT + ph - sY(90));
      // grid
      cx.strokeStyle = "#1B2430"; cx.lineWidth = 1;
      [0, .5, 1].forEach((f) => { const y = mT + f * ph; cx.beginPath(); cx.moveTo(mL, y); cx.lineTo(mL + pw, y); cx.stroke(); });
      const n = Math.max(bpmHist.length, 1);
      const X = (i: number) => mL + (i / Math.max(1, n - 1)) * pw;
      const bY = (v: number) => mT + (1 - (Math.max(45, Math.min(100, v)) - 45) / 55) * ph;
      const line = (data: number[], Y: (v: number) => number, col: string) => {
        cx.strokeStyle = col; cx.lineWidth = 1.8; cx.lineJoin = "round"; cx.beginPath();
        data.forEach((v, i) => (i ? cx.lineTo(X(i), Y(v)) : cx.moveTo(X(i), Y(v)))); cx.stroke();
      };
      line(bpmHist, bY, "#35B8A6");
      line(spo2Hist, sY, "#5B8DEF");
      // axis labels
      cx.fillStyle = "#49535F"; cx.font = "9px ui-monospace, monospace";
      cx.textAlign = "right"; cx.fillText("100", mL - 4, bY(100) + 3); cx.fillText("45", mL - 4, bY(45) + 3);
      cx.textAlign = "left"; cx.fillText("100", mL + pw + 4, sY(100) + 3); cx.fillText("82", mL + pw + 4, sY(82) + 3);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="eyebrow !text-[var(--mute)]">Replay · trailing window</span>
        <div className="flex gap-3 text-[11px] mono">
          <span className="flex items-center gap-1"><span className="w-3 h-[2px] inline-block" style={{ background: "#35B8A6" }} />HR</span>
          <span className="flex items-center gap-1"><span className="w-3 h-[2px] inline-block" style={{ background: "#5B8DEF" }} />SpO₂</span>
        </div>
      </div>
      <canvas ref={ref} height={150} className="w-full block rounded-md" />
    </div>
  );
}
