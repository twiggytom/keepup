import { describe, expect, it } from 'vitest'
import { clampDomain, MIN_SPAN_MS, panBy, zoomAt, type Domain } from './zoom'

const HOUR = 3_600_000
const bounds: Domain = [0, 10 * HOUR]

describe('zoom', () => {
  it('zooms in around the anchor', () => {
    expect(zoomAt(bounds, 0.5, 0.5, bounds)).toEqual([2.5 * HOUR, 7.5 * HOUR])
    // Anchor at the left edge keeps the start fixed.
    expect(zoomAt(bounds, 0.5, 0, bounds)).toEqual([0, 5 * HOUR])
  })

  it('never zooms out past the full range', () => {
    expect(zoomAt([2 * HOUR, 4 * HOUR], 100, 0.5, bounds)).toEqual(bounds)
  })

  it('stops at the minimum span', () => {
    const d = zoomAt(bounds, 0.000001, 0.5, bounds)
    expect(d[1] - d[0]).toBe(MIN_SPAN_MS)
  })

  it('keeps a zoomed view inside the bounds', () => {
    const d = zoomAt([0, 2 * HOUR], 0.5, 0.05, bounds)
    expect(d[0]).toBeGreaterThanOrEqual(0)
    expect(clampDomain([-HOUR, HOUR], bounds)).toEqual([0, 2 * HOUR])
  })

  it('pans and stops at the edges', () => {
    expect(panBy([0, 2 * HOUR], HOUR, bounds)).toEqual([HOUR, 3 * HOUR])
    expect(panBy([8 * HOUR, 10 * HOUR], HOUR, bounds)).toEqual([8 * HOUR, 10 * HOUR])
  })
})
