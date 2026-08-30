"use client";
import { create } from "zustand";

export type Severity = "ok" | "warnl" | "crit";
export type Alert = { id: number; time: string; cls: Severity; msg: string; ai: string };
type Mode = "normal" | "hr" | "spo2";
type Sleep = "Awake" | "Light" | "Deep" | "REM";

type Vitals = {
  hr: number;
  spo2: number;
  hrv: number;
  sleep: Sleep;
  mode: Mode;
  modeT: number;
  t: number;
  hist: number[];
  alerts: Alert[];
  lastAlert: number;
  warn: boolean;
  tick: () => void;
  trigger: (m: Mode | "reset") => void;
};

const MAXP = 120;
const stages: Sleep[] = ["Awake", "Light", "Deep", "REM"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
let alertId = 0;

function push(state: Vitals, cls: Severity, msg: string, ai: string): Alert[] {
  const a: Alert = { id: ++alertId, time: new Date().toLocaleTimeString(), cls, msg, ai };
  return [a, ...state.alerts].slice(0, 8);
}

export const useVitals = create<Vitals>((set, get) => ({
  hr: 72,
  spo2: 97,
  hrv: 42,
  sleep: "Awake",
  mode: "normal",
  modeT: 0,
  t: 0,
  hist: [],
  alerts: [
    {
      id: ++alertId,
      time: "--:--:--",
      cls: "ok",
      msg: "Monitoring started · all vitals within normal range",
      ai: "Baseline established for Ramesh. CareTwin now tracks heart rate, SpO₂, and sleep in real time and will alert you before values become dangerous.",
    },
  ],
  lastAlert: -99,
  warn: false,

  tick: () => {
    const s = get();
    let baseHR = 72, baseSpO2 = 97;
    if (s.mode === "hr") baseHR = 134;
    if (s.mode === "spo2") baseSpO2 = 83;

    let hr = s.hr + (baseHR - s.hr) * 0.25 + (Math.random() - 0.5) * 3;
    let spo2 = s.spo2 + (baseSpO2 - s.spo2) * 0.25 + (Math.random() - 0.5) * 0.6;
    hr = Math.max(45, Math.min(180, hr));
    spo2 = Math.max(75, Math.min(100, spo2));
    const hrv = Math.max(12, Math.round(70 - Math.abs(hr - 72) * 0.8 + (Math.random() - 0.5) * 6));

    const t = s.t + 1;
    const hist = [...s.hist, hr].slice(-MAXP);
    const sleep = t % 30 === 0 ? pick(stages) : s.sleep;
    const warn = hr > 120 || spo2 < 90;

    let alerts = s.alerts;
    let lastAlert = s.lastAlert;
    if (t - lastAlert >= 8) {
      if (spo2 < 88) {
        lastAlert = t;
        const crit = spo2 < 85;
        const where = sleep === "Awake" ? "the day" : "sleep";
        alerts = push(s, crit ? "crit" : "warnl",
          `SpO₂ ${Math.round(spo2)}% · ${crit ? "moderate" : "mild"} hypoxemia detected`,
          `Oxygen dropped to <b>${Math.round(spo2)}%</b> during ${where}. Check on Ramesh, ensure a clear airway and an upright position. If it stays below 90% for 5+ minutes, contact the physician.`);
      } else if (hr > 120) {
        lastAlert = t;
        alerts = push(s, "warnl",
          `Heart rate ${Math.round(hr)} bpm · above expected range`,
          `Heart rate spiked to <b>${Math.round(hr)} bpm</b>. If Ramesh is at rest, check for distress or pain. Encourage slow breathing and monitor; alert the physician if it persists past 10 minutes.`);
      }
    }

    let mode = s.mode, modeT = s.modeT;
    if (mode !== "normal" && ++modeT > 16) { mode = "normal"; modeT = 0; }

    set({ hr, spo2, hrv, sleep, hist, t, warn, alerts, lastAlert, mode, modeT });
  },

  trigger: (m) => {
    if (m === "reset") { set({ mode: "normal", modeT: 0 }); return; }
    set({ mode: m, modeT: 0, lastAlert: -99 });
  },
}));
