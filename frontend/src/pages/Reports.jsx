import { useState, useEffect, useCallback, useRef } from 'react'
import Layout from '../components/Layout'
import DateInput from '../components/DateInput'
import Toast from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const STATUS_OPTIONS = [
  ['pending',           'Pending'],
  ['approved',          'Approved by Manager'],
  ['disapproved',       'Rejected by Manager'],
  ['final_approved',    'Final Approved'],
  ['final_disapproved', 'Final Rejected'],
  ['agent_rejected',    'Rejected by Agent'],
]
const STATUS_BADGE = {
  pending:           'bg-amber-100 text-amber-700',
  approved:          'bg-blue-100 text-blue-700',
  disapproved:       'bg-red-100 text-red-700',
  final_approved:    'bg-green-100 text-green-700',
  final_disapproved: 'bg-gray-100 text-gray-600',
  agent_rejected:    'bg-orange-100 text-orange-700',
}
const STATUS_LABEL = {
  pending:           'Pending',
  approved:          'Approved by Manager',
  disapproved:       'Rejected by Manager',
  final_approved:    'Final Approved',
  final_disapproved: 'Final Rejected',
  agent_rejected:    'Rejected by Agent',
}
const VERTICAL_OPTIONS = ['Medicare', 'Final Expense', 'ACA', 'Other']
const PERIOD_BTNS = [
  { key: 'today',  label: 'Today'      },
  { key: 'week',   label: 'This Week'  },
  { key: 'month',  label: 'This Month' },
  { key: 'all',    label: 'Overall'    },
  { key: 'custom', label: 'Custom'     },
]
const MIN_COL_W = 60

const selectCls = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition cursor-pointer'
const inputCls  = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition'
const labelCls  = 'block text-xs font-bold uppercase tracking-widest mb-0.5'
const filterSelectStyle = { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }
const filterInputStyle  = { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }

function fmt(dateStr) {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtEST(dateStr) {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/New_York' })
}
function fmtRate(client) {
  if (!client) return 'N/A'
  if (client.rate_type === 'variable') return 'Variable'
  if (client.rate_of_sale_amount) return `$${Number(client.rate_of_sale_amount).toLocaleString()}`
  return 'N/A'
}
const FROZEN = ['final_approved', 'disapproved', 'final_disapproved']
function getSnapshotDid(c)     { return FROZEN.includes(c.status) && c.sale_did_code     ? c.sale_did_code     : c.client?.did_code     ?? null }
function getSnapshotCompany(c) { return FROZEN.includes(c.status) && c.sale_company_name ? c.sale_company_name : c.client?.company_name ?? null }
function getSnapshotRate(c) {
  if (FROZEN.includes(c.status) && c.sale_rate_type)
    return c.sale_rate_amount != null ? `$${Number(c.sale_rate_amount).toLocaleString()}` : 'N/A'
  return fmtRate(c.client)
}
function getRejectionReason(c) {
  if (c.status === 'agent_rejected')    return c.reason       ?? 'N/A'
  if (c.status === 'disapproved')       return c.manager_note ?? 'N/A'
  if (c.status === 'final_disapproved') return c.final_note   ?? 'N/A'
  return 'N/A'
}
function getPeriodDates(period) {
  const today = new Date()
  const d = (x) => x.toISOString().slice(0, 10)
  switch (period) {
    case 'today': return { date_from: d(today), date_to: d(today) }
    case 'week': {
      const day = today.getDay() || 7
      const mon = new Date(today); mon.setDate(today.getDate() - day + 1)
      return { date_from: d(mon), date_to: d(today) }
    }
    case 'month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      return { date_from: d(first), date_to: d(today) }
    }
    case 'all':  return { date_from: '', date_to: '' }
    default:     return null
  }
}

function buildCols(canSeeAgent, canSeeCompany) {
  const cols = [
    { key: 'code',       label: 'Code',             w: 105, show: true },
    { key: 'name',       label: 'Name',              w: 165, show: true },
    { key: 'status',     label: 'Status',            w: 158, show: true },
    { key: 'vertical',   label: 'Vertical',          w: 115, show: true },
  ]
  if (canSeeAgent)   cols.push({ key: 'agent',      label: 'Agent',            w: 110, show: true })
  cols.push(          { key: 'did',        label: 'DID',              w: 78,  show: true })
  cols.push(          { key: 'sale_type',  label: 'Sale Type',        w: 80,  show: true })
  if (canSeeCompany) {
    cols.push(        { key: 'client',     label: 'Client',           w: 140, show: true })
    cols.push(        { key: 'rate_type',  label: 'Rate Type',        w: 88,  show: true })
    cols.push(        { key: 'rate',       label: 'Rate',             w: 88,  show: true })
  }
  cols.push(          { key: 'rej_reason', label: 'Rejection Reason', w: 155, show: true })
  cols.push(          { key: 'pak_time',   label: 'Pak Time',         w: 88,  show: true })
  cols.push(          { key: 'est_time',   label: 'USA Time',         w: 88,  show: true })
  cols.push(          { key: 'date',       label: 'Date',             w: 90,  show: true, minW: 90 })
  return cols
}

function cellContent(col, c) {
  switch (col.key) {
    case 'code':     return <span className="font-mono text-xs font-bold text-gray-700 truncate block">{c.customer_code}</span>
    case 'name':     return <span className="font-medium text-gray-800 truncate block">{c.first_name} {c.last_name}</span>
    case 'status':   return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
    case 'vertical': return <span className="truncate block text-xs text-gray-600">{c.vertical_type ?? 'N/A'}</span>
    case 'agent':    return <span className="truncate block text-xs font-bold text-gray-700">{c.agent?.display_name ?? 'N/A'}</span>
    case 'did':      return <span className="font-mono text-xs text-gray-700">{getSnapshotDid(c) ?? 'N/A'}</span>
    case 'sale_type': {
      const st = c.client?.sale_type
      if (!st) return <span className="text-gray-400 text-xs">N/A</span>
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${st === 'CPA' ? 'bg-violet-100 text-violet-700' : 'bg-teal-100 text-teal-700'}`}>{st}</span>
    }
    case 'client':   return <span className="truncate block text-xs text-gray-700">{getSnapshotCompany(c) ?? 'N/A'}</span>
    case 'rate_type': {
      const rt = FROZEN.includes(c.status) && c.sale_rate_type ? c.sale_rate_type : c.client?.rate_type
      if (!rt) return <span className="text-gray-400 text-xs">N/A</span>
      return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${rt === 'fixed' ? 'bg-slate-100 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>{rt === 'fixed' ? 'Fixed' : 'Variable'}</span>
    }
    case 'rate':      return <span className="text-xs text-gray-700">{getSnapshotRate(c)}</span>
    case 'rej_reason': {
      const reason = getRejectionReason(c)
      const isRej  = ['disapproved','final_disapproved','agent_rejected'].includes(c.status)
      return <span className={`truncate block text-xs font-medium ${isRej && reason !== 'N/A' ? 'text-red-600' : 'text-gray-400'}`}>{reason}</span>
    }
    case 'pak_time': { const p = c.submitted_at_pak?.split(' '); return <span className="font-mono text-xs text-gray-600 whitespace-nowrap">{p?.length >= 5 ? `${p[3]} ${p[4]}` : 'N/A'}</span> }
    case 'est_time': { const p = c.submitted_at_est?.split(' '); return <span className="font-mono text-xs text-gray-600 whitespace-nowrap">{p?.length >= 5 ? `${p[3]} ${p[4]}` : 'N/A'}</span> }
    case 'date': {
      const d = c.created_at ? new Date(c.created_at) : null
      if (!d) return <span className="text-gray-400 text-xs">N/A</span>
      const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'America/New_York' })
      return <span className="text-xs text-gray-600 whitespace-nowrap">{label}</span>
    }
    default:         return <span className="text-gray-400">N/A</span>
  }
}

// ── Sale Detail Modal ──────────────────────────────────────────────────────────
function DR({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-sm text-gray-800">{value ?? 'N/A'}</div>
    </div>
  )
}
function MS({ title, children }) {
  return (
    <div>
      <div className="-mx-6 px-6 py-1.5 mb-3"
        style={{ background: 'rgba(61,71,83,0.08)', borderTop: '1px solid rgba(92,109,130,0.18)', borderBottom: '1px solid rgba(92,109,130,0.18)' }}>
        <span className="text-xs font-black uppercase tracking-widest"
          style={{ color: '#111827', fontFamily: "'Agency FB','Rajdhani',sans-serif" }}>
          {title}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </div>
  )
}
function SaleDetailModal({ record: c, onClose, canSeeCompany }) {
  const did = getSnapshotDid(c), company = getSnapshotCompany(c), rate = getSnapshotRate(c)
  const saleType = c.client?.sale_type
  const rateType = FROZEN.includes(c.status) && c.sale_rate_type ? c.sale_rate_type : c.client?.rate_type
  const pakP = c.submitted_at_pak?.split(' '), estP = c.submitted_at_est?.split(' ')
  const pakTime = pakP?.length >= 5 ? `${pakP[3]} ${pakP[4]}` : 'N/A'
  const estTime = estP?.length >= 5 ? `${estP[3]} ${estP[4]}` : 'N/A'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0E5F6E 0%, #1E8496 100%)', borderBottom: '1px solid #1A7888' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: '#FFFFFF', fontFamily: "'FB Agency',sans-serif", letterSpacing: '0.06em' }}>
              {c.first_name} {c.mid_name ? c.mid_name + ' ' : ''}{c.last_name}
            </h2>
            <p className="text-xs font-mono font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>{c.customer_code}</p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
            <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors ml-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <MS title="Personal Information">
            <DR label="First Name" value={c.first_name} /><DR label="Last Name" value={c.last_name} />
            {c.mid_name && <DR label="Middle Name" value={c.mid_name} />}
            <DR label="Age" value={c.age} /><DR label="Date of Birth" value={c.date_of_birth ? fmt(c.date_of_birth) : null} />
            <DR label="Phone" value={c.phone} />
          </MS>
          <MS title="Address">
            <div className="col-span-2"><DR label="Street Address" value={c.address} /></div>
            <DR label="City" value={c.city} /><DR label="State" value={c.state} /><DR label="ZIP Code" value={c.postal_code} />
          </MS>
          <MS title="Business Information">
            <DR label="Vertical" value={c.vertical_type} /><DR label="DID" value={did} />
            <DR label="Sale Type" value={saleType ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${saleType === 'CPA' ? 'bg-violet-100 text-violet-700' : 'bg-teal-100 text-teal-700'}`}>{saleType}</span> : null} />
            {canSeeCompany && <DR label="Client" value={company} />}
            {canSeeCompany && rateType && <DR label="Rate Type" value={<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${rateType === 'fixed' ? 'bg-slate-100 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>{rateType === 'fixed' ? 'Fixed' : 'Variable'}</span>} />}
            {canSeeCompany && <DR label="Rate" value={rate} />}
          </MS>
          <MS title="Additional Information">
            <DR label="Transferred From" value={c.transferred_from} /><DR label="Cancellation Reason" value={c.reason} />
            <div className="col-span-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Comments</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.did_comments || 'N/A'}</p>
            </div>
          </MS>
          <MS title="Timestamps">
            <DR label="Pak Time" value={pakTime} /><DR label="USA Time" value={estTime} />
            <DR label="Date (EST)" value={fmtEST(c.created_at)} />
            {c.agent && <DR label="Agent" value={c.agent.display_name} />}
          </MS>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Reports() {
  const { user } = useAuth()
  const role          = user?.role
  const canSeeAgent   = ['manager','director','admin'].includes(role)
  const canSeeCompany = ['director','admin'].includes(role)
  const LS_KEY        = `reports_cols_v3_${role}`

  const BASE        = { status: '', agent_id: '', client_id: '', vertical_type: '' }
  const todayDates  = getPeriodDates('today')
  const initFilters = { ...BASE, ...todayDates }

  const [period, setPeriod]                 = useState('today')
  const [filters, setFilters]               = useState(initFilters)
  const [applied, setApplied]               = useState(initFilters)
  const [agents, setAgents]                 = useState([])
  const [dids, setDids]                     = useState([])
  const [companies, setCompanies]           = useState([])
  const [data, setData]                     = useState(null)
  const [page, setPage]                     = useState(1)
  const [loading, setLoading]               = useState(false)
  const [exporting, setExporting]           = useState(false)
  const [toast, setToast]                   = useState(null)
  const [colMenuOpen, setColMenuOpen]       = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)

  // ── Columns — same pattern as Approvals ───────────────────────────────────
  const DEFAULT_COLS = buildCols(canSeeAgent, canSeeCompany)

  const [cols, setCols] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY))
      if (saved && Array.isArray(saved) && saved.length > 0) {
        // Merge saved widths+visibility into defaults (handles new columns gracefully)
        return DEFAULT_COLS.map(def => {
          const s = saved.find(x => x.key === def.key)
          return s ? { ...def, w: s.w ?? def.w, show: s.show ?? def.show } : def
        })
      }
    } catch {}
    return DEFAULT_COLS
  })

  const resizingRef    = useRef(null)
  const containerRef   = useRef(null)
  const userResizedRef = useRef(false)

  // Save to localStorage after user resizes or toggles
  useEffect(() => {
    if (!userResizedRef.current) return
    localStorage.setItem(LS_KEY, JSON.stringify(cols.map(c => ({ key: c.key, w: c.w, show: c.show }))))
  }, [cols]) // eslint-disable-line

  // Auto-scale on mount — only when no saved prefs (fills container exactly)
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && Array.isArray(s)) return } catch {}
    const el = containerRef.current
    if (!el) return
    const w = el.clientWidth
    if (w <= 0) return
    setCols(prev => {
      const vis   = prev.filter(c => c.show)
      const total = vis.reduce((s, c) => s + c.w, 0)
      if (!total) return prev
      const scale = w / total
      return prev.map(c => c.show ? { ...c, w: Math.max(c.minW ?? MIN_COL_W, Math.floor(c.w * scale)) } : c)
    })
  }, []) // eslint-disable-line

  // Adjacent-column-shrink resize — exact same as Approvals
  useEffect(() => {
    const onMove = (e) => {
      if (!resizingRef.current) return
      const { key, nextKey, startX, startW, nextStartW, colMin, nextMin } = resizingRef.current
      let d = e.clientX - startX
      if (startW + d < colMin)                d = colMin - startW
      if (nextKey && nextStartW - d < nextMin) d = nextStartW - nextMin
      setCols(prev => prev.map(c => {
        if (c.key === key)     return { ...c, w: startW + d }
        if (c.key === nextKey) return { ...c, w: nextStartW - d }
        return c
      }))
    }
    const onUp = () => { resizingRef.current = null }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => {
    if (canSeeAgent)
      api.get('/users', { params: { per_page: 'all', role: 'agent' } })
        .then(({ data }) => setAgents(Array.isArray(data) ? data : data.data ?? [])).catch(() => {})
    api.get('/clients/dropdown')
      .then(({ data }) => { setDids(data); setCompanies(data) }).catch(() => {})
  }, [role]) // eslint-disable-line

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { ...applied, page }
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k] })
      const { data } = await api.get('/reports', { params })
      setData(data)
    } catch { setToast({ message: 'Failed to load report data.', type: 'error' }) }
    finally  { setLoading(false) }
  }, [applied, page])

  useEffect(() => { fetchData() }, [fetchData])

  const handlePeriod = (p) => {
    setPeriod(p); if (p === 'custom') return
    const dates = getPeriodDates(p)
    setFilters(prev => ({ ...prev, ...dates })); setApplied(prev => ({ ...prev, ...dates })); setPage(1)
  }
  const setF = (e) => { const { name, value } = e.target; setFilters(p => ({ ...p, [name]: value })) }
  const handleApply  = (e) => { e.preventDefault(); setApplied(filters); setPage(1) }
  const handleReset  = () => {
    const dates = getPeriodDates('today'); const reset = { ...BASE, ...dates }
    setFilters(reset); setApplied(reset); setPeriod('today'); setPage(1)
  }

  // Toggle visibility — redistribute visible widths to fill container
  const toggleCol = (key) => {
    userResizedRef.current = true
    setCols(prev => {
      const next = prev.map(c => c.key === key ? { ...c, show: !c.show } : c)
      const el = containerRef.current; if (!el) return next
      const w   = el.clientWidth
      const vis = next.filter(c => c.show)
      const total = vis.reduce((s, c) => s + c.w, 0)
      if (!total || !w) return next
      const scale = w / total
      return next.map(c => c.show ? { ...c, w: Math.max(c.minW ?? MIN_COL_W, Math.floor(c.w * scale)) } : c)
    })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = { ...applied }; Object.keys(params).forEach(k => { if (!params[k]) delete params[k] })
      const response = await api.get('/reports/export', { params, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a'); link.href = url
      link.setAttribute('download', `report_${new Date().toISOString().slice(0,10)}.csv`)
      document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url)
    } catch { setToast({ message: 'Export failed. Please try again.', type: 'error' }) }
    finally  { setExporting(false) }
  }

  const visibleCols = cols.filter(c => c.show)

  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="p-5 space-y-4 h-[calc(100vh-64px)] flex flex-col" style={{ background: '#EDF0F3', minHeight: '100vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#132E57', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>Reports</h1>
            <p className="text-sm mt-0.5" style={{ color: '#5C5C5C' }}>Filter and export customer data</p>
          </div>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-60">
            {exporting
              ? <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"/></svg>Exporting…</>
              : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>Export CSV</>
            }
          </button>
        </div>

        {/* Filters */}
        <form onSubmit={handleApply} className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 shadow-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0E5F6E 0%, #1E8496 100%)', border: '1px solid #1A7888' }}>
          <div className="flex items-end gap-2.5 overflow-x-auto pb-0.5">
            <div className="flex-shrink-0">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif" }}>Period</label>
              <div className="flex gap-1">
                {PERIOD_BTNS.map(btn => (
                  <button key={btn.key} type="button" onClick={() => handlePeriod(btn.key)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                    style={period === btn.key
                      ? { background: 'linear-gradient(135deg, #132E57 0%, #1E8496 100%)', color: '#fff', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.04em' }
                      : { background: 'rgba(0,0,0,0.15)', color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif" }}
                    onMouseEnter={e => { if(period !== btn.key){ e.currentTarget.style.background='rgba(255,255,255,0.15)' }}}
                    onMouseLeave={e => { if(period !== btn.key){ e.currentTarget.style.background='rgba(0,0,0,0.15)' }}}
                  >{btn.label}</button>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0 self-stretch flex items-center"><div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.2)' }} /></div>
            {period === 'custom' && (<>
              <div className="flex-shrink-0 w-[120px]">
                <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif" }}>From</label>
                <DateInput value={filters.date_from} onChange={e => setF({ target: { name: 'date_from', value: e.target.value } })} className={inputCls} style={filterInputStyle} />
              </div>
              <div className="flex-shrink-0 w-[120px]">
                <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif" }}>To</label>
                <DateInput value={filters.date_to} onChange={e => setF({ target: { name: 'date_to', value: e.target.value } })} className={inputCls} style={filterInputStyle} />
              </div>
              <div className="flex-shrink-0 self-stretch flex items-center"><div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.2)' }} /></div>
            </>)}
            <div className="flex-shrink-0 w-[145px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif" }}>Status</label>
              <select name="status" value={filters.status} onChange={setF} className={selectCls} style={filterSelectStyle}>
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </div>
            <div className="flex-shrink-0 w-[120px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif" }}>Vertical</label>
              <select name="vertical_type" value={filters.vertical_type} onChange={setF} className={selectCls} style={filterSelectStyle}>
                <option value="">All Verticals</option>
                {VERTICAL_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {canSeeAgent && (
              <div className="flex-shrink-0 w-[120px]">
                <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif" }}>Agent</label>
                <select name="agent_id" value={filters.agent_id} onChange={setF} className={selectCls} style={filterSelectStyle}>
                  <option value="">All Agents</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                </select>
              </div>
            )}
            <div className="flex-shrink-0 w-[100px]">
              <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif" }}>DID</label>
              <select name="client_id" value={filters.client_id} onChange={setF} className={selectCls} style={filterSelectStyle}>
                <option value="">All DIDs</option>
                {dids.map(c => <option key={c.id} value={c.id}>{c.did_code}</option>)}
              </select>
            </div>
            {canSeeCompany && (
              <div className="flex-shrink-0 w-[130px]">
                <label className={labelCls} style={{ color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif" }}>Client</label>
                <select name="client_id" value={filters.client_id} onChange={setF} className={selectCls} style={filterSelectStyle}>
                  <option value="">All Clients</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.company_name ?? c.did_code}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-1.5 flex-shrink-0 ml-auto pl-2">
              <button type="button" onClick={handleReset}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif" }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent' }}>
                Reset
              </button>
              <button type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shadow-sm"
                style={{ background: 'linear-gradient(135deg, #132E57 0%, #1E8496 100%)', color: '#fff', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.05em' }}>
                Apply
              </button>
            </div>
          </div>
        </form>

        {/* Results */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-gray-700">Results</h2>
              {data && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{data.total} record{data.total !== 1 ? 's' : ''}</span>}
            </div>
            <div className="relative">
              <button onClick={() => setColMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors select-none">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Columns
                <svg className={`w-3 h-3 transition-transform ${colMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {colMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 min-w-[175px]">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 mb-1">Toggle Columns</p>
                  {cols.map(col => (
                    <label key={col.key} className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 select-none">
                      <input type="checkbox" checked={col.show} onChange={() => toggleCol(col.key)} className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer" />
                      <span className="text-xs text-gray-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table — same approach as Approvals: fixed layout, 100% width, adjacent shrink */}
          <div ref={containerRef} className="overflow-hidden flex-shrink-0">
            <table className="text-sm border-separate border-spacing-0" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>{visibleCols.map(col => <col key={col.key} style={{ width: col.w }} />)}</colgroup>
              <thead>
                <tr style={{ background: 'linear-gradient(90deg, #4A5568 0%, #5A6880 100%)', borderBottom: '2px solid #3A4558' }}>
                  {visibleCols.map((col, idx) => {
                    const isLast = idx === visibleCols.length - 1
                    return (
                      <th key={col.key}
                        className="px-3 py-2.5 text-center text-xs font-bold uppercase tracking-widest select-none relative"
                        style={{ color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif", background: 'transparent', letterSpacing: '0.07em' }}>
                        <span className="block leading-tight whitespace-normal break-words">{col.label}</span>
                        {!isLast && (
                          <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-center group"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              userResizedRef.current = true
                              const next = visibleCols[idx + 1]
                              resizingRef.current = {
                                key: col.key, nextKey: next?.key,
                                startX: e.clientX, startW: col.w, nextStartW: next?.w ?? 0,
                                colMin:  col.minW  ?? MIN_COL_W,
                                nextMin: next?.minW ?? MIN_COL_W,
                              }
                            }}>
                            <div className="w-px h-4 group-hover:w-0.5 transition-all rounded-full"
                              style={{ background: '#5C6D82' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#AA7F56'}
                              onMouseLeave={e => e.currentTarget.style.background = '#5C6D82'} />
                          </div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
            </table>
          </div>

          {/* Scrollable body — separate from header so header stays sticky */}
          <div className="overflow-y-auto flex-1">
            <table className="text-sm border-separate border-spacing-0" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>{visibleCols.map(col => <col key={col.key} style={{ width: col.w }} />)}</colgroup>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      {visibleCols.map(col => <td key={col.key} className="px-3 py-2.5 border-b border-gray-50"><div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" /></td>)}
                    </tr>
                  ))
                ) : !data || data.data.length === 0 ? (
                  <tr><td colSpan={visibleCols.length} className="px-4 py-12 text-center text-gray-400 text-sm">No records found for the selected filters.</td></tr>
                ) : (
                  data.data.map((c, idx) => (
                    <tr key={c.id}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                      onClick={() => setSelectedRecord(c)}>
                      {visibleCols.map(col => (
                        <td key={col.key} className="px-3 py-2 border-b border-gray-50 overflow-hidden">
                          {cellContent(col, c)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.last_page > 1 && (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
              <p className="text-xs text-gray-500">Page {data.current_page} of {data.last_page} — {data.total} total</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={data.current_page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Previous</button>
                <span className="text-xs text-gray-400 px-1">{data.current_page} / {data.last_page}</span>
                <button onClick={() => setPage(p => Math.min(data.last_page, p+1))} disabled={data.current_page === data.last_page}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {colMenuOpen && <div className="fixed inset-0 z-10" onClick={() => setColMenuOpen(false)} />}
      {selectedRecord && <SaleDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} canSeeCompany={canSeeCompany} />}
    </Layout>
  )
}
