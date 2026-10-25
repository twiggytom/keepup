import type { SessionMetrics } from '../analysis/metrics'
import type { RepEvent } from '../pose/repCounter'
import type { QualityFlags } from '../pose/formChecks'

export type Sex = 'male' | 'female'

export interface User {
  id: number
  email: string
}

export interface ProfileIn {
  name: string
  birth_date: string
  sex: Sex
  health_notes: string
  caregiver_email: string | null
  test_interval_days: number
}

export interface Profile extends ProfileIn {
  age: number
}

export interface SessionIn {
  started_at: string
  raw_reps: number
  used_arms: boolean
  quality_flags: QualityFlags
  metrics: SessionMetrics
  rep_events: RepEvent[]
}

export interface TestSession {
  id: number
  started_at: string
  age_at_test: number
  sex: Sex
  raw_reps: number
  reps: number
  used_arms: boolean
  valid: boolean
  cdc_threshold: number | null
  cdc_band: string
  norm_applicable: boolean
  below_threshold: boolean | null
  quality_flags: Partial<QualityFlags>
  metrics: SessionMetrics | Record<string, never> // empty for sessions recorded before Phase 2
  rep_events: RepEvent[]
}

export type TrendStatus = 'insufficient_data' | 'improving' | 'steady' | 'declining'
export type Exclusion = 'not_counted' | 'low_quality' | 'arms_used'

export interface Trend {
  status: TrendStatus
  n: number
  needed: number
  slope_per_month: number | null
  fitted_change: number | null
  first_fitted: number | null
  last_fitted: number | null
  span_days: number | null
}

export interface TrendPoint {
  session_id: number
  started_at: string
  reps: number
  raw_reps: number
  cdc_threshold: number | null
  quality_score: number | null
  mean_stand_s: number | null
  fatigue_index: number | null
  mean_sway: number | null
  in_fit: boolean
  excluded_reason: Exclusion | null
}

export interface Trends {
  min_sessions: number
  low_quality_below: number
  points: TrendPoint[]
  reps: Trend
  mean_stand_s: Trend
  fatigue_index: Trend
  mean_sway: Trend
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json()
      message = typeof data.detail === 'string' ? data.detail : (data.detail?.[0]?.msg ?? message)
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  register: (email: string, password: string) => request<User>('POST', '/auth/register', { email, password }),
  login: (email: string, password: string) => request<User>('POST', '/auth/login', { email, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<User>('GET', '/auth/me'),
  getProfile: () => request<Profile>('GET', '/profile'),
  putProfile: (p: ProfileIn) => request<Profile>('PUT', '/profile', p),
  createSession: (s: SessionIn) => request<TestSession>('POST', '/sessions', s),
  listSessions: () => request<TestSession[]>('GET', '/sessions'),
  getSession: (id: number) => request<TestSession>('GET', `/sessions/${id}`),
  getTrends: () => request<Trends>('GET', '/trends'),
}
