import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_HOME = {
  admin:    '/admin/dashboard',
  director: '/director/dashboard',
  manager:  '/manager/dashboard',
  agent:    '/agent/dashboard',
}

function Forbidden({ role }) {
  const navigate = useNavigate()
  const home = ROLE_HOME[role]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-6xl font-bold text-red-500">403</p>
        <h1 className="mt-4 text-2xl font-semibold text-gray-800">Access Denied</h1>
        <p className="mt-2 text-gray-500">You don't have permission to view this page.</p>
        {home && (
          <button
            onClick={() => navigate(home, { replace: true })}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Go to my dashboard
          </button>
        )}
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Forbidden role={role} />
  }

  return children
}
