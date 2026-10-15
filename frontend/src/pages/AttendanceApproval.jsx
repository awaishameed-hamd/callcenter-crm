import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import TimePicker from '../components/TimePicker'
import DateInput from '../components/DateInput'
import api from '../api/axios'

// ── Shared style constants (matching Reports.jsx) ─────────────────────────────
const labelCls          = 'block text-xs font-bold uppercase tracking-widest mb-0.5'
const selectCls         = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition cursor-pointer'
const inputCls          = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition'
const filterSelectStyle = { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }
const filterInputStyle  = { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }

const STATUS_TABS = [
  { key: 'all',      label: 'All'      },
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

const APPROVAL_BADGE = {
  pending:  'border border-gray-300 text-gray-500',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}
const APPROVAL_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, colorCls }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm flex-1 min-w-[120px]">
      <div className={`text-2xl font-bold ${colorCls}`}>{value ?? 0}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}

// ── Inline Edit Time ──────────────────────────────────────────────────────────
function EditTimeCell({ rec, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)

  async function save(newVal) {
    setSaving(true)
    try {
      await api.patch(`/attendance/${rec.id}/edit-time`, { time: newVal })
      onSaved(rec.id, newVal)
      setEditing(false)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  if (editing) {
    return (
      <div className="py-0.5">
        {saving ? (
          <span className="text-xs text-gray-400">Saving…</span>
        ) : (
          <TimePicker
            value={rec.login_time}
            onConfirm={save}
            onCancel={() => setEditing(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-700" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.82rem', letterSpacing: '0.04em' }}>
        {rec.login_time ?? 'N/A'}
      </span>
      {rec.approval_status === 'pending' && (
        <button onClick={() => setEditing(true)}
          className="px-2 py-0.5 rounded border border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
          Edit
        </button>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AttendanceApproval() {
  const [date,    setDate]    = useState(todayStr)
  const [status,  setStatus]  = useState('all')
  const [search,  setSearch]  = useState('')
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null) // { id, action, display_name }
  const [acting,  setActing]  = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/attendance/approval', {
        params: { date, status: status === 'all' ? undefined : status, search: search || undefined }
      })
      setRecords(data.records ?? [])
      setSummary(data.summary ?? {})
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [date, status, search])

  useEffect(() => { fetchData() }, [fetchData])

  async function doAction() {
    if (!confirm) return
    setActing(true)
    try {
      await api.patch(`/attendance/${confirm.id}/${confirm.action}`)
      setConfirm(null)
      fetchData()
    } catch { setConfirm(null) } finally { setActing(false) }
  }

  function onTimeSaved(id, newTime) {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, login_time: newTime } : r))
  }

  return (
    <Layout>
      <div className="p-5 space-y-4 h-[calc(100vh-64px)] flex flex-col" style={{ background: '#EDF0F3', minHeight: '100vh' }}>

        {/* ── Header ── */}
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-black" style={{ color: '#132E57', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>Attendance Approval</h1>
          <p className="text-sm mt-0.5" style={{ color: '#5C5C5C' }}>Review and approve employee attendance records</p>
        </div>

        {/* ── Stat cards ── */}
        <div className="flex gap-3 flex-shrink-0">
          <StatCard label="Total Present" value={summary.total}    colorCls="text-gray-800"   />
          <StatCard label="Pending"       value={summary.pending}  colorCls="text-amber-600"  />
          <StatCard label="Late"          value={summary.late}     colorCls="text-orange-600" />
          <StatCard label="Approved"      value={summary.approved} colorCls="text-emerald-600"/>
          <StatCard label="Rejected"      value={summary.rejected} colorCls="text-red-600"    />
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 shadow-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0E5F6E 0%, #1E8496 100%)', border: '1px solid #1A7888' }}>
          <div className="flex items-end gap-2.5 flex-wrap">
            {/* Date */}
            <div className="w-[150px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>Date</label>
              <DateInput value={date} onChange={e => setDate(e.target.value)}
                min="2026-05-01"
                className={inputCls} style={filterInputStyle} />
            </div>

            {/* Search */}
            <div className="w-[200px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>Search</label>
              <input type="text" placeholder="Name or username…" value={search}
                onChange={e => setSearch(e.target.value)} className={inputCls} style={filterInputStyle} />
            </div>

            {/* Status tabs */}
            <div>
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}>Status</label>
              <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
                {STATUS_TABS.map(({ key, label }) => (
                  <button key={key} type="button" onClick={() => setStatus(key)}
                    className="px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all"
                    style={{
                      fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em', border: 'none', cursor: 'pointer',
                      background: status === key ? 'linear-gradient(135deg, #132E57 0%, #1E8496 100%)' : 'transparent',
                      color:      '#FFFFFF',
                    }}
                    onMouseEnter={e => { if (status !== key) { e.currentTarget.style.background='rgba(255,255,255,0.15)' }}}
                    onMouseLeave={e => { if (status !== key) { e.currentTarget.style.background='transparent' }}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

          {/* Results header */}
          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2.5 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Results</h2>
            {!loading && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {records.length} record{records.length !== 1 ? 's' : ''} for {date}
              </span>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-separate border-spacing-0" style={{ minWidth: 800 }}>
              <thead className="sticky top-0 z-10">
                <tr style={{ background: 'linear-gradient(90deg, #4A5568 0%, #5A6880 100%)', borderBottom: '2px solid #3A4558' }}>
                  {['User ID','Name','Role','Designation','Date','Login Time','Late','Status','Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase whitespace-nowrap"
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
                      {Array.from({ length: 9 }).map((_, c) => (
                        <td key={c} className="px-4 py-2.5 border-b border-gray-50">
                          <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : records.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No attendance records for this date.
                  </td></tr>
                ) : records.map((rec, idx) => {
                  const isPending = rec.approval_status === 'pending'
                  const roleBadge = rec.role === 'manager'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-cyan-100 text-cyan-700'

                  return (
                    <tr key={rec.id}
                      className={`hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      {/* User ID */}
                      <td className="px-4 py-2 border-b border-gray-50">
                        <span className="font-mono text-xs font-bold text-gray-700">{rec.username}</span>
                      </td>
                      {/* Name */}
                      <td className="px-4 py-2 border-b border-gray-50">
                        <span className="font-medium text-gray-800">{rec.display_name}</span>
                      </td>
                      {/* Role */}
                      <td className="px-4 py-2 border-b border-gray-50">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${roleBadge}`}>
                          {rec.role}
                        </span>
                      </td>
                      {/* Designation */}
                      <td className="px-4 py-2 border-b border-gray-50">
                        <span className="text-xs text-gray-500">{rec.agent_type ?? rec.manager_type ?? 'N/A'}</span>
                      </td>
                      {/* Date */}
                      <td className="px-4 py-2 border-b border-gray-50">
                        <span className="text-xs text-gray-500 whitespace-nowrap">{rec.date}</span>
                      </td>
                      {/* Login Time */}
                      <td className="px-4 py-2 border-b border-gray-50">
                        <EditTimeCell rec={rec} onSaved={onTimeSaved} />
                      </td>
                      {/* Late */}
                      <td className="px-4 py-2 border-b border-gray-50">
                        {rec.is_late ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                            style={{ background: 'rgba(73,49,30,0.1)', color: '#49311E', border: '1px solid #AA7F56' }}>
                            +{rec.late_minutes}m
                          </span>
                        ) : <span className="text-xs text-gray-300">N/A</span>}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-2 border-b border-gray-50">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${APPROVAL_BADGE[rec.approval_status] ?? ''}`}>
                          {APPROVAL_LABEL[rec.approval_status] ?? rec.approval_status}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-2 border-b border-gray-50">
                        {isPending ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setConfirm({ id: rec.id, action: 'approve', display_name: rec.display_name })}
                              className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors">
                              Approve
                            </button>
                            <button
                              onClick={() => setConfirm({ id: rec.id, action: 'reject', display_name: rec.display_name })}
                              className="px-3 py-1 rounded-lg bg-red-100 text-red-700 border border-red-200 text-xs font-semibold hover:bg-red-200 transition-colors">
                              Mark Absent
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Confirm dialog ── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !acting && setConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center border border-gray-200">
            <div className="text-4xl mb-3">{confirm.action === 'approve' ? '✅' : '🚫'}</div>
            <h3 className="text-base font-bold text-gray-800 mb-2">
              {confirm.action === 'approve' ? 'Approve Attendance' : 'Mark as Absent'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {confirm.action === 'approve'
                ? `Approve attendance for ${confirm.display_name}?`
                : `Mark ${confirm.display_name} as absent and reject their attendance?`}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirm(null)} disabled={acting}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={doAction} disabled={acting}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                  confirm.action === 'approve'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}>
                {acting ? 'Processing…' : confirm.action === 'approve' ? 'Approve' : 'Mark Absent'}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  )
}
