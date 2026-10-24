import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type ProfileIn, type Sex } from '../api/client'
import { useAuth } from '../auth'

export default function Onboarding() {
  const { profile, setProfile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<ProfileIn>({
    name: profile?.name ?? '',
    birth_date: profile?.birth_date ?? '',
    sex: profile?.sex ?? 'female',
    health_notes: profile?.health_notes ?? '',
    caregiver_email: profile?.caregiver_email ?? null,
    test_interval_days: profile?.test_interval_days ?? 30,
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof ProfileIn>(key: K, value: ProfileIn[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setProfile(await api.putProfile({ ...form, caregiver_email: form.caregiver_email || null }))
      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card narrow">
      <h1>{profile ? 'Your profile' : 'A few details first'}</h1>
      <p className="muted">Your age and sex are used to compare your result with CDC guidelines.</p>
      <form onSubmit={submit} className="stack">
        <label>
          First name (optional)
          <input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          Date of birth
          <input type="date" required value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
        </label>
        <fieldset>
          <legend>Sex</legend>
          <div className="choice-row">
            {(['female', 'male'] as Sex[]).map((s) => (
              <label key={s} className={`choice ${form.sex === s ? 'selected' : ''}`}>
                <input type="radio" name="sex" value={s} checked={form.sex === s} onChange={() => set('sex', s)} />
                {s === 'female' ? 'Female' : 'Male'}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Anything else we should know? (optional)
          <textarea
            rows={3}
            placeholder="For example: I use a cane, I had a fall last year, I take blood pressure medicine"
            value={form.health_notes}
            onChange={(e) => set('health_notes', e.target.value)}
          />
        </label>
        <label>
          Family member or caregiver email (optional)
          <input
            type="email"
            value={form.caregiver_email ?? ''}
            onChange={(e) => set('caregiver_email', e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          Save
        </button>
      </form>
    </section>
  )
}
