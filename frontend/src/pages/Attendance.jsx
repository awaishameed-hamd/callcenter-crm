import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout'
import api from '../api/axios'

// ── CRM Palette ────────────────────────────────────────────────────────────────
const P = {
  navy:   '#132E57',
  teal:   '#1E8496',
  tealDk: '#0E5F6E',
  gold:   '#D7A520',
  brick:  '#C25A1F',
  bg:     '#EDF0F3',
  text:   '#132E57',
  muted:  '#5C5C5C',
  border: '#E0DDD5',
  white:  '#FFFFFF',
}

// ── Style constants ────────────────────────────────────────────────────────────
const labelCls          = 'block text-xs font-bold uppercase tracking-widest mb-0.5'
const filterSelectStyle = { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }
const selectCls         = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition cursor-pointer'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const MODULE_START_YEAR  = 2026
const MODULE_START_MONTH = 5

// ── Status badges ──────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  present:    { bg: '#E6F4F6', color: P.tealDk,   label: 'Present'    },
  absent:     { bg: '#FFEBEE', color: '#C62828',   label: 'Absent'     },
  weekend:    { bg: '#F5F5F5', color: '#9E9E9E',   label: 'Weekend'    },
  leave:      { bg: '#E3F2FD', color: '#1565C0',   label: 'Leave'      },
  late:       { bg: '#FFF3E0', color: P.brick,     label: 'Late'       },
  upcoming:   { bg: '',        color: '',           label: 'N/A'        },
  not_joined: { bg: '#F5F5F5', color: '#BDBDBD',   label: 'Not Joined' },
}

function StatusPill({ status, label }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.upcoming
  if (!s.bg) return <span className="text-xs" style={{ color: P.muted }}>N/A</span>
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {label ?? s.label}
    </span>
  )
}

function ApprovalBadge({ approvalStatus, status }) {
  if (status === 'leave')
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: '#E3F2FD', color: '#1565C0' }}>Marked Leave</span>
  if (approvalStatus === 'rejected' || status === 'absent')
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: '#FFEBEE', color: '#C62828' }}>Marked Absent</span>
  if (approvalStatus === 'approved')
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: '#E6F4F6', color: P.tealDk }}>Approved</span>
  if (approvalStatus === 'pending')
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ borderColor: P.border, color: P.muted }}>Pending</span>
  return <span className="text-xs" style={{ color: P.muted }}>N/A</span>
}

function fmtTime(t) {
  if (!t) return 'N/A'
  return t.replace(/^(\d):/, '0$1:')
}

function effectiveStart(joiningDateStr) {
  const base = { year: MODULE_START_YEAR, month: MODULE_START_MONTH }
  if (!joiningDateStr) return base
  const [jy, jm] = joiningDateStr.split('-').slice(0, 2).map(Number)
  if (jy > base.year || (jy === base.year && jm > base.month)) return { year: jy, month: jm }
  return base
}

// ── "EDITED" badge ─────────────────────────────────────────────────────────────
function EditedBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold"
      style={{ background: P.gold + '22', color: P.gold, border: `1px solid ${P.gold}55` }}>
      EDITED
    </span>
  )
}

// ── Late badge ─────────────────────────────────────────────────────────────────
function LateBadge({ minutes }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
      style={{ background: P.brick + '18', color: P.brick, border: `1px solid ${P.brick}40` }}>
      LATE +{minutes}m
    </span>
  )
}

// ── Calendar View ──────────────────────────────────────────────────────────────
function CalendarView({ calendar, year, month }) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDay    = new Date(year, month - 1, 1).getDay()

  const dayMap = {}
  calendar.forEach(row => {
    const d = parseInt(row.date.split('-')[2], 10)
    dayMap[d] = row
  })

  function cellStyle(status) {
    if (status === 'present')    return { background: '#E6F4F6', borderColor: '#B2DDE4' }
    if (status === 'absent')     return { background: '#FFEBEE', borderColor: '#FFCDD2' }
    if (status === 'leave')      return { background: '#E3F2FD', borderColor: '#BBDEFB' }
    if (status === 'weekend')    return { background: '#F5F5F5', borderColor: '#EEEEEE' }
    if (status === 'not_joined') return { background: '#F5F5F5', borderColor: '#EEEEEE' }
    return { background: P.white, borderColor: P.border }
  }

  function statusLetter(status) {
    if (status === 'present')    return <span className="text-sm font-black" style={{ color: P.teal }}>P</span>
    if (status === 'absent')     return <span className="text-sm font-black" style={{ color: '#C62828' }}>A</span>
    if (status === 'weekend')    return <span className="text-xs font-bold" style={{ color: '#9E9E9E' }}>WE</span>
    if (status === 'leave')      return <span className="text-sm font-black" style={{ color: '#1565C0' }}>L</span>
    if (status === 'not_joined') return <span className="text-[9px]" style={{ color: '#BDBDBD' }}>NJ</span>
    return <span className="text-xs" style={{ color: '#E0E0E0' }}>N/A</span>
  }

  return (
    <div className="p-4">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-xs font-bold py-1"
            style={{ color: P.muted, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
          const row    = dayMap[d]
          const status = row?.status ?? 'upcoming'
          const cs     = cellStyle(status)

          return (
            <div key={d}
              className="rounded-xl border relative flex flex-col"
              style={{ minHeight: 80, opacity: status === 'not_joined' ? 0.35 : 1, ...cs }}>

              {/* Day number + EDITED */}
              <div className="flex items-start justify-between px-1.5 pt-1.5">
                <span className="text-xs font-semibold" style={{ color: P.muted }}>{d}</span>
                {row?.manually_edited && (
                  <span className="text-[8px] font-bold px-1 rounded leading-[1.4]"
                    style={{ background: P.gold + '22', color: P.gold }}>
                    ED
                  </span>
                )}
              </div>

              {/* Status letter */}
              <div className="flex-1 flex items-center justify-center">
                {statusLetter(status)}
              </div>

              {/* Login time */}
              {row?.login_time && (
                <div className="text-center pb-0.5">
                  <span className="text-[9px] font-bold"
                    style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em', color: P.teal }}>
                    {fmtTime(row.login_time)}
                  </span>
                </div>
              )}

              {/* Late badge */}
              {row?.is_late && (
                <div className="text-center pb-1">
                  <span className="text-[8px] font-bold px-1 rounded"
                    style={{ background: P.brick + '18', color: P.brick, border: `1px solid ${P.brick}40` }}>
                    +{row.late_minutes}m
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Attendance() {
  const now      = new Date()
  const nowYear  = now.getFullYear()
  const nowMonth = now.getMonth() + 1

  const [month,       setMonth]       = useState(nowMonth)
  const [year,        setYear]        = useState(nowYear)
  const [view,        setView]        = useState('list')
  const [calendar,    setCalendar]    = useState([])
  const [summary,     setSummary]     = useState({})
  const [joiningDate, setJoiningDate] = useState(null)
  const [loading,     setLoading]     = useState(true)

  const start = useMemo(() => effectiveStart(joiningDate), [joiningDate])

  const availableYears = useMemo(() => {
    const years = []
    for (let y = start.year; y <= nowYear; y++) years.push(y)
    return years
  }, [start, nowYear])

  const availableMonths = useMemo(() => {
    const minM = year === start.year ? start.month : 1
    const maxM = year === nowYear    ? nowMonth    : 12
    const months = []
    for (let m = minM; m <= maxM; m++) months.push(m)
    return months
  }, [year, start, nowYear, nowMonth])

  useEffect(() => {
    if (!joiningDate) return
    const s = effectiveStart(joiningDate)
    const tooEarly = year < s.year || (year === s.year && month < s.month)
    const tooLate  = year > nowYear || (year === nowYear && month > nowMonth)
    if (tooEarly) { setYear(s.year); setMonth(s.month) }
    else if (tooLate) { setYear(nowYear); setMonth(nowMonth) }
  }, [joiningDate]) // eslint-disable-line

  useEffect(() => {
    const minM = year === start.year ? start.month : 1
    const maxM = year === nowYear    ? nowMonth    : 12
    if (month < minM) setMonth(minM)
    else if (month > maxM) setMonth(maxM)
  }, [year]) // eslint-disable-line

  useEffect(() => { fetchData() }, [month, year]) // eslint-disable-line

  async function fetchData() {
    setLoading(true)
    try {
      const { data } = await api.get('/attendance/my', { params: { month, year } })
      setCalendar(data.calendar ?? [])
      setSummary(data.summary ?? {})
      if (data.joining_date) setJoiningDate(data.joining_date)
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  function viewBtn(key, label, icon) {
    const isActive = view === key
    return (
      <button key={key} onClick={() => setView(key)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all"
        style={{
          background:    isActive ? `linear-gradient(135deg, ${P.navy} 0%, ${P.teal} 100%)` : 'rgba(0,0,0,0.15)',
          color:         '#fff',
          fontFamily:    "'Rajdhani', sans-serif",
          letterSpacing: '0.04em',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.15)' }}>
        <span>{icon}</span>{label}
      </button>
    )
  }

  return (
    <Layout>
      <div className="p-5 space-y-4 h-[calc(100vh-64px)] flex flex-col" style={{ background: P.bg, minHeight: '100vh' }}>

        {/* ── Header ── */}
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-black"
            style={{ color: P.navy, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
            Attendance
          </h1>
          <p className="text-sm mt-0.5" style={{ color: P.muted }}>Your monthly attendance record</p>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 shadow-sm flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${P.tealDk} 0%, ${P.teal} 100%)`, border: `1px solid ${P.tealDk}` }}>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="w-[140px]">
              <label className={labelCls} style={{ color: '#fff', fontFamily: "'Rajdhani', sans-serif" }}>Month</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectCls} style={filterSelectStyle}>
                {availableMonths.map(m => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
              </select>
            </div>
            <div className="w-[100px]">
              <label className={labelCls} style={{ color: '#fff', fontFamily: "'Rajdhani', sans-serif" }}>Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectCls} style={filterSelectStyle}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="h-8 w-px self-center" style={{ background: 'rgba(255,255,255,0.2)' }} />

            <div>
              <label className={labelCls} style={{ color: '#fff', fontFamily: "'Rajdhani', sans-serif" }}>View</label>
              <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
                {viewBtn('list',  'List',  '☰')}
                {viewBtn('chart', 'Chart', '📅')}
              </div>
            </div>
          </div>
        </div>

        {/* ── Results card ── */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0"
          style={{ border: `1px solid ${P.border}` }}>

          {/* Card header */}
          <div className="px-4 py-2 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: `1px solid ${P.border}` }}>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold" style={{ color: P.navy, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
                {MONTH_NAMES[month - 1]} {year}
              </h2>
              {!loading && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: P.teal + '15', color: P.teal }}>
                  {calendar.length} days
                </span>
              )}
            </div>

            {/* Summary pills */}
            {!loading && Object.keys(summary).length > 0 && (
              <div className="flex items-center gap-4 text-xs flex-wrap">
                {[
                  { label: 'Present',      val: summary.present,      color: P.teal    },
                  { label: 'Absent',       val: summary.absent,       color: '#C62828' },
                  { label: 'Late',         val: summary.late ?? 0,    color: P.brick   },
                  { label: 'Leaves',       val: summary.leave,        color: '#1565C0' },
                  { label: 'Weekends',     val: summary.weekend,      color: P.muted   },
                  { label: 'Working Days', val: summary.working_days, color: P.navy    },
                ].map(({ label, val, color }) => (
                  <span key={label} className="flex items-center gap-1">
                    <span className="font-black" style={{ color }}>{val ?? 0}</span>
                    <span style={{ color: P.muted }}>{label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── List View ── */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: `linear-gradient(90deg, ${P.navy} 0%, ${P.tealDk} 100%)` }}>
                    {['Date', 'Day', 'Login Time', 'Status', 'Approval'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase"
                        style={{ color: '#fff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.07em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? P.white : '#FAFCFC' }}>
                        {[1,2,3,4,5].map(c => (
                          <td key={c} className="px-4 py-2.5" style={{ borderBottom: `1px solid ${P.border}50` }}>
                            <div className="h-3 rounded animate-pulse w-3/4" style={{ background: P.border }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : calendar.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: P.muted }}>No records found.</td></tr>
                  ) : calendar.map((row, idx) => {
                    const isWeekend   = row.status === 'weekend'
                    const isUpcoming  = row.status === 'upcoming'
                    const isNotJoined = row.status === 'not_joined'
                    const isLeave     = row.status === 'leave'

                    return (
                      <tr key={row.date}
                        style={{
                          background: idx % 2 === 0 ? P.white : '#FAFCFC',
                          opacity: isWeekend || isNotJoined ? 0.45 : 1,
                          borderBottom: `1px solid ${P.border}50`,
                        }}
                        className="hover:bg-teal-50/30 transition-colors">

                        {/* Date */}
                        <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${P.border}40` }}>
                          <span className="text-sm font-semibold" style={{ color: P.text }}>
                            {row.date}
                          </span>
                        </td>

                        {/* Day */}
                        <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${P.border}40` }}>
                          <span className="text-sm font-medium"
                            style={{ color: P.muted, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.02em' }}>
                            {row.day_name}
                          </span>
                        </td>

                        {/* Login Time + EDITED */}
                        <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${P.border}40` }}>
                          <div className="flex items-center gap-1.5">
                            {row.login_time ? (
                              <span className="font-black"
                                style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.06em', fontSize: '0.85rem', color: P.teal }}>
                                {fmtTime(row.login_time)}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: P.border }}>N/A</span>
                            )}
                            {row.manually_edited && <EditedBadge />}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${P.border}40` }}>
                          {isUpcoming ? (
                            <span className="text-xs" style={{ color: P.border }}>N/A</span>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <StatusPill status={row.status} />
                              {isLeave && row.leave_reason && (
                                <span className="text-xs italic" style={{ color: P.muted }}>({row.leave_reason})</span>
                              )}
                              {row.is_late && <LateBadge minutes={row.late_minutes} />}
                            </div>
                          )}
                        </td>

                        {/* Approval */}
                        <td className="px-4 py-2.5" style={{ borderBottom: `1px solid ${P.border}40` }}>
                          {isUpcoming || isWeekend || isNotJoined ? (
                            <span className="text-xs" style={{ color: P.border }}>N/A</span>
                          ) : (
                            <ApprovalBadge approvalStatus={row.approval_status} status={row.status} />
                          )}
                        </td>

                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Chart View ── */}
          {view === 'chart' && (
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-8 h-8 border-4 rounded-full animate-spin"
                    style={{ borderColor: P.teal + '30', borderTopColor: P.teal }} />
                </div>
              ) : (
                <CalendarView calendar={calendar} year={year} month={month} />
              )}
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
