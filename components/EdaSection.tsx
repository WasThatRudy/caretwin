import { analysis } from "@/lib/data";
import { Section, Figure } from "./ui";
import { Histogram, GroupedHist, BarCat, StackedBar, Legend, C } from "./charts";

function CorrGrid({ labels, matrix }: { labels: string[]; matrix: number[][] }) {
  const cells: React.ReactNode[] = [<div key="corner" />];
  labels.forEach((l) => cells.push(<div key={"h" + l} className="text-center text-[11px] dim pb-1">{l}</div>));
  matrix.forEach((row, i) => {
    cells.push(<div key={"rl" + i} className="text-[11px] dim flex items-center justify-end pr-2">{labels[i]}</div>);
    row.forEach((v, j) => {
      const a = Math.min(1, Math.abs(v)), col = v >= 0 ? "53,184,166" : "224,112,138";
      cells.push(
        <div key={`c${i}-${j}`} className="h-[52px] rounded-md flex items-center justify-center mono tnum text-[13px] font-semibold border border-[var(--line)]"
          style={{ background: `rgba(${col},${0.08 + a * 0.85})`, color: a > 0.5 ? "#08120F" : "#AEB9C6" }}>
          {v.toFixed(2)}
        </div>
      );
    });
  });
  return <div className="inline-grid gap-1" style={{ gridTemplateColumns: `70px repeat(${labels.length}, 74px)` }}>{cells}</div>;
}

export default function EdaSection() {
  const e = analysis.eda;
  const sleepItems = [
    { label: "deep", value: e.sleep_dist_pct.deep, color: C.blue },
    { label: "light", value: e.sleep_dist_pct.light, color: C.teal },
    { label: "rem", value: e.sleep_dist_pct.rem, color: C.violet },
    { label: "wake", value: e.sleep_dist_pct.wake, color: C.amber },
    { label: "restless", value: e.sleep_dist_pct.restless ?? 0, color: C.rose },
  ];
  const sev = e.spo2_severity;
  const sevSeg = [
    { label: "normal ≥95", value: sev["normal>=95"], color: C.good },
    { label: "mild 90–94", value: sev["mild 90-94"], color: C.amber },
    { label: "moderate 88–89", value: sev["moderate 88-89"], color: "#E07C3A" },
    { label: "severe <88", value: sev["severe <88"], color: C.bad },
  ];
  return (
    <Section id="analysis" eyebrow="Exploratory analysis" title="What the real recordings show"
      intro={<>Reproducing the base paper&rsquo;s exploratory analysis on the actual data &mdash; the distributions
        that motivate every downstream modelling choice.</>}>
      <div className="grid lg:grid-cols-2 gap-3">
        <Figure n="Fig. 1" title="Heart-rate distribution"
          caption={<>N = <b>{analysis.dataset.hr_records.toLocaleString()}</b> readings. Mean <b>{e.hr_summary.mean.toFixed(1)}</b>,
            median <b>{e.hr_summary.median.toFixed(0)}</b> bpm; 5–95th percentile {e.hr_summary.p5.toFixed(0)}–{e.hr_summary.p95.toFixed(0)}.</>}>
          <Histogram data={e.hr_overall} xlabel="heart rate (bpm)" />
        </Figure>

        <Figure n="Fig. 2" title="Heart rate: sleep vs. wake"
          caption={<>Sleep mean <b>{e.hr_sleep_vs_wake.sleep_mean.toFixed(1)}</b> bpm vs. wake
            <b> {e.hr_sleep_vs_wake.wake_mean.toFixed(1)}</b> bpm &mdash; the expected drop during rest, recovered from real labels.</>}>
          <div className="mb-2"><Legend items={[{ name: "sleep", color: C.violet }, { name: "wake", color: C.amber }]} /></div>
          <GroupedHist a={e.hr_sleep_vs_wake.sleep} b={e.hr_sleep_vs_wake.wake} xlabel="heart rate (bpm)" />
        </Figure>

        <Figure n="Fig. 3" title="Sleep-stage class distribution"
          caption={<>Real class imbalance: <b>light</b> dominates at {e.sleep_dist_pct.light}% while <b>wake</b> and
            <b> restless</b> are rare. This imbalance is exactly what augmentation must address.</>}>
          <BarCat items={sleepItems} height={200} />
        </Figure>

        <Figure n="Fig. 4" title="SpO₂ distribution &amp; hypoxemia severity"
          caption={<>After cleaning, the retained SpO₂ still skews low &mdash; a real consumer-sensor characteristic.
            Severity split by clinical thresholds (paper Table 9).</>}>
          <Histogram data={e.spo2_hist} color={C.blue} xlabel="SpO₂ (%)" height={150} />
          <div className="mt-4"><StackedBar segments={sevSeg} /></div>
        </Figure>

        <Figure n="Fig. 5" title="Feature correlation" wide
          caption={<>BPM and SpO₂ are moderately anti-correlated (<b>r = {e.correlation.matrix[0][1].toFixed(2)}</b>): higher
            heart rate tracks lower oxygen. Both correlate weakly with sleep stage, so they carry complementary information.</>}>
          <div className="flex justify-center py-2"><CorrGrid labels={e.correlation.labels} matrix={e.correlation.matrix} /></div>
        </Figure>

        <div className="card p-5 flex flex-col justify-center">
          <div className="eyebrow !text-[var(--mute)] mb-2">Reading these</div>
          <p className="cap leading-relaxed">
            These are not illustrative curves &mdash; they are computed live from the {analysis.dataset.hr_records.toLocaleString()}-point
            heart-rate series and the {analysis.dataset.sleep_minutes.toLocaleString()}-minute sleep record. The lower resting
            heart rate, the low-skewed SpO₂, and the heavy light-sleep imbalance all reappear in the modelling below and
            shape what the twin can and cannot claim.
          </p>
        </div>
      </div>
    </Section>
  );
}
