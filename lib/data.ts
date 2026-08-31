// Typed access to the real analysis + replay data produced offline from the
// base paper's EDT-Datasets (Momand et al., IEEE Access 2025).
import analysisJson from "@/public/data/analysis.json";
import monitorJson from "@/public/data/monitor.json";

export type Hist = { centers: number[]; counts: number[] };

export type Analysis = {
  dataset: {
    source: string; device: string;
    hr_records: number; hr_date_start: string; hr_date_end: string; hr_cadence_sec: number;
    spo2_records_raw: number; spo2_records_valid: number; spo2_artifacts_removed: number; spo2_artifact_pct: number;
    fused_records: number; sleep_minutes: number;
  };
  eda: {
    hr_overall: Hist;
    hr_summary: { mean: number; median: number; p5: number; p95: number; min: number; max: number };
    hr_sleep_vs_wake: { sleep: Hist; wake: Hist; sleep_mean: number; wake_mean: number };
    spo2_hist: Hist;
    spo2_severity: Record<string, number>;
    sleep_dist: Record<string, number>;
    sleep_dist_pct: Record<string, number>;
    correlation: { labels: string[]; matrix: number[][] };
  };
  hr_model: {
    window: number; train_n: number; test_n: number; std_bpm: number; mean_bpm: number;
    lstm: { mse: number; mae: number; rmse_bpm: number };
    bilstm: { mse: number; mae: number; rmse_bpm: number };
    paper_bilstm: { mse: number; mae: number };
    sample: { actual: number[]; lstm: number[]; bilstm: number[]; actual_bpm: number[]; bilstm_bpm: number[] };
  };
  sleep_model: {
    classes: string[]; seq_classes: string[];
    rf_instant_acc: number; rf_instant_f1: number; rf_temporal_acc: number; rf_temporal_f1: number;
    confusion: number[][]; paper_lstm_acc: number;
    imbalance: Record<string, number>; minority_class: string;
    smote: { recall_before: number; recall_after: number; acc_before: number; acc_after: number };
  };
  transitions: { states: string[]; markov: number[][]; bayesian: number[][]; next_step_acc: number };
};

export type Monitor = {
  bpm: number[]; spo2: number[]; level: string[];
  start: string; min_spo2: number; hr_fine: number[];
};

export const analysis = analysisJson as unknown as Analysis;
export const monitor = monitorJson as unknown as Monitor;
