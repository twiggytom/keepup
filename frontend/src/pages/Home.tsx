import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type TestSession } from '../api/client'
import { useAuth } from '../auth'

export default function Home() {
  const { profile } = useAuth()
  const [last, setLast] = useState<TestSession | null>(null)

  useEffect(() => {
    api.listSessions().then((s) => setLast(s.find((x) => x.valid) ?? null), () => {})
  }, [])

  return (
    <section className="card">
      <h1>Hello{profile?.name ? `, ${profile.name}` : ''}</h1>
      <p className="lead">
        The 30-second chair stand test checks leg strength and balance. You'll stand up and sit down as many
        times as you can in 30 seconds, with your arms crossed.
      </p>
      <h2>Before you start</h2>
      <ul className="checklist">
        <li>Use a sturdy chair without wheels or arms, pushed against a wall.</li>
        <li>Place your device about 2–3 metres (8–10 feet) away, at waist height.</li>
        <li>Turn your side towards the camera so your whole body is visible.</li>
        <li>Have someone nearby if you feel unsteady. Stop if you feel pain or dizziness.</li>
      </ul>
      <Link to="/test" className="button primary big">
        Start the test
      </Link>
      {last && (
        <p className="muted">
          Last result: <Link to={`/results/${last.id}`}>{last.reps} stands</Link> on{' '}
          {new Date(last.started_at).toLocaleDateString()}
        </p>
      )}
    </section>
  )
}
