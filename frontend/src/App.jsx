import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewSale from './pages/agent/NewSale'
import MySales from './pages/agent/MySales'
import Approvals from './pages/Approvals'
import Profile from './pages/Profile'
import Reports from './pages/Reports'
import Users from './pages/admin/Users'
import Clients from './pages/admin/Clients'
import Attendance from './pages/Attendance'
import AttendanceReport from './pages/AttendanceReport'
import AttendanceApproval from './pages/AttendanceApproval'
import WorkingDays from './pages/WorkingDays'
import DailyAttendance from './pages/DailyAttendance'
import CrmManagement from './pages/CrmManagement'
import InvoicingPayments from './pages/InvoicingPayments'
import Accounting from './pages/accountant/Accounting'
import Leave from './pages/Leave'
import Layout from './components/Layout'

/** Redirects HR Managers away from pages they shouldn't access. */
function NoHR({ children }) {
  const { user } = useAuth()
  if (user?.manager_type === 'HR Manager') {
    return <Navigate to="/manager/team" replace />
  }
  return children
}

/** Only HR Managers can access this — all other managers are redirected. */
function HROnly({ children }) {
  const { user } = useAuth()
  if (user?.manager_type !== 'HR Manager') {
    return <Navigate to="/manager/dashboard" replace />
  }
  return children
}

/** Only Accountant managers can access this — all other managers are redirected. */
function AccountantOnly({ children }) {
  const { user } = useAuth()
  if (user?.manager_type !== 'Accountant') {
    return <Navigate to="/manager/dashboard" replace />
  }
  return children
}

/** Default redirect for managers — HR Manager lands on team, others on dashboard. */
function ManagerDefault() {
  const { user } = useAuth()
  return <Navigate to={user?.manager_type === 'HR Manager' ? 'team' : 'dashboard'} replace />
}

function ComingSoon({ title }) {
  return (
    <Layout>
      <div className="flex items-center justify-center h-full min-h-64">
        <div className="text-center">
          <p className="text-4xl">🚧</p>
          <h2 className="mt-3 text-lg font-semibold text-gray-700">{title}</h2>
          <p className="mt-1 text-sm text-gray-400">This page is under construction.</p>
        </div>
      </div>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* ── Admin ──────────────────────────────────────────────────── */}
          <Route path="/admin/*" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Routes>
                <Route path="dashboard"           element={<Dashboard />} />
                <Route path="users"               element={<Users />} />
                <Route path="clients"             element={<Clients />} />
                <Route path="approvals"           element={<Approvals />} />
                <Route path="reports"             element={<Reports />} />
                <Route path="working-days"        element={<WorkingDays />} />
                <Route path="attendance/report"   element={<AttendanceReport />} />
                <Route path="attendance/approval" element={<AttendanceApproval />} />
                <Route path="attendance/daily"    element={<DailyAttendance />} />
                <Route path="invoicing"            element={<InvoicingPayments />} />
                <Route path="crm"                 element={<CrmManagement />} />
                <Route path="profile"             element={<Profile />} />
                <Route path="*"                   element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          } />

          {/* ── Director ───────────────────────────────────────────────── */}
          <Route path="/director/*" element={
            <ProtectedRoute allowedRoles={['director']}>
              <Routes>
                <Route path="dashboard"          element={<Dashboard />} />
                <Route path="users"              element={<Users />} />
                <Route path="clients"            element={<Clients />} />
                <Route path="approvals"          element={<Approvals />} />
                <Route path="reports"            element={<Reports />} />
                <Route path="attendance/report"  element={<AttendanceReport />} />
                <Route path="attendance/daily"   element={<DailyAttendance />} />
                <Route path="profile"            element={<Profile />} />
                <Route path="*"                  element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          } />

          {/* ── Manager ────────────────────────────────────────────────── */}
          <Route path="/manager/*" element={
            <ProtectedRoute allowedRoles={['manager']}>
              <Routes>
                <Route path="dashboard"          element={<NoHR><Dashboard /></NoHR>} />
                <Route path="team"               element={<Users />} />
                <Route path="approvals"          element={<NoHR><Approvals /></NoHR>} />
                <Route path="reports"            element={<NoHR><Reports /></NoHR>} />
                <Route path="working-days"       element={<HROnly><WorkingDays /></HROnly>} />
                <Route path="attendance"         element={<Attendance />} />
                <Route path="leave"              element={<Leave />} />
                <Route path="attendance/report"  element={<AttendanceReport />} />
                <Route path="attendance/approval"element={<HROnly><AttendanceApproval /></HROnly>} />
                <Route path="attendance/daily"  element={<HROnly><DailyAttendance /></HROnly>} />
                <Route path="accounting"         element={<AccountantOnly><Accounting /></AccountantOnly>} />
                <Route path="profile"            element={<Profile />} />
                <Route path="*"                  element={<ManagerDefault />} />
              </Routes>
            </ProtectedRoute>
          } />

          {/* ── Agent ──────────────────────────────────────────────────── */}
          <Route path="/agent/*" element={
            <ProtectedRoute allowedRoles={['agent']}>
              <Routes>
                <Route path="dashboard"  element={<Dashboard />} />
                <Route path="new-sale"   element={<NewSale />} />
                <Route path="my-sales"   element={<MySales />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="leave"      element={<Leave />} />
                <Route path="profile"    element={<Profile />} />
                <Route path="*"          element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          } />

          {/* Root → login */}
          <Route path="/"  element={<Navigate to="/login" replace />} />
          <Route path="*"  element={<Navigate to="/login" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
