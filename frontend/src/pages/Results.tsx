import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type TestSession } from '../api/client'
import { hasMetrics } from '../analysis/metrics'
import MovementSummary from '../components/MovementSummary'

export default function Results() {
  const { id } = useParams()
  const [s, setS] = useState<TestSession | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getSession(Number(id)).then(setS, (e) => setError(e.message))
  }, [id])

  if (error) return <p className="center error">{error}</p>
  if (!s) return <p className="center">Loading…</p>

  const q = s.quality_flags
  const warnings: string[] = []
  if (s.used_arms) warnings.push('Your arms left your chest during the test. Per CDC guidance, the test counts as 0 when arms are used.')
  if (!s.valid) warnings.push('You were out of view of the camera for part of the test, so this result may not be accurate.')
  if (q.multiple_people) warnings.push('Another person was seen by the camera. The count may be affected.')
  if (q.low_light) warnings.push('The camera had trouble seeing you clearly. Try more light next time.')

  return (
    <section className="card">
      <p className="muted">{new Date(s.started_at).toLocaleString()}</p>
      <div className="big-number">{s.reps}</div>
      <p className="lead center">stands in 30 seconds</p>
      {s.used_arms && s.raw_reps > 0 && <p className="muted center">({s.raw_reps} stands were detected)</p>}

      {s.valid && s.norm_applicable && s.cdc_threshold !== null && (
        <div className={`verdict ${s.below_threshold ? 'warn' : 'ok'}`}>
          {s.below_threshold ? (
            <>
              <strong>Below the typical range for your age.</strong> For {s.sex === 'male' ? 'men' : 'women'} aged{' '}
              {s.cdc_band}, fewer than {s.cdc_threshold} stands suggests a higher risk of falling. Consider sharing this
              result with your doctor.
            </>
          ) : (
            <>
              <strong>Within the typical range for your age.</strong> For {s.sex === 'male' ? 'men' : 'women'} aged{' '}
              {s.cdc_band}, the CDC guide is {s.cdc_threshold} or more stands.
            </>
          )}
        </div>
      )}
      {!s.norm_applicable && (
        <p className="muted">CDC reference values cover ages 60–94, so there is no comparison for age {s.age_at_test}.</p>
      )}

      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {hasMetrics(s.metrics) && s.valid && <MovementSummary metrics={s.metrics} />}

      <div className="actions">
        <Link to="/test" className="button">
          Try again
        </Link>
        <Link to="/" className="button primary">
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
