import { useState, useEffect, useCallback, useRef } from 'react'
import Layout from '../components/Layout'
import Toast from '../components/Toast'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
const selectCls = inputCls + ' cursor-pointer'

const STATUS_BADGE = {
  pending:           'bg-yellow-100 text-yellow-700',
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
const REASON_OPTIONS   = ['XFER', 'No LA', 'Ringing', 'Over Age', 'Out of State', 'Hangup', 'No medicare card']

/** Extract time-only from stored string "12 May 2026 02:47 AM PKT" â†’ "02:47 AM PKT" */
function timeOnly(str) {
  if (!str) return 'â€”'
  const parts = str.split(' ')
  return parts.slice(3).join(' ')   // skip "12 May 2026"
}

/** Format a UTC datetime string as "12 May 2026 Â· 07:47 AM PKT" */
function fmtWithPKT(dateStr) {
  if (!dateStr) return 'â€”'
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' })
  return `${date} Â· ${time} PKT`
}

function Badge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function SectionTitle({ children }) {
  return (
    <div className="-mx-5 px-5 py-1.5 mt-3"
      style={{ background: 'rgba(61,71,83,0.08)', borderTop: '1px solid rgba(92,109,130,0.18)', borderBottom: '1px solid rgba(92,109,130,0.18)' }}>
      <span className="text-sm font-black uppercase tracking-widest"
        style={{ color: '#111827', fontFamily: "'Agency FB', 'Rajdhani', sans-serif" }}>
        {children}
      </span>
    </div>
  )
}

function FieldLabel({ children }) {
  return <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{children}</label>
}

export default function Approvals() {
  const { role } = useAuth()

  const isFinalApprover = role === 'director' || role === 'admin'

  const [customers, setCustomers]     = useState([])
  const [meta, setMeta]               = useState(null)
  const [page, setPage]               = useState(1)
  // Director/Admin land directly on the queue that needs their action (manager-approved records)
  // Manager lands on pending records (the queue that needs their action)
  const [statusFilter, setStatusFilter] = useState(isFinalApprover ? 'approved' : 'pending')
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(false)
  const [selected, setSelected]       = useState(null)
  const [editing, setEditing]         = useState(false)
  const [editForm, setEditForm]       = useState({})
  const [editDids, setEditDids]           = useState([])
  const [editDidsLoading, setEditDidsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [noteModal, setNoteModal]       = useState(null)
  const [noteText, setNoteText]         = useState('')
  const [noteReason, setNoteReason]     = useState('')
  const [noteQa, setNoteQa]             = useState('')
  const [confirmModal, setConfirmModal]   = useState(false)
  const [deleteModal, setDeleteModal]     = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [rateModal, setRateModal]         = useState(false)
  const [rateInput, setRateInput]         = useState('')
  const [toast, setToast]                 = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [listCollapsed, setListCollapsed]       = useState(false)

  // Resizable columns for the list panel
  const MIN_COL_W    = 50
  const LS_KEY       = 'approvals_col_widths'
  const DEFAULT_COLS = [
    { key: 'name',     label: 'Name',     w: 140 },
    { key: 'agent',    label: 'Agent',    w: 90  },
    { key: 'phone',    label: 'Phone',    w: 115 },
    { key: 'vertical', label: 'Vertical', w: 82  },
    { key: 'did',      label: 'DID',      w: 60  },
  ]

  const [cols, setCols] = useState(() => {
    // Restore saved widths from localStorage if available
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY))
      if (saved && Array.isArray(saved) && saved.length === DEFAULT_COLS.length) {
        return DEFAULT_COLS.map((col, i) => ({ ...col, w: saved[i] ?? col.w }))
      }
    } catch {}
    return DEFAULT_COLS
  })

  const listResizingRef  = useRef(null)
  const listContainerRef = useRef(null)
  const userResizedRef   = useRef(false) // track if user has manually resized

  // Save widths to localStorage whenever cols change (after user resizes)
  useEffect(() => {
    if (!userResizedRef.current) return
    localStorage.setItem(LS_KEY, JSON.stringify(cols.map(c => c.w)))
  }, [cols])

  // Scale columns to fill panel width on mount â€” only if no saved widths
  useEffect(() => {
    const el = listContainerRef.current
    if (!el) return
    const w = el.clientWidth
    if (w <= 0) return
    // Skip auto-scale if user already has saved preferences
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY))
      if (saved && Array.isArray(saved)) return
    } catch {}
    setCols(prev => {
      const total = prev.reduce((s, c) => s + c.w, 0)
      const scale = w / total
      return prev.map(c => ({ ...c, w: Math.max(MIN_COL_W, Math.floor(c.w * scale)) }))
    })
  }, [])

  // Mouse drag handlers for column resize
  useEffect(() => {
    const onMove = (e) => {
      if (!listResizingRef.current) return
      const { key, nextKey, startX, startW, nextStartW } = listResizingRef.current
      let d = e.clientX - startX
      if (startW + d < MIN_COL_W)               d = MIN_COL_W - startW
      if (nextKey && nextStartW - d < MIN_COL_W) d = nextStartW - MIN_COL_W
      setCols(prev => prev.map(c => {
        if (c.key === key)     return { ...c, w: startW + d }
        if (c.key === nextKey) return { ...c, w: nextStartW - d }
        return c
      }))
    }
    const onUp = () => { listResizingRef.current = null }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  const STATUS_TABS = isFinalApprover
    ? [
        { key: 'approved',           label: 'Awaiting Final' },
        { key: 'final_approved',     label: 'Final Approved' },
        { key: 'final_disapproved',  label: 'Final Rejected' },
        { key: 'pending',            label: 'Pending (Manager)' },
        { key: 'disapproved',        label: 'Rejected by Manager' },
        { key: '',                   label: 'All' },
      ]
    : [
        { key: 'pending',     label: 'Pending' },
        { key: 'approved',    label: 'Approved by Manager' },
        { key: 'disapproved', label: 'Rejected by Manager' },
        { key: '',            label: 'All' },
      ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page }
      if (statusFilter) params.status = statusFilter
      if (search)       params.search = search
      const { data } = await api.get('/customers', { params })
      setCustomers(data.data)
      setMeta(data)
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search])

  useEffect(() => { load() }, [load])

  const handleTabChange = (key) => { setStatusFilter(key); setPage(1); setSelected(null); setSidebarCollapsed(false) }

  const handleSearch = (e) => {
    if (e.key === 'Enter') { setSearch(e.target.value); setPage(1); setSelected(null) }
  }

  const VERTICAL_TO_CAMPAIGN = { Medicare: 'Medicare', 'Final Expense': 'Final Expense', ACA: 'ACA' }

  const selectCustomer = (c) => {
    setSelected(c)
    setSidebarCollapsed(true)   // auto-collapse sidebar when detail panel opens
    setEditing(false)
    setEditDids([])
    setEditForm({
      first_name:        c.first_name  ?? '',
      mid_name:          c.mid_name    ?? '',
      last_name:         c.last_name   ?? '',
      date_of_birth:     c.date_of_birth ?? '',
      phone:             c.phone       ?? '',
      address:           c.address     ?? '',
      city:              c.city        ?? '',
      state:             c.state       ?? '',
      postal_code:       c.postal_code ?? '',
      vertical_type:     c.vertical_type    ?? '',
      vertical_other:    c.vertical_other   ?? '',
      client_id:         c.client_id        ?? '',
      did_comments:      c.did_comments     ?? '',
      transferred_from:  c.transferred_from ?? '',
      verifiers_part:    c.verifiers_part   ?? '',
      lead_id_timestamp: c.lead_id_timestamp ?? '',
      reason:            c.reason      ?? '',
    })
  }

  // Load DIDs when editing and vertical_type changes
  useEffect(() => {
    if (!editing) return
    const campaign = VERTICAL_TO_CAMPAIGN[editForm.vertical_type]
    if (!campaign) { setEditDids([]); return }
    setEditDidsLoading(true)
    api.get('/clients/dropdown', { params: { campaign } })
      .then(({ data }) => setEditDids(data))
      .catch(() => setEditDids([]))
      .finally(() => setEditDidsLoading(false))
  }, [editing, editForm.vertical_type]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditChange = (e) => {
    const { name, value } = e.target
    // Reset DID when vertical changes
    if (name === 'vertical_type') {
      setEditForm(p => ({ ...p, vertical_type: value, client_id: '' }))
      return
    }
    setEditForm(p => ({ ...p, [name]: value }))
  }

  const saveEdit = async () => {
    setActionLoading(true)
    try {
      const { data } = await api.put(`/customers/${selected.id}`, editForm)
      const updated = data.customer
      setSelected(updated)
      setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c))
      setEditing(false)
      setToast({ message: 'Customer updated.', type: 'success' })
    } catch {
      setToast({ message: 'Failed to save changes.', type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const doAction = async (action, note, extraPayload = {}) => {
    setActionLoading(true)
    try {
      let res
      if (action === 'approve') {
        res = await api.post(`/customers/${selected.id}/approve`, { qa_comments: noteQa })
      } else if (action === 'reject') {
        const managerNote = noteReason + (note ? ' â€” ' + note : '')
        res = await api.post(`/customers/${selected.id}/reject`, { manager_note: managerNote, qa_comments: noteQa })
      } else if (action === 'final-approve') {
        res = await api.post(`/customers/${selected.id}/final-approve`, extraPayload)
      } else if (action === 'final-reject') {
        res = await api.post(`/customers/${selected.id}/final-reject`)
      }
      const updated = res.data.customer
      setSelected(updated)
      setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c))
      setToast({ message: 'Action completed successfully.', type: 'success' })
    } catch (e) {
      setToast({ message: e.response?.data?.message ?? 'Action failed.', type: 'error' })
    } finally {
      setActionLoading(false)
      setNoteModal(null)
      setConfirmModal(false)
      setRateModal(false)
      setNoteText('')
      setNoteReason('')
      setNoteQa('')
      setRateInput('')
    }
  }

  const openNoteModal = (action) => { setNoteModal(action); setNoteText(''); setNoteReason(''); setNoteQa('') }

  const doDelete = async () => {
    setDeleteLoading(true)
    try {
      await api.delete(`/customers/${selected.id}`)
      setCustomers(prev => prev.filter(c => c.id !== selected.id))
      setSelected(null)
      setDeleteModal(false)
      setToast({ message: 'Record permanently deleted.', type: 'success' })
    } catch (e) {
      setToast({ message: e.response?.data?.message ?? 'Delete failed.', type: 'error' })
    } finally {
      setDeleteLoading(false)
    }
  }

  const inp = (name, extra = {}) => (
    <input name={name} value={editForm[name] ?? ''} onChange={handleEditChange}
      className={inputCls} {...extra} />
  )

  return (
    <Layout sidebarCollapsed={sidebarCollapsed} onSidebarCollapsedChange={setSidebarCollapsed}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex h-full overflow-hidden">

        {/* â”€â”€ Left panel: list â”€â”€ */}
        <div className="flex-shrink-0 flex flex-col transition-all duration-300"
          style={{ width: listCollapsed ? 0 : 480, minWidth: listCollapsed ? 0 : undefined, overflow: 'hidden', background: '#EDF0F3', borderRight: listCollapsed ? 'none' : '1px solid rgba(92, 109, 130, 0.25)' }}>

          {/* Title + tabs in one compact block */}
          <div className="px-3 pt-3 pb-3 space-y-2.5"
            style={{ background: 'transparent', borderBottom: '1px solid rgba(92,109,130,0.18)' }}>
            <div className="flex items-center justify-between">
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#132E57', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em', margin: 0 }}>
                Approvals
              </h1>
              <button
                onClick={() => setListCollapsed(true)}
                title="Collapse list"
                className="flex items-center justify-center w-6 h-6 rounded transition-all"
                style={{ color: '#9FA7B2' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#132E57'; e.currentTarget.style.background = 'rgba(19,46,87,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9FA7B2'; e.currentTarget.style.background = 'transparent' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
              {STATUS_TABS.map((t) => (
                <button key={t.key} onClick={() => handleTabChange(t.key)}
                  className="flex-shrink-0 px-2.5 py-1 rounded text-xs font-bold transition-all"
                  style={statusFilter === t.key
                    ? { background: 'linear-gradient(135deg, #132E57 0%, #1E8496 100%)', color: '#fff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.03em' }
                    : { background: 'rgba(19,46,87,0.45)', color: '#fff', fontFamily: "'Rajdhani', sans-serif" }}
                  onMouseEnter={e => { if(statusFilter !== t.key) { e.currentTarget.style.background='rgba(19,46,87,0.65)' }}}
                  onMouseLeave={e => { if(statusFilter !== t.key) { e.currentTarget.style.background='rgba(19,46,87,0.45)' }}}>
                  {t.label}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#9FA7B2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input type="text" placeholder="Search name / code..."
                defaultValue={search}
                onKeyDown={handleSearch}
                className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none transition"
                style={{ background: '#fff', border: '1px solid #E0DDD5', color: '#132E57' }}
                onFocus={e => { e.target.style.borderColor='#1E8496'; e.target.style.boxShadow='0 0 0 2px rgba(30,132,150,0.12)' }}
                onBlur={e => { e.target.style.borderColor='#E0DDD5'; e.target.style.boxShadow='none' }}
              />
            </div>
          </div>

          {/* Resizable table */}
          <div ref={listContainerRef} className="overflow-hidden">
            {/* Header */}
            <div className="flex select-none"
              style={{ background: 'linear-gradient(90deg, #4A5568 0%, #5A6880 100%)', borderBottom: '2px solid #3A4558' }}>
              {cols.map((col, idx) => {
                const isLast = idx === cols.length - 1
                return (
                  <div key={col.key} className="relative flex items-center px-2 py-2.5 flex-shrink-0"
                    style={{ width: col.w }}>
                    <span className="text-xs font-bold uppercase tracking-widest truncate"
                      style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.07em' }}>
                      {col.label}
                    </span>
                    {!isLast && (
                      <div
                        className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize group z-10"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          userResizedRef.current = true
                          const next = cols[idx + 1]
                          listResizingRef.current = {
                            key: col.key, nextKey: next?.key,
                            startX: e.clientX, startW: col.w, nextStartW: next?.w ?? 0,
                          }
                        }}>
                        <div className="w-px h-3.5 rounded-full transition-all group-hover:w-0.5"
                          style={{ background: '#5C6D82' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#AA7F56'}
                          onMouseLeave={e => e.currentTarget.style.background = '#5C6D82'} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-6">
                <svg className="h-4 w-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                </svg>
              </div>
            )}
            {!loading && customers.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-gray-400">No records found.</p>
            )}
            {customers.map((c) => (
              <button key={c.id} onClick={() => selectCustomer(c)}
                className={`w-full text-left flex border-b border-gray-50 hover:bg-blue-50 transition-colors ${
                  selected?.id === c.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}>
                {cols.map(col => (
                  <div key={col.key} className="px-2 py-1.5 flex items-center flex-shrink-0 min-w-0 overflow-hidden"
                    style={{ width: col.w }}>
                    {col.key === 'name'     && <span className="text-xs text-gray-700 truncate">{c.first_name} {c.last_name}</span>}
                    {col.key === 'agent'    && <span className="text-xs text-gray-700 truncate">{c.agent?.display_name ?? 'â€”'}</span>}
                    {col.key === 'phone'    && <span className="text-xs font-mono text-gray-600 truncate">{c.phone ?? 'â€”'}</span>}
                    {col.key === 'vertical' && <span className="text-xs text-gray-700 truncate">{c.vertical_type ?? 'â€”'}</span>}
                    {col.key === 'did'      && <span className="text-xs font-mono text-gray-700 truncate">{c.client?.did_code ?? 'â€”'}</span>}
                  </div>
                ))}
              </button>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.last_page > 1 && (
            <div className="px-3 py-2 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-400">{meta.total} total</span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40 hover:bg-gray-50">Prev</button>
                <button disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* â”€â”€ Right panel: detail â”€â”€ */}
        <div className="flex-1 overflow-y-auto bg-gray-50 relative">

          {/* Re-open list button â€” visible only when list is collapsed */}
          {listCollapsed && (
            <button
              onClick={() => setListCollapsed(false)}
              title="Expand list"
              className="absolute top-3 left-3 z-20 flex items-center justify-center w-7 h-7 rounded-lg shadow-lg transition-all"
              style={{ background: 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)', color: '#ffffff', border: '1px solid #1E8496' }}
              onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, #2296AA 0%, #1E8496 100%)'}
              onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {!selected && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-3xl text-gray-200">â†</p>
                <p className="mt-2 text-sm text-gray-400">Select a record to view details</p>
              </div>
            </div>
          )}

          {selected && (
            <div className="p-6 space-y-5 max-w-2xl mx-auto">

              {/* Customer header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    {selected.first_name} {selected.mid_name} {selected.last_name}
                  </h2>
                  <p className="text-xs font-mono font-bold text-gray-700 mt-0.5">{selected.customer_code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={selected.status} />
                  <button
                    onClick={() => { setSelected(null); setSidebarCollapsed(false) }}
                    title="Close panel & expand sidebar"
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Action prompt banner */}
              {isFinalApprover && selected.status === 'approved' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900">Awaiting your final approval</p>
                    <p className="text-amber-700 text-xs mt-0.5">This record was approved by the manager. Final approve or reject below.</p>
                  </div>
                </div>
              )}
              {!isFinalApprover && selected.status === 'pending' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm">
                    <p className="font-semibold text-blue-900">Awaiting your approval</p>
                    <p className="text-blue-700 text-xs mt-0.5">After you approve, it will go to the director for final approval.</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {!isFinalApprover && selected.status === 'pending' && (
                  <>
                    <button onClick={() => openNoteModal('approve')} disabled={actionLoading}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
                      Approve
                    </button>
                    <button onClick={() => openNoteModal('reject')} disabled={actionLoading}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
                      Reject
                    </button>
                  </>
                )}
                {isFinalApprover && selected.status === 'approved' && (
                  <>
                    <button onClick={() => {
                      if (selected.client?.rate_type === 'variable') {
                        setRateInput('')
                        setRateModal(true)
                      } else {
                        doAction('final-approve')
                      }
                    }} disabled={actionLoading}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
                      Final Approve
                    </button>
                    <button onClick={() => setConfirmModal(true)} disabled={actionLoading}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
                      Final Reject
                    </button>
                  </>
                )}
                {!editing && (
                  <button onClick={() => setEditing(true)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-white transition-colors">
                    Edit
                  </button>
                )}
                {/* Permanent delete â€” director / admin only */}
                {isFinalApprover && !editing && (
                  <button onClick={() => setDeleteModal(true)} disabled={actionLoading}
                    className="ml-auto px-4 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60">
                    Delete Record
                  </button>
                )}
                {editing && (
                  <>
                    <button onClick={saveEdit} disabled={actionLoading}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
                      {actionLoading ? 'Savingâ€¦' : 'Save Changes'}
                    </button>
                    <button onClick={() => setEditing(false)}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-white transition-colors">
                      Cancel
                    </button>
                  </>
                )}
              </div>

              {/* Detail card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-1">

                <SectionTitle>Personal Information</SectionTitle>
                {editing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div><FieldLabel>First Name</FieldLabel>{inp('first_name', { placeholder: 'First name' })}</div>
                      <div><FieldLabel>Middle Name</FieldLabel>{inp('mid_name', { placeholder: 'Middle name' })}</div>
                      <div><FieldLabel>Last Name</FieldLabel>{inp('last_name', { placeholder: 'Last name' })}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><FieldLabel>Date of Birth</FieldLabel>{inp('date_of_birth', { type: 'date' })}</div>
                      <div><FieldLabel>Phone</FieldLabel>{inp('phone', { type: 'tel', placeholder: 'Phone' })}</div>
                    </div>
                  </div>
                ) : (
                  <dl className="space-y-1">
                    <DetailRow label="Full Name" value={[selected.first_name, selected.mid_name, selected.last_name].filter(Boolean).join(' ')} />
                    <DetailRow label="Date of Birth" value={selected.date_of_birth} />
                    <DetailRow label="Phone" value={selected.phone} />
                  </dl>
                )}

                <SectionTitle>Address</SectionTitle>
                {editing ? (
                  <div className="space-y-3">
                    <div><FieldLabel>Street Address</FieldLabel>{inp('address', { placeholder: 'Street address' })}</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><FieldLabel>City</FieldLabel>{inp('city', { placeholder: 'City' })}</div>
                      <div><FieldLabel>State</FieldLabel>{inp('state', { placeholder: 'State' })}</div>
                      <div><FieldLabel>ZIP</FieldLabel>{inp('postal_code', { placeholder: 'ZIP' })}</div>
                    </div>
                  </div>
                ) : (
                  <dl className="space-y-1">
                    <DetailRow label="Address" value={selected.address} />
                    <DetailRow label="City" value={selected.city} />
                    <DetailRow label="State" value={selected.state} />
                    <DetailRow label="ZIP" value={selected.postal_code} />
                  </dl>
                )}

                <SectionTitle>Business Information</SectionTitle>
                {editing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Vertical Type</FieldLabel>
                        <select name="vertical_type" value={editForm.vertical_type} onChange={handleEditChange} className={selectCls}>
                          <option value="">Selectâ€¦</option>
                          {VERTICAL_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      {editForm.vertical_type === 'Other' && (
                        <div><FieldLabel>Specify Other</FieldLabel>{inp('vertical_other', { placeholder: 'Specify' })}</div>
                      )}
                    </div>
                    {editForm.vertical_type && editForm.vertical_type !== 'Other' && (
                      <div>
                        <FieldLabel>DID</FieldLabel>
                        <select name="client_id" value={editForm.client_id} onChange={handleEditChange}
                          className={selectCls} disabled={editDidsLoading}>
                          <option value="">{editDidsLoading ? 'Loading DIDsâ€¦' : 'â€” Select DID â€”'}</option>
                          {editDids.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.did_code}{d.sale_type ? ` (${d.sale_type})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <dl className="space-y-1">
                    <DetailRow label="Vertical Type" value={selected.vertical_type} />
                    {selected.vertical_type === 'Other' && <DetailRow label="Vertical Other" value={selected.vertical_other} />}
                    <DetailRow label="DID Code" value={selected.client?.did_code} />
                    {selected.client?.sale_type && (
                      <div className="grid grid-cols-5 gap-2 py-1.5 border-b border-gray-50">
                        <dt className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sale Type</dt>
                        <dd className="col-span-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${selected.client.sale_type === 'CPA' ? 'bg-violet-100 text-violet-700' : 'bg-teal-100 text-teal-700'}`}>
                            {selected.client.sale_type}
                          </span>
                        </dd>
                      </div>
                    )}
                    {isFinalApprover && selected.client?.rate_type && (
                      <div className="grid grid-cols-5 gap-2 py-1.5 border-b border-gray-50">
                        <dt className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Rate Type</dt>
                        <dd className="col-span-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${selected.client.rate_type === 'fixed' ? 'bg-slate-100 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                            {selected.client.rate_type === 'fixed' ? 'Fixed' : 'Variable'}
                          </span>
                        </dd>
                      </div>
                    )}
                    {isFinalApprover && selected.client?.rate_type === 'fixed' && selected.client?.rate_of_sale_amount != null && (
                      <div className="grid grid-cols-5 gap-2 py-1.5 border-b border-gray-50">
                        <dt className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Rate</dt>
                        <dd className="col-span-3 text-sm font-semibold text-gray-800">
                          ${Number(selected.client.rate_of_sale_amount).toLocaleString()}
                        </dd>
                      </div>
                    )}
                    {isFinalApprover && selected.client?.rate_type === 'variable' && (
                      <div className="grid grid-cols-5 gap-2 py-1.5 border-b border-gray-50">
                        <dt className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Rate</dt>
                        <dd className="col-span-3">
                          <span className="text-xs text-orange-600 italic">Entered at approval</span>
                        </dd>
                      </div>
                    )}
                    <DetailRow label="Agent" value={selected.agent?.display_name ?? selected.agent?.username} />
                  </dl>
                )}

                <SectionTitle>Additional Information</SectionTitle>
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <FieldLabel>Comments</FieldLabel>
                      <textarea name="did_comments" value={editForm.did_comments} onChange={handleEditChange}
                        rows={3} placeholder="Commentsâ€¦"
                        className={`${inputCls} resize-none`} />
                    </div>
                    <div>
                      <FieldLabel>Transferred From</FieldLabel>{inp('transferred_from', { placeholder: 'Transferred from' })}
                    </div>
                    <div>
                      <FieldLabel>Reason</FieldLabel>
                      <select name="reason" value={editForm.reason} onChange={handleEditChange} className={selectCls}>
                        <option value="">Select reasonâ€¦</option>
                        {REASON_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <dl className="space-y-1">
                    <DetailRow label="Comments" value={selected.did_comments} />
                    <DetailRow label="Transferred From" value={selected.transferred_from} />
                    <DetailRow label="Reason" value={selected.reason} />
                  </dl>
                )}

                {selected.qa_comments && (
                  <>
                    <SectionTitle>QA Comments</SectionTitle>
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900 whitespace-pre-wrap">
                      {selected.qa_comments}
                    </div>
                  </>
                )}

                {(selected.manager_note || selected.final_note) && (
                  <>
                    <SectionTitle>Notes</SectionTitle>
                    <dl className="space-y-1">
                      <DetailRow label="Manager Note" value={selected.manager_note} />
                      <DetailRow label="Final Note" value={selected.final_note} />
                    </dl>
                  </>
                )}

                {isFinalApprover && selected.sale_rate_amount != null && (
                  <>
                    <SectionTitle>Sale Snapshot</SectionTitle>
                    <dl className="space-y-1">
                      <DetailRow label="DID at Close"  value={selected.sale_did_code} />
                      <DetailRow label="Rate at Close" value={`$${Number(selected.sale_rate_amount).toFixed(2)} (${selected.sale_rate_type ?? ''})`} />
                    </dl>
                  </>
                )}

                <SectionTitle>Timestamps</SectionTitle>
                <dl className="space-y-1">
                  {selected.submitted_at_pak && (
                    <div className="grid grid-cols-5 gap-2 py-1.5 border-b border-gray-50">
                      <dt className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sale Time (PKT)</dt>
                      <dd className="col-span-3 text-sm font-mono text-gray-800">{selected.submitted_at_pak}</dd>
                    </div>
                  )}
                  {selected.submitted_at_est && (
                    <div className="grid grid-cols-5 gap-2 py-1.5 border-b border-gray-50">
                      <dt className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sale Time (EST)</dt>
                      <dd className="col-span-3 text-sm font-mono text-gray-800">{selected.submitted_at_est}</dd>
                    </div>
                  )}
                  <DetailRow label="Approved At"       value={fmtWithPKT(selected.approved_at)} />
                  {selected.disapproved_at    && <DetailRow label="Disapproved At"    value={fmtWithPKT(selected.disapproved_at)} />}
                  <DetailRow label="Final Approved At" value={fmtWithPKT(selected.final_approved_at)} />
                  {selected.final_disapproved_at && <DetailRow label="Final Rejected At" value={fmtWithPKT(selected.final_disapproved_at)} />}
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modal â€” Final Reject */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-800">Final Reject Customer</h3>
            <p className="text-sm text-gray-600">
              This sale will be marked as <span className="font-semibold text-red-600">Final Rejected</span>.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm font-semibold text-red-700">Reason: Rejected by Client</span>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => doAction('final-reject')} disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
                {actionLoading ? 'Processingâ€¦' : 'Confirm Final Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete confirmation modal */}
      {deleteModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-800">Permanently Delete Record</h3>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-red-800">
                {selected.first_name} {selected.last_name}
              </p>
              <p className="text-xs font-mono font-bold text-red-600">{selected.customer_code}</p>
            </div>

            <p className="text-sm text-gray-600">
              This record will be <span className="font-semibold text-red-600">permanently deleted</span> and cannot be recovered. Are you absolutely sure?
            </p>

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setDeleteModal(false)} disabled={deleteLoading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={doDelete} disabled={deleteLoading}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2">
                {deleteLoading
                  ? <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"/></svg>Deletingâ€¦</>
                  : 'Yes, Delete Permanently'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variable Rate modal â€” director/admin must enter rate before final approval */}
      {rateModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-800">Enter Rate for Final Approval</h3>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              This client uses a <span className="font-semibold">variable rate</span>. Enter the actual rate agreed for this sale before approving.
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Rate Amount (USD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => { setRateModal(false); setRateInput('') }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => doAction('final-approve', undefined, { sale_rate_amount: parseFloat(rateInput) })}
                disabled={actionLoading || rateInput === '' || isNaN(parseFloat(rateInput)) || parseFloat(rateInput) < 0}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
                {actionLoading ? 'Processingâ€¦' : 'Confirm Final Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QA Comments modal â€” approve or reject */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 ${noteModal === 'approve' ? 'bg-green-100' : 'bg-red-100'}`}>
                <svg className={`w-5 h-5 ${noteModal === 'approve' ? 'text-green-600' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {noteModal === 'approve'
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                  }
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-800">
                {noteModal === 'approve' ? 'Approve Customer' : 'Reject Customer'}
              </h3>
            </div>

            {/* Reason of Cancellation â€” reject only */}
            {noteModal === 'reject' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Reason of Cancellation <span className="text-red-500">*</span>
                </label>
                <select value={noteReason} onChange={e => setNoteReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 cursor-pointer">
                  <option value="">Select reasonâ€¦</option>
                  {REASON_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            {/* QA Comments â€” required for both approve and reject */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                QA Comments <span className="text-red-500">*</span>
              </label>
              <textarea value={noteQa} onChange={e => setNoteQa(e.target.value)}
                rows={4} placeholder="Enter QA review commentsâ€¦"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 resize-none" />
            </div>

            {/* Additional note â€” reject only */}
            {noteModal === 'reject' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Additional Note <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                  rows={2} placeholder="Extra noteâ€¦"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 resize-none" />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => { setNoteModal(null); setNoteText(''); setNoteReason(''); setNoteQa('') }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => doAction(noteModal, noteText)}
                disabled={actionLoading || !noteQa.trim() || (noteModal === 'reject' && !noteReason)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${noteModal === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {actionLoading ? 'Processingâ€¦' : noteModal === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-5 gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <dt className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="col-span-3 text-sm text-gray-800 break-words">{value}</dd>
    </div>
  )
}


