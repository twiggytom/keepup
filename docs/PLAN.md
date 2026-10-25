# PLAN.md: chair stand test web app

Read this whole file before writing code. Use plan mode to propose the file structure and milestone breakdown, confirm with the user, then build milestone by milestone. Ask before changing any decision marked FIXED.

Working rules and the session workflow are in CLAUDE.md. Progress lives in docs/HANDOFF.md, settled choices in docs/DECISIONS.md, gotchas in docs/LESSONS.md, and accuracy runs in docs/VALIDATION.md. Keep those files current as described in CLAUDE.md, and use the /handoff command at the end of each session.

## Goal

A browser app that administers the CDC 30-second chair stand test using the laptop or phone camera. It tracks body pose with MediaPipe, counts reps, checks the protocol, stores per-rep data locally, shows results and history, and exports a PDF report for doctors.

## Fixed decisions

- FIXED: React + Vite + TypeScript, single-page app.
- FIXED: Pose model is MediaPipe Pose Landmarker via `@mediapipe/tasks-vision`, `runningMode: "VIDEO"`, `numPoses: 1`, GPU delegate with CPU fallback. Start with the lite model.
- FIXED: All processing in the browser. Never upload or store raw video.
- FIXED: Storage is localStorage for the MVP, behind a storage interface so it can be swapped for Supabase later.
- FIXED: No diagnostic language in the UI. Results say "below average for age and sex (CDC)" and "consider discussing with your doctor," never "you are at risk of falling" or similar.
- Charts: Recharts. PDF: jsPDF. Voice: Web Speech API `speechSynthesis`.
- Deploy target: Vercel (HTTPS required for camera).

## Test protocol (CDC STEADI)

- Straight-backed chair, no armrests, 17-inch seat, against a wall.
- Arms crossed at the wrists over the chest, feet flat.
- Stand fully and sit as many times as possible in 30 seconds.
- Arm use: the standard test scores 0. This app instead records the count and marks the trial `modified` (LOINC 93125-3).
- A stand more than halfway up at 30 seconds counts.
- A second person must be present. The user confirms this before each test.

### Below-average thresholds (score strictly less than value = below average)

```ts
export const CDC_BELOW_AVERAGE: Record<string, { male: number; female: number }> = {
  "60-64": { male: 14, female: 12 },
  "65-69": { male: 12, female: 11 },
  "70-74": { male: 12, female: 10 },
  "75-79": { male: 11, female: 10 },
  "80-84": { male: 10, female: 9 },
  "85-89": { male: 8, female: 8 },
  "90-94": { male: 7, female: 4 },
};
```

Ages outside 60-94: show the score with "no CDC norm for this age."

## MediaPipe landmark indices

11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips, 25/26 knees, 27/28 ankles. Coordinates are normalized with y = 0 at the top of the frame, so standing has a smaller hip y than sitting. Each landmark has a `visibility` score.

## Signal processing and rep counting

Implement as pure TypeScript with no DOM or camera dependencies, so it can be unit tested with recorded landmark sequences.

1. Per frame, pick the body side (left or right) with higher average visibility across hip, knee, ankle.
2. Hip height: hip y of that side. Knee angle: 2D angle at the knee between hip-knee and ankle-knee vectors, in degrees.
3. Smooth both with an exponential moving average (alpha around 0.3, configurable).
4. Calibration: user sits still 2 seconds, then stands still 2 seconds. Store median sitting hip y, median standing hip y, and median knee angles. Reject calibration if the sit and stand hip values differ by too little (person not fully visible or did not stand).
5. Normalized height h = (sitHipY - hipY) / (sitHipY - standHipY), so 0 = seated and 1 = standing.
6. State machine with hysteresis:
   - seated to standing when h > 0.85 AND knee angle > 160. Increment count. Record `standReachedMs`.
   - standing to seated when h < 0.15. Record `sitReachedMs`.
   - Record `riseStartMs` when h first exceeds 0.15 after being seated.
7. Half-stand rule: at 30.0 seconds, if state is seated, h > 0.5, and h is rising, add one rep and set `halfStandCounted = true`.
8. Arm check: per frame, distance from each wrist to the opposite shoulder, divided by shoulder width. If either exceeds a threshold (start at 0.6, configurable) for more than a few consecutive frames during the test, set protocol to `modified`.
9. Safety stop: if hip x or hip y velocity exceeds a threshold far beyond normal sitting speed, stop the test, speak "Test stopped," and mark the trial `aborted`.
10. Confidence: fraction of frames during the test where hip, knee, and ankle visibility all exceed 0.5. Below 0.8 marks the trial low confidence.

All thresholds live in one config object so they can be tuned.

## Data model

```ts
type Sex = "male" | "female";

interface User {
  id: string; name: string; birthDate: string; sex: Sex;
  heightCm: number; weightKg: number; chairHeightCm: number;
  testIntervalDays: number; emergencyContact?: string;
}

interface Session {
  id: string; userId: string; startedAt: string;
  helperPresent: boolean; chairAgainstWall: boolean; notes?: string;
  isDemoData?: boolean;
}

interface Calibration {
  sitHipY: number; standHipY: number; sitKneeDeg: number; standKneeDeg: number;
}

interface Trial {
  id: string; sessionId: string; trialNumber: number;
  score: number; protocol: "standard" | "modified" | "aborted";
  confidence: number; lowConfidence: boolean; halfStandCounted: boolean;
  calibration: Calibration;
}

interface Rep {
  id: string; trialId: string; repNumber: number;
  riseStartMs: number; standReachedMs: number; sitReachedMs?: number;
}

interface LandmarkSeries {
  trialId: string; fps: number;          // downsampled to about 10 fps
  frames: { t: number; points: [number, number, number][] }[]; // x, y, visibility per landmark
}
```

Save landmark series for every trial. Later features (wobble, trunk lean, asymmetry, power) will be computed from them.

## Screens and flow

1. Onboarding: user profile form. Large text, large buttons.
2. Home: next test due date, start test button, history link.
3. Safety checklist: helper present, chair against wall, no armrests. All required.
4. Camera setup: live preview with skeleton overlay. Green indicator only when shoulders, hips, knees, and ankles are visible with good confidence. "Continue" disabled until green.
5. Calibration: spoken and on-screen prompts for sit 2 seconds and stand 2 seconds.
6. Test: spoken instructions, 3-2-1 countdown, "Go," 30-second timer, big live count, skeleton overlay, spoken "Stop."
7. Trial result: score, CDC comparison, protocol, confidence. Offer trial 2 after a short rest. Session headline score = best valid trial.
8. History: list of sessions plus trend chart (score over time, CDC threshold line, low-confidence points greyed out).
9. Report: generate PDF.
10. Settings: test interval, demo mode toggles, threshold config (dev only).

## Recorded video mode

A toggle that replaces the camera with an uploaded or bundled video file. The video goes through the identical pipeline. This is the demo backup and the validation harness.

## Validation harness

- Load a video, run the pipeline offline, output the count and per-rep timestamps.
- Accept a CSV of human counts (filename, count) and report exact-match and within-one accuracy across all videos.
- Export recorded landmark sequences as JSON fixtures for unit tests of the rep counter.

## PDF report (MVP)

- Header: patient name, age, sex, report date range. Label "Patient-collected home measurement."
- Latest score with CDC comparison and LOINC code (66247-8 standard, 93125-3 modified).
- Trend chart image.
- Table of sessions: date, score, protocol, confidence.
- Footer: test protocol summary and the note that home results are for discussion with a clinician.

Generate the PDF from the same data objects that a future FHIR export will use.

## Demo data

A seed function that creates about 3 months of sample sessions with `isDemoData: true`, shown with a visible "Demo data" label, so the trend chart and PDF can be shown during the demo.

## Milestones

1. Camera + MediaPipe running, skeleton overlay drawn on canvas, frame loop stable.
2. Pure TS signal processing and rep counter with unit tests on synthetic sequences.
3. Calibration flow and live counting on camera. Recorded video mode.
4. Arm check, half-stand rule, safety stop, confidence score.
5. Onboarding, safety checklist, setup check, guided test with voice.
6. Storage layer, results, history, trend chart.
7. PDF export and demo data seed.
8. Validation harness and threshold tuning.

Each milestone ends with a working app and passing tests.

## Out of scope for the MVP (do not build yet)

Wobble and sway scoring, trunk lean, asymmetry, power estimates, FHIR export, clinician dashboard, caregiver accounts, alerts, balance tests, Timed Up and Go, exercise programs, native mobile apps, backend or accounts.

## Open questions to ask the user when relevant

- Default test interval (current plan: weekly for 4 weeks, then every 2 weeks).
- Whether to include an emergency contact field in the MVP.
- Which demo videos to bundle.
