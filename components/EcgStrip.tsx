"use client";
import { useEffect, useRef } from "react";
import { useVitals } from "@/lib/store";

// A live scrolling ECG trace, like a bedside monitor. Sweep speed follows BPM.
export default function EcgStrip({ height = 88 }: { height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    const cx = c.getContext("2d")!;
    let raf = 0;
    let x = 0;
    let lastBeatX = 0;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let buf: number[] = [];

    // one PQRST beat as a function of local phase 0..1
    const beat = (p: number) => {
      const g = (c0: number, a: number, w: number) => a * Math.exp(-Math.pow((p - c0) / w, 2));
      return g(0.18, 0.12, 0.035) - g(0.30, 0.10, 0.012) + g(0.34, 1.0, 0.010)
           - g(0.39, 0.26, 0.016) + g(0.62, 0.24, 0.05);
    };

    const draw = () => {
      const { hr, warn } = useVitals.getState();
      const w = c.clientWidth || 600, h = height;
      if (c.width !== Math.floor(w * dpr)) { c.width = w * dpr; c.height = h * dpr; buf = new Array(Math.ceil(w)).fill(h / 2); }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const speed = 2.0 + hr / 90;                 // px per frame, scales with HR
      const beatPx = (60 / hr) * 260;              // px between beats
      const color = warn ? "#E5533C" : "#2FB3A3";

      for (let s = 0; s < speed; s++) {
        x = (x + 1) % w;
        if (x - lastBeatX >= beatPx || x < lastBeatX) { if (x < lastBeatX) lastBeatX = x; }
        const local = ((x - lastBeatX) % beatPx) / beatPx;
        if (local >= 0.999) lastBeatX = x;
        const y = h / 2 - beat(local) * (h * 0.42) + (Math.random() - 0.5) * 1.2;
        buf[x] = y;
      }

      // fade previous frame (trail) then redraw whole buffer
      cx.fillStyle = "rgba(7,11,17,0.28)";
      cx.fillRect(0, 0, w, h);
      // baseline grid
      cx.strokeStyle = "rgba(120,150,180,.06)"; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(0, h / 2); cx.lineTo(w, h / 2); cx.stroke();

      cx.strokeStyle = color; cx.lineWidth = 1.8; cx.lineJoin = "round";
      cx.shadowColor = color; cx.shadowBlur = 8;
      cx.beginPath();
      for (let i = 0; i < w; i++) { i ? cx.lineTo(i, buf[i]) : cx.moveTo(i, buf[i]); }
      cx.stroke();
      cx.shadowBlur = 0;
      // sweep head
      cx.fillStyle = color;
      cx.beginPath(); cx.arc(x, buf[x], 2.4, 0, 7); cx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [height]);

  return <canvas ref={ref} style={{ height }} className="w-full block rounded-lg" />;
}
