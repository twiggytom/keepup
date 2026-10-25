import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { SessionMetrics } from '../analysis/metrics'
import { METRICS } from '../config/thresholds'

function paceText(index: number | null): string {
  if (index === null) return 'Not enough stands to compare'
  if (index <= METRICS.fatigueSteadyMax) return 'Kept a steady pace'
  if (index <= METRICS.fatigueSlightMax) return 'Slowed down a little toward the end'
  return 'Slowed down noticeably toward the end'
}

function steadinessText(sway: number | null): string {
  if (sway === null) return 'Not measured'
  if (sway <= METRICS.swaySteadyMax) return 'Steady at the top of each stand'
  if (sway <= METRICS.swaySomeMax) return 'Some wobble at the top of each stand'
  return 'Noticeable wobble at the top of each stand'
}

const secs = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)} s`)

interface RepRow {
  stand: number
  total: number
  rise: number | null
  lower: number | null
}

function RepTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload as RepRow
  return (
    <div className="chart-tooltip">
      <strong>Stand {r.stand}</strong>
      <div>{secs(r.total)} total</div>
      <div className="muted">
        Up {secs(r.rise)} · down {secs(r.lower)}
      </div>
    </div>
  )
}

export default function MovementSummary({ metrics }: { metrics: SessionMetrics }) {
  const { speed, fatigue, steadiness, quality_score } = metrics
  const rows: RepRow[] = speed.per_rep_s.map((total, i) => ({
    stand: i + 1,
    total,
    rise: speed.rise_s[i] ?? null,
    lower: speed.lower_s[i] ?? null,
  }))

  return (
    <section className="movement">
      <h2>How you moved</h2>
      <p className="muted">
        There are no CDC reference values for these measures. They are most useful for seeing how your own results
        change over time.
      </p>

      <div className="tiles">
        <div className="tile">
          <div className="tile-label">Average time per stand</div>
          <div className="tile-value">{secs(speed.mean_s)}</div>
          <div className="tile-note">
            Up {secs(speed.mean_rise_s)} · down {secs(speed.mean_lower_s)}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Pace</div>
          <div className="tile-text">{paceText(fatigue.index)}</div>
          <div className="tile-note">
            {fatigue.reps_first_half} stands in the first 15 s, {fatigue.reps_second_half} in the last 15 s
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Steadiness</div>
          <div className="tile-text">{steadinessText(steadiness.mean_sway)}</div>
          {steadiness.mean_lean_deg !== null && (
            <div className="tile-note">Leaned forward about {Math.round(steadiness.mean_lean_deg)}° to stand up</div>
          )}
        </div>
        <div className="tile">
          <div className="tile-label">Recording quality</div>
          <div className="tile-value">{quality_score}/100</div>
          <div className="tile-note">How clearly the camera could follow the test</div>
        </div>
      </div>

      {steadiness.incomplete_stands > 0 && (
        <p className="note">
          On {steadiness.incomplete_stands} {steadiness.incomplete_stands === 1 ? 'stand' : 'stands'} your knees did not
          fully straighten.
        </p>
      )}

      {rows.length > 0 && (
        <>
          <h3>Time for each stand</h3>
          <div className="chart" role="img" aria-label="Column chart of seconds taken for each stand">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="stand" tickLine={false} axisLine={{ stroke: 'var(--grid)' }} tick={{ fill: 'var(--muted)' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--muted)' }}
                  tickFormatter={(v: number) => `${v}s`}
                  allowDecimals={false}
                />
                <Tooltip content={RepTooltip} cursor={{ fill: 'var(--grid)', opacity: 0.5 }} />
                <Bar dataKey="total" fill="var(--chart)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details>
            <summary>Show as a table</summary>
            <table className="history">
              <thead>
                <tr>
                  <th>Stand</th>
                  <th>Total</th>
                  <th>Up</th>
                  <th>Down</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.stand}>
                    <td>{r.stand}</td>
                    <td>{secs(r.total)}</td>
                    <td>{secs(r.rise)}</td>
                    <td>{secs(r.lower)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  )
}
