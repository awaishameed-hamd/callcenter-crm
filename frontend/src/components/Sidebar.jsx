import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { useState, useRef, useEffect, useCallback } from 'react'

// ── SVG icon helper ───────────────────────────────────────────────────────────
const Icon = ({ path, size = 'w-[18px] h-[18px]' }) => (
  <svg className={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
)

const ICONS = {
  dashboard:   'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  users:       'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  clients:     'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z',
  reports:     'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  profile:     'M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z',
  approvals:   'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  team:        'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
  newSale:     'M12 4.5v15m7.5-7.5h-15',
  mySales:     'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  logout:      'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
  attendance:  'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  attReport:   'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  attApproval: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  dailyAtt:    'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  workingDays: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z',
  leave:       'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0z',
  crm:         'M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.384.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  invoicing:   'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z',
  accounting:  'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  chevronRight:'M9 5l7 7-7 7',
}

// ── Attendance labels that collapse into the flyout group ─────────────────────
const ATTENDANCE_LABELS = new Set([
  'My Attendance', 'Leave',
  'Attendance Report', 'Attendance Approval',
  'Daily Attendance', 'Manage Working Days',
])

const NAV = {
  admin: [
    { label: 'Sales Dashboard',      path: '/admin/dashboard',           icon: 'dashboard'  },
    { label: 'My Team',              path: '/admin/users',               icon: 'team'       },
    { label: 'Clients',             path: '/admin/clients',             icon: 'clients'    },
    { label: 'Approvals',           path: '/admin/approvals',           icon: 'approvals'  },
    { label: 'Sales Report',        path: '/admin/reports',             icon: 'reports'    },
    // ── attendance group (rendered as flyout) ──
    { label: 'Manage Working Days', path: '/admin/working-days',        icon: 'workingDays'},
    { label: 'Attendance Report',   path: '/admin/attendance/report',   icon: 'attReport'  },
    { label: 'Attendance Approval', path: '/admin/attendance/approval', icon: 'attApproval'},
    { label: 'Daily Attendance',    path: '/admin/attendance/daily',    icon: 'dailyAtt'   },
    // ──────────────────────────────────────────
    { label: 'Invoicing & Payments', path: '/admin/invoicing',          icon: 'invoicing'  },
    { label: 'CRM Management',      path: '/admin/crm',                 icon: 'crm'        },
    { label: 'Profile',             path: '/admin/profile',             icon: 'profile'    },
  ],
  director: [
    { label: 'Sales Dashboard',     path: '/director/dashboard',         icon: 'dashboard' },
    { label: 'My Team',             path: '/director/users',             icon: 'team'      },
    { label: 'Clients',             path: '/director/clients',           icon: 'clients'   },
    { label: 'Approvals',           path: '/director/approvals',         icon: 'approvals' },
    { label: 'Sales Report',        path: '/director/reports',           icon: 'reports'   },
    // ── attendance group ──
    { label: 'Attendance Report',   path: '/director/attendance/report', icon: 'attReport' },
    { label: 'Daily Attendance',    path: '/director/attendance/daily',  icon: 'dailyAtt'  },
    // ──────────────────────
    { label: 'Profile',             path: '/director/profile',           icon: 'profile'   },
  ],
  manager: [
    { label: 'Sales Dashboard',     path: '/manager/dashboard',          icon: 'dashboard'  },
    { label: 'My Team',             path: '/manager/team',               icon: 'team'       },
    { label: 'Approvals',           path: '/manager/approvals',          icon: 'approvals'  },
    { label: 'Sales Report',        path: '/manager/reports',            icon: 'reports'    },
    // ── attendance group ──
    { label: 'My Attendance',       path: '/manager/attendance',         icon: 'attendance' },
    { label: 'Leave',               path: '/manager/leave',              icon: 'leave'      },
    { label: 'Attendance Report',   path: '/manager/attendance/report',  icon: 'attReport'  },
    { label: 'Attendance Approval', path: '/manager/attendance/approval',icon: 'attApproval'},
    { label: 'Daily Attendance',    path: '/manager/attendance/daily',   icon: 'dailyAtt'   },
    // ──────────────────────
    { label: 'Profile',             path: '/manager/profile',            icon: 'profile'    },
  ],
  manager_accountant: [
    { label: 'Sales Dashboard', path: '/manager/dashboard',   icon: 'dashboard'  },
    { label: 'My Team',         path: '/manager/team',        icon: 'team'       },
    { label: 'Sales Report',    path: '/manager/reports',     icon: 'reports'    },
    { label: 'Accounting',      path: '/manager/accounting',  icon: 'accounting' },
    { label: 'Profile',         path: '/manager/profile',     icon: 'profile'    },
  ],
  manager_hr: [
    { label: 'My Team',             path: '/manager/team',                icon: 'team'        },
    // ── attendance group ──
    { label: 'Manage Working Days', path: '/manager/working-days',        icon: 'workingDays' },
    { label: 'My Attendance',       path: '/manager/attendance',          icon: 'attendance'  },
    { label: 'Leave',               path: '/manager/leave',               icon: 'leave'       },
    { label: 'Attendance Report',   path: '/manager/attendance/report',   icon: 'attReport'   },
    { label: 'Attendance Approval', path: '/manager/attendance/approval', icon: 'attApproval' },
    { label: 'Daily Attendance',    path: '/manager/attendance/daily',    icon: 'dailyAtt'    },
    // ──────────────────────
    { label: 'Profile',             path: '/manager/profile',             icon: 'profile'     },
  ],
  agent: [
    { label: 'Sales Dashboard', path: '/agent/dashboard',  icon: 'dashboard'  },
    { label: 'New Sale',        path: '/agent/new-sale',   icon: 'newSale'    },
    { label: 'My Sales',        path: '/agent/my-sales',   icon: 'mySales'    },
    // ── attendance group ──
    { label: 'My Attendance',   path: '/agent/attendance', icon: 'attendance' },
    { label: 'Leave',           path: '/agent/leave',      icon: 'leave'      },
    // ──────────────────────
    { label: 'Profile',         path: '/agent/profile',    icon: 'profile'    },
  ],
}

const ROLE_LABELS = {
  admin:              'Administrator',
  director:           'Director',
  manager:            'Manager',
  manager_hr:         'HR Manager',
  manager_accountant: 'Accountant',
  agent:              'Sales Agent',
}

// ── Per-label gradient / border / icon-color map ──────────────────────────────
const LABEL_GRAD = {
  'Sales Dashboard':      { border: '#132E57', icon: '#1E8496' },
  'My Team':              { border: '#1E8496', icon: '#1E8496' },
  'Clients':              { border: '#3A6B3A', icon: '#3A6B3A' },
  'Approvals':            { border: '#D7A520', icon: '#C25A1F' },
  'Sales Report':         { border: '#7B2D8E', icon: '#7B2D8E' },
  'Profile':              { border: '#CBB26A', icon: '#CBB26A' },
  'New Sale':             { border: '#3A6B3A', icon: '#3A6B3A' },
  'My Sales':             { border: '#C25A1F', icon: '#C25A1F' },
  'Invoicing & Payments': { border: '#3A6B3A', icon: '#D7A520' },
  'Accounting':           { border: '#132E57', icon: '#1E8496' },
  'CRM Management':       { border: '#132E57', icon: '#1E8496' },
  // Attendance sub-items (shown in flyout)
  'My Attendance':        { border: '#CBB26A', icon: '#CBB26A' },
  'Leave':                { border: '#D7A520', icon: '#D7A520' },
  'Attendance Report':    { border: '#3A6B3A', icon: '#3A6B3A' },
  'Attendance Approval':  { border: '#D7A520', icon: '#1E8496' },
  'Daily Attendance':     { border: '#C25A1F', icon: '#7B2D8E' },
  'Manage Working Days':  { border: '#3A6B3A', icon: '#1E8496' },
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:        '#E8EAED',
  bgActive:  'rgba(242,172,24,0.26)',   // gold tint — matches argroup.cloud
  border:    '#E0DDD5',
  teal:      '#1E8496',
  tealDim:   'rgba(30,132,150,0.12)',
  gold:      '#D7A520',
  navy:      '#132E57',
  slate:     '#5C5C5C',
  gray:      '#808080',
  iconMuted: '#9FA7B2',
  white:     '#FFFFFF',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Sidebar({ collapsed, onToggle }) {
  const { user, role, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const fileRef   = useRef(null)
  const triggerRef = useRef(null)
  const panelRef   = useRef(null)
  const closeTimer = useRef(null)

  // ── Attendance flyout ─────────────────────────────────────────────────────
  const [attOpen,    setAttOpen]    = useState(false)
  const [attMenuPos, setAttMenuPos] = useState({ top: 0, left: 0 })

  const openAttMenu = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setAttMenuPos({ top: rect.top, left: rect.right + 4 })
    setAttOpen(true)
  }, [])

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setAttOpen(false), 150)
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }, [])

  // Close flyout on navigation
  useEffect(() => { setAttOpen(false) }, [location.pathname])

  // ── Badge counts ──────────────────────────────────────────────────────────
  const [attPendingCount,   setAttPendingCount]   = useState(0)
  const [leavePendingCount, setLeavePendingCount] = useState(0)

  const fetchBadges = useCallback(async () => {
    if (!['admin', 'director', 'manager'].includes(role)) return
    try {
      const [attRes, leaveRes] = await Promise.all([
        api.get('/attendance/approval'),
        api.get('/leaves/pending-count'),
      ])
      const attList = attRes.data?.data ?? attRes.data ?? []
      setAttPendingCount(Array.isArray(attList) ? attList.filter(a => a.approval_status === 'pending').length : 0)
      setLeavePendingCount(leaveRes.data?.count ?? 0)
    } catch { /* ignore */ }
  }, [role])

  useEffect(() => { fetchBadges() }, [fetchBadges, location.pathname])

  // ── Avatar ────────────────────────────────────────────────────────────────
  const avatarKey = `avatar_${user?.id}`
  const [avatar, setAvatar] = useState(() => localStorage.getItem(avatarKey) ?? null)
  useEffect(() => { setAvatar(localStorage.getItem(avatarKey) ?? null) }, [avatarKey])

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const b64 = ev.target.result
      localStorage.setItem(avatarKey, b64)
      setAvatar(b64)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Nav resolution ────────────────────────────────────────────────────────
  const navKey = role === 'manager'
    ? user?.manager_type === 'HR Manager' ? 'manager_hr'
    : user?.manager_type === 'Accountant' ? 'manager_accountant'
    : role
    : role
  const links    = NAV[navKey] ?? []
  const roleLabel = ROLE_LABELS[navKey] ?? ROLE_LABELS[role] ?? role

  // Split into main links and attendance sub-items
  const mainLinks = links.filter(l => !ATTENDANCE_LABELS.has(l.label))
  const attLinks  = links.filter(l => ATTENDANCE_LABELS.has(l.label))
  const attInsertIdx = links.findIndex(l => ATTENDANCE_LABELS.has(l.label))

  // Is any attendance path currently active?
  const attIsActive = attLinks.some(l => {
    const stripped = location.pathname.replace(/\/$/, '')
    return stripped === l.path || stripped.startsWith(l.path + '/')
  })

  // Total badge for the group trigger
  const totalAttBadge = attPendingCount + leavePendingCount

  const handleLogout = async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    logout()
    navigate('/login', { replace: true })
  }

  // ── Shared nav-item style factory ─────────────────────────────────────────
  function navItemStyle(isActive, label) {
    const g = LABEL_GRAD[label]
    return {
      display: 'flex', alignItems: 'center', gap: '0.625rem',
      padding: '0.3rem 0.75rem', borderRadius: '0.5rem',
      fontSize: '1rem', fontFamily: "'Rajdhani', sans-serif",
      fontWeight: 600, letterSpacing: '0.03em',
      transition: 'all 0.15s ease', textDecoration: 'none',
      background:  isActive ? C.bgActive : 'transparent',
      color:       isActive ? C.navy : C.slate,
      borderLeft:  isActive ? `3px solid ${g?.border ?? C.teal}` : '3px solid transparent',
      cursor: 'pointer',
    }
  }

  // ── Reusable badge pill ───────────────────────────────────────────────────
  function Badge({ count }) {
    if (!count) return null
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 18, height: 18, borderRadius: 9999, padding: '0 5px',
        fontSize: 10, fontWeight: 800, lineHeight: 1,
        background: '#DC2626', color: '#fff',
        fontFamily: '"Rajdhani", sans-serif', flexShrink: 0,
      }}>
        {count > 99 ? '99+' : count}
      </span>
    )
  }

  // ── Build ordered nav rows (main items + attendance group in correct spot) ─
  const orderedRows = []
  let attInserted = false
  for (let i = 0; i < links.length; i++) {
    const item = links[i]
    if (ATTENDANCE_LABELS.has(item.label)) {
      if (!attInserted && attLinks.length > 0) {
        orderedRows.push({ type: 'attGroup' })
        attInserted = true
      }
    } else {
      orderedRows.push({ type: 'link', ...item })
    }
  }
  if (!attInserted && attLinks.length > 0) orderedRows.push({ type: 'attGroup' })

  return (
    <>
      <aside
        className={`flex flex-col min-h-screen shrink-0 transition-all duration-200 overflow-hidden ${collapsed ? 'w-0' : 'w-64'}`}
        style={{ background: C.bg }}
      >
        {/* ── Brand header ─────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-2 shrink-0"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex-1 min-w-0">
            <p className="truncate leading-none" style={{
              fontFamily: "'Bebas Neue', cursive", fontWeight: 400, fontSize: '1.9rem',
              background: 'linear-gradient(180deg, #1E8496 0%, #0E5F6E 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', WebkitTextStroke: '0.3px #0E5F6E',
              letterSpacing: '0.1em', paddingLeft: '10px',
            }}>META-VOICE</p>
          </div>
          <button onClick={onToggle} title="Hide sidebar"
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded transition-colors"
            style={{ color: C.gray }}
            onMouseEnter={e => { e.currentTarget.style.color = C.navy; e.currentTarget.style.background = C.tealDim }}
            onMouseLeave={e => { e.currentTarget.style.color = C.gray; e.currentTarget.style.background = 'transparent' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* ── User badge ───────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 shrink-0"
          style={{ borderBottom: `1px solid ${C.border}`, paddingTop: '6px', paddingBottom: '6px' }}>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
          <div onClick={() => fileRef.current?.click()} title="Change profile photo"
            className="relative shrink-0 cursor-pointer" style={{ width: 52, height: 52 }}>
            {avatar ? (
              <img src={avatar} alt="avatar"
                style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div className="flex items-center justify-center w-full h-full rounded-full text-sm font-bold uppercase"
                style={{ background: C.teal, color: C.white }}>
                {user?.display_name?.[0] ?? '?'}
              </div>
            )}
            <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.45)' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black truncate" style={{ color: C.navy }}>{user?.display_name}</p>
            <p className="text-sm truncate" style={{ color: C.slate }}>{roleLabel}</p>
          </div>
        </div>

        {/* ── Navigation ───────────────────────────────────── */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto" style={{ paddingTop: '8px', paddingBottom: '16px' }}>
          {orderedRows.map((row, idx) => {
            if (row.type === 'attGroup') {
              return (
                <div
                  key="att-group"
                  ref={triggerRef}
                  onMouseEnter={openAttMenu}
                  onMouseLeave={scheduleClose}
                  style={{
                    ...navItemStyle(attIsActive, 'Attendance'),
                    background: attIsActive ? C.bgActive : attOpen ? C.tealDim : 'transparent',
                    color:      attIsActive || attOpen ? C.navy : C.slate,
                    borderLeft: attIsActive ? `3px solid #CBB26A` : '3px solid transparent',
                    userSelect: 'none',
                  }}
                  onMouseEnterCapture={undefined}
                >
                  <span style={{ color: attIsActive ? '#CBB26A' : C.iconMuted, display: 'flex', flexShrink: 0 }}>
                    <Icon path={ICONS.attendance} />
                  </span>
                  <span style={{ flex: 1 }}>Attendance</span>
                  {totalAttBadge > 0 && <Badge count={totalAttBadge} />}
                  <svg style={{ width: 14, height: 14, flexShrink: 0, color: C.iconMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )
            }

            const { label, path, icon } = row
            const g = LABEL_GRAD[label]
            return (
              <NavLink
                key={path}
                to={path}
                end={
                  !path.endsWith('/report') &&
                  !path.endsWith('/approval') &&
                  !path.endsWith('/working-days') &&
                  !path.endsWith('/daily') &&
                  !path.endsWith('/leave')
                }
                style={({ isActive }) => navItemStyle(isActive, label)}
                onMouseEnter={e => {
                  if (e.currentTarget.getAttribute('aria-current') !== 'page') {
                    e.currentTarget.style.background = C.tealDim
                    e.currentTarget.style.color = C.navy
                  }
                }}
                onMouseLeave={e => {
                  if (e.currentTarget.getAttribute('aria-current') !== 'page') {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = C.slate
                  }
                }}
              >
                {({ isActive }) => (
                  <>
                    <span style={{ color: isActive ? (g?.icon ?? C.teal) : C.iconMuted, display: 'flex', flexShrink: 0 }}>
                      <Icon path={ICONS[icon]} />
                    </span>
                    <span style={{ flex: 1 }}>{label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* ── Logout ───────────────────────────────────────── */}
        <div className="px-3 pb-4 pt-1">
          <button onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-colors"
            style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, color: C.slate, background: 'transparent', border: 'none', cursor: 'pointer', width: '100%' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(214,40,40,0.1)'; e.currentTarget.style.color = '#D62828' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.slate }}
          >
            <Icon path={ICONS.logout} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Attendance flyout panel (outside aside, fixed) ─── */}
      {attOpen && attLinks.length > 0 && (
        <div
          ref={panelRef}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{
            position: 'fixed',
            top:  attMenuPos.top,
            left: attMenuPos.left,
            zIndex: 9999,
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            padding: '6px',
            minWidth: 220,
          }}
        >
          {/* Panel header */}
          <div style={{ padding: '4px 10px 8px', borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'Ethnocentric Rg', sans-serif",
              textTransform: 'uppercase', letterSpacing: '0.1em', color: C.gray }}>
              Attendance
            </span>
          </div>

          {/* Sub-items */}
          {attLinks.map(({ label, path, icon }) => {
            const g = LABEL_GRAD[label]
            const badge = label === 'Attendance Approval' ? attPendingCount
                        : label === 'Leave'               ? leavePendingCount
                        : 0
            return (
              <NavLink
                key={path}
                to={path}
                end={
                  !path.endsWith('/report') &&
                  !path.endsWith('/approval') &&
                  !path.endsWith('/working-days') &&
                  !path.endsWith('/daily') &&
                  !path.endsWith('/leave')
                }
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.3rem 0.7rem', borderRadius: 7,
                  fontSize: '0.95rem', fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 600, letterSpacing: '0.03em',
                  textDecoration: 'none',
                  background:  isActive ? C.bgActive : 'transparent',
                  color:       isActive ? C.navy : C.slate,
                  borderLeft:  isActive ? `3px solid ${g?.border ?? C.teal}` : '3px solid transparent',
                  transition: 'all 0.12s ease',
                })}
                onMouseEnter={e => {
                  if (e.currentTarget.getAttribute('aria-current') !== 'page') {
                    e.currentTarget.style.background = C.tealDim
                    e.currentTarget.style.color = C.navy
                  }
                }}
                onMouseLeave={e => {
                  if (e.currentTarget.getAttribute('aria-current') !== 'page') {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = C.slate
                  }
                }}
              >
                {({ isActive }) => (
                  <>
                    <span style={{ color: isActive ? (g?.icon ?? C.teal) : C.iconMuted, display: 'flex', flexShrink: 0 }}>
                      <Icon path={ICONS[icon]} />
                    </span>
                    <span style={{ flex: 1 }}>{label}</span>
                    {badge > 0 && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 18, height: 18, borderRadius: 9999, padding: '0 5px',
                        fontSize: 10, fontWeight: 800, lineHeight: 1,
                        background: '#DC2626', color: '#fff',
                        fontFamily: '"Rajdhani", sans-serif', flexShrink: 0,
                      }}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      )}
    </>
  )
}
