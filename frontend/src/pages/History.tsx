import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type TestSession } from '../api/client'

const CHART_SESSIONS = 10
const shortDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })

function trendText(sessions: TestSession[]): string | null {
  const valid = sessions.filter((s) => s.valid)
  if (valid.length < 2) return null
  const first = valid[0]
  const last = valid[valid.length - 1]
  const since = new Date(first.started_at).toLocaleDateString([], { month: 'long' })
  const d = last.reps - first.reps
  if (d === 0) return `Same as in ${since}.`
  return `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)} ${Math.abs(d) === 1 ? 'stand' : 'stands'} since ${since}.`
}

export default function History() {
  const [sessions, setSessions] = useState<TestSession[] | null>(null)

  useEffect(() => {
    api.listSessions().then(setSessions, () => setSessions([]))
  }, [])

  if (!sessions) return <p className="center">Loading…</p>
  if (sessions.length === 0)
    return (
      <section className="card wide empty">
        <h1>Your results</h1>
        <p>Your first result starts here.</p>
        <div className="actions">
          <Link to="/test" className="button primary pill">
            Take first test
          </Link>
          <Link to="/onboarding" className="button pill ghost">
            My profile
          </Link>
        </div>
      </section>
    )

  // The API returns newest first; the chart reads left to right in time.
  const chart = sessions.slice(0, CHART_SESSIONS).reverse()
  const guide = sessions.find((s) => s.valid && s.norm_applicable && s.cdc_threshold !== null)?.cdc_threshold ?? null
  // Headroom above the tallest bar leaves space for its number label.
  const scaleMax = Math.max(16, guide ? guide + 2 : 0, ...chart.map((s) => s.reps + 2))
  const height = (n: number) => `${(n / scaleMax) * 100}%`
  const trend = trendText(chart)

  return (
    <div className="history-page">
      <div>
        <h1>Your results</h1>
        {trend && <p className="lead">{trend}</p>}
      </div>

      <section className="card">
        <h2>Stands in 30 seconds</h2>
        <div
          className="bars"
          role="img"
          aria-label={`Bar chart of stands per test for your last ${chart.length} tests${guide ? `; the CDC guide is ${guide}` : ''}.`}
        >
          {guide !== null && (
            <>
              <div className="guide-line" style={{ bottom: height(guide) }} />
              <span className="guide-label" style={{ bottom: height(guide) }}>
                CDC guide: {guide}
              </span>
            </>
          )}
          {chart.map((s) => (
            <div
              key={s.id}
              className={`bar ${!s.valid ? 'low' : s.below_threshold ? 'below' : ''}`}
            >
              {s.reps}
              <div style={{ height: height(s.reps) }} />
            </div>
          ))}
        </div>
        <div className="bar-dates">
          {chart.map((s) => (
            <span key={s.id}>{shortDate(s.started_at)}</span>
          ))}
        </div>
        <div className="legend">
          <span>
            <i style={{ background: 'var(--primary)' }} />
            At or above guide
          </span>
          <span>
            <i style={{ background: 'var(--below)' }} />
            Below guide
          </span>
          <span>
            <i style={{ background: 'var(--low-conf)' }} />
            Low confidence
          </span>
        </div>
      </section>

      <section className="card table-card">
        <table className="history">
          <thead>
            <tr>
              <th>Date</th>
              <th>Stands</th>
              <th>CDC guide</th>
              <th>Confidence</th>
              <th>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className={s.valid ? '' : 'invalid'}>
                <td>{new Date(s.started_at).toLocaleDateString()}</td>
                <td>
                  <strong>{s.reps}</strong>
                </td>
                <td>
                  {!s.valid ? 'Not counted' : s.below_threshold === null ? '—' : s.below_threshold ? 'Below' : 'At or above'}
                </td>
                <td>{s.valid ? 'Good' : 'Low'}</td>
                <td>
                  <Link to={`/results/${s.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Link to="/test" className="button primary pill">
        Take a new test
      </Link>
    </div>
  )
}
