import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type TestSession } from '../api/client'
import { useAuth } from '../auth'

const SETUP_STEPS = [
  ['Sturdy chair', 'Place a sturdy chair against a wall. Use a chair without wheels or armrests.'],
  ['Device placement', 'Place device at waist height, 2–3 meters (8–10 feet) away.'],
  ['Camera view', 'Face one side to the camera. Keep your whole body in view.'],
  ['Safety first', 'Unsteady? Have someone nearby. Stop for pain or dizziness.'],
]

export default function Home() {
  const { profile } = useAuth()
  const [last, setLast] = useState<TestSession | null>(null)

  useEffect(() => {
    api.listSessions().then((s) => setLast(s.find((x) => x.valid) ?? null), () => {})
  }, [])

  return (
    <section className="card wide home">
      <div>
        <h1>Hey {profile?.name || 'there'}</h1>
        <p className="lead">Instructions for 30-second Chair Stand Test:</p>
      </div>
      <div>
        <h2>Before you start</h2>
        <div className="setup-cards">
          {SETUP_STEPS.map(([title, text], i) => (
            <div key={title} className="setup-card">
              <h3>
                <span className="step">{i + 1}</span>
                {title}
              </h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Link to="/test" className="button primary big">
          Start the test
        </Link>
        <Link to="/history" className="button secondary big">
          View my results
        </Link>
      </div>
      {last && (
        <p className="muted">
          Last result: <Link to={`/results/${last.id}`}>{last.reps} stands</Link> on{' '}
          {new Date(last.started_at).toLocaleDateString()}
        </p>
      )}
    </section>
  )
}
