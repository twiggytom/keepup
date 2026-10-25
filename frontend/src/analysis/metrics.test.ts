import { describe, expect, it } from 'vitest'
import type { QualityFlags } from '../pose/formChecks'
import { RepCounter, type RepEvent } from '../pose/repCounter'
import { fatigueMetrics, qualityScore, speedMetrics, steadinessMetrics, type FrameSample } from './metrics'

const ev = (index: number, start: number, peak: number, end: number | null, partial = false): RepEvent => ({
  index,
  t_sit_start: start,
  t_stand_peak: peak,
  t_sit_end: end,
  duration_s: end === null ? null : end - start,
  partial,
})

/** Stands that take `durations[i]` seconds each, back to back from t = 0.5. */
function events(durations: number[]): RepEvent[] {
  let t = 0.5
  return durations.map((d, i) => {
    const e = ev(i, t, t + d * 0.45, t + d)
    t += d
    return e
  })
}

const cleanFlags: QualityFlags = {
  out_of_frame_s: 0,
  arms_uncrossed_s: 0,
  used_arms: false,
  multiple_people: false,
  low_light: false,
  mean_visibility: 0.95,
  side: 'left',
  frames: 900,
}

describe('speedMetrics', () => {
  it('reports per-stand, rise and lower times', () => {
    const s = speedMetrics(events([2, 2, 2]))
    expect(s.per_rep_s).toEqual([2, 2, 2])
    expect(s.mean_s).toBe(2)
    expect(s.mean_rise_s).toBeCloseTo(0.9)
    expect(s.mean_lower_s).toBeCloseTo(1.1)
    expect(s.cv).toBe(0)
  })

  it('leaves partial and unfinished stands out of cycle times', () => {
    const s = speedMetrics([...events([2, 2]), ev(2, 4.5, 5.4, null), ev(3, 29, 30, null, true)])
    expect(s.per_rep_s).toHaveLength(2)
    expect(s.rise_s).toHaveLength(3) // the unfinished full stand still has a rise time
  })

  it('has no CV with a single stand', () => {
    expect(speedMetrics(events([2])).cv).toBeNull()
  })
})

describe('fatigueMetrics', () => {
  it('compares the last third with the first third', () => {
    const f = fatigueMetrics(events([2, 2, 2, 2.5, 2.5, 3, 3, 3, 3]))
    expect(f.early_mean_s).toBe(2)
    expect(f.late_mean_s).toBe(3)
    expect(f.index).toBe(1.5)
  })

  it('needs enough stands', () => {
    expect(fatigueMetrics(events([2, 2, 2])).index).toBeNull()
  })

  it('splits reps by half', () => {
    const f = fatigueMetrics(events(Array(12).fill(2.4)))
    expect(f.reps_first_half + f.reps_second_half).toBe(12)
    expect(f.reps_first_half).toBe(6)
  })
})

describe('steadinessMetrics', () => {
  /** Drive the real counter so sample states and counts match what the app records. */
  function simulate(reps: number, swayAmp: number, leanDeg: number, peakKnee = 172) {
    const counter = new RepCounter()
    const samples: FrameSample[] = []
    const period = 2.5
    for (let t = 0; t < 0.5 + reps * period; t += 1 / 30) {
      const phase = t < 0.5 ? 0 : ((t - 0.5) % period) / period
      // 0-0.4 rise, 0.4-0.6 hold at top, 0.6-1 sit down
      const up = phase < 0.4 ? phase / 0.4 : phase < 0.6 ? 1 : (1 - phase) / 0.4
      counter.update(t, 90 + up * 82)
      samples.push({
        t,
        state: counter.state,
        count: counter.count,
        kneeDeg: 90 + up * (peakKnee - 90),
        trunkLeanDeg: phase < 0.4 ? leanDeg * Math.sin(Math.PI * up) : 0,
        sway: up === 1 ? swayAmp * Math.sin(t * 20) : 0,
      })
    }
    return steadinessMetrics(samples, counter.events)
  }

  it('measures sway, lean and full knee extension', () => {
    const s = simulate(5, 0.04, 30)
    expect(s.per_rep_sway).toHaveLength(5)
    expect(s.mean_sway!).toBeGreaterThan(0.04)
    expect(s.mean_sway!).toBeLessThanOrEqual(0.08)
    expect(s.mean_lean_deg!).toBeGreaterThan(25)
    expect(s.incomplete_stands).toBe(0)
  })

  it('flags stands where the knees never straighten', () => {
    expect(simulate(4, 0, 20, 158).incomplete_stands).toBe(4)
  })
})

describe('qualityScore', () => {
  it('is 100 for a clean session', () => {
    expect(qualityScore(cleanFlags)).toBe(100)
  })

  it('loses points for each problem and never goes below 0', () => {
    expect(qualityScore({ ...cleanFlags, out_of_frame_s: 1.5 })).toBe(85)
    expect(qualityScore({ ...cleanFlags, used_arms: true, multiple_people: true })).toBe(65)
    expect(
      qualityScore({ ...cleanFlags, out_of_frame_s: 9, used_arms: true, multiple_people: true, low_light: true, mean_visibility: 0.2 }),
    ).toBe(0)
  })
})
