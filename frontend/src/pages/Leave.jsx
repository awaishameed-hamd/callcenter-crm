import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

// ── Palette ────────────────────────────────────────────────────────────────────
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

const LEAVE_TYPE_OPTIONS = [
  { value: 'sick',   label: 'Sick Leave'   },
  { value: 'casual', label: 'Casual Leave' },
  { value: 'annual', label: 'Annual Leave' },
  { value: 'exam',   label: 'Exam Leave'   },
  { value: 'other',  label: 'Other'        },
]

const LEAVE_TYPE_LABELS = Object.fromEntries(LEAVE_TYPE_OPTIONS.map(o => [o.value, o.label]))

const STATUS_BADGE = {
  pending:  { bg: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1' },
  approved: { bg: '#F0FDF4', color: '#16A34A', border: 'none' },
  rejected: { bg: '#FEF2F2', color: '#DC2626', border: 'none' },
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ── Select component (no plain <select>) ──────────────────────────────────────
function StyledSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)

  return (
    <div style={{ position: 'relative', userSelect: 'none' }} onBlur={() => setOpen(false)} tabIndex={0}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 12px', borderRadius: 8,
          border: `1.5px solid ${open ? P.gold : '#CBD5E1'}`,
          background: '#fff', cursor: 'pointer', fontSize: 13,
          color: selected ? P.navy : '#94A3B8', fontFamily: '"Rajdhani", sans-serif', fontWeight: 600,
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.15s', color: P.muted }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: '#fff', border: `1.5px solid ${P.gold}`,
          borderRadius: 8, marginTop: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          {options.map(o => (
            <div
              key={o.value}
              onMouseDown={() => { onChange(o.value); setOpen(false) }}
              style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                fontFamily: '"Rajdhani", sans-serif', fontWeight: 600,
                color: o.value === value ? P.teal : P.navy,
                background: o.value === value ? 'rgba(30,132,150,0.08)' : 'transparent',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,132,150,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = o.value === value ? 'rgba(30,132,150,0.08)' : 'transparent' }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, fill, border }) {
  return (
    <div style={{ flex: 1, minWidth: 100, background: fill, border: `1px solid ${border}30`, borderRadius: 10, padding: '11px 14px' }}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: P.navy, fontFamily: '"Rajdhani", sans-serif' }}>{value}</p>
      <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, fontFamily: "'Ethnocentric Rg', sans-serif", color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', top: 18, right: 22, zIndex: 9999,
      padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13,
      background: toast.ok ? '#16A34A' : '#DC2626', color: '#fff',
      boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
    }}>
      {toast.msg}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
      borderRadius: 9999, fontSize: 11, fontWeight: 700,
      fontFamily: '"Rajdhani", sans-serif', textTransform: 'capitalize',
      background: s.bg, color: s.color, border: s.border,
    }}>
      {status}
    </span>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────
function Table({ columns, rows, loading, emptyText }) {
  const thStyle = {
    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    fontFamily: "'Ethnocentric Rg', sans-serif", textTransform: 'uppercase',
    letterSpacing: '0.06em', color: P.navy, background: P.gold,
    borderRight: '1px solid rgba(255,255,255,0.3)', whiteSpace: 'nowrap',
  }
  const tdStyle = {
    padding: '7px 12px', fontSize: 13, color: P.text,
    fontFamily: '"Rajdhani", sans-serif', fontWeight: 500,
    borderBottom: `1px solid ${P.border}`,
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: P.muted, fontSize: 13 }}>Loading…</div>
  )
  if (!rows.length) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: P.muted, fontSize: 13 }}>{emptyText}</div>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={{ ...thStyle, width: c.width }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i}
              style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,132,150,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F9FAFB' }}
            >
              {columns.map(c => (
                <td key={c.key} style={tdStyle}>
                  {c.render ? c.render(row, i) : (row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Leave() {
  const { user, role } = useAuth()
  const isManager = ['manager', 'director', 'admin'].includes(role)

  const [leaves,   setLeaves]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState(null)
  const [rejectModal, setRejectModal] = useState(null) // { id }
  const [rejectReason, setRejectReason] = useState('')
  const [form,     setForm]     = useState({
    leave_type: 'sick',
    from_date:  todayStr(),
    to_date:    todayStr(),
    reason:     '',
  })

  const fetchLeaves = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = isManager ? '/leaves' : '/leaves/my'
      const { data } = await api.get(endpoint)
      setLeaves(data.data ?? [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [isManager])

  useEffect(() => { fetchLeaves() }, [fetchLeaves])

  function showToast(msg, ok) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.reason.trim()) { showToast('Please enter a reason', false); return }
    setSaving(true)
    try {
      await api.post('/leaves', form)
      showToast('Leave application submitted!', true)
      setShowForm(false)
      setForm({ leave_type: 'sick', from_date: todayStr(), to_date: todayStr(), reason: '' })
      fetchLeaves()
    } catch (err) {
      showToast(err?.response?.data?.message ?? 'Failed to submit', false)
    } finally { setSaving(false) }
  }

  async function handleApprove(id) {
    try {
      await api.post(`/leaves/${id}/approve`)
      showToast('Leave approved', true)
      fetchLeaves()
    } catch { showToast('Failed to approve', false) }
  }

  async function openReject(id) {
    setRejectModal({ id })
    setRejectReason('')
  }

  async function handleReject() {
    if (!rejectReason.trim()) { showToast('Enter a rejection reason', false); return }
    try {
      await api.post(`/leaves/${rejectModal.id}/reject`, { rejection_reason: rejectReason })
      showToast('Leave rejected', true)
      setRejectModal(null)
      fetchLeaves()
    } catch { showToast('Failed to reject', false) }
  }

  // Stats
  const myLeaves = isManager ? leaves.filter(l => l.user_id === user?.id) : leaves
  const allForStats = isManager ? leaves : leaves
  const stats = {
    total:    allForStats.length,
    pending:  allForStats.filter(l => l.status === 'pending').length,
    approved: allForStats.filter(l => l.status === 'approved').length,
    rejected: allForStats.filter(l => l.status === 'rejected').length,
  }

  const STAT_CARDS = [
    { label: 'Total',    value: stats.total,    fill: '#A5D8DD', border: '#0891B2' },
    { label: 'Pending',  value: stats.pending,  fill: '#BDDAF8', border: '#1565C0' },
    { label: 'Approved', value: stats.approved, fill: '#BBF0D6', border: '#16A34A' },
    { label: 'Rejected', value: stats.rejected, fill: '#FECACA', border: '#DC2626' },
  ]

  const agentColumns = [
    { key: 'n',       label: '#',       width: 48, render: (_r, i) => i + 1 },
    { key: 'leave_type', label: 'Type', width: 120, render: r => LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type },
    { key: 'from_date',  label: 'From', width: 100, render: r => r.from_date?.split('T')[0] ?? r.from_date ?? '' },
    { key: 'to_date',    label: 'To',   width: 100, render: r => r.to_date?.split('T')[0] ?? r.to_date ?? '' },
    { key: 'days',    label: 'Days',    width: 60  },
    { key: 'reason',  label: 'Reason',  width: 200 },
    { key: 'status',  label: 'Status',  width: 110, render: r => <StatusBadge status={r.status} /> },
    { key: 'reviewer', label: 'Reviewed By', width: 160,
      render: r => r.reviewed_by ? `${r.reviewed_by.display_name} (${r.reviewed_by.role})` : 'Pending' },
    { key: 'rejection_reason', label: 'Rejection Reason', width: 180,
      render: r => <span style={{ color: '#DC2626', fontSize: 12 }}>{r.rejection_reason ?? ''}</span> },
  ]

  const managerColumns = [
    { key: 'n',       label: '#',       width: 48, render: (_r, i) => i + 1 },
    { key: 'agent',   label: 'Staff',   width: 150,
      render: r => r.user ? `${r.user.display_name} (${r.user.role})` : '' },
    { key: 'leave_type', label: 'Type', width: 120, render: r => LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type },
    { key: 'from_date',  label: 'From', width: 100, render: r => r.from_date?.split('T')[0] ?? r.from_date ?? '' },
    { key: 'to_date',    label: 'To',   width: 100, render: r => r.to_date?.split('T')[0] ?? r.to_date ?? '' },
    { key: 'days',    label: 'Days',    width: 60  },
    { key: 'reason',  label: 'Reason',  width: 180 },
    { key: 'status',  label: 'Status',  width: 110, render: r => <StatusBadge status={r.status} /> },
    { key: 'actions', label: 'Actions', width: 160,
      render: r => r.status === 'pending' ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => handleApprove(r.id)}
            style={{ padding: '3px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: '#16A34A', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: '"Rajdhani", sans-serif' }}
          >Approve</button>
          <button
            onClick={() => openReject(r.id)}
            style={{ padding: '3px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: '#DC2626', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: '"Rajdhani", sans-serif' }}
          >Reject</button>
        </div>
      ) : <span style={{ color: P.muted, fontSize: 12 }}>{r.reviewed_by?.display_name ?? ''}</span>
    },
    { key: 'rejection_reason', label: 'Rejection Reason', width: 170,
      render: r => <span style={{ color: '#DC2626', fontSize: 12 }}>{r.rejection_reason ?? ''}</span> },
  ]

  return (
    <Layout>
      <Toast toast={toast} />

      <div style={{ padding: '0 20px 20px', minHeight: '100vh', background: P.bg }}>

        {/* Header */}
        <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginBottom: 8 }}>
          <h1 style={{
            margin: 0, fontFamily: "'Bebas Neue', cursive",
            fontSize: 28, letterSpacing: '0.06em',
            background: `linear-gradient(135deg, ${P.teal} 0%, ${P.navy} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {isManager ? 'Leave Management' : 'My Leaves'}
          </h1>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: P.teal, color: '#fff',
              fontSize: 13, fontWeight: 700, fontFamily: '"Rajdhani", sans-serif',
              letterSpacing: '0.04em',
            }}
          >
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Apply for Leave
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {STAT_CARDS.map(c => <StatCard key={c.label} {...c} />)}
        </div>

        {/* Table card */}
        <div style={{ background: P.white, borderRadius: 10, border: `1px solid ${P.border}`, overflow: 'hidden' }}>
          <Table
            columns={isManager ? managerColumns : agentColumns}
            rows={leaves}
            loading={loading}
            emptyText='No leave applications yet. Click "Apply for Leave" to submit one.'
          />
        </div>

      </div>

      {/* Apply Leave Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontFamily: "'Bebas Neue', cursive", fontSize: 26,
                letterSpacing: '0.06em', color: P.teal }}>
                Apply for Leave
              </h2>
              <button onClick={() => setShowForm(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#64748B' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#64748B', marginBottom: 5 }}>Leave Type</label>
                <StyledSelect
                  value={form.leave_type}
                  onChange={val => setForm(f => ({ ...f, leave_type: val }))}
                  options={LEAVE_TYPE_OPTIONS}
                  placeholder="Select leave type..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: '#64748B', marginBottom: 5 }}>From Date</label>
                  <input type="date" value={form.from_date}
                    onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                      fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: '"Rajdhani", sans-serif' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: '#64748B', marginBottom: 5 }}>To Date</label>
                  <input type="date" value={form.to_date}
                    onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                      fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: '"Rajdhani", sans-serif' }} />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#64748B', marginBottom: 5 }}>Reason</label>
                <textarea
                  rows={3}
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Enter reason for leave..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                    fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    fontFamily: '"Rajdhani", sans-serif', color: P.navy }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '9px 20px', borderRadius: 8, border: `1.5px solid ${P.border}`,
                    background: 'transparent', color: P.muted, cursor: 'pointer',
                    fontFamily: '"Rajdhani", sans-serif', fontWeight: 700, fontSize: 13 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '9px 20px', borderRadius: 8, border: 'none',
                    background: saving ? '#94A3B8' : P.teal, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                    fontFamily: '"Rajdhani", sans-serif', fontWeight: 700, fontSize: 13 }}>
                  {saving ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 440,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h2 style={{ margin: '0 0 16px', fontFamily: "'Bebas Neue', cursive", fontSize: 24,
              letterSpacing: '0.06em', color: '#DC2626' }}>Reject Leave</h2>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: '#64748B', marginBottom: 5 }}>Rejection Reason</label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              autoFocus
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                fontFamily: '"Rajdhani", sans-serif', color: P.navy, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectModal(null)}
                style={{ padding: '9px 20px', borderRadius: 8, border: `1.5px solid ${P.border}`,
                  background: 'transparent', color: P.muted, cursor: 'pointer',
                  fontFamily: '"Rajdhani", sans-serif', fontWeight: 700, fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={handleReject}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: '#DC2626', color: '#fff', cursor: 'pointer',
                  fontFamily: '"Rajdhani", sans-serif', fontWeight: 700, fontSize: 13 }}>
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
