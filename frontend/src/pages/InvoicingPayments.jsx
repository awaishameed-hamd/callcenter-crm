import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import Toast from '../components/Toast'
import DateInput from '../components/DateInput'
import api from '../api/axios'

// ── Palette ───────────────────────────────────────────────────────────────────
const P = {
  navy:    '#132E57',
  navyDk:  '#0C1E3A',
  teal:    '#1E8496',
  tealDk:  '#0E5F6E',
  gold:    '#D7A520',
  goldDk:  '#B8900F',
  orange:  '#C25A1F',
  green:   '#3A6B3A',
  gray:    '#5C5C5C',
  bg:      '#EDF0F3',
}

const pkr = (n) =>
  'PKR ' + (+(n ?? 0)).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  pending: { bg: '#FEF3C7', color: '#92400E', border: '#F59E0B' },
  sent:    { bg: '#DBEAFE', color: '#1D4ED8', border: '#3B82F6' },
  overdue: { bg: '#FEE2E2', color: '#991B1B', border: '#EF4444' },
  paid:    { bg: '#D1FAE5', color: '#065F46', border: '#10B981' },
}
function StatusPill({ status }) {
  const s = STATUS_BADGE[status] ?? { bg: '#F3F4F6', color: '#374151', border: '#9CA3AF' }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {status}
    </span>
  )
}

const PERIODS = [
  { key: 'today', label: 'Today'     },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month'},
  { key: 'all',   label: 'All Time'  },
  { key: 'custom',label: 'Custom'    },
]

// ── Single compact revenue table ──────────────────────────────────────────────
function RevenueTable({ title, accent, rows, loading }) {
  const total = { expected: 0, confirmed: 0, invoice: 0 }
  rows.forEach(r => { total.expected += r.expected ?? 0; total.confirmed += r.confirmed ?? 0; total.invoice += r.invoice ?? 0 })

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Section header */}
      <div className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${accent.from} 0%, ${accent.to} 100%)`, borderBottom: `1px solid ${accent.border}` }}>
        <span className="text-sm font-black text-white" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.06em' }}>
          {title}
        </span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
          {loading ? '…' : `${rows.length} rows`}
        </span>
      </div>

      {/* Column sub-headers */}
      <div className="grid grid-cols-4 gap-0 border-b border-gray-100"
        style={{ background: 'rgba(19,46,87,0.04)' }}>
        {['Name', 'Expected', 'Confirmed', 'Invoiced'].map((h, i) => (
          <div key={h} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${i === 0 ? 'col-span-1' : ''}`}
            style={{ color: P.navy, opacity: 0.55, fontFamily: "'Rajdhani',sans-serif" }}>
            {h}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 320 }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`grid grid-cols-4 gap-0 px-3 py-2 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
              {[1,2,3,4].map(c => <div key={c} className="h-3 bg-gray-100 rounded animate-pulse w-4/5" />)}
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">No data for this period.</div>
        ) : rows.map((row, i) => (
          <div key={i}
            className={`grid grid-cols-4 gap-0 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
            <div className="px-3 py-2 border-b border-gray-50 min-w-0">
              <div className="text-xs font-semibold text-gray-800 truncate">{row.label}</div>
            </div>
            <div className="px-3 py-2 border-b border-gray-50 flex items-center">
              <span className="text-xs font-bold" style={{ color: P.orange }}>{pkr(row.expected)}</span>
            </div>
            <div className="px-3 py-2 border-b border-gray-50 flex items-center">
              <span className="text-xs font-bold" style={{ color: P.teal }}>{pkr(row.confirmed)}</span>
            </div>
            <div className="px-3 py-2 border-b border-gray-50 flex items-center">
              <span className="text-xs font-bold" style={{ color: P.green }}>{pkr(row.invoice)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer totals */}
      {rows.length > 0 && !loading && (
        <div className="grid grid-cols-4 gap-0 border-t-2 flex-shrink-0"
          style={{ borderColor: accent.from, background: 'rgba(19,46,87,0.04)' }}>
          <div className="px-3 py-2 text-xs font-black uppercase tracking-wide" style={{ color: P.navy }}>Total</div>
          {[total.expected, total.confirmed, total.invoice].map((v, ci) => (
            <div key={ci} className="px-3 py-2 flex items-center">
              <span className="text-xs font-black" style={{ color: [P.orange, P.teal, P.green][ci] }}>{pkr(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab 1: Revenue Reports (all 3 on one page) ────────────────────────────────
function RevenueTab() {
  const [period,   setPeriod]   = useState('month')
  const [fromDate, setFromDate] = useState('')
  const [toDate,   setToDate]   = useState('')
  const [clientRows,   setClientRows]   = useState([])
  const [agentRows,    setAgentRows]    = useState([])
  const [verticalRows, setVerticalRows] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    if (period === 'custom' && (!fromDate || !toDate)) return
    setLoading(true)
    try {
      const base = { period, from_date: fromDate || undefined, to_date: toDate || undefined }
      const [c, a, v] = await Promise.all([
        api.get('/admin/invoicing/revenue-report', { params: { ...base, type: 'client'   } }),
        api.get('/admin/invoicing/revenue-report', { params: { ...base, type: 'agent'    } }),
        api.get('/admin/invoicing/revenue-report', { params: { ...base, type: 'vertical' } }),
      ])
      setClientRows(c.data.rows ?? [])
      setAgentRows(a.data.rows ?? [])
      setVerticalRows(v.data.rows ?? [])
    } catch {
      setClientRows([]); setAgentRows([]); setVerticalRows([])
    } finally { setLoading(false) }
  }, [period, fromDate, toDate])

  useEffect(() => { fetchAll() }, [fetchAll])

  const TABLE_CONFIG = [
    { key: 'client',   title: 'Client-wise Revenue',   accent: { from: '#3D4A5C', to: '#4A5568', border: '#2D3748' } },
    { key: 'agent',    title: 'Agent-wise Revenue',    accent: { from: '#3D4A5C', to: '#4A5568', border: '#2D3748' } },
    { key: 'vertical', title: 'Vertical-wise Revenue', accent: { from: '#3D4A5C', to: '#4A5568', border: '#2D3748' } },
  ]
  const tableData = { client: clientRows, agent: agentRows, vertical: verticalRows }

  return (
    <div className="space-y-4">
      {/* ── Single filter bar — teal style matching My Team page ── */}
      <div className="rounded-xl px-5 py-2.5 shadow-sm flex flex-wrap items-center gap-3"
        style={{ background: `linear-gradient(135deg, ${P.tealDk} 0%, ${P.teal} 100%)`, border: `1px solid #0A4A58` }}>

        <span className="text-xs font-black text-white uppercase tracking-widest flex-shrink-0"
          style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.1em' }}>
          Period
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
              style={period === p.key
                ? { background: '#EB9A60', color: '#fff' }
                : { background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <DateInput value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="rounded-lg px-2.5 py-1 text-xs outline-none"
              style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }} />
            <span className="text-xs text-white/60 font-bold">→</span>
            <DateInput value={toDate} onChange={e => setToDate(e.target.value)}
              className="rounded-lg px-2.5 py-1 text-xs outline-none"
              style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }} />
          </div>
        )}

        {loading && (
          <div className="ml-auto flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-xs text-white/60">Loading…</span>
          </div>
        )}
      </div>

      {/* ── Row 1: Client (left) | Agent (right) ── */}
      <div className="grid grid-cols-2 gap-4">
        <RevenueTable title={TABLE_CONFIG[0].title} accent={TABLE_CONFIG[0].accent} rows={clientRows} loading={loading} />
        <RevenueTable title={TABLE_CONFIG[1].title} accent={TABLE_CONFIG[1].accent} rows={agentRows}  loading={loading} />
      </div>

      {/* ── Row 2: Vertical (left half) | right half free for future ── */}
      <div className="grid grid-cols-2 gap-4">
        <RevenueTable title={TABLE_CONFIG[2].title} accent={TABLE_CONFIG[2].accent} rows={verticalRows} loading={loading} />
        {/* right half intentionally empty — add next report here */}
        <div />
      </div>
    </div>
  )
}

// ── Create Invoice Modal ──────────────────────────────────────────────────────
function CreateInvoiceModal({ pending, onClose, onCreated }) {
  const [discount,   setDiscount]   = useState('')
  const [adjustment, setAdjustment] = useState('')
  const [dueDate,    setDueDate]    = useState('')
  const [notes,      setNotes]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const subtotal = pending.subtotal ?? 0
  const disc     = parseFloat(discount)   || 0
  const adj      = parseFloat(adjustment) || 0
  const total    = subtotal - disc + adj

  async function handleCreate() {
    if (!dueDate) { setError('Payment receipt date is required.'); return }
    setSaving(true); setError('')
    try {
      await api.post('/admin/invoicing/create-invoice', {
        client_id:            pending.client_id,
        period_start:         pending.period_start,
        period_end:           pending.period_end,
        discount:             disc   || null,
        adjustment:           adj    || null,
        payment_receipt_date: dueDate,
        notes:                notes  || null,
      })
      onCreated()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to create invoice.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-gray-100">
        <div className="px-6 py-4 flex items-start justify-between"
          style={{ background: `linear-gradient(135deg, ${P.tealDk} 0%, ${P.teal} 100%)`, borderBottom: `1px solid ${P.tealDk}` }}>
          <div>
            <h2 className="text-base font-bold text-white" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.05em' }}>
              Create Invoice
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {pending.company_name} · {pending.period_start} → {pending.period_end}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(30,132,150,0.06)', border: '1px solid rgba(30,132,150,0.2)' }}>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Sales in period</span>
              <span className="font-bold text-gray-700">{pending.sales_count} records</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-bold" style={{ color: P.teal }}>{pkr(subtotal)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Discount (PKR)</label>
              <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)}
                placeholder="0.00" className="w-full rounded-lg px-2.5 py-1.5 text-xs border border-gray-200 outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Adjustment (PKR)</label>
              <input type="number" value={adjustment} onChange={e => setAdjustment(e.target.value)}
                placeholder="0.00" className="w-full rounded-lg px-2.5 py-1.5 text-xs border border-gray-200 outline-none focus:border-teal-400" />
            </div>
          </div>
          <div className="rounded-xl px-4 py-3 flex justify-between items-center" style={{ background: P.navy }}>
            <span className="text-sm font-bold text-white/70">Total Amount</span>
            <span className="text-lg font-black" style={{ color: P.gold, fontFamily: "'Rajdhani',sans-serif" }}>{pkr(total)}</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Receipt Date <span className="text-red-500">*</span></label>
            <DateInput value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full rounded-lg px-2.5 py-1.5 text-xs border border-gray-200 outline-none focus:border-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any additional notes…"
              className="w-full rounded-lg px-2.5 py-1.5 text-xs border border-gray-200 outline-none focus:border-teal-400 resize-none" />
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={saving}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${P.tealDk}, ${P.teal})` }}>
            {saving ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Mark Received Modal ───────────────────────────────────────────────────────
function MarkReceivedModal({ invoice, onClose, onSaved }) {
  const [date,   setDate]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    if (!date) { setError('Payment received date is required.'); return }
    setSaving(true); setError('')
    try {
      await api.post(`/admin/invoicing/mark-received/${invoice.id}`, { payment_received_date: date })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to update invoice.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden border border-gray-100">
        <div className="px-6 py-4"
          style={{ background: `linear-gradient(135deg, ${P.green} 0%, #4A8A4A 100%)`, borderBottom: '1px solid #2E5A2E' }}>
          <h2 className="text-base font-bold text-white" style={{ fontFamily: "'Rajdhani',sans-serif" }}>Mark as Received</h2>
          <p className="text-xs mt-0.5 text-white/70">{invoice.invoice_number} · {pkr(invoice.total_amount)}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Payment Received Date <span className="text-red-500">*</span>
            </label>
            <DateInput value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg px-2.5 py-1.5 text-xs border border-gray-200 outline-none focus:border-green-400" />
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50"
            style={{ background: P.green }}>
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Pending Invoices ─────────────────────────────────────────────────────
function PendingInvoicesTab({ setToast }) {
  const [pending,     setPending]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [createModal, setCreateModal] = useState(null)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get('/admin/invoicing/pending-invoices'); setPending(data.pending ?? []) }
    catch { setPending([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  return (
    <div className="space-y-4">
      {/* Teal filter-style header */}
      <div className="rounded-xl px-5 py-2.5 flex items-center justify-between shadow-sm"
        style={{ background: `linear-gradient(135deg, ${P.tealDk} 0%, ${P.teal} 100%)`, border: '1px solid #0A4A58' }}>
        <span className="text-xs font-black text-white uppercase tracking-widest" style={{ fontFamily: "'Rajdhani',sans-serif" }}>
          Create Invoice
        </span>
        {!loading && (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: pending.length > 0 ? P.gold : 'rgba(255,255,255,0.2)', color: '#fff' }}>
            {pending.length} pending
          </span>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-teal-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading…</span>
        </div>
      ) : pending.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-sm font-semibold text-gray-500">All billing periods are invoiced.</p>
          <p className="text-xs text-gray-400 mt-1">New pending invoices will appear here automatically.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((p, i) => (
            <div key={i} className="bg-white rounded-xl border shadow-sm overflow-hidden"
              style={{ borderColor: 'rgba(215,165,32,0.3)' }}>
              {/* Card header */}
              <div className="px-4 py-3 flex items-start justify-between"
                style={{ background: 'rgba(215,165,32,0.07)', borderBottom: '1px solid rgba(215,165,32,0.2)' }}>
                <div className="min-w-0">
                  <p className="font-black text-sm truncate" style={{ color: P.navy, fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.03em' }}>
                    {p.company_name}
                  </p>
                  <p className="text-xs font-mono text-gray-400">{p.did_code}</p>
                </div>
                <span className="ml-2 flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: P.teal, color: '#fff' }}>
                  {p.sales_count} sales
                </span>
              </div>
              {/* Card body */}
              <div className="px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Billing Period</span>
                  <span className="font-semibold text-gray-700">{p.period_start} → {p.period_end}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Cycle</span>
                  <span className="font-semibold text-gray-600">{p.cycle_days} days</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-100">
                  <span className="text-gray-400 font-semibold">Subtotal</span>
                  <span className="text-base font-black" style={{ color: P.navy, fontFamily: "'Rajdhani',sans-serif" }}>
                    {pkr(p.subtotal)}
                  </span>
                </div>
              </div>
              {/* Action */}
              <div className="px-4 pb-4">
                <button onClick={() => setCreateModal(p)}
                  className="w-full py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${P.tealDk}, ${P.teal})` }}>
                  Create Invoice
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {createModal && (
        <CreateInvoiceModal pending={createModal} onClose={() => setCreateModal(null)}
          onCreated={() => {
            setCreateModal(null)
            setToast({ message: 'Invoice created successfully.', type: 'success' })
            fetchPending()
          }} />
      )}
    </div>
  )
}

// ── Tab: Invoices ─────────────────────────────────────────────────────────────
function InvoicesTab({ setToast }) {
  const [invoices,      setInvoices]      = useState([])
  const [loadingI,      setLoadingI]      = useState(true)
  const [statusFilter,  setStatusFilter]  = useState('pending')
  const [period,        setPeriod]        = useState('today')
  const [fromDate,      setFromDate]      = useState('')
  const [toDate,        setToDate]        = useState('')
  const [receivedModal, setReceivedModal] = useState(null)

  const fetchInvoices = useCallback(async () => {
    setLoadingI(true)
    try {
      const { data } = await api.get('/admin/invoicing/invoices', {
        params: { status: statusFilter, period, from_date: fromDate || undefined, to_date: toDate || undefined },
      })
      setInvoices(data.invoices ?? [])
    } catch { setInvoices([]) } finally { setLoadingI(false) }
  }, [statusFilter, period, fromDate, toDate])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  async function handleMarkSent(inv) {
    try {
      await api.post(`/admin/invoicing/mark-sent/${inv.id}`)
      setToast({ message: `${inv.invoice_number} marked as sent.`, type: 'success' })
      fetchInvoices()
    } catch (err) {
      setToast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' })
    }
  }

  const STATUS_FILTERS = ['pending', 'sent', 'overdue', 'paid', 'all']

  return (
    <div className="space-y-4">
      {/* ── Single teal filter bar — status + period on one line ── */}
      <div className="rounded-xl px-5 py-2.5 shadow-sm flex flex-wrap items-center gap-3"
        style={{ background: `linear-gradient(135deg, ${P.tealDk} 0%, ${P.teal} 100%)`, border: '1px solid #0A4A58' }}>

        {/* Status pills */}
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all"
              style={statusFilter === s
                ? { background: '#EB9A60', color: '#fff' }
                : { background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)' }}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-5 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.25)' }} />

        {/* Period pills */}
        <div className="flex items-center gap-1.5">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
              style={period === p.key
                ? { background: '#EB9A60', color: '#fff' }
                : { background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <DateInput value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="rounded-lg px-2.5 py-1 text-xs outline-none"
              style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }} />
            <span className="text-xs text-white/60 font-bold">→</span>
            <DateInput value={toDate} onChange={e => setToDate(e.target.value)}
              className="rounded-lg px-2.5 py-1 text-xs outline-none"
              style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }} />
          </div>
        )}

        <span className="ml-auto text-xs font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Invoice list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0" style={{ minWidth: 820 }}>
            <thead>
              <tr style={{ background: 'linear-gradient(90deg, #3D4A5C 0%, #4A5568 100%)' }}>
                {['Invoice #','Client','Billing Period','Subtotal','Discount','Other Adjustment','Total','Status','Due Date','Actions'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase whitespace-nowrap"
                    style={{ color: '#fff', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.06em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingI ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    {Array.from({ length: 9 }).map((__, c) => (
                      <td key={c} className="px-3 py-2.5 border-b border-gray-50">
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">No invoices found.</td></tr>
              ) : invoices.map((inv, i) => (
                <tr key={inv.id} className={`hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <td className="px-3 py-2.5 border-b border-gray-50">
                    <span className="font-mono text-xs font-bold" style={{ color: P.navy }}>{inv.invoice_number}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gray-50">
                    <div className="text-xs font-semibold text-gray-800">{inv.company_name}</div>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gray-50">
                    <span className="text-xs text-gray-600 whitespace-nowrap">{inv.billing_period_start} → {inv.billing_period_end}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gray-50">
                    <span className="text-xs font-semibold text-gray-700">{pkr(inv.subtotal)}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gray-50">
                    <span className="text-xs text-gray-500">{pkr(inv.discount)}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gray-50">
                    <span className="text-xs text-gray-500">{pkr(inv.adjustment)}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gray-50">
                    <span className="text-xs font-black" style={{ color: P.navy }}>{pkr(inv.total_amount)}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gray-50"><StatusPill status={inv.status} /></td>
                  <td className="px-3 py-2.5 border-b border-gray-50">
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {inv.status === 'paid' ? (inv.payment_received_date ?? '—') : (inv.due_date ?? '—')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gray-50">
                    {inv.status === 'pending' && (
                      <button onClick={() => handleMarkSent(inv)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-white whitespace-nowrap"
                        style={{ background: P.teal }}>Mark Sent</button>
                    )}
                    {(inv.status === 'sent' || inv.status === 'overdue') && (
                      <button onClick={() => setReceivedModal(inv)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-white whitespace-nowrap"
                        style={{ background: P.green }}>Mark Received</button>
                    )}
                    {inv.status === 'paid' && <span className="text-xs text-gray-300">Paid</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {receivedModal && (
        <MarkReceivedModal invoice={receivedModal} onClose={() => setReceivedModal(null)}
          onSaved={() => {
            setReceivedModal(null)
            setToast({ message: 'Payment marked as received.', type: 'success' })
            fetchInvoices()
          }} />
      )}
    </div>
  )
}

// ── Tab 3: Customer Balances ──────────────────────────────────────────────────
function BalancesTab() {
  const [balances, setBalances] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.get('/admin/invoicing/customer-balances')
      .then(({ data }) => setBalances(data.balances ?? []))
      .catch(() => setBalances([]))
      .finally(() => setLoading(false))
  }, [])

  const totals = balances.reduce((acc, b) => ({
    total_confirmed: acc.total_confirmed + b.total_confirmed,
    total_invoiced:  acc.total_invoiced  + b.total_invoiced,
    balance_due:     acc.balance_due     + b.balance_due,
  }), { total_confirmed: 0, total_invoiced: 0, balance_due: 0 })

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${P.navy} 0%, ${P.teal} 100%)` }}>
        <span className="text-sm font-black text-white" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.06em' }}>
          Client Balance Tracker
        </span>
        <span className="text-xs italic" style={{ color: 'rgba(255,255,255,0.6)' }}>All-time · not affected by period filters</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0" style={{ minWidth: 560 }}>
          <thead>
            <tr style={{ background: 'rgba(19,46,87,0.06)', borderBottom: '1px solid #E5E7EB' }}>
              {['Client', 'DID Code', 'Total Confirmed', 'Already Invoiced', 'Balance Due'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs font-bold uppercase"
                  style={{ color: P.navy, fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.06em', opacity: 0.7 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  {[1,2,3,4,5].map(c => (
                    <td key={c} className="px-4 py-2.5 border-b border-gray-50">
                      <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : balances.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No balance data. Final-approved sales will appear here.</td></tr>
            ) : balances.map((b, i) => (
              <tr key={b.client_id} className={`hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                <td className="px-4 py-2.5 border-b border-gray-50">
                  <span className="font-semibold text-gray-800">{b.company_name}</span>
                </td>
                <td className="px-4 py-2.5 border-b border-gray-50">
                  <span className="font-mono text-xs text-gray-500">{b.did_code}</span>
                </td>
                <td className="px-4 py-2.5 border-b border-gray-50">
                  <span className="text-xs font-bold" style={{ color: P.teal }}>{pkr(b.total_confirmed)}</span>
                </td>
                <td className="px-4 py-2.5 border-b border-gray-50">
                  <span className="text-xs font-bold" style={{ color: P.orange }}>{pkr(b.total_invoiced)}</span>
                </td>
                <td className="px-4 py-2.5 border-b border-gray-50">
                  <span className="text-sm font-black" style={{ color: b.balance_due > 0 ? P.navy : P.green }}>
                    {pkr(b.balance_due)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {balances.length > 0 && !loading && (
            <tfoot>
              <tr style={{ background: 'rgba(19,46,87,0.06)', borderTop: `2px solid ${P.navy}` }}>
                <td colSpan={2} className="px-4 py-2 text-xs font-black uppercase tracking-wide border-t-2 border-gray-200" style={{ color: P.navy }}>
                  Total
                </td>
                {['total_confirmed','total_invoiced','balance_due'].map((col, ci) => (
                  <td key={ci} className="px-4 py-2 border-t-2 border-gray-200">
                    <span className="text-xs font-black" style={{ color: [P.teal, P.orange, P.navy][ci] }}>
                      {pkr(totals[col])}
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = ['Revenue Reports', 'Invoices', 'Customer Balances', 'Create Invoice']

export default function InvoicingPayments() {
  const [activeTab, setActiveTab] = useState(0)
  const [toast,     setToast]     = useState(null)

  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="p-5 space-y-4 min-h-screen" style={{ background: P.bg }}>
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black" style={{ color: P.navy, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
            Invoicing &amp; Payments
          </h1>
          <p className="text-sm mt-0.5" style={{ color: P.gray }}>
            Billing cycles, invoice management &amp; revenue tracking
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#fff', border: '1px solid #E5E7EB', width: 'fit-content' }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setActiveTab(i)}
              className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
              style={activeTab === i
                ? { background: `linear-gradient(135deg, ${P.navy}, ${P.teal})`, color: '#fff', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.03em' }
                : { color: P.gray, fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.03em' }}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 0 && <RevenueTab />}
        {activeTab === 1 && <InvoicesTab setToast={setToast} />}
        {activeTab === 2 && <BalancesTab />}
        {activeTab === 3 && <PendingInvoicesTab setToast={setToast} />}
      </div>
    </Layout>
  )
}
