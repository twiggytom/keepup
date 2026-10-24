export interface Point {
  x: number
  y: number
  z?: number
  visibility?: number
}

// MediaPipe Pose landmark indices.
export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const

export type Side = 'left' | 'right'

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Angle ABC in degrees (vertex at B). */
export function angle(a: Point, b: Point, c: Point): number {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const dot = ab.x * cb.x + ab.y * cb.y
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y)
  if (mag === 0) return 0
  return (Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI
}

export function sideLandmarks(lm: Point[], side: Side) {
  return side === 'left'
    ? { shoulder: lm[LM.leftShoulder], hip: lm[LM.leftHip], knee: lm[LM.leftKnee], ankle: lm[LM.leftAnkle] }
    : { shoulder: lm[LM.rightShoulder], hip: lm[LM.rightHip], knee: lm[LM.rightKnee], ankle: lm[LM.rightAnkle] }
}

/** The side of the body facing the camera, by summed landmark visibility. */
export function moreVisibleSide(lm: Point[]): Side {
  const score = (s: Side) => Object.values(sideLandmarks(lm, s)).reduce((sum, p) => sum + (p.visibility ?? 0), 0)
  return score('left') >= score('right') ? 'left' : 'right'
}
