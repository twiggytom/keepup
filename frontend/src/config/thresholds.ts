/** Every tunable number for pose analysis lives here. Record changes in docs/VALIDATION.md. */

// Rep counter, on the extension angle (mean of knee and hip angle, degrees).
export const REP = {
  sitEnter: 110, // at or below: seated
  sitExit: 120, // above: has started rising
  standEnter: 155, // at or above: fully standing (a rep)
  standExit: 145, // below: has started descending
  emaAlpha: 0.4,
  defaultSitDeg: 90,
  defaultStandDeg: 170,
}

// Form and framing checks.
export const FORM = {
  visibilityMin: 0.6,
  wristVisibilityMin: 0.3,
  armsCrossedMaxTorso: 0.75, // wrist to shoulder-midpoint distance, in torso lengths
  sideOnMaxRatio: 0.6, // horizontal shoulder spread / torso length
  armsFlagMinS: 0.5,
  outOfFrameMinS: 0.5,
  lowLightMeanVisibility: 0.5,
  maxOutOfFrameS: 3, // more than this in total and the session is not counted (mirrors the backend)
}

// Movement metrics (Phase 2). Wording bands are provisional: there are no published norms.
export const METRICS = {
  halfTimeS: 15,
  fatigueMinReps: 4, // complete stands needed to compare early vs late
  fatigueSteadyMax: 1.1, // late/early stand time ratio
  fatigueSlightMax: 1.3,
  minStandSamples: 3, // frames at the top of a stand needed to measure sway
  swaySteadyMax: 0.05, // shoulder sway range, in torso lengths
  swaySomeMax: 0.1,
  incompleteKneeDeg: 160, // peak knee angle below this = knees not fully straight
}

// Session quality score (0-100) penalties.
export const QUALITY = {
  outOfFramePerS: 10,
  outOfFrameMax: 40,
  usedArms: 20,
  multiplePeople: 15,
  lowLight: 15,
  goodVisibility: 0.9,
  visibilityPerUnit: 100, // points lost per 1.0 of mean visibility below goodVisibility
  visibilityMax: 20,
}
