import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type TestSession } from '../api/client'
import { hasMetrics } from '../analysis/metrics'
import { useAuth } from '../auth'
import MovementSummary from '../components/MovementSummary'

const GAUGE_MAX = 20

function deltaText(reps: number, prev: TestSession | null): string | null {
  if (!prev) return null
  const d = reps - prev.reps
  if (d === 0) return 'Same as your last test'
  return `${Math.abs(d)} ${Math.abs(d) === 1 ? 'stand' : 'stands'} ${d > 0 ? 'more' : 'fewer'} than your last test`
}

const pct = (n: number) => `${(Math.min(n, GAUGE_MAX) / GAUGE_MAX) * 100}%`

export default function Results() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [s, setS] = useState<TestSession | null>(null)
  const [prev, setPrev] = useState<TestSession | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getSession(Number(id)).then(setS, (e) => setError(e.message))
    // Sessions come back newest first; the previous valid test is the first older one.
    api.listSessions().then(
      (all) => {
        const i = all.findIndex((x) => x.id === Number(id))
        setPrev(i < 0 ? null : (all.slice(i + 1).find((x) => x.valid) ?? null))
      },
      () => {},
    )
  }, [id])

  if (error) return <p className="center error">{error}</p>
  if (!s) return <p className="center">Loading…</p>

  const q = s.quality_flags
  const warnings: string[] = []
  if (s.used_arms) warnings.push('Your arms left your chest during the test. Per CDC guidance, the test counts as 0 when arms are used.')
  if (!s.valid) warnings.push('You were out of view of the camera for part of the test, so this result may not be accurate.')
  if (q.multiple_people) warnings.push('Another person was seen by the camera. The count may be affected.')
  if (q.low_light) warnings.push('The camera had trouble seeing you clearly. Try more light next time.')

  const group = s.sex === 'male' ? 'men' : 'women'
  const compared = s.valid && s.norm_applicable && s.cdc_threshold !== null
  const threshold = s.cdc_threshold ?? 0
  const delta = s.valid ? deltaText(s.reps, prev) : null

  return (
    <section className="card wide result">
      <div className="result-meta">
        <span>{new Date(s.started_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
        {!s.valid && <span className="chip">Low confidence</span>}
      </div>

      <div className="result-score">
        <div className="big-number">{s.reps}</div>
        <div className="unit">stands in 30 seconds</div>
        {s.used_arms && s.raw_reps > 0 && <div className="delta">({s.raw_reps} stands were detected)</div>}
        {delta && <div className="delta">{delta}</div>}
      </div>

      {compared && (
        <div className={`verdict ${s.below_threshold ? 'warn' : 'ok'}`}>
          {s.below_threshold ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v5" />
                <path d="M12 16h.01" />
              </svg>
              <div>
                <strong>Below average for age and sex (CDC)</strong>
                For {group} aged {s.cdc_band}, the CDC guide is {threshold} or more stands. Consider discussing this
                result with your doctor.
              </div>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="m8 12 3 3 5-6" />
              </svg>
              <div>
                <strong>At or above the CDC guide for your age and sex</strong>
                For {group} aged {s.cdc_band}, the CDC guide is {threshold} or more stands.
              </div>
            </>
          )}
        </div>
      )}
      {!s.norm_applicable && (
        <p className="muted">CDC reference values cover ages 60–94, so there is no comparison for age {s.age_at_test}.</p>
      )}

      {compared && (
        <div className="gauge">
          <h2>Where today's score lands</h2>
          <div className="gauge-track">
            <div className="gauge-today" style={{ left: pct(s.reps) }}>
              Today {s.reps}
            </div>
            <div className="gauge-today-line" style={{ left: pct(s.reps) }} />
            {prev && (
              <>
                <div className="gauge-last-line" style={{ left: pct(prev.reps) }} />
                <div className="gauge-last" style={{ left: pct(prev.reps) }}>
                  Last test {prev.reps}
                </div>
              </>
            )}
            <div className="gauge-bands">
              <div className="below" style={{ flex: threshold }} />
              <div className="above" style={{ flex: GAUGE_MAX - threshold }} />
            </div>
          </div>
          <div className="gauge-scale">
            {[0, 5, 10, 15, 20].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <div className="legend">
            <span>
              <i style={{ background: 'var(--below-bg)' }} />
              Below guide (under {threshold})
            </span>
            <span>
              <i style={{ background: 'var(--above-bg)' }} />
              At or above guide ({threshold} or more)
            </span>
          </div>
        </div>
      )}

      <div className="result-tiles">
        <div className="tile">
          <div className="tile-label">Protocol</div>
          <div className="tile-value">{s.used_arms ? 'Arms used' : 'Standard'}</div>
          <div className="tile-note">{s.used_arms ? 'Counts as 0 per CDC guidance' : 'Arms stayed crossed'}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Tracking</div>
          <div className="tile-value">{s.valid ? 'Good' : 'Partial'}</div>
          <div className="tile-note">{s.valid ? 'In view the whole time' : 'Out of view for part of the test'}</div>
        </div>
        {profile && (
          <div className="tile">
            <div className="tile-label">Next test</div>
            <div className="tile-value">In {profile.test_interval_days} days</div>
            <div className="tile-note">From your profile settings</div>
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {hasMetrics(s.metrics) && s.valid && <MovementSummary metrics={s.metrics} />}

      <div className="result-actions">
        <Link to="/test" className="button secondary big">
          Try again
        </Link>
        <Link to="/" className="button primary big">
          Done
        </Link>
      </div>
      <p className="disclaimer">
        KeepUp is a screening aid, not a medical diagnosis. Reference values come from the CDC STEADI 30-Second Chair
        Stand assessment. Talk to a healthcare professional about your fall risk.
      </p>
    </section>
  )
}
