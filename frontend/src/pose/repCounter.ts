/**
 * Sit-to-stand repetition counter.
 *
 * Input is a per-frame "extension" angle: the mean of the knee angle (hip-knee-ankle) and
 * hip angle (shoulder-hip-knee). Seated is roughly 90°, fully standing roughly 170°.
 * Separate enter/exit thresholds give hysteresis so pose jitter cannot double count.
 */

export type RepState = 'sitting' | 'rising' | 'standing' | 'descending'

export interface RepEvent {
  index: number
  t_sit_start: number
  t_stand_peak: number
  t_sit_end: number | null
  duration_s: number | null
  partial: boolean
}

export const THRESHOLDS = {
  sitEnter: 110, // at or below: seated
  sitExit: 120, // above: has started rising
  standEnter: 155, // at or above: fully standing (a rep)
  standExit: 145, // below: has started descending
}

const EMA_ALPHA = 0.4
const DEFAULT_SIT = 90
const DEFAULT_STAND = 170

export class RepCounter {
  state: RepState = 'sitting'
  events: RepEvent[] = []
  smoothed: number | null = null

  private riseStart = 0
  private lastSitT = 0
  private sitSum = 0
  private sitN = 0
  private peakSum = 0
  private peakN = 0
  private currentPeak = 0

  get count(): number {
    return this.events.length
  }

  /** Feed one frame. Returns true when a new rep was counted on this frame. */
  update(t: number, extension: number): boolean {
    this.smoothed = this.smoothed === null ? extension : EMA_ALPHA * extension + (1 - EMA_ALPHA) * this.smoothed
    const a = this.smoothed
    const th = THRESHOLDS

    switch (this.state) {
      case 'sitting':
        this.sitSum += a
        this.sitN += 1
        if (a > th.sitExit) {
          this.state = 'rising'
          this.riseStart = this.lastSitT
        } else {
          this.lastSitT = t
        }
        return false

      case 'rising':
        if (a >= th.standEnter) {
          this.state = 'standing'
          this.currentPeak = a
          this.events.push({
            index: this.events.length,
            t_sit_start: round(this.riseStart),
            t_stand_peak: round(t),
            t_sit_end: null,
            duration_s: null,
            partial: false,
          })
          return true
        }
        if (a <= th.sitEnter) {
          this.state = 'sitting' // aborted attempt
          this.lastSitT = t
        }
        return false

      case 'standing':
        if (a > this.currentPeak) {
          this.currentPeak = a
          this.events[this.events.length - 1].t_stand_peak = round(t)
        }
        if (a < th.standExit) {
          this.peakSum += this.currentPeak
          this.peakN += 1
          this.state = 'descending'
        }
        return false

      case 'descending':
        if (a >= th.standEnter) {
          this.state = 'standing' // straightened up again, same rep
          this.currentPeak = a
        } else if (a <= th.sitEnter) {
          const last = this.events[this.events.length - 1]
          last.t_sit_end = round(t)
          last.duration_s = round(t - last.t_sit_start)
          this.state = 'sitting'
          this.lastSitT = t
        }
        return false
    }
  }

  /**
   * Call when time is up. Per STEADI, a stand that is more than halfway up when the
   * time ends counts as a stand.
   */
  finish(t: number): void {
    if (this.state !== 'rising' || this.smoothed === null) return
    const sit = this.sitN ? this.sitSum / this.sitN : DEFAULT_SIT
    const stand = this.peakN ? this.peakSum / this.peakN : DEFAULT_STAND
    if (this.smoothed > (sit + stand) / 2) {
      this.events.push({
        index: this.events.length,
        t_sit_start: round(this.riseStart),
        t_stand_peak: round(t),
        t_sit_end: null,
        duration_s: null,
        partial: true,
      })
    }
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
