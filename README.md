# CareTwin

A generative-AI **digital twin** for real-time elderly health monitoring. Proof-of-concept dashboard: live vitals, a Bi-LSTM heart-rate forecast, on-edge anomaly detection, AI caregiver recommendations, and a 3D anatomical heart that beats at the patient's live BPM.

Built for the CareTwin major project (DSCE, Dept. of CSE).

## Stack

- **Next.js 14** (App Router) + TypeScript
- **react-three-fiber** + **drei** for the 3D anatomical heart (procedural mesh, orbit controls)
- **zustand** for the live vitals store and simulation loop
- **Tailwind CSS** for the clinical dark UI

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Demo

The vitals are simulated for the proof of concept. Use the two red buttons to trigger an anomaly live during a demo:

- **Simulate SpO₂ drop** — oxygen falls into the hypoxemia range; the anomaly detector fires and the AI writes a caregiver recommendation.
- **Simulate HR spike** — heart rate climbs above the safe zone; the heart flushes red and an alert appears.
- **Back to normal** — returns vitals to baseline.

## Structure

```
app/            App Router entry, global styles
components/      Dashboard, HeartTwin (R3F), VitalTiles, HRChart, AlertFeed, DataFlow
lib/store.ts    zustand vitals store + simulation + anomaly detection
lib/heartGeometry.ts  procedural anatomical heart geometry (ventricles + vessels)
```

## Where the real system would plug in

- `lib/store.ts` `tick()` — replace the simulated stream with real wearable data (Fitbit / Apple Watch / Samsung APIs).
- Bi-LSTM forecast in `HRChart` — swap the linear extrapolation for a TensorFlow.js / on-device model.
- The AI recommendation text — call a real (ideally self-hosted) medical LLM.

## Credits

- 3D heart model: `public/models/heart.glb`, sourced from the [AdnanKhan45/interactive_3d](https://github.com/AdnanKhan45/interactive_3d) repository. Verify its license before any public or commercial use; swap in your own licensed `.glb` at the same path if needed.

Not a medical device.
