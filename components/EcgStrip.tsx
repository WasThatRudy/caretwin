"use client";
import { useEffect, useRef } from "react";
import { useMonitor } from "@/lib/store";

// HR-derived rhythm strip (visual). The dataset provides heart rate, not raw ECG,
// so the trace is synthesised at the live BPM as a monitor-style visualisation.
export default function EcgStrip({ height = 84 }: { height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, cx = c.getContext("2d")!;
    let raf = 0, x = 0, lastBeat = 0, buf: number[] = [];
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const beat = (p: number) => {
      const g = (c0: number, a: number, w: number) => a * Math.exp(-Math.pow((p - c0) / w, 2));
      return g(0.18, 0.12, 0.035) - g(0.30, 0.10, 0.012) + g(0.34, 1.0, 0.010) - g(0.39, 0.26, 0.016) + g(0.62, 0.22, 0.05);
    };
    const draw = () => {
      const { bpm, warn } = useMonitor.getState();
      const w = c.clientWidth || 500, h = height;
      if (c.width !== Math.floor(w * dpr)) { c.width = w * dpr; c.height = h * dpr; buf = new Array(Math.ceil(w)).fill(h / 2); }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const speed = 1.6 + bpm / 110, beatPx = (60 / Math.max(40, bpm)) * 240;
      const color = warn ? "#E05C46" : "#35B8A6";
      for (let s = 0; s < speed; s++) {
        x = (x + 1) % w;
        if (x < lastBeat) lastBeat = x;
        const local = ((x - lastBeat) % beatPx) / beatPx;
        if (local >= 0.999) lastBeat = x;
        buf[x] = h / 2 - beat(local) * (h * 0.4) + (Math.random() - 0.5);
      }
      cx.fillStyle = "rgba(11,14,19,0.3)"; cx.fillRect(0, 0, w, h);
      cx.strokeStyle = "rgba(120,150,180,.05)"; cx.beginPath(); cx.moveTo(0, h / 2); cx.lineTo(w, h / 2); cx.stroke();
      cx.strokeStyle = color; cx.lineWidth = 1.6; cx.lineJoin = "round"; cx.shadowColor = color; cx.shadowBlur = 6;
      cx.beginPath(); for (let i = 0; i < w; i++) i ? cx.lineTo(i, buf[i]) : cx.moveTo(i, buf[i]); cx.stroke(); cx.shadowBlur = 0;
      cx.fillStyle = color; cx.beginPath(); cx.arc(x, buf[x] || h / 2, 2, 0, 7); cx.fill();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [height]);
  return <canvas ref={ref} style={{ height }} className="w-full block rounded-md" />;
}
