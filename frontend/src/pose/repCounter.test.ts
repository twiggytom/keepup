import { describe, expect, it } from 'vitest'
import { RepCounter } from './repCounter'

const FPS = 30

/** Feed a piecewise-linear extension-angle trajectory: [time_s, angle][] keyframes. */
function feed(counter: RepCounter, keyframes: [number, number][], jitter = 0) {
  let seed = 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2
  for (let i = 0; i < keyframes.length - 1; i++) {
    const [t0, a0] = keyframes[i]
    const [t1, a1] = keyframes[i + 1]
    for (let t = t0; t < t1; t += 1 / FPS) {
      counter.update(t, a0 + ((a1 - a0) * (t - t0)) / (t1 - t0) + jitter * rand())
    }
  }
  return keyframes[keyframes.length - 1][0]
}

/** n full sit-stand-sit cycles of `period` seconds, starting seated. */
function cycles(n: number, period = 2.5, start = 0.5): [number, number][] {
  const k: [number, number][] = [[0, 90], [start, 90]]
  for (let i = 0; i < n; i++) {
    const t = start + i * period
    k.push([t + period * 0.4, 172], [t + period * 0.5, 172], [t + period * 0.9, 90], [t + period, 90])
  }
  return k
}

describe('RepCounter', () => {
  it('counts full stands', () => {
    const c = new RepCounter()
    feed(c, cycles(10))
    expect(c.count).toBe(10)
    expect(c.events.every((e) => e.duration_s! > 1.5 && e.duration_s! < 3.5)).toBe(true)
  })

  it('does not double count with jitter around thresholds', () => {
    const c = new RepCounter()
    feed(c, cycles(8), 6)
    expect(c.count).toBe(8)
  })

  it('ignores a partial rise that sits back down', () => {
    const c = new RepCounter()
    feed(c, [[0, 90], [1, 140], [2, 90], [3, 90]])
    expect(c.count).toBe(0)
  })

  it('counts a stand more than halfway up at the end', () => {
    const c = new RepCounter()
    const end = feed(c, [...cycles(3), [8.5, 90], [9.2, 140]])
    c.finish(end)
    expect(c.count).toBe(4)
    expect(c.events[3].partial).toBe(true)
  })

  it('does not count a stand less than halfway up at the end', () => {
    const c = new RepCounter()
    const end = feed(c, [...cycles(3), [8.5, 90], [9.0, 122]])
    c.finish(end)
    expect(c.count).toBe(3)
  })
})
