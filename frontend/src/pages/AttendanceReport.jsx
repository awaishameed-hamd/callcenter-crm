import { useState, useEffect, useCallback, useMemo } from 'react'
import Layout from '../components/Layout'
import TimePicker from '../components/TimePicker'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

// ── Shared style constants ─────────────────────────────────────────────────────
const labelCls          = 'block text-xs font-bold uppercase tracking-widest mb-0.5'
const selectCls         = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition cursor-pointer'
const inputCls          = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition'
const filterSelectStyle = { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }
const filterInputStyle  = { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DEPTS       = ['Medicare', 'Final Expense', 'ACA', 'Management']

const MODULE_START_YEAR  = 2026
const MODULE_START_MONTH = 5

// ── Cell style by status ───────────────────────────────────────────────────────
function cellStyle(status) {
  if (status === 'Present')    return 'bg-amber-50 border-amber-200'
  if (status === 'Absent')     return 'bg-red-50 border-red-200'
  if (status === 'Week-End')   return 'bg-gray-50 border-gray-100'
  if (status === 'Leave')      return 'bg-blue-50 border-blue-200'
  if (status === 'Not Joined') return 'bg-slate-50 border-slate-100'
  return 'bg-white border-gray-100'
}

// ── Employee detail modal ──────────────────────────────────────────────────────
function EmployeeModal({ employee: initialEmployee, year, month, isHrManager, onClose }) {
  const [employee,   setEmployee]   = useState(initialEmployee)
  const [editingDay, setEditingDay] = useState(null)   // day number being edited
  const [editAction, setEditAction] = useState('present') // 'present' | 'absent' | 'leave'
  const [editTime,   setEditTime]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [wdTimes,    setWdTimes]    = useState({})  // day → login_time_formatted

  // Sync if parent passes new employee data
  useEffect(() => { setEmployee(initialEmployee) }, [initialEmployee])

  // Fetch working-day login times for this month (so we can prefill the time picker)
  useEffect(() => {
    if (!isHrManager) return
    api.get('/working-days', { params: { month, year } }).then(({ data }) => {
      const map = {}
      ;(data.days ?? []).forEach(d => {
        const dayNum = parseInt(d.date.split('-')[2], 10)
        if (d.login_time_formatted) map[dayNum] = d.login_time_formatted
      })
      setWdTimes(map)
    }).catch(() => {})
  }, [month, year, isHrManager])

  const daysInMonth = new Date(year, month, 0).getDate()
  const days        = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const firstDay    = new Date(year, month - 1, 1).getDay()

  function getDayData(d) {
    const raw = employee.days[d]
    if (!raw) return { status: 'N/A', login_time: null, attendance_id: null, manually_edited: false, is_late: false, late_minutes: null }
    if (typeof raw === 'string') return { status: raw, login_time: null, attendance_id: null, manually_edited: false, is_late: false, late_minutes: null }
    return raw
  }

  async function saveEdit() {
    const dateStr  = `${year}-${String(month).padStart(2,'0')}-${String(editingDay).padStart(2,'0')}`
    const apiAction = editAction === 'present' ? 'mark_present'
                    : editAction === 'absent'  ? 'mark_absent'
                    : 'mark_leave'
    setSaving(true)
    try {
      await api.patch('/attendance/hr-edit', {
        user_id:    employee.user_id,
        date:       dateStr,
        action:     apiAction,
        login_time: editAction === 'present' ? (editTime || wdTimes[editingDay] || '9:00 AM') : undefined,
      })
      const newStatus    = editAction === 'present' ? 'Present' : editAction === 'absent' ? 'Absent' : 'Leave'
      const newLoginTime = editAction === 'present' ? (editTime || wdTimes[editingDay] || '9:00 AM') : null
      const prevData     = getDayData(editingDay)

      setEmployee(prev => ({
        ...prev,
        days: {
          ...prev.days,
          [editingDay]: {
            status:          newStatus,
            login_time:      newLoginTime,
            attendance_id:   prevData.attendance_id,
            manually_edited: true,
            is_late:         false,
            late_minutes:    null,
          }
        },
        total_present: prev.total_present
          + (newStatus === 'Present' ? 1 : 0)
          - (prevData.status === 'Present' ? 1 : 0),
        total_absent:  prev.total_absent
          + (newStatus === 'Absent' ? 1 : 0)
          - (prevData.status === 'Absent' ? 1 : 0),
        total_leave:   prev.total_leave
          + (newStatus === 'Leave' ? 1 : 0)
          - (prevData.status === 'Leave' ? 1 : 0),
      }))
      setEditingDay(null)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !editingDay && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[96vh] flex flex-col overflow-hidden border border-gray-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
          style={{ background: '#1E8496' }}>
          <div>
            <h2 className="text-xl font-black leading-tight" style={{ color: '#FFFFFF', fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.06em' }}>
              {employee.display_name.toUpperCase()}
            </h2>
            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {employee.username} &nbsp;·&nbsp; {MONTH_NAMES[month - 1]} {year}
              {isHrManager && (
                <span className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(251,220,180,0.18)', color: '#FBDCB4', border: '1px solid rgba(251,220,180,0.35)' }}>
                  ✎ HR Edit Mode
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="transition-colors p-1.5 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={e => e.currentTarget.style.color='#fff'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.6)'}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Calendar */}
        <div className="overflow-auto flex-1 px-4 py-3">
          <div className="grid grid-cols-7 mb-2" style={{ gap: 6 }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-center py-1"
                style={{ fontFamily:"'Rajdhani',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing:'0.08em', color:'#1E8496' }}>
                {d}
              </div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {days.map(d => {
              const data     = getDayData(d)
              const status   = data.status
              const isEditing = editingDay === d

              return (
                <div key={d}
                  className={`rounded-lg border ${cellStyle(status)} relative`}
                  style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>

                  {/* Day number + edited badge */}
                  <div className="flex items-center justify-between px-1.5 pt-1">
                    <span className="text-[10px] font-semibold" style={{ color:'#6B7280' }}>{d}</span>
                    {data.manually_edited && (
                      <span className="text-[7px] font-black px-1 rounded"
                        style={{ background: 'rgba(170,127,86,0.2)', color: '#AA7F56', lineHeight:'1.6', letterSpacing:'0.04em' }}>
                        EDITED
                      </span>
                    )}
                  </div>

                  {/* Status letter */}
                  <div className="text-center" style={{ marginTop: 1, marginBottom: 1 }}>
                    {status === 'Present'    && <span className="font-black text-amber-700" style={{ fontSize: 18, fontFamily:"'Rajdhani',sans-serif" }}>P</span>}
                    {status === 'Absent'     && <span className="font-black text-red-600"   style={{ fontSize: 18, fontFamily:"'Rajdhani',sans-serif" }}>A</span>}
                    {status === 'Week-End'   && <span className="font-bold text-gray-400"   style={{ fontSize: 12, fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.05em' }}>WE</span>}
                    {status === 'Leave'      && <span className="font-black text-blue-600"  style={{ fontSize: 18, fontFamily:"'Rajdhani',sans-serif" }}>L</span>}
                    {status === 'Not Joined' && <span className="font-bold text-slate-400"  style={{ fontSize: 10, fontFamily:"'Rajdhani',sans-serif" }}>N/J</span>}
                    {status === 'N/A'        && <span className="font-semibold text-gray-300" style={{ fontSize: 10 }}>N/A</span>}
                  </div>

                  {/* Login time */}
                  {data.login_time && (
                    <div className="text-center">
                      <span className="font-bold text-amber-700"
                        style={{ fontSize: 10, fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.04em' }}>
                        {data.login_time}
                      </span>
                    </div>
                  )}

                  {/* Late badge */}
                  {data.is_late && (
                    <div className="text-center">
                      <span className="font-black px-1 rounded"
                        style={{ fontSize: 9, background:'rgba(73,49,30,0.12)', color:'#49311E', border:'1px solid #AA7F56' }}>
                        +{data.late_minutes}m
                      </span>
                    </div>
                  )}

                  {/* HR edit button — only for working days (Present/Absent) */}
                  {isHrManager && (status === 'Present' || status === 'Absent' || status === 'Leave') && !isEditing && (
                    <button
                      onClick={() => {
                        setEditingDay(d)
                        setEditAction(status === 'Present' ? 'present' : status === 'Leave' ? 'leave' : 'absent')
                        setEditTime(data.login_time ?? wdTimes[d] ?? '')
                      }}
                      className="absolute bottom-0.5 right-0.5 text-[9px] text-gray-400 hover:text-blue-500 transition-colors p-0.5 leading-none"
                      title="Edit">
                      ✎
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Inline edit panel */}
          {editingDay !== null && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-amber-800">
                  Editing {MONTH_NAMES[month-1]} {editingDay}, {year}
                </span>
                <button onClick={() => setEditingDay(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
              </div>

              {/* Action selector */}
              <div className="flex gap-2 mb-3">
                {[
                  { key: 'present', label: '✓ Present', active: 'bg-emerald-600 text-white', inactive: 'bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 hover:text-emerald-700' },
                  { key: 'absent',  label: '✕ Absent',  active: 'bg-red-600 text-white',     inactive: 'bg-white border border-gray-300 text-gray-600 hover:border-red-400 hover:text-red-600' },
                  { key: 'leave',   label: '📅 Leave',   active: 'bg-blue-600 text-white',    inactive: 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600' },
                ].map(({ key, label, active, inactive }) => (
                  <button key={key}
                    onClick={() => {
                      setEditAction(key)
                      if (key === 'present' && !editTime) setEditTime(wdTimes[editingDay] ?? '')
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${editAction === key ? active : inactive}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Time picker — only for Present */}
              {editAction === 'present' && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1.5">Login time:</p>
                  <TimePicker
                    value={editTime || wdTimes[editingDay] || ''}
                    onConfirm={t => setEditTime(t)}
                    onCancel={() => setEditingDay(null)}
                  />
                </div>
              )}

              {/* Save button */}
              <div className="pt-2 border-t border-amber-200">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                    editAction === 'present' ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : editAction === 'absent' ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}>
                  {saving ? 'Saving…' : `Save — ${editAction === 'present' ? 'Mark Present' : editAction === 'absent' ? 'Mark Absent' : 'Mark Leave'}`}
                </button>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
            {[
              { label:'Present',  val: employee.total_present, cls:'bg-amber-100 text-amber-800' },
              { label:'Absent',   val: employee.total_absent,  cls:'bg-red-100 text-red-700'    },
              { label:'Leave',    val: employee.total_leave,   cls:'bg-blue-100 text-blue-700'  },
              { label:'Weekends', val: employee.total_weekend, cls:'bg-gray-100 text-gray-600'  },
            ].map(({ label, val, cls }) => (
              <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${cls}`}>
                <span className="font-bold text-sm">{val}</span> {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AttendanceReport() {
  const { user }  = useAuth()
  const isHrManager = ['admin', 'director'].includes(user?.role) ||
    (user?.role === 'manager' && user?.manager_type === 'HR Manager')

  const now      = new Date()
  const nowYear  = now.getFullYear()
  const nowMonth = now.getMonth() + 1

  const [month,     setMonth]     = useState(nowMonth)
  const [year,      setYear]      = useState(nowYear)
  const [search,    setSearch]    = useState('')
  const [roleF,     setRoleF]     = useState('')
  const [deptF,     setDeptF]     = useState('')
  const [lateOnly,  setLateOnly]  = useState(false)
  const [report,    setReport]    = useState([])
  const [days,      setDays]      = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [selected,  setSelected]  = useState(null)

  const availableYears = useMemo(() => {
    const years = []
    for (let y = MODULE_START_YEAR; y <= nowYear; y++) years.push(y)
    return years
  }, [nowYear])

  const availableMonths = useMemo(() => {
    const minM = year === MODULE_START_YEAR ? MODULE_START_MONTH : 1
    const maxM = year === nowYear           ? nowMonth           : 12
    const months = []
    for (let m = minM; m <= maxM; m++) months.push(m)
    return months
  }, [year, nowYear, nowMonth])

  useEffect(() => {
    const minM = year === MODULE_START_YEAR ? MODULE_START_MONTH : 1
    const maxM = year === nowYear           ? nowMonth           : 12
    if (month < minM) setMonth(minM)
    else if (month > maxM) setMonth(maxM)
  }, [year]) // eslint-disable-line

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/attendance/report', {
        params: { month, year, search: search || undefined, role: roleF || undefined, department: deptF || undefined }
      })
      setReport(data.report ?? [])
      setDays(data.days_in_month ?? 0)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [month, year, search, roleF, deptF])

  const filteredReport = lateOnly ? report.filter(emp => emp.total_late > 0) : report

  useEffect(() => { fetchReport() }, [fetchReport])

  async function handleExport() {
    setExporting(true)
    try {
      const { data } = await api.get('/attendance/report/export', { params: { month, year } })
      const blob = new Blob([data.csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = data.filename; a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ } finally { setExporting(false) }
  }

  return (
    <Layout>
      <div className="p-5 space-y-4 h-[calc(100vh-64px)] flex flex-col" style={{ background: '#EDF0F3', minHeight: '100vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#132E57', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>Attendance Report</h1>
            <p className="text-sm mt-0.5" style={{ color: '#5C5C5C' }}>Monthly attendance overview for all employees</p>
          </div>
          <button onClick={handleExport} disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-60">
            {exporting
              ? <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Exporting…</>
              : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>Export CSV</>
            }
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 shadow-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0E5F6E 0%, #1E8496 100%)', border: '1px solid #1A7888' }}>
          <div className="flex items-end gap-2.5 flex-wrap">
            <div className="w-[140px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>Month</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectCls} style={filterSelectStyle}>
                {availableMonths.map(m => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
              </select>
            </div>
            <div className="w-[90px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectCls} style={filterSelectStyle}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="w-[110px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>Role</label>
              <select value={roleF} onChange={e => setRoleF(e.target.value)} className={selectCls} style={filterSelectStyle}>
                <option value="">All Roles</option>
                <option value="manager">Manager</option>
                <option value="agent">Agent</option>
              </select>
            </div>
            <div className="w-[140px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>Department</label>
              <select value={deptF} onChange={e => setDeptF(e.target.value)} className={selectCls} style={filterSelectStyle}>
                <option value="">All Departments</option>
                {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="w-[180px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>Search</label>
              <input type="text" placeholder="Name or username…" value={search}
                onChange={e => setSearch(e.target.value)} className={inputCls} style={filterInputStyle} />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={lateOnly} onChange={e => setLateOnly(e.target.checked)}
                  className="rounded accent-amber-600 w-3.5 h-3.5 cursor-pointer" />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>
                  Late Only
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2.5 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Results</h2>
            {!loading && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {filteredReport.length} employee{filteredReport.length !== 1 ? 's' : ''} · {MONTH_NAMES[month - 1]} {year} · {days} days
              </span>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-separate border-spacing-0" style={{ minWidth: 760 }}>
              <thead className="sticky top-0 z-10">
                <tr style={{ background: 'linear-gradient(90deg, #4A5568 0%, #5A6880 100%)', borderBottom: '2px solid #3A4558' }}>
                  {['S.No','User ID','Name','Role','Designation','Dept','Present','Late','Absent','Leave','Weekends','Not Joined','Working Days',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase whitespace-nowrap"
                      style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.07em', background: 'transparent' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      {Array.from({ length: 14 }).map((_, c) => (
                        <td key={c} className="px-3 py-2.5 border-b border-gray-50">
                          <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : report.length === 0 ? (
                  <tr><td colSpan={14} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No records found for the selected filters.
                  </td></tr>
                ) : filteredReport.map((emp, idx) => {
                  const notJoined   = emp.total_not_joined ?? 0
                  const workingDays = emp.total_present + emp.total_absent + emp.total_leave
                  const roleBadge   = emp.role === 'manager'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-cyan-100 text-cyan-700'
                  const designation = emp.agent_type ?? emp.manager_type ?? 'N/A'

                  return (
                    <tr key={emp.user_id}
                      className={`hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-3 py-2 border-b border-gray-50 text-xs text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2 border-b border-gray-50">
                        <span className="font-mono text-xs font-bold text-gray-700">{emp.username}</span>
                      </td>
                      {/* Name — no designation here anymore */}
                      <td className="px-3 py-2 border-b border-gray-50">
                        <span className="font-medium text-gray-800 text-sm">{emp.display_name}</span>
                      </td>
                      {/* Role */}
                      <td className="px-3 py-2 border-b border-gray-50">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${roleBadge}`}>
                          {emp.role}
                        </span>
                      </td>
                      {/* Designation — separate column */}
                      <td className="px-3 py-2 border-b border-gray-50">
                        <span className="text-xs text-gray-500">{designation}</span>
                      </td>
                      <td className="px-3 py-2 border-b border-gray-50 text-xs text-gray-500">{emp.department ?? 'N/A'}</td>
                      <td className="px-3 py-2 border-b border-gray-50 text-sm font-bold text-amber-700">{emp.total_present}</td>
                      <td className="px-3 py-2 border-b border-gray-50 text-sm font-bold" style={{ color: '#AA7F56' }}>
                        {emp.total_late ?? 0}
                      </td>
                      <td className="px-3 py-2 border-b border-gray-50 text-sm font-bold text-red-600">{emp.total_absent}</td>
                      <td className="px-3 py-2 border-b border-gray-50 text-sm font-semibold text-blue-600">{emp.total_leave}</td>
                      <td className="px-3 py-2 border-b border-gray-50 text-sm text-gray-500">{emp.total_weekend}</td>
                      <td className="px-3 py-2 border-b border-gray-50 text-sm font-semibold text-slate-500">
                        {notJoined}
                      </td>
                      <td className="px-3 py-2 border-b border-gray-50 text-sm font-bold text-gray-700">{workingDays}</td>
                      <td className="px-3 py-2 border-b border-gray-50">
                        <button onClick={() => setSelected(emp)}
                          className="px-3 py-1 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors">
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Employee detail modal */}
      {selected && (
        <EmployeeModal
          employee={selected}
          year={year}
          month={month}
          isHrManager={isHrManager}
          onClose={() => setSelected(null)}
        />
      )}
    </Layout>
  )
}
