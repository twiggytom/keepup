# Decisions

One entry per settled choice. Do not reopen a decision without asking the user. Newest at the bottom.

Format:
## YYYY-MM-DD: decision
- Why:
- Rejected:

## 2026-10-24: Web app for the hackathon, native iOS later
- Why: fastest to build, runs on any laptop or phone browser, no app store, whole team can work on it without Macs.
- Rejected: iOS first (needs Macs, Xcode, and a developer account; excludes Android).

## 2026-10-24: MediaPipe Pose Landmarker for pose estimation
- Why: runs in the browser on-device, gives body landmarks with visibility scores, free.
- Rejected: Google Cloud Vision API (does not do body pose estimation).

## 2026-10-24: Store landmarks and metrics, never raw video
- Why: privacy, small storage, and saved landmarks let later features (wobble, trunk lean, power) be computed on past tests.
- Rejected: storing video.

## 2026-10-24: Arm use marks the trial "modified" instead of scoring 0
- Why: a real count is more useful to clinicians, and LOINC 93125-3 exists for the modified test.
- Rejected: strict CDC scoring of 0 when arms are used.

## 2026-10-24: Calibration per user before each test
- Why: normalizing hip height between measured sitting and standing positions handles different bodies, chairs, and camera distances.
- Rejected: fixed absolute hip height thresholds.

## 2026-10-24: Two trials per session, best valid trial is the headline score
- Why: single trials are noisy (individual minimal detectable change is about 2.5 to 3.3 stands in published studies).
- Rejected: one trial per session.

## 2026-10-24: Wellness positioning, no diagnostic claims
- Why: diagnostic claims can make the app an FDA-regulated medical device.
- Rejected: wording like "fall risk detected".

## 2026-10-24: Movement-quality and wobble analysis after the MVP
- Why: needs reliable rep segmentation first. Landmarks are saved now so it can run on past data later.
- Rejected: building it into the MVP.

## 2026-10-24: Movement metrics now; landmark traces are not stored
- Why: the user asked for speed per stand, fatigue, wobble/steadiness and a session quality score now, and decided a saved landmark trace is not needed. Metrics are computed in the browser from in-memory per-frame samples and only the summary numbers are saved. This replaces "Store landmarks and metrics" and "Movement-quality and wobble analysis after the MVP" above.
- Rejected: saving a 10 fps landmark series per trial (about 30-100 KB each). Trade-off: past tests cannot be re-scored if the metric formulas change.

## 2026-10-24: Trend rules
- Why (user's choices): a trend needs 3 counted sessions. Low-quality sessions (quality score < 70) are plotted greyed out but left out of the fit. No projected date for crossing the CDC threshold on the user's screens; that belongs in the Phase 4 report. Phase 3 is backend only (`GET /api/trends`); the History UI is left to the frontend redesign.
- Also excluded from the fit: not-counted sessions and arm-used sessions (scored 0, not comparable to standard trials). A fitted change smaller than the noise band (3 stands, from the published minimal detectable change) reads as "steady".
- Rejected: fitting every session; numpy (a few points don't need it).
