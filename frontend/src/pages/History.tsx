import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type TestSession, type Trends } from '../api/client'
import TrendSummary from '../components/TrendSummary'

export default function History() {
  const [sessions, setSessions] = useState<TestSession[] | null>(null)
  const [trends, setTrends] = useState<Trends | null>(null)

  useEffect(() => {
    api.listSessions().then(setSessions, () => setSessions([]))
    api.getTrends().then(setTrends, () => setTrends(null))
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
  return (
    <section className="card">
      <h1>Your results</h1>
      {trends && trends.points.length > 0 && <TrendSummary trends={trends} />}
      <h2>All tests</h2>
      <table className="history">
        <thead>
          <tr>
            <th>Date</th>
            <th>Stands</th>
            <th>CDC guide</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className={s.valid ? '' : 'invalid'}>
              <td>{new Date(s.started_at).toLocaleDateString()}</td>
              <td>{s.reps}</td>
              <td>
                {!s.valid ? 'Not counted' : s.below_threshold === null ? '—' : s.below_threshold ? 'Below' : 'At or above'}
              </td>
              <td>
                <Link to={`/results/${s.id}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
