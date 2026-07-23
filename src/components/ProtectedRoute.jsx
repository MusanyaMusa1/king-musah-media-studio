import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Layout from './Layout'

export default function ProtectedRoute({ children, roles }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-ink text-text-faint flex items-center justify-center text-sm">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(role)) {
    return (
      <Layout>
        <div className="max-w-md">
          <h1 className="font-display text-2xl mb-2">Not available</h1>
          <p className="text-text-soft text-sm">
            Your account doesn't have permission to view this page. Ask an Administrator if you think this is wrong.
          </p>
        </div>
      </Layout>
    )
  }

  return <Layout>{children}</Layout>
}
