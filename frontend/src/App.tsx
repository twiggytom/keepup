import type { ReactNode } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import History from './pages/History'
import Home from './pages/Home'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Results from './pages/Results'
import TestRunner from './pages/TestRunner'

function RequireAuth({ children, needsProfile = true }: { children: ReactNode; needsProfile?: boolean }) {
  const { loading, user, profile } = useAuth()
  if (loading) return <p className="center">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (needsProfile && !profile) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  const { user, logout } = useAuth()
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          KeepUp
        </Link>
        {user && (
          <nav>
            <Link to="/history">History</Link>
            <Link to="/onboarding">Profile</Link>
            <button className="link" onClick={logout}>
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/onboarding"
            element={
              <RequireAuth needsProfile={false}>
                <Onboarding />
              </RequireAuth>
            }
          />
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/test" element={<RequireAuth><TestRunner /></RequireAuth>} />
          <Route path="/results/:id" element={<RequireAuth><Results /></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
