# Lessons

One line per mistake or gotcha, with the fix. Add a line whenever the user corrects Claude or a bug teaches something. If a lesson comes up twice, move it into the Hard rules in CLAUDE.md.

Format: - YYYY-MM-DD: what went wrong or what to watch for -> fix

- 2026-10-24: MediaPipe uses image coordinates with y = 0 at the top, so standing has a smaller hip y. -> Normalize between calibrated sit and stand values; never hardcode "up" as larger y.
- 2026-10-24: Browsers allow camera access only over HTTPS or localhost. -> Use localhost in dev and an HTTPS deploy (Vercel) for the demo.
- 2026-10-24: Single trials are noisy. -> Never alert or draw conclusions from one test; use trends and the noise band.
- 2026-10-24: Google Cloud Vision API does not do body pose. -> Use MediaPipe Pose Landmarker.
- 2026-10-24: Pose output jitters frame to frame. -> Smooth before thresholding and use hysteresis (separate enter and exit thresholds) in the state machine.
- 2026-10-24: MediaPipe normalizes x by frame width and y by height, so angles and distances on a 16:9 frame are skewed. -> Multiply x by width/height before any geometry (analyzeFrame takes the aspect ratio).
