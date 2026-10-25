import { useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { Exclusion, Trend, TrendPoint, Trends } from '../api/client'

const DAY_MS = 86_400_000
const MIN_PAD_MS = 30 * 60_000

type Range = 'day' | 'week' | 'month' | 'year' | 'all'

const RANGES: { key: Range; label: string; ms: number | null }[] = [
  { key: 'day', label: 'Day', ms: DAY_MS },
  { key: 'week', label: 'Week', ms: 7 * DAY_MS },
  { key: 'month', label: 'Month', ms: 30 * DAY_MS },
  { key: 'year', label: 'Year', ms: 365 * DAY_MS },
  { key: 'all', label: 'All', ms: null },
]

/** Fit the axis to the shown tests, padded by 5% (at least 30 minutes) so edge points are not on the axis. */
function fitDomain(first: number, last: number): [number, number] {
  const pad = Math.max((last - first) * 0.05, MIN_PAD_MS)
  return [first - pad, last + pad]
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()

function tickFormat([start, end]: [number, number]): Intl.DateTimeFormatOptions {
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

function PointTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload as Row
  const p = r.point
  return (
    <div className="chart-tooltip">
      <strong>{new Date(p.started_at).toLocaleString()}</strong>
      <div>{p.reps} stands</div>
      {p.cdc_threshold !== null && <div className="muted">CDC guide: {p.cdc_threshold}</div>}
      {p.quality_score !== null && <div className="muted">Recording quality {p.quality_score}/100</div>}
      {p.excluded_reason && <div className="muted">{EXCLUSION_TEXT[p.excluded_reason]}</div>}
    </div>
  )
}

const hollowDot = (props: { cx?: number; cy?: number }) => (
  <circle cx={props.cx} cy={props.cy} r={5} fill="var(--surface)" stroke="var(--muted)" strokeWidth={2} />
)

const filledDot = (props: { cx?: number; cy?: number }) => (
  <circle cx={props.cx} cy={props.cy} r={6} fill="var(--chart)" stroke="var(--surface)" strokeWidth={2} />
)

export default function TrendSummary({ trends }: { trends: Trends }) {
  const rows = buildRows(trends.points, trends.reps)
  const yMax = Math.max(10, ...rows.map((r) => Math.max(r.reps, r.cdc ?? 0))) + 2
  const anyExcluded = rows.some((r) => !r.point.in_fit)
  const hasTrend = rows.some((r) => r.trend !== undefined)
  const s = (n: number) => `${n.toFixed(1)} s`

  // A range picks which tests are shown: those in the `windowMs` before `windowEnd`, which is
  // always a test's time. The axis then fits the shown tests so close-together tests spread out.
  const [range, setRange] = useState<Range>('all')
  const [windowEnd, setWindowEnd] = useState<number | null>(null) // null = the latest test
  const windowMs = RANGES.find((r) => r.key === range)!.ms
  const end = windowEnd ?? rows[rows.length - 1].t
  const start = windowMs === null ? -Infinity : end - windowMs
  const shown = rows.filter((r) => r.t >= start && r.t <= end)
  const domain = fitDomain(shown[0].t, shown[shown.length - 1].t)
  const ticks = TICK_FRACTIONS.map((f) => domain[0] + (domain[1] - domain[0]) * f)
  const tickOpts = tickFormat(domain)
  const earlier = rows.filter((r) => r.t < start)
  const later = rows.filter((r) => r.t > end)

  function pick(r: Range) {
    setRange(r)
    setWindowEnd(null)
  }

  function goEarlier() {
    setWindowEnd(earlier[earlier.length - 1].t)
  }

  function goLater() {
    // Show as many later tests as fit in one window, starting from the next one.
    const reach = later[0].t + windowMs!
    setWindowEnd(later.filter((r) => r.t <= reach).pop()!.t)
  }

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
        {windowMs !== null && (
          <div className="pager">
            <button onClick={goEarlier} disabled={earlier.length === 0} aria-label="Earlier tests">
              ←
            </button>
            <button onClick={goLater} disabled={later.length === 0} aria-label="Later tests">
              →
            </button>
          </div>
        )}
      </div>
      <p className="muted window-label">
        {formatSpan(shown[0].t, shown[shown.length - 1].t)} · {shown.length} {shown.length === 1 ? 'test' : 'tests'}
      </p>
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
      <div className="chart" role="img" aria-label="Chart of stands in 30 seconds for each test over time, with trend line and CDC guide">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
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
            <Tooltip content={PointTooltip} cursor={{ stroke: 'var(--grid)' }} />
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
            <Scatter data={rows.filter((r) => !r.point.in_fit)} dataKey="reps" shape={hollowDot} isAnimationActive={false} />
            <Scatter data={rows.filter((r) => r.point.in_fit)} dataKey="reps" shape={filledDot} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
