# Chair stand test web app

Browser app that runs the CDC 30-second chair stand test with MediaPipe pose tracking.
Full spec: docs/PLAN.md. Do not build anything listed as out of scope there.

## Stack
React + Vite + TypeScript, @mediapipe/tasks-vision, Recharts, jsPDF, Web Speech API, localStorage.

## Commands
- npm run dev
- npm test
- npm run build

## Folder layout
- src/analysis/  pure TypeScript signal processing and rep counting (no DOM or camera imports)
- src/config/    thresholds.ts (every tunable number) and norms.ts (CDC table)
- src/pose/      MediaPipe setup and frame loop
- src/storage/   storage interface plus localStorage implementation
- src/screens/   one file per screen in docs/PLAN.md
- src/report/    PDF generation
- tests/fixtures/ recorded landmark sequences as JSON

## Hard rules
- Never store or upload raw video. Landmarks and metrics only.
- No diagnostic language in UI text. Use "below average for age and sex (CDC)" and "consider discussing with your doctor".
- All thresholds live in src/config/thresholds.ts. No magic numbers elsewhere.
- src/analysis/ stays free of DOM, React, and camera imports so it is unit testable.
- MediaPipe y = 0 is the top of the frame. Standing has a smaller hip y than sitting.
- Demo data is always created with isDemoData: true and shown with a "Demo data" label.

## Project docs (read when the workflow below says to, not every time)
- docs/PLAN.md: spec, milestones, data model. Changes only when the user changes scope.
- docs/HANDOFF.md: current state and next step.
- docs/DECISIONS.md: settled choices and why.
- docs/LESSONS.md: mistakes and gotchas already hit.
- docs/VALIDATION.md: accuracy runs and threshold tuning history.

## Session workflow
- Start of session: read docs/HANDOFF.md, then docs/LESSONS.md.
- Before changing a FIXED item in PLAN.md or anything in DECISIONS.md: stop and ask the user.
- New architecture or library choice: add an entry to docs/DECISIONS.md.
- When the user corrects you or you hit a gotcha: add one line to docs/LESSONS.md. If a lesson comes up twice, move it into Hard rules above.
- After any accuracy test or threshold change: add a row to docs/VALIDATION.md.
- End of session (or when the user runs /handoff): rewrite docs/HANDOFF.md.
- Work one milestone at a time. Each milestone ends with a working app and passing tests.
