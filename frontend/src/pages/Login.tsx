import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth'

export default function Login() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await (mode === 'login' ? api.login(email, password) : api.register(email, password))
      await refresh()
      navigate(mode === 'login' ? '/' : '/onboarding')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card narrow">
      <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <form onSubmit={submit} className="stack">
        <label>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
      </button>
    </section>
  )
}
