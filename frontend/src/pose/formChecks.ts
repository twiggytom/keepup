import { angle, dist, LM, midpoint, moreVisibleSide, sideLandmarks, type Point, type Side } from './geometry'

export const VISIBILITY_MIN = 0.6
// Wrists farther than this (in torso lengths) from the shoulder midpoint = arms not crossed.
const ARMS_CROSSED_MAX_DIST = 0.75
// Horizontal shoulder separation / torso length below this = side-on or roughly 45°.
const SIDE_ON_MAX_RATIO = 0.6
const ARMS_FLAG_MIN_S = 0.5
const OUT_OF_FRAME_MIN_S = 0.5
const LOW_LIGHT_MEAN_VISIBILITY = 0.5

export interface FrameAnalysis {
  side: Side
  extension: number // mean of knee and hip angle, degrees
  bodyVisible: boolean // shoulder, hip, knee, ankle on the near side, all inside the frame
  armsCrossed: boolean
  sideOn: boolean
  meanVisibility: number
}

const inFrame = (p: Point) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1

export function analyzeFrame(lm: Point[]): FrameAnalysis {
  const side = moreVisibleSide(lm)
  const { shoulder, hip, knee, ankle } = sideLandmarks(lm, side)
  const keypoints = [shoulder, hip, knee, ankle]
  const bodyVisible = keypoints.every((p) => (p.visibility ?? 0) >= VISIBILITY_MIN && inFrame(p))

  const knee_ = angle(hip, knee, ankle)
  const hip_ = angle(shoulder, hip, knee)

  const shoulderMid = midpoint(lm[LM.leftShoulder], lm[LM.rightShoulder])
  const torso = Math.max(dist(shoulderMid, midpoint(lm[LM.leftHip], lm[LM.rightHip])), 1e-6)
  const wrists = [lm[LM.leftWrist], lm[LM.rightWrist]].filter((w) => (w.visibility ?? 0) >= 0.3)
  // A wrist hidden behind the body (common side-on) is treated as crossed.
  const armsCrossed = wrists.every((w) => dist(w, shoulderMid) / torso <= ARMS_CROSSED_MAX_DIST)

  const shoulderSpread = Math.abs(lm[LM.leftShoulder].x - lm[LM.rightShoulder].x) / torso
  const meanVisibility = lm.reduce((s, p) => s + (p.visibility ?? 0), 0) / lm.length

  return {
    side,
    extension: (knee_ + hip_) / 2,
    bodyVisible,
    armsCrossed,
    sideOn: shoulderSpread <= SIDE_ON_MAX_RATIO,
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
      if (this.outRun >= OUT_OF_FRAME_MIN_S) this.outTotal += dt
      return this.outRun >= OUT_OF_FRAME_MIN_S ? 'out_of_frame' : null
    }
    this.outRun = 0
    this.visSum += frame.meanVisibility
    this.sides[frame.side] += 1

    if (!frame.armsCrossed) {
      this.armsRun += dt
      if (this.armsRun >= ARMS_FLAG_MIN_S) {
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
      low_light: seen > 0 && meanVis < LOW_LIGHT_MEAN_VISIBILITY,
      mean_visibility: round(meanVis),
      side: seen ? (this.sides.left >= this.sides.right ? 'left' : 'right') : null,
      frames: this.frames,
    }
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
