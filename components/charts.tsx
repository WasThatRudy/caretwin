import type { Hist } from "@/lib/data";

export const C = {
  teal: "#35B8A6", blue: "#5B8DEF", violet: "#9B7CF0", amber: "#E0A13A", rose: "#E0708A", slate: "#8391A2",
  good: "#4BB07E", warn: "#E0A13A", bad: "#E05C46",
  grid: "#1E2732", axis: "#49535F", ink: "#8B97A5", line: "#212B37",
};

const W = 640;
const M = { l: 44, r: 14, t: 12, b: 30 };

function Frame({ h, children }: { h: number; children: React.ReactNode }) {
  return <svg viewBox={`0 0 ${W} ${h}`} className="w-full h-auto block" style={{ overflow: "visible" }}>{children}</svg>;
}

function yTicks(max: number, h: number, n = 4) {
  const py = h - M.b, ph = py - M.t;
  return Array.from({ length: n + 1 }, (_, i) => {
    const v = (max / n) * i;
    return { v, y: py - (v / max) * ph };
  });
}

export function Histogram({ data, color = C.teal, xlabel, ylabel = "count", height = 220, fmtx = (x: number) => String(x) }:
  { data: Hist; color?: string; xlabel?: string; ylabel?: string; height?: number; fmtx?: (x: number) => string }) {
  const h = height, px = W - M.l - M.r, py = h - M.b, ph = py - M.t;
  const max = Math.max(...data.counts) || 1;
  const bw = px / data.counts.length;
  return (
    <Frame h={h}>
      {yTicks(max, h).map((t, i) => (
        <g key={i}>
          <line x1={M.l} x2={W - M.r} y1={t.y} y2={t.y} stroke={C.grid} strokeWidth={1} />
          <text x={M.l - 6} y={t.y + 3} textAnchor="end" fontSize={10} fill={C.axis} className="mono">{Math.round(t.v)}</text>
        </g>
      ))}
      {data.counts.map((c, i) => {
        const bh = (c / max) * ph;
        return <rect key={i} x={M.l + i * bw + 0.5} y={py - bh} width={Math.max(0.5, bw - 1)} height={bh} fill={color} opacity={0.9} rx={0.5} />;
      })}
      {data.centers.map((cx, i) => i % 8 === 0 && (
        <text key={i} x={M.l + i * bw + bw / 2} y={py + 14} textAnchor="middle" fontSize={10} fill={C.axis} className="mono">{fmtx(cx)}</text>
      ))}
      {xlabel && <text x={M.l + px / 2} y={h - 2} textAnchor="middle" fontSize={11} fill={C.ink}>{xlabel}</text>}
      <text x={12} y={M.t + ph / 2} textAnchor="middle" fontSize={11} fill={C.ink} transform={`rotate(-90 12 ${M.t + ph / 2})`}>{ylabel}</text>
    </Frame>
  );
}

export function GroupedHist({ a, b, colors = [C.violet, C.amber], height = 220, xlabel }:
  { a: Hist; b: Hist; colors?: [string, string]; height?: number; xlabel?: string }) {
  const h = height, px = W - M.l - M.r, py = h - M.b, ph = py - M.t;
  const max = Math.max(...a.counts, ...b.counts) || 1;
  const bw = px / a.counts.length;
  const bars = (d: Hist, col: string, op: number) => d.counts.map((c, i) => (
    <rect key={col + i} x={M.l + i * bw + 0.5} y={py - (c / max) * ph} width={Math.max(0.5, bw - 1)} height={(c / max) * ph} fill={col} opacity={op} />
  ));
  return (
    <Frame h={h}>
      {yTicks(max, h).map((t, i) => <line key={i} x1={M.l} x2={W - M.r} y1={t.y} y2={t.y} stroke={C.grid} strokeWidth={1} />)}
      {bars(a, colors[0], 0.55)}
      {bars(b, colors[1], 0.55)}
      {a.centers.map((cx, i) => i % 8 === 0 && (
        <text key={i} x={M.l + i * bw + bw / 2} y={py + 14} textAnchor="middle" fontSize={10} fill={C.axis} className="mono">{Math.round(cx)}</text>
      ))}
      {xlabel && <text x={M.l + px / 2} y={h - 2} textAnchor="middle" fontSize={11} fill={C.ink}>{xlabel}</text>}
    </Frame>
  );
}

export function BarCat({ items, height = 200, maxOverride }:
  { items: { label: string; value: number; color?: string }[]; height?: number; maxOverride?: number }) {
  const h = height, px = W - M.l - M.r, py = h - M.b, ph = py - M.t;
  const max = (maxOverride ?? (Math.max(...items.map((i) => i.value)) * 1.1)) || 1;
  const gap = 14, bw = (px - gap * (items.length - 1)) / items.length;
  return (
    <Frame h={h}>
      {yTicks(max, h).map((t, i) => (
        <g key={i}>
          <line x1={M.l} x2={W - M.r} y1={t.y} y2={t.y} stroke={C.grid} strokeWidth={1} />
          <text x={M.l - 6} y={t.y + 3} textAnchor="end" fontSize={10} fill={C.axis} className="mono">{t.v.toFixed(t.v < 10 ? 1 : 0)}</text>
        </g>
      ))}
      {items.map((it, i) => {
        const x = M.l + i * (bw + gap), bh = (it.value / max) * ph;
        return (
          <g key={i}>
            <rect x={x} y={py - bh} width={bw} height={bh} fill={it.color ?? C.teal} rx={2} />
            <text x={x + bw / 2} y={py - bh - 5} textAnchor="middle" fontSize={11} fill={C.ink} className="mono tnum">{it.value}</text>
            <text x={x + bw / 2} y={py + 15} textAnchor="middle" fontSize={11} fill={C.ink}>{it.label}</text>
          </g>
        );
      })}
    </Frame>
  );
}

export function StackedBar({ segments, height = 60 }:
  { segments: { label: string; value: number; color: string }[]; height?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let x = 0;
  const barH = 26;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${barH}`} className="w-full h-auto block" style={{ borderRadius: 6, overflow: "hidden" }}>
        {segments.map((s, i) => {
          const w = (s.value / total) * W; const rx = x; x += w;
          return <rect key={i} x={rx} y={0} width={w} height={barH} fill={s.color} />;
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[12px]">
            <span style={{ width: 9, height: 9, background: s.color, borderRadius: 2, display: "inline-block" }} />
            <span className="dim">{s.label}</span>
            <span className="mono tnum muted">{((s.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Heatmap({ matrix, rows, cols, base = C.teal, fmt = (v: number) => v.toFixed(2), title }:
  { matrix: number[][]; rows: string[]; cols: string[]; base?: string; fmt?: (v: number) => string; title?: string }) {
  const max = Math.max(...matrix.flat()) || 1;
  const n = cols.length, m = rows.length;
  const cell = 60, lx = 58, ty = 22;
  const w = lx + n * cell + 10, hh = ty + m * cell + 24;
  const hex = base.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (
    <svg viewBox={`0 0 ${w} ${hh}`} className="w-full h-auto block" style={{ maxWidth: w }}>
      {cols.map((c, j) => <text key={j} x={lx + j * cell + cell / 2} y={ty - 6} textAnchor="middle" fontSize={11} fill={C.ink}>{c}</text>)}
      {rows.map((r, i) => <text key={i} x={lx - 8} y={ty + i * cell + cell / 2 + 4} textAnchor="end" fontSize={11} fill={C.ink}>{r}</text>)}
      {matrix.map((row, i) => row.map((v, j) => {
        const a = Math.pow(v / max, 0.7);
        return (
          <g key={`${i}-${j}`}>
            <rect x={lx + j * cell} y={ty + i * cell} width={cell - 3} height={cell - 3} rx={4}
              fill={`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.08 + a * 0.9})`} stroke={C.line ?? "#212B37"} />
            <text x={lx + j * cell + (cell - 3) / 2} y={ty + i * cell + (cell - 3) / 2 + 4} textAnchor="middle"
              fontSize={12} className="mono tnum" fill={a > 0.5 ? "#08120F" : "#AEB9C6"} fontWeight={600}>{fmt(v)}</text>
          </g>
        );
      }))}
      {title && <text x={lx} y={hh - 4} fontSize={11} fill={C.axis}>{title}</text>}
    </svg>
  );
}

export function LineCompare({ series, height = 240, yfmt = (v: number) => v.toFixed(1) }:
  { series: { name: string; color: string; data: number[]; dashed?: boolean }[]; height?: number; yfmt?: (v: number) => string }) {
  const h = height, px = W - M.l - M.r, py = h - M.b, ph = py - M.t;
  const all = series.flatMap((s) => s.data);
  const lo = Math.min(...all), hi = Math.max(...all), rng = hi - lo || 1;
  const n = series[0]?.data.length ?? 0;
  const X = (i: number) => M.l + (i / (n - 1)) * px;
  const Y = (v: number) => py - ((v - lo) / rng) * ph;
  const path = (d: number[]) => d.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  return (
    <Frame h={h}>
      {[0, .25, .5, .75, 1].map((f, i) => {
        const v = lo + f * rng, y = Y(v);
        return <g key={i}><line x1={M.l} x2={W - M.r} y1={y} y2={y} stroke={C.grid} strokeWidth={1} />
          <text x={M.l - 6} y={y + 3} textAnchor="end" fontSize={10} fill={C.axis} className="mono">{yfmt(v)}</text></g>;
      })}
      {series.map((s, i) => (
        <path key={i} d={path(s.data)} fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.6 : 2}
          strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" opacity={0.95} />
      ))}
    </Frame>
  );
}

export function Legend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5 text-[12px] dim">
          <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={it.color} strokeWidth="2" strokeDasharray={it.dashed ? "4 3" : undefined} /></svg>
          {it.name}
        </span>
      ))}
    </div>
  );
}
