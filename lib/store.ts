"use client";
import { create } from "zustand";
import { monitor } from "./data";

export type Severity = "ok" | "warn" | "crit";
export type Alert = { id: number; time: string; cls: Severity; title: string; msg: string; ai: string };

const B = monitor.bpm, S = monitor.spo2, L = monitor.level;
const N = B.length;
const startMs = new Date(monitor.start.replace(" ", "T")).getTime();
const recTime = (i: number) => new Date(startMs + i * 60000).toISOString().slice(11, 16);

let alertId = 0;
const cap = <T,>(a: T[], n: number) => (a.length > n ? a.slice(a.length - n) : a);

type State = {
  idx: number; playing: boolean; speed: number;
  bpm: number; spo2: number; level: string; roll: number;
  bpmHist: number[]; spo2Hist: number[];
  warn: boolean; alerts: Alert[]; lastAlertIdx: number; lastSev: Severity;
  tick: () => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  jumpToEvent: () => void;
};

function rollingMean(arr: number[], k: number) {
  const s = arr.slice(-k);
  return s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
}

export const useMonitor = create<State>((set, get) => ({
  idx: 0, playing: true, speed: 1,
  bpm: B[0], spo2: S[0], level: L[0], roll: S[0],
  bpmHist: [B[0]], spo2Hist: [S[0]],
  warn: false,
  alerts: [{
    id: ++alertId, time: recTime(0), cls: "ok",
    title: "Monitoring started",
    msg: `Replaying a real overnight recording (Fitbit Sense 2, ${monitor.start.slice(0, 10)}).`,
    ai: "Baseline established. CareTwin is tracking heart rate, SpO₂, and sleep stage from the recorded stream and will flag desaturation and rhythm anomalies against clinical thresholds.",
  }],
  lastAlertIdx: -99, lastSev: "ok",

  tick: () => {
    const st = get();
    if (!st.playing) return;
    let { idx, bpmHist, spo2Hist, alerts, lastAlertIdx, lastSev } = st;
    let warn = st.warn;

    for (let s = 0; s < st.speed; s++) {
      idx = (idx + 1) % N;
      bpmHist = cap([...bpmHist, B[idx]], 90);
      spo2Hist = cap([...spo2Hist, S[idx]], 90);
      const roll = rollingMean(spo2Hist, 5);

      let sev: Severity = "ok";
      if (roll < 88) sev = "crit";
      else if (roll < 90) sev = "warn";
      warn = sev !== "ok" || B[idx] > 120;

      const worsened = (sev === "crit" && lastSev !== "crit") || (sev === "warn" && lastSev === "ok");
      if (sev !== "ok" && worsened && idx - lastAlertIdx > 12) {
        lastAlertIdx = idx;
        const crit = sev === "crit";
        const a: Alert = {
          id: ++alertId, time: recTime(idx), cls: sev,
          title: crit ? "Severe desaturation" : "Moderate desaturation",
          msg: `SpO₂ fell to ${roll.toFixed(0)}% (5-min mean) during ${L[idx]} sleep, HR ${B[idx]} bpm.`,
          ai: crit
            ? `Oxygen has dropped to <b>${roll.toFixed(0)}%</b> for several minutes during deep sleep. This pattern is consistent with a sleep-related breathing disturbance. Recommend checking on the patient and, if repeated across the night, referring for a sleep assessment.`
            : `A moderate dip to <b>${roll.toFixed(0)}%</b> was detected. Isolated dips are common on consumer sensors, but clustered events during sleep warrant follow-up. Continuing to monitor.`,
        };
        alerts = [a, ...alerts].slice(0, 8);
      }
      lastSev = sev;
    }

    set({
      idx, bpm: B[idx], spo2: S[idx], level: L[idx], roll: rollingMean(spo2Hist, 5),
      bpmHist, spo2Hist, warn, alerts, lastAlertIdx, lastSev,
    });
  },

  setPlaying: (p) => set({ playing: p }),
  setSpeed: (s) => set({ speed: s }),
  jumpToEvent: () => {
    let mi = 0, mv = 200;
    for (let i = 0; i < N; i++) if (S[i] < mv) { mv = S[i]; mi = i; }
    const idx = Math.max(0, mi - 6);
    set({ idx, bpm: B[idx], spo2: S[idx], level: L[idx], bpmHist: [B[idx]], spo2Hist: [S[idx]], lastAlertIdx: -99, lastSev: "ok", playing: true });
  },
}));

export const MONITOR_META = { N, minSpo2: monitor.min_spo2, start: monitor.start, recTime };
