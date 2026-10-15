import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import TimePicker from '../components/TimePicker'
import DateInput from '../components/DateInput'
import api from '../api/axios'

// ── Style constants ────────────────────────────────────────────────────────────
const labelCls = 'block text-xs font-bold uppercase tracking-widest mb-0.5'
const inputCls = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition'
const filterInputStyle = { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }

function todayPKT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, fill }) {
  return (
    <div className="rounded-xl flex-1 min-w-[110px]" style={{
      background:  `linear-gradient(135deg, ${fill} 0%, #fff 100%)`,
      borderLeft:  `4px solid ${color}`,
      padding:     '12px 16px',
      boxShadow:   `0 1px 4px ${color}18`,
    }}>
      <div className="text-2xl font-bold" style={{ color }}>{value ?? 0}</div>
      <div className="text-xs font-semibold uppercase tracking-wide mt-0.5" style={{ color: `${color}99` }}>{label}</div>
    </div>
  )
}

// ── Inline edit for a row ──────────────────────────────────────────────────────
function EditCell({ emp, date, defaultLoginTime, onSaved }) {
  const [open,       setOpen]      = useState(false)
  const [editAction, setEditAction] = useState('present')
  const [time,       setTime]       = useState('')
  const [saving,     setSaving]     = useState(false)

  function openEdit() {
    setEditAction(emp.login_time ? 'present' : 'absent')
    setTime(emp.login_time ?? defaultLoginTime ?? '')
    setOpen(true)
  }

  async function save() {
    const apiAction = editAction === 'present' ? 'mark_present'
                    : editAction === 'absent'  ? 'mark_absent'
                    : 'mark_leave'
    setSaving(true)
    try {
      await api.patch('/attendance/hr-edit', {
        user_id:    emp.user_id,
        date,
        action:     apiAction,
        login_time: editAction === 'present' ? (time || defaultLoginTime || '9:00 AM') : undefined,
      })
      onSaved(emp.user_id, editAction, editAction === 'present' ? (time || defaultLoginTime) : null)
      setOpen(false)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  if (!open) {
    return (
      <button onClick={openEdit}
        className="px-2.5 py-1 rounded-lg border border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
        Edit
      </button>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2.5 min-w-[300px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-amber-800">Edit Attendance</span>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>

      {/* Action selector */}
      <div className="flex gap-2">
        {[
          { key: 'present', label: '✓ Present', active: 'bg-emerald-600 text-white', inactive: 'bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 hover:text-emerald-600' },
          { key: 'absent',  label: '✕ Absent',  active: 'bg-red-600 text-white',     inactive: 'bg-white border border-gray-300 text-gray-600 hover:border-red-400 hover:text-red-600' },
          { key: 'leave',   label: '📅 Leave',   active: 'bg-blue-600 text-white',    inactive: 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600' },
        ].map(({ key, label, active, inactive }) => (
          <button key={key}
            onClick={() => { setEditAction(key); if (key === 'present' && !time) setTime(defaultLoginTime ?? '') }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${editAction === key ? active : inactive}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Time picker — only for present */}
      {editAction === 'present' && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Login time:</p>
          <TimePicker
            value={time || defaultLoginTime || ''}
            onConfirm={t => setTime(t)}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 w-full ${
          editAction === 'present' ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
          : editAction === 'absent' ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}>
        {saving ? 'Saving…' : `Save — ${editAction === 'present' ? 'Mark Present' : editAction === 'absent' ? 'Mark Absent' : 'Mark Leave'}`}
      </button>
    </div>
  )
}

// ── Employee row ───────────────────────────────────────────────────────────────
function EmpRow({ emp, date, idx, defaultLoginTime, onSaved }) {
  const roleBadge = emp.role === 'manager' ? 'bg-indigo-100 text-indigo-700' : 'bg-cyan-100 text-cyan-700'
  const designation = emp.agent_type ?? emp.manager_type ?? 'N/A'

  return (
    <tr className={`transition-colors hover:bg-blue-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
      <td className="px-4 py-2.5 border-b border-gray-50">
        <span className="font-mono text-xs font-bold text-gray-700">{emp.username}</span>
      </td>
      <td className="px-4 py-2.5 border-b border-gray-50">
        <span className="font-medium text-gray-800 text-sm">{emp.display_name}</span>
      </td>
      <td className="px-4 py-2.5 border-b border-gray-50">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${roleBadge}`}>
          {emp.role}
        </span>
      </td>
      <td className="px-4 py-2.5 border-b border-gray-50">
        <span className="text-xs text-gray-500">{designation}</span>
      </td>
      {/* Login time */}
      <td className="px-4 py-2.5 border-b border-gray-50">
        {emp.login_time ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-700" style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:'0.78rem', letterSpacing:'0.04em' }}>
              {emp.login_time}
            </span>
            {emp.is_late && (
              <span className="text-[9px] font-bold px-1 rounded"
                style={{ background:'rgba(73,49,30,0.1)', color:'#49311E', border:'1px solid #AA7F56' }}>
                +{emp.late_minutes}m
              </span>
            )}
            {emp.manually_edited && (
              <span className="text-[9px] font-bold px-1 rounded"
                style={{ background:'rgba(170,127,86,0.2)', color:'#AA7F56' }}>
                EDITED
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-300">N/A</span>
        )}
      </td>
      {/* Approval status */}
      <td className="px-4 py-2.5 border-b border-gray-50">
        {emp.approval_status === 'approved' && <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Approved</span>}
        {emp.approval_status === 'rejected' && <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Rejected</span>}
        {emp.approval_status === 'pending'  && <span className="text-xs font-medium border border-gray-300 text-gray-500 px-2 py-0.5 rounded-full">Pending</span>}
        {!emp.approval_status && <span className="text-xs text-gray-300">N/A</span>}
      </td>
      <td className="px-4 py-2.5 border-b border-gray-50">
        <EditCell emp={emp} date={date} defaultLoginTime={defaultLoginTime} onSaved={onSaved} />
      </td>
    </tr>
  )
}

// ── Section table ──────────────────────────────────────────────────────────────
function Section({ title, colorCls, bgCls, employees, date, defaultLoginTime, onSaved, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)

  if (employees.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <button
        className={`w-full flex items-center justify-between px-4 py-2.5 ${bgCls} text-left`}
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2.5">
          <span className={`text-sm font-bold ${colorCls}`}>{title}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colorCls} bg-white/60`}>
            {employees.length}
          </span>
        </div>
        <span className={`text-sm ${colorCls} transition-transform ${open ? '' : 'rotate-180'}`}>▲</span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0" style={{ minWidth: 720 }}>
            <thead>
              <tr style={{ background: 'linear-gradient(90deg, #4A5568 0%, #5A6880 100%)', borderBottom: '2px solid #3A4558' }}>
                {['User ID','Name','Role','Designation','Login Time','Approval','Actions'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-bold uppercase whitespace-nowrap"
                    style={{ color: '#FFFFFF', fontFamily:"'Rajdhani',sans-serif", letterSpacing: '0.07em', background: 'transparent' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, idx) => (
                <EmpRow key={emp.user_id} emp={emp} date={date} idx={idx} defaultLoginTime={defaultLoginTime} onSaved={onSaved} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function DailyAttendance() {
  const [date,             setDate]             = useState(todayPKT)
  const [data,             setData]             = useState(null)
  const [loading,          setLoading]          = useState(true)
  const [defaultLoginTime, setDefaultLoginTime] = useState('')

  // Fetch working-day login time for this date (to prefill time picker)
  useEffect(() => {
    const [y, m] = date.split('-').map(Number)
    const dayNum = parseInt(date.split('-')[2], 10)
    api.get('/working-days', { params: { month: m, year: y } })
      .then(({ data: wd }) => {
        const day = (wd.days ?? []).find(d => parseInt(d.date.split('-')[2], 10) === dayNum)
        setDefaultLoginTime(day?.login_time_formatted ?? '')
      })
      .catch(() => setDefaultLoginTime(''))
  }, [date])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: res } = await api.get('/attendance/daily', { params: { date } })
      setData(res)
    } catch { setData(null) } finally { setLoading(false) }
  }, [date])

  useEffect(() => { fetchData() }, [fetchData])

  function handleSaved(userId, action, loginTime) {
    if (!data) return
    const isPresent = action === 'mark_present'

    // Remove employee from current list, add to correct list
    setData(prev => {
      const allEmps = [...prev.present, ...prev.absent]
      const emp = allEmps.find(e => e.user_id === userId)
      if (!emp) return prev

      const updated = {
        ...emp,
        login_time:      isPresent ? (loginTime ?? null) : null,
        manually_edited: true,
        approval_status: isPresent ? 'approved' : 'rejected',
      }

      return {
        ...prev,
        present: isPresent
          ? [...prev.present.filter(e => e.user_id !== userId), updated]
          : prev.present.filter(e => e.user_id !== userId),
        absent: !isPresent
          ? [...prev.absent.filter(e => e.user_id !== userId), updated]
          : prev.absent.filter(e => e.user_id !== userId),
        summary: {
          ...prev.summary,
          present: isPresent
            ? prev.summary.present + (prev.present.some(e => e.user_id === userId) ? 0 : 1)
            : prev.summary.present - (prev.present.some(e => e.user_id === userId) ? 1 : 0),
          absent: !isPresent
            ? prev.summary.absent + (prev.absent.some(e => e.user_id === userId) ? 0 : 1)
            : prev.summary.absent - (prev.absent.some(e => e.user_id === userId) ? 1 : 0),
        }
      }
    })
  }

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <Layout>
      <div className="p-5 space-y-4 h-[calc(100vh-64px)] flex flex-col" style={{ background: '#EDF0F3', minHeight: '100vh' }}>

        {/* ── Header ── */}
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-black" style={{ color: '#132E57', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>Daily Attendance</h1>
          <p className="text-sm mt-0.5" style={{ color: '#5C5C5C' }}>View and edit employee attendance for a specific day</p>
        </div>

        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 shadow-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0E5F6E 0%, #1E8496 100%)', border: '1px solid #1A7888' }}>
          <div className="flex items-end gap-4">
            <div className="w-[180px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily:"'Rajdhani',sans-serif" }}>Date</label>
              <DateInput value={date} min="2026-05-01"
                max={todayPKT()}
                onChange={e => setDate(e.target.value)}
                className={inputCls} style={filterInputStyle} />
            </div>
            <div className="text-sm font-semibold pb-1.5" style={{ color: '#FFFFFF', fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.03em' }}>
              {dateLabel}
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        {!loading && data && (
          <div className="flex gap-3 flex-shrink-0">
            <StatCard label="Total"   value={data.summary.total}   color="#132E57" fill="rgba(19,46,87,0.08)"    />
            <StatCard label="Present" value={data.summary.present} color="#1E8496" fill="rgba(30,132,150,0.08)" />
            <StatCard label="Absent"  value={data.summary.absent}  color="#C25A1F" fill="rgba(194,90,31,0.08)"  />
            <StatCard label="Leave"   value={data.summary.leave}   color="#132E57" fill="rgba(19,46,87,0.06)"   />
            <StatCard label="Late" value={data.summary.late ?? 0} color="#AA7F56" fill="rgba(170,127,86,0.08)" />
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-400 mt-3">Loading attendance…</p>
            </div>
          ) : !data ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Failed to load data.
            </div>
          ) : data.is_leave ? (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 text-center">
              <p className="text-4xl mb-2">📅</p>
              <p className="text-base font-bold text-blue-700">Company Leave Day</p>
              {data.leave_reason && <p className="text-sm text-blue-500 mt-1">{data.leave_reason}</p>}
            </div>
          ) : data.is_weekend ? (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
              <p className="text-4xl mb-2">🏖️</p>
              <p className="text-base font-bold text-gray-500">Weekend</p>
              <p className="text-sm text-gray-400 mt-1">No attendance on weekends</p>
            </div>
          ) : (
            <>
              <Section
                title="Present"
                colorCls="text-amber-700"
                bgCls="bg-amber-50"
                employees={data.present}
                date={date}
                defaultLoginTime={defaultLoginTime}
                onSaved={handleSaved}
                defaultOpen={true}
              />
              <Section
                title="Absent"
                colorCls="text-orange-700"
                bgCls="bg-orange-50"
                employees={data.absent}
                date={date}
                defaultLoginTime={defaultLoginTime}
                onSaved={handleSaved}
                defaultOpen={true}
              />
              {data.leave.length > 0 && (
                <Section
                  title="Leave"
                  colorCls="text-blue-600"
                  bgCls="bg-blue-50"
                  employees={data.leave}
                  date={date}
                  defaultLoginTime={defaultLoginTime}
                  onSaved={handleSaved}
                  defaultOpen={false}
                />
              )}
              {data.present.length === 0 && data.absent.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
                  No attendance data for this date.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
