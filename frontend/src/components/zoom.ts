/** Pure helpers for zooming and panning a time axis. Domains are [start, end] in ms. */

export type Domain = [number, number]

export const MIN_SPAN_MS = 4 * 60_000

/** Shift `d` so it lies inside `bounds`; if it is wider than `bounds`, return `bounds`. */
export function clampDomain(d: Domain, bounds: Domain): Domain {
  const span = d[1] - d[0]
  if (span >= bounds[1] - bounds[0]) return bounds
  if (d[0] < bounds[0]) return [bounds[0], bounds[0] + span]
  if (d[1] > bounds[1]) return [bounds[1] - span, bounds[1]]
  return d
}

/**
 * Scale `d` by `factor` (below 1 zooms in) keeping the time under `anchor` fixed, where
 * `anchor` is the 0-1 position across the axis (0.5 = centre).
 */
export function zoomAt(d: Domain, factor: number, anchor: number, bounds: Domain): Domain {
  const span = d[1] - d[0]
  const minSpan = Math.min(MIN_SPAN_MS, bounds[1] - bounds[0])
  const next = Math.min(Math.max(span * factor, minSpan), bounds[1] - bounds[0])
  const at = d[0] + span * anchor
  const start = at - next * anchor
  return clampDomain([start, start + next], bounds)
}

export function panBy(d: Domain, deltaMs: number, bounds: Domain): Domain {
  return clampDomain([d[0] + deltaMs, d[1] + deltaMs], bounds)
}

export const isFullView = (d: Domain, bounds: Domain) => d[0] <= bounds[0] && d[1] >= bounds[1]
