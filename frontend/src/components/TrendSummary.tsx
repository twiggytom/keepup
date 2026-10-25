import { useEffect, useRef, useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  XAxis,
  YAxis,
} from 'recharts'
import type { Exclusion, Trend, TrendPoint, Trends } from '../api/client'
import { isFullView, panBy, zoomAt, type Domain } from './zoom'

const DAY_MS = 86_400_000
const MIN_PAD_MS = 2 * 60_000
const SINGLE_TEST_PAD_MS = 30 * 60_000
const ZOOM_STEP = 2 // the − and + buttons halve or double the visible time
const PAN_FRACTION = 0.8 // arrows move a zoomed view by this share of its width
const HOVER_RADIUS_PX = 14 // details show only when the cursor is this close to a point
const TOOLTIP_WIDTH_PX = 240

type Range = 'day' | 'week' | 'month' | 'year' | 'all'

const RANGES: { key: Range; label: string; ms: number | null }[] = [
  { key: 'day', label: 'Day', ms: DAY_MS },
  { key: 'week', label: 'Week', ms: 7 * DAY_MS },
  { key: 'month', label: 'Month', ms: 30 * DAY_MS },
  { key: 'year', label: 'Year', ms: 365 * DAY_MS },
  { key: 'all', label: 'All', ms: null },
]

/** A fixed-width window centred on the tests it contains. */
function centredDomain(first: number, last: number, widthMs: number): Domain {
  const mid = (first + last) / 2
  return [mid - widthMs / 2, mid + widthMs / 2]
}

/** Fit the axis to the shown tests, padded by 5% so edge points are not on the axis. */
function fitDomain(first: number, last: number): Domain {
  const pad = first === last ? SINGLE_TEST_PAD_MS : Math.max((last - first) * 0.05, MIN_PAD_MS)
  return [first - pad, last + pad]
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()

function tickFormat([start, end]: Domain): Intl.DateTimeFormatOptions {
  if (end - start <= 15 * 60_000) return { hour: 'numeric', minute: '2-digit', second: '2-digit' }
  if (sameDay(start, end)) return { hour: 'numeric', minute: '2-digit' }
  if (end - start <= 7 * DAY_MS) return { month: 'short', day: 'numeric', hour: 'numeric' }
  if (end - start <= 400 * DAY_MS) return { month: 'short', day: 'numeric' }
  return { month: 'short', year: 'numeric' }
}

/** Describe the shown tests' time span, e.g. "Oct 24, 2026, 4:05 PM – 5:10 PM". */
function formatSpan(first: number, last: number): string {
  const date: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  const time: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  const d = (t: number, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleString(undefined, o)
  if (first === last) return d(first, { ...date, ...time })
  if (sameDay(first, last)) return `${d(first, { ...date, ...time })} – ${d(last, time)}`
  return `${d(first, date)} – ${d(last, date)}`
}

// Ticks sit inside the axis ends so edge labels are never clipped.
const TICK_FRACTIONS = [0.1, 0.3, 0.5, 0.7, 0.9]

const EXCLUSION_TEXT: Record<Exclusion, string> = {
  not_counted: 'Not counted (out of view of the camera)',
  low_quality: 'Low recording quality, not used in the trend',
  arms_used: 'Arms used, not used in the trend',
}

// Plain-language trend wording per metric: [improving, steady, declining].
const WORDING: Record<'reps' | 'mean_stand_s' | 'fatigue_index' | 'mean_sway', [string, string, string]> = {
  reps: ['Going up', 'Holding steady', 'Going down'],
  mean_stand_s: ['Getting faster', 'Holding steady', 'Getting slower'],
  fatigue_index: ['Slowing down less at the end', 'Holding steady', 'Slowing down more at the end'],
  mean_sway: ['Getting steadier', 'Holding steady', 'Less steady than before'],
}

function statusText(metric: keyof typeof WORDING, t: Trend): string {
  if (t.status === 'insufficient_data') return 'Not enough tests yet'
  const [up, flat, down] = WORDING[metric]
  return t.status === 'improving' ? up : t.status === 'steady' ? flat : down
}

function spanText(days: number | null): string {
  if (days === null || days < 1) return 'so far'
  if (days < 14) return `over ${Math.round(days)} days`
  if (days < 61) return `over ${Math.round(days / 7)} weeks`
  return `over ${Math.round(days / 30.44)} months`
}

function noteText(t: Trend, unit: (n: number) => string): string {
  if (t.status === 'insufficient_data') {
    return `Take ${t.needed} more counted ${t.needed === 1 ? 'test' : 'tests'} to see a trend`
  }
  const change = t.fitted_change ?? 0
  return `${change >= 0 ? '+' : '−'}${unit(Math.abs(change))} ${spanText(t.span_days)} (${t.n} tests)`
}

interface Row {
  t: number
  date: string
  reps: number
  cdc: number | null
  trend?: number
  point: TrendPoint
}

function buildRows(points: TrendPoint[], reps: Trend): Row[] {
  const rows: Row[] = points.map((p) => ({
    t: new Date(p.started_at).getTime(),
    date: new Date(p.started_at).toLocaleDateString(),
    reps: p.reps,
    cdc: p.cdc_threshold,
    point: p,
  }))
  if (reps.status !== 'insufficient_data' && reps.first_fitted !== null && reps.last_fitted !== null) {
    const fitted = rows.filter((r) => r.point.in_fit)
    fitted[0].trend = reps.first_fitted
    fitted[fitted.length - 1].trend = reps.last_fitted
  }
  return rows
}

interface Hover {
  row: Row
  x: number // point position in chart pixels
  y: number
}

function PointTooltip({ hover, chartWidth }: { hover: Hover; chartWidth: number }) {
  const p = hover.row.point
  const flip = hover.x + 16 + TOOLTIP_WIDTH_PX > chartWidth
  return (
    <div
      className="chart-tooltip floating"
      style={{ top: hover.y, left: flip ? hover.x - 16 - TOOLTIP_WIDTH_PX : hover.x + 16, width: TOOLTIP_WIDTH_PX }}
    >
      <strong>{new Date(p.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>
      <div>{p.reps} stands</div>
      {p.cdc_threshold !== null && <div className="muted">CDC guide: {p.cdc_threshold}</div>}
      {p.quality_score !== null && <div className="muted">Recording quality {p.quality_score}/100</div>}
      {p.excluded_reason && <div className="muted">{EXCLUSION_TEXT[p.excluded_reason]}</div>}
    </div>
  )
}

interface DotProps {
  cx?: number
  cy?: number
  payload?: Row
}

/** A point plus a larger invisible hit circle that shows its details on hover or tap. */
function dotShape(filled: boolean, setHover: (h: Hover | null) => void) {
  return function Dot({ cx = 0, cy = 0, payload }: DotProps) {
    const show = () => payload && setHover({ row: payload, x: cx, y: cy })
    return (
      <g>
        {filled ? (
          <circle cx={cx} cy={cy} r={6} fill="var(--chart)" stroke="var(--surface)" strokeWidth={2} />
        ) : (
          <circle cx={cx} cy={cy} r={5} fill="var(--surface)" stroke="var(--muted)" strokeWidth={2} />
        )}
        <circle
          cx={cx}
          cy={cy}
          r={HOVER_RADIUS_PX}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onMouseEnter={show}
          onMouseLeave={() => setHover(null)}
          onClick={show}
        />
      </g>
    )
  }
}

export default function TrendSummary({ trends }: { trends: Trends }) {
  const rows = buildRows(trends.points, trends.reps)
  const yMax = Math.max(10, ...rows.map((r) => Math.max(r.reps, r.cdc ?? 0))) + 2
  const anyExcluded = rows.some((r) => !r.point.in_fit)
  const hasTrend = rows.some((r) => r.trend !== undefined)
  const s = (n: number) => `${n.toFixed(1)} s`

  // A range picks a fixed-width window (a day, week, month or year) around the tests in the
  // `windowMs` before `windowEnd`, which is always a test's time. "All" fits every test.
  const [range, setRange] = useState<Range>('all')
  const [windowEnd, setWindowEnd] = useState<number | null>(null) // null = the latest test
  const windowMs = RANGES.find((r) => r.key === range)!.ms
  const end = windowEnd ?? rows[rows.length - 1].t
  const start = windowMs === null ? -Infinity : end - windowMs
  const inWindow = rows.filter((r) => r.t >= start && r.t <= end)

  const windowFirst = inWindow[0].t
  const windowLast = inWindow[inWindow.length - 1].t
  const base: Domain =
    windowMs === null ? fitDomain(windowFirst, windowLast) : centredDomain(windowFirst, windowLast, windowMs)

  // Zooming (pinch, Ctrl + scroll, or − / +) overrides the range's view until reset. It can
  // reach anywhere in the history, or the whole range window if that is wider.
  const [zoom, setZoom] = useState<Domain | null>(null)
  const all = fitDomain(rows[0].t, rows[rows.length - 1].t)
  const bounds: Domain = [Math.min(all[0], base[0]), Math.max(all[1], base[1])]
  const domain = zoom ?? base
  const shown = rows.filter((r) => r.t >= domain[0] && r.t <= domain[1])
  const ticks = TICK_FRACTIONS.map((f) => domain[0] + (domain[1] - domain[0]) * f)
  const tickOpts = tickFormat(domain)
  const earlier = rows.filter((r) => r.t < start)
  const later = rows.filter((r) => r.t > end)

  const chartRef = useRef<HTMLDivElement>(null)
  const view = useRef({ domain, bounds, base })
  useEffect(() => {
    view.current = { domain, bounds, base }
  })

  const [hover, setHover] = useState<Hover | null>(null)

  const applyZoom = (d: Domain) => {
    const v = view.current
    v.domain = d // wheel events can arrive faster than re-renders
    setZoom(isFullView(d, v.bounds) && isFullView(v.base, v.bounds) ? null : d)
    setHover(null) // the point has moved
  }

  // Gestures: pinch or Ctrl + wheel zooms at the cursor; a horizontal swipe or Shift + wheel pans.
  // Plain vertical scrolling is left alone so the page still scrolls.
  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const plot = () => (el.querySelector('.recharts-cartesian-grid') ?? el).getBoundingClientRect()
    const anchorAt = (clientX: number) => {
      const r = plot()
      return Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    }

    const onWheel = (e: WheelEvent) => {
      const { domain: d, bounds: b } = view.current
      const scale = e.deltaMode === 1 ? 16 : 1 // line-based wheels report lines, not pixels
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const factor = Math.min(2, Math.max(0.5, Math.exp(e.deltaY * scale * 0.01)))
        applyZoom(zoomAt(d, factor, anchorAt(e.clientX), b))
        return
      }
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
      if (Math.abs(dx) > Math.abs(e.shiftKey ? 0 : e.deltaY) && !isFullView(d, b)) {
        e.preventDefault()
        applyZoom(panBy(d, ((dx * scale) / plot().width) * (d[1] - d[0]), b))
      }
    }

    // Safari reports trackpad pinches as gesture events instead of Ctrl + wheel.
    type Gesture = Event & { scale: number; clientX: number }
    let gestureStart: Domain | null = null
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      gestureStart = view.current.domain
    }
    const onGestureChange = (e: Event) => {
      const g = e as Gesture
      if (!gestureStart) return
      e.preventDefault()
      applyZoom(zoomAt(gestureStart, 1 / g.scale, anchorAt(g.clientX), view.current.bounds))
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', onGestureStart)
    el.addEventListener('gesturechange', onGestureChange)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', onGestureStart)
      el.removeEventListener('gesturechange', onGestureChange)
    }
  }, [])

  function pick(r: Range) {
    setRange(r)
    setWindowEnd(null)
    setZoom(null)
    setHover(null)
  }

  function goEarlier() {
    if (zoom) return applyZoom(panBy(domain, -(domain[1] - domain[0]) * PAN_FRACTION, bounds))
    setWindowEnd(earlier[earlier.length - 1].t)
  }

  function goLater() {
    if (zoom) return applyZoom(panBy(domain, (domain[1] - domain[0]) * PAN_FRACTION, bounds))
    // Show as many later tests as fit in one window, starting from the next one.
    const reach = later[0].t + windowMs!
    setWindowEnd(later.filter((r) => r.t <= reach).pop()!.t)
  }

  const canGoEarlier = zoom ? domain[0] > bounds[0] : earlier.length > 0
  const canGoLater = zoom ? domain[1] < bounds[1] : later.length > 0
  const fullyZoomedIn = domain[1] - domain[0] <= Math.min(4 * 60_000, bounds[1] - bounds[0])

  // Lines get extra points at the view's edges so the CDC guide spans the whole window.
  const lineRows = [
    { t: Math.min(domain[0], rows[0].t), cdc: rows[0].cdc },
    ...rows.map((r) => ({ t: r.t, cdc: r.cdc, trend: r.trend })),
    { t: Math.max(domain[1], rows[rows.length - 1].t), cdc: rows[rows.length - 1].cdc },
  ]
  const Hollow = dotShape(false, setHover)
  const Filled = dotShape(true, setHover)

  return (
    <section className="trends">
      <h2>Your trends</h2>
      <div className="tiles">
        <div className="tile">
          <div className="tile-label">Stands in 30 seconds</div>
          <div className="tile-text">{statusText('reps', trends.reps)}</div>
          <div className="tile-note">{noteText(trends.reps, (n) => `${Math.round(n)} stands`)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Time per stand</div>
          <div className="tile-text">{statusText('mean_stand_s', trends.mean_stand_s)}</div>
          <div className="tile-note">{noteText(trends.mean_stand_s, s)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Pace</div>
          <div className="tile-text">{statusText('fatigue_index', trends.fatigue_index)}</div>
          <div className="tile-note">{noteText(trends.fatigue_index, (n) => n.toFixed(2))}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Steadiness</div>
          <div className="tile-text">{statusText('mean_sway', trends.mean_sway)}</div>
          <div className="tile-note">{noteText(trends.mean_sway, (n) => n.toFixed(2))}</div>
        </div>
      </div>
      {trends.reps.status === 'declining' && (
        <p className="note">Your stands are going down over time. Consider discussing this with your doctor.</p>
      )}

      <h3>Stands over time</h3>
      <div className="chart-controls">
        <div className="segmented" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.key} className={range === r.key ? 'primary' : ''} aria-pressed={range === r.key} onClick={() => pick(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="pager">
          <button onClick={() => applyZoom(zoomAt(domain, ZOOM_STEP, 0.5, bounds))} disabled={isFullView(domain, bounds)} aria-label="Zoom out">
            −
          </button>
          <button onClick={() => applyZoom(zoomAt(domain, 1 / ZOOM_STEP, 0.5, bounds))} disabled={fullyZoomedIn} aria-label="Zoom in">
            +
          </button>
          {(windowMs !== null || zoom) && (
            <>
              <button onClick={goEarlier} disabled={!canGoEarlier} aria-label="Earlier">
                ←
              </button>
              <button onClick={goLater} disabled={!canGoLater} aria-label="Later">
                →
              </button>
            </>
          )}
        </div>
      </div>
      <p className="muted window-label">
        {zoom || windowMs !== null ? formatSpan(domain[0], domain[1]) : formatSpan(windowFirst, windowLast)}
        {' · '}
        {shown.length} {shown.length === 1 ? 'test' : 'tests'}
        {zoom && (
          <>
            {' · '}
            <button className="link" onClick={() => applyZoom(base)}>
              Reset zoom
            </button>
          </>
        )}
      </p>
      <p className="muted window-label">Pinch or Ctrl + scroll on the chart to zoom. Swipe sideways to move.</p>
      <ul className="legend">
        <li>
          <span className="swatch dot" /> Counted test
        </li>
        {anyExcluded && (
          <li>
            <span className="swatch dot hollow" /> Not used in the trend
          </li>
        )}
        {hasTrend && (
          <li>
            <span className="swatch line" /> Trend
          </li>
        )}
        <li>
          <span className="swatch line guide" /> CDC guide: below this is below average for your age and sex
        </li>
      </ul>
      <div className="chart" ref={chartRef} onMouseLeave={() => setHover(null)} role="img" aria-label="Chart of stands in 30 seconds for each test over time, with trend line and CDC guide">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={lineRows} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={domain}
              allowDataOverflow
              ticks={ticks}
              interval={0}
              tickFormatter={(t: number) => new Date(t).toLocaleString(undefined, tickOpts)}
              tickLine={false}
              tickMargin={8}
              axisLine={{ stroke: 'var(--grid)' }}
              tick={{ fill: 'var(--muted)' }}
            />
            <YAxis
              domain={[0, yMax]}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted)' }}
            />
            <Line
              dataKey="cdc"
              type="stepAfter"
              stroke="var(--muted)"
              strokeWidth={2}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="trend"
              stroke="var(--chart)"
              strokeWidth={2}
              connectNulls
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Scatter data={rows.filter((r) => !r.point.in_fit)} dataKey="reps" shape={Hollow} isAnimationActive={false} />
            <Scatter data={rows.filter((r) => r.point.in_fit)} dataKey="reps" shape={Filled} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        {hover && <PointTooltip hover={hover} chartWidth={chartRef.current?.clientWidth ?? 0} />}
      </div>
    </section>
  )
}
