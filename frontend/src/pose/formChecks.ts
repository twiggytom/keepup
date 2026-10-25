import { FORM } from '../config/thresholds'
import { angle, dist, LM, midpoint, moreVisibleSide, sideLandmarks, type Point, type Side } from './geometry'

export interface FrameAnalysis {
  side: Side
  extension: number // mean of knee and hip angle, degrees
  kneeDeg: number
  trunkLeanDeg: number // hip-to-shoulder line vs vertical, 0 = upright
  sway: number // shoulder-midpoint x relative to ankle-midpoint x, in torso lengths
  bodyVisible: boolean // shoulder, hip, knee, ankle on the near side, all inside the frame
  armsCrossed: boolean
  sideOn: boolean
  meanVisibility: number
}

const inFrame = (p: Point) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1

/**
 * `aspect` is video width / height. MediaPipe normalizes x by width and y by height,
 * so x is scaled by the aspect ratio to make angles and distances true to life.
 */
export function analyzeFrame(raw: Point[], aspect = 1): FrameAnalysis {
  const side = moreVisibleSide(raw)
  const near = sideLandmarks(raw, side)
  const bodyVisible = Object.values(near).every((p) => (p.visibility ?? 0) >= FORM.visibilityMin && inFrame(p))

  const lm = raw.map((p) => ({ ...p, x: p.x * aspect }))
  const { shoulder, hip, knee, ankle } = sideLandmarks(lm, side)
  const kneeDeg = angle(hip, knee, ankle)
  const hipDeg = angle(shoulder, hip, knee)

  const shoulderMid = midpoint(lm[LM.leftShoulder], lm[LM.rightShoulder])
  const hipMid = midpoint(lm[LM.leftHip], lm[LM.rightHip])
  const ankleMid = midpoint(lm[LM.leftAnkle], lm[LM.rightAnkle])
  const torso = Math.max(dist(shoulderMid, hipMid), 1e-6)

  const wrists = [lm[LM.leftWrist], lm[LM.rightWrist]].filter((w) => (w.visibility ?? 0) >= FORM.wristVisibilityMin)
  // A wrist hidden behind the body (common side-on) is treated as crossed.
  const armsCrossed = wrists.every((w) => dist(w, shoulderMid) / torso <= FORM.armsCrossedMaxTorso)

  const shoulderSpread = Math.abs(lm[LM.leftShoulder].x - lm[LM.rightShoulder].x) / torso
  const meanVisibility = raw.reduce((s, p) => s + (p.visibility ?? 0), 0) / raw.length
  // y grows downwards, so hip.y - shoulder.y is positive when upright.
  const trunkLeanDeg = (Math.atan2(Math.abs(shoulderMid.x - hipMid.x), hipMid.y - shoulderMid.y) * 180) / Math.PI

  return {
    side,
    extension: (kneeDeg + hipDeg) / 2,
    kneeDeg,
    trunkLeanDeg,
    sway: (shoulderMid.x - ankleMid.x) / torso,
    bodyVisible,
    armsCrossed,
    sideOn: shoulderSpread <= FORM.sideOnMaxRatio,
    meanVisibility,
  }
}

export interface QualityFlags {
  out_of_frame_s: number
  arms_uncrossed_s: number
  used_arms: boolean
  multiple_people: boolean
  low_light: boolean
  mean_visibility: number
  side: Side | null
  frames: number
}

export type LiveIssue = 'out_of_frame' | 'arms' | 'multiple_people' | null

/** Accumulates form/quality problems across the 30 s run. */
export class FormMonitor {
  private outRun = 0
  private armsRun = 0
  private outTotal = 0
  private armsTotal = 0
  private usedArms = false
  private multiple = false
  private visSum = 0
  private frames = 0
  private sides = { left: 0, right: 0 }

  /** `poseCount` is how many people were detected; `frame` is the primary person or null. */
  update(dt: number, poseCount: number, frame: FrameAnalysis | null): LiveIssue {
    this.frames += 1
    if (poseCount > 1) this.multiple = true

    if (!frame || !frame.bodyVisible) {
      this.outRun += dt
      if (this.outRun >= FORM.outOfFrameMinS) this.outTotal += dt
      return this.outRun >= FORM.outOfFrameMinS ? 'out_of_frame' : null
    }
    this.outRun = 0
    this.visSum += frame.meanVisibility
    this.sides[frame.side] += 1

    if (!frame.armsCrossed) {
      this.armsRun += dt
      if (this.armsRun >= FORM.armsFlagMinS) {
        this.armsTotal += dt
        this.usedArms = true
        return 'arms'
      }
    } else {
      this.armsRun = 0
    }
    return poseCount > 1 ? 'multiple_people' : null
  }

  summary(): QualityFlags {
    const seen = this.sides.left + this.sides.right
    const meanVis = seen ? this.visSum / seen : 0
    return {
      out_of_frame_s: round(this.outTotal),
      arms_uncrossed_s: round(this.armsTotal),
      used_arms: this.usedArms,
      multiple_people: this.multiple,
      low_light: seen > 0 && meanVis < FORM.lowLightMeanVisibility,
      mean_visibility: round(meanVis),
      side: seen ? (this.sides.left >= this.sides.right ? 'left' : 'right') : null,
      frames: this.frames,
    }
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
