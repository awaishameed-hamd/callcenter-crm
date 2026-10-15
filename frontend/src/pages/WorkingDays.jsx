import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout'
import Toast from '../components/Toast'
import TimePicker from '../components/TimePicker'
import api from '../api/axios'

// ── Shared style constants ────────────────────────────────────────────────────
const labelCls          = 'block text-xs font-bold uppercase tracking-widest mb-0.5'
const filterSelectStyle = { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }
const selectCls         = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition cursor-pointer'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MODULE_START_YEAR  = 2026
const MODULE_START_MONTH = 5

// PKT date helpers
function pktDate(offsetDays = 0) {
  const now = new Date()
  const pkt = new Date(now.getTime() + 5 * 60 * 60 * 1000)
  if (offsetDays) pkt.setUTCDate(pkt.getUTCDate() + offsetDays)
  return pkt.toISOString().split('T')[0]
}

const STATUS_OPTIONS = [
  { value: 'working_day', label: 'Working Day' },
  { value: 'weekend',     label: 'Weekend'     },
  { value: 'leave',       label: 'Leave'       },
]

// ── Row background colors ─────────────────────────────────────────────────────
function rowStyle(status, idx) {
  if (status === 'leave')   return { background: 'rgba(73,49,30,0.08)' }
  if (status === 'weekend') return { background: idx % 2 === 0 ? '#F8FAFC' : '#F1F5F9', opacity: 0.75 }
  return { background: idx % 2 === 0 ? '#ffffff' : '#F9FAFB' }
}

// ── Inline Login Time Editor ──────────────────────────────────────────────────
function LoginTimeCell({ row, onSaved, nextWorkingDay }) {
  const isEditable = row.status === 'working_day' &&
    ([pktDate(-1), pktDate(0), pktDate(1)].includes(row.date) || row.date === nextWorkingDay)

  const [editing,  setEditing]  = useState(false)
  const [val,      setVal]      = useState(row.login_time_formatted ?? '')
  const [confirm,  setConfirm]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  // Sync val if parent state changes (e.g. carry-forward)
  useEffect(() => { setVal(row.login_time_formatted ?? '') }, [row.login_time_formatted])

  if (row.status !== 'working_day') {
    return <span className="text-xs text-gray-300">N/A</span>
  }

  if (confirm) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-amber-700">
          Set to <span style={{ fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.04em', fontSize:'0.78rem', fontWeight:700 }}>{val}</span> &amp; carry forward to all future working days?
        </p>
        <div className="flex items-center gap-1.5">
          <button onClick={async () => {
            setSaving(true)
            try {
              await api.patch(`/working-days/${row.date}/login-time`, { login_time: val })
              onSaved(row.date, val)
              setEditing(false); setConfirm(false)
            } catch { /* ignore */ } finally { setSaving(false) }
          }} disabled={saving}
            className="px-3 py-0.5 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {saving ? '…' : 'Yes, Save'}
          </button>
          <button onClick={() => setConfirm(false)}
            className="px-2 py-0.5 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <TimePicker
          value={val}
          onConfirm={newVal => { setVal(newVal); setConfirm(true) }}
          onCancel={() => { setEditing(false); setVal(row.login_time_formatted ?? '') }}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-bold text-gray-800"
        style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em', fontSize: '0.82rem' }}>
        {row.login_time_formatted ?? 'N/A'}
      </span>
      {isEditable && (
        <button onClick={() => setEditing(true)} title="Edit login time"
          className="p-0.5 rounded text-gray-400 hover:text-blue-500 transition-colors text-xs font-semibold">
          Edit
        </button>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WorkingDays() {
  const now      = new Date()
  const nowYear  = now.getFullYear()
  const nowMonth = now.getMonth() + 1

  // Allow setup up to 1 month ahead
  const maxYear  = nowMonth === 12 ? nowYear + 1 : nowYear
  const maxMonth = nowMonth === 12 ? 1 : nowMonth + 1

  const [month,           setMonth]           = useState(nowMonth)
  const [year,            setYear]            = useState(nowYear)
  const [days,            setDays]            = useState([])
  const [isSetup,         setIsSetup]         = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [toast,           setToast]           = useState(null)

  // Available years: May 2026 → maxYear
  const availableYears = useMemo(() => {
    const years = []
    for (let y = MODULE_START_YEAR; y <= maxYear; y++) years.push(y)
    return years
  }, [maxYear])

  // Available months for selected year
  const availableMonths = useMemo(() => {
    const minM = year === MODULE_START_YEAR ? MODULE_START_MONTH : 1
    const mxM  = year === maxYear           ? maxMonth           : 12
    const months = []
    for (let m = minM; m <= mxM; m++) months.push(m)
    return months
  }, [year, maxYear, maxMonth])

  // Clamp month when year changes
  useEffect(() => {
    const minM = year === MODULE_START_YEAR ? MODULE_START_MONTH : 1
    const mxM  = year === maxYear           ? maxMonth           : 12
    if (month < minM) setMonth(minM)
    else if (month > mxM) setMonth(mxM)
  }, [year]) // eslint-disable-line

  useEffect(() => { fetchData() }, [month, year]) // eslint-disable-line

  async function fetchData() {
    setLoading(true)
    try {
      const { data } = await api.get('/working-days', { params: { month, year } })
      setDays(data.days ?? [])
      setIsSetup(data.is_setup ?? false)
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  // ── Local state helpers ─────────────────────────────────────────────────────
  function setDayField(idx, field, value) {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  }

  function handleStatusChange(idx, newStatus) {
    setDays(prev => {
      // When switching TO working_day, carry forward nearest existing login time
      let carryTime = null
      if (newStatus === 'working_day') {
        for (let i = idx - 1; i >= 0; i--) {
          if (prev[i].login_time_formatted) { carryTime = prev[i].login_time_formatted; break }
        }
        if (!carryTime) {
          for (let i = idx + 1; i < prev.length; i++) {
            if (prev[i].login_time_formatted) { carryTime = prev[i].login_time_formatted; break }
          }
        }
      }

      return prev.map((d, i) => {
        if (i !== idx) return d
        return {
          ...d,
          status:               newStatus,
          leave_reason:         newStatus !== 'leave' ? null : d.leave_reason,
          login_time_formatted: newStatus === 'weekend' || newStatus === 'leave'
            ? null
            : (d.login_time_formatted ?? carryTime),
        }
      })
    })
  }

  // Called when HR edits login time for an editable date → carry forward in UI too
  function handleLoginTimeSaved(date, newTime) {
    setDays(prev => prev.map(d => {
      if (d.date === date) return { ...d, login_time_formatted: newTime }
      if (d.date > date && d.status === 'working_day') return { ...d, login_time_formatted: newTime }
      return d
    }))
    setToast({ message: `Login time updated to ${newTime} and carried forward.`, type: 'success' })
  }

  // ── Save changes ────────────────────────────────────────────────────────────
  async function handleSave() {
    // Validate: leave rows must have a reason
    const missing = days.find(d => d.status === 'leave' && !d.leave_reason?.trim())
    if (missing) {
      setToast({ message: `Leave reason is required for ${missing.date}.`, type: 'error' })
      return
    }

    setSaving(true)
    try {
      await api.post('/working-days/setup', {
        month,
        year,
        days: days.map(d => ({
          date:         d.date,
          status:       d.status,
          leave_reason: d.leave_reason ?? null,
          login_time:   d.login_time_formatted ?? null,
        })),
      })
      setIsSetup(true)
      setToast({ message: `Working days for ${MONTH_NAMES[month - 1]} ${year} saved successfully.`, type: 'success' })
    } catch (err) {
      setToast({ message: err.response?.data?.message ?? 'Save failed.', type: 'error' })
    } finally { setSaving(false) }
  }


  // ── Summary ─────────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const working  = days.filter(d => d.status === 'working_day').length
    const weekends = days.filter(d => d.status === 'weekend').length
    const leaves   = days.filter(d => d.status === 'leave').length
    return { working, weekends, leaves, total: days.length }
  }, [days])

  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="p-5 space-y-4 h-[calc(100vh-64px)] flex flex-col" style={{ background: '#EDF0F3', minHeight: '100vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#132E57', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>Manage Working Days</h1>
            <p className="text-sm mt-0.5" style={{ color: '#5C5C5C' }}>Configure the monthly attendance calendar</p>
          </div>
          <button onClick={handleSave} disabled={saving || loading}
            className="px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)', color: '#ffffff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
            onMouseEnter={e => { if (!saving && !loading) e.currentTarget.style.background = 'linear-gradient(135deg, #2296AA 0%, #1E8496 100%)' }}
            onMouseLeave={e => { if (!saving && !loading) e.currentTarget.style.background = 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)' }}>
            {saving ? 'Saving…' : isSetup ? 'Update Changes' : 'Save Changes'}
          </button>
        </div>

        {/* ── Filters + Settings bar ── */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 shadow-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0E5F6E 0%, #1E8496 100%)', border: '1px solid #1A7888' }}>
          <div className="flex items-end gap-4 flex-wrap">
            {/* Month */}
            <div className="w-[140px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>Month</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectCls} style={filterSelectStyle}>
                {availableMonths.map(m => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
              </select>
            </div>
            {/* Year */}
            <div className="w-[100px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectCls} style={filterSelectStyle}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Results card ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

          {/* Card header */}
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-gray-700">{MONTH_NAMES[month - 1]} {year}</h2>
              {!loading && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSetup ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isSetup ? '✓ Configured' : 'Preview — Not Saved'}
                </span>
              )}
            </div>
            {/* Summary pills */}
            {!loading && (
              <div className="flex items-center gap-4 text-xs">
                {[
                  { label: 'Working',  val: summary.working,  color: 'text-gray-700'   },
                  { label: 'Weekends', val: summary.weekends, color: 'text-gray-400'   },
                  { label: 'Leaves',   val: summary.leaves,   color: 'text-orange-600' },
                  { label: 'Total',    val: summary.total,    color: 'text-gray-500'   },
                ].map(({ label, val, color }) => (
                  <span key={label} className="flex items-center gap-1">
                    <span className={`font-bold ${color}`}>{val}</span>
                    <span className="text-gray-400">{label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: 'linear-gradient(90deg, #4A5568 0%, #5A6880 100%)', borderBottom: '2px solid #3A4558' }}>
                  {['Date', 'Day', 'Status', 'Leave Reason', 'Login Time'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase"
                      style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.07em', background: 'transparent' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      {[1,2,3,4,5].map(c => (
                        <td key={c} className="px-4 py-2.5 border-b border-gray-50">
                          <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : days.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">No data.</td></tr>
                ) : days.map((row, idx) => {
                  // Lock status editing for dates before yesterday (PKT)
                  const isLocked = row.date < pktDate(-1)

                  const statusBadgeStyle = {
                    leave:       { bg: 'rgba(73,49,30,0.12)',  border: '#AA7F56', color: '#49311E' },
                    weekend:     { bg: 'rgba(63,71,83,0.10)',  border: '#9FA7B2', color: '#5C6D82' },
                    working_day: { bg: '#f9fafb',              border: '#d1d5db', color: '#374151' },
                  }[row.status] ?? { bg: '#f9fafb', border: '#d1d5db', color: '#374151' }

                  return (
                  <tr key={row.date}
                    style={{ ...rowStyle(row.status, idx), opacity: isLocked ? 0.6 : 1 }}
                    className="hover:brightness-95 transition-all">

                    {/* Date */}
                    <td className="px-4 py-2 border-b border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                          {row.date}
                        </span>
                      </div>
                    </td>

                    {/* Day name */}
                    <td className="px-4 py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-600" style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.02em' }}>
                        {row.day_name}
                      </span>
                    </td>

                    {/* Status — locked = read-only badge, unlocked = dropdown */}
                    <td className="px-4 py-2 border-b border-gray-100">
                      {isLocked ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border"
                          style={{ background: statusBadgeStyle.bg, borderColor: statusBadgeStyle.border, color: statusBadgeStyle.color }}>
                          {STATUS_OPTIONS.find(o => o.value === row.status)?.label ?? row.status}
                        </span>
                      ) : (
                        <select
                          value={row.status}
                          onChange={e => handleStatusChange(idx, e.target.value)}
                          className="rounded-lg px-2 py-1 text-xs outline-none transition cursor-pointer border"
                          style={{
                            background:  statusBadgeStyle.bg,
                            borderColor: statusBadgeStyle.border,
                            color:       statusBadgeStyle.color,
                            fontWeight: 600,
                          }}>
                          {STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Leave Reason — locked = read-only text, unlocked = input */}
                    <td className="px-4 py-2 border-b border-gray-100" style={{ minWidth: 180 }}>
                      {row.status === 'leave' ? (
                        isLocked ? (
                          <span className="text-xs font-medium" style={{ color: '#49311E' }}>
                            {row.leave_reason ?? 'N/A'}
                          </span>
                        ) : (
                        <input
                          type="text"
                          placeholder="Required — e.g. Labour Day"
                          value={row.leave_reason ?? ''}
                          onChange={e => setDayField(idx, 'leave_reason', e.target.value)}
                          className="w-full rounded border px-2 py-1 text-xs outline-none focus:ring-1"
                          style={{
                            borderColor: !row.leave_reason?.trim() ? '#f87171' : '#AA7F56',
                            background: 'rgba(73,49,30,0.05)',
                            color: '#374151',
                          }}
                        />
                        )
                      ) : (
                        <span className="text-xs text-gray-300">N/A</span>
                      )}
                    </td>

                    {/* Login Time */}
                    <td className="px-4 py-2 border-b border-gray-100">
                      <LoginTimeCell row={row} onSaved={handleLoginTimeSaved}
                        nextWorkingDay={days.find(d => d.date > pktDate(0) && d.status === 'working_day')?.date} />
                    </td>

                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          {!loading && days.length > 0 && (
            <div className="px-5 py-2.5 border-t border-gray-100 flex items-center gap-6 flex-shrink-0 bg-gray-50/60">
              {[
                { label: 'Working Days', val: summary.working,  color: '#374151'   },
                { label: 'Weekends',     val: summary.weekends, color: '#9FA7B2'   },
                { label: 'Leaves',       val: summary.leaves,   color: '#AA7F56'   },
                { label: 'Total Days',   val: summary.total,    color: '#6B7280'   },
              ].map(({ label, val, color }) => (
                <span key={label} className="text-xs flex items-center gap-1.5">
                  <span className="font-bold text-sm" style={{ color }}>{val}</span>
                  <span className="text-gray-400">{label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
