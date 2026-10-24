/**
 * Movement metrics computed after a test from rep events and per-frame samples.
 * Pure functions: no DOM, React or camera imports.
 */

import { METRICS, QUALITY } from '../config/thresholds'
import type { QualityFlags } from '../pose/formChecks'
import type { RepEvent, RepState } from '../pose/repCounter'

/** One frame during the run, recorded after the rep counter has processed it. */
export interface FrameSample {
  t: number
  state: RepState
  count: number // reps counted so far, including this frame
  kneeDeg: number
  trunkLeanDeg: number
  sway: number
}

export interface SpeedMetrics {
  per_rep_s: number[] // full sit-stand-sit cycle time for each complete stand
  rise_s: number[] // seated to top of stand
  lower_s: number[] // top of stand back to seated
  mean_s: number | null
  mean_rise_s: number | null
  mean_lower_s: number | null
  cv: number | null // coefficient of variation of per_rep_s: lower = more consistent
}

export interface FatigueMetrics {
  early_mean_s: number | null // mean stand time, first third of complete stands
  late_mean_s: number | null // mean stand time, last third
  index: number | null // late / early: above 1 = slowing down
  reps_first_half: number
  reps_second_half: number
}

export interface SteadinessMetrics {
  per_rep_sway: (number | null)[] // shoulder sway range at the top of each stand, torso lengths
  mean_sway: number | null
  max_sway: number | null
  per_rep_lean_deg: (number | null)[] // greatest forward trunk lean while rising
  mean_lean_deg: number | null
  incomplete_stands: number // stands where the knees never fully straightened
}

export interface SessionMetrics {
  version: 1
  speed: SpeedMetrics
  fatigue: FatigueMetrics
  steadiness: SteadinessMetrics
  quality_score: number
}

export function computeMetrics(samples: FrameSample[], events: RepEvent[], flags: QualityFlags): SessionMetrics {
  return {
    version: 1,
    speed: speedMetrics(events),
    fatigue: fatigueMetrics(events),
    steadiness: steadinessMetrics(samples, events),
    quality_score: qualityScore(flags),
  }
}

export function speedMetrics(events: RepEvent[]): SpeedMetrics {
  const full = events.filter((e) => !e.partial)
  const complete = full.filter((e) => e.duration_s !== null && e.t_sit_end !== null)
  const perRep = complete.map((e) => e.duration_s!)
  const rise = full.map((e) => e.t_stand_peak - e.t_sit_start)
  const lower = complete.map((e) => e.t_sit_end! - e.t_stand_peak)
  const m = mean(perRep)
  return {
    per_rep_s: perRep.map(r3),
    rise_s: rise.map(r3),
    lower_s: lower.map(r3),
    mean_s: r3n(m),
    mean_rise_s: r3n(mean(rise)),
    mean_lower_s: r3n(mean(lower)),
    cv: perRep.length >= 2 && m ? r3(std(perRep) / m) : null,
  }
}

export function fatigueMetrics(events: RepEvent[]): FatigueMetrics {
  const durations = events.filter((e) => !e.partial && e.duration_s !== null).map((e) => e.duration_s!)
  const firstHalf = events.filter((e) => e.t_stand_peak < METRICS.halfTimeS).length
  const base = { reps_first_half: firstHalf, reps_second_half: events.length - firstHalf }
  if (durations.length < METRICS.fatigueMinReps) {
    return { ...base, early_mean_s: null, late_mean_s: null, index: null }
  }
  const k = Math.max(1, Math.floor(durations.length / 3))
  const early = mean(durations.slice(0, k))!
  const late = mean(durations.slice(-k))!
  return { ...base, early_mean_s: r3(early), late_mean_s: r3(late), index: r3(late / early) }
}

export function steadinessMetrics(samples: FrameSample[], events: RepEvent[]): SteadinessMetrics {
  const full = events.filter((e) => !e.partial)
  const sway: (number | null)[] = []
  const lean: (number | null)[] = []
  let incomplete = 0

  for (const e of full) {
    // Rising frames before rep i have count === i; standing frames of rep i have count === i + 1.
    const rising = samples.filter((s) => s.state === 'rising' && s.count === e.index)
    const top = samples.filter((s) => s.state === 'standing' && s.count === e.index + 1)

    lean.push(rising.length ? r3(Math.max(...rising.map((s) => s.trunkLeanDeg))) : null)
    if (top.length >= METRICS.minStandSamples) {
      const xs = top.map((s) => s.sway)
      sway.push(r3(Math.max(...xs) - Math.min(...xs)))
    } else {
      sway.push(null)
    }
    if (top.length && Math.max(...top.map((s) => s.kneeDeg)) < METRICS.incompleteKneeDeg) incomplete += 1
  }

  const swayVals = sway.filter((v): v is number => v !== null)
  return {
    per_rep_sway: sway,
    mean_sway: r3n(mean(swayVals)),
    max_sway: swayVals.length ? Math.max(...swayVals) : null,
    per_rep_lean_deg: lean,
    mean_lean_deg: r3n(mean(lean.filter((v): v is number => v !== null))),
    incomplete_stands: incomplete,
  }
}

/** 0-100: starts at 100 and loses points for each recording problem. */
export function qualityScore(f: QualityFlags): number {
  const penalty =
    Math.min(f.out_of_frame_s * QUALITY.outOfFramePerS, QUALITY.outOfFrameMax) +
    (f.used_arms ? QUALITY.usedArms : 0) +
    (f.multiple_people ? QUALITY.multiplePeople : 0) +
    (f.low_light ? QUALITY.lowLight : 0) +
    Math.min(Math.max(0, QUALITY.goodVisibility - f.mean_visibility) * QUALITY.visibilityPerUnit, QUALITY.visibilityMax)
  return Math.round(Math.min(100, Math.max(0, 100 - penalty)))
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

function std(xs: number[]): number {
  const m = mean(xs)!
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
}

function r3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function r3n(n: number | null): number | null {
  return n === null ? null : r3(n)
}
