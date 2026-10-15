import { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/Layout'
import api from '../../api/axios'

const STATUS_TABS = [
  { key: '',                   label: 'All' },
  { key: 'pending',            label: 'Pending' },
  { key: 'approved',           label: 'Approved by Manager' },
  { key: 'disapproved',        label: 'Rejected by Manager' },
  { key: 'final_approved',     label: 'Final Approved' },
  { key: 'final_disapproved',  label: 'Final Rejected' },
  { key: 'agent_rejected',     label: 'Rejected by Agent' },
]

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

function Badge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function timeOnly(str) {
  if (!str) return null
  const parts = str.split(' ')
  return parts.slice(3).join(' ')
}
function fmtWithPKT(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' })
  return `${date} · ${time} PKT`
}

function Row({ label, value }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-5 gap-2 py-2 border-b border-gray-50 last:border-0">
      <dt className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="col-span-3 text-sm text-gray-800 break-words">{value}</dd>
    </div>
  )
}

function DetailModal({ customer, onClose }) {
  if (!customer) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">
              {customer.first_name} {customer.mid_name} {customer.last_name}
            </h2>
            <p className="text-xs font-mono font-bold text-gray-700 mt-0.5">{customer.customer_code}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge status={customer.status} />
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-5">
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Personal Information</h3>
            <dl>
              <Row label="Date of Birth" value={customer.date_of_birth} />
              <Row label="Phone" value={customer.phone} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Address</h3>
            <dl>
              <Row label="Street" value={customer.address} />
              <Row label="City" value={customer.city} />
              <Row label="State" value={customer.state} />
              <Row label="ZIP" value={customer.postal_code} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Business Information</h3>
            <dl>
              <Row label="Vertical Type" value={customer.vertical_type} />
              {customer.vertical_type === 'Other' && (
                <Row label="Vertical Other" value={customer.vertical_other} />
              )}
              <Row label="DID Code" value={customer.client?.did_code} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Additional Information</h3>
            <dl>
              <Row label="DiD & Comments" value={customer.did_comments} />
              <Row label="Transferred From" value={customer.transferred_from} />
              <Row label="Reason" value={customer.reason} />
            </dl>
          </section>

          {customer.qa_comments && (
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">QA Comments</h3>
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900 whitespace-pre-wrap">
                {customer.qa_comments}
              </div>
            </section>
          )}

          {(customer.manager_note || customer.final_note) && (
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Notes</h3>
              <dl>
                <Row label="Manager Note" value={customer.manager_note} />
                <Row label="Final Note" value={customer.final_note} />
              </dl>
            </section>
          )}

          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Timestamps</h3>
            <dl>
              <Row label="Sale Time (PKT)" value={customer.submitted_at_pak} />
              <Row label="Sale Time (EST)" value={customer.submitted_at_est} />
              <Row label="Approved At"       value={fmtWithPKT(customer.approved_at)} />
              <Row label="Final Approved At" value={fmtWithPKT(customer.final_approved_at)} />
            </dl>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MySales() {
  const [tab, setTab]           = useState('')
  const [customers, setCustomers] = useState([])
  const [meta, setMeta]         = useState(null)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page }
      if (tab)    params.status = tab
      if (search) params.search = search
      const { data } = await api.get('/customers', { params })
      setCustomers(data.data)
      setMeta(data)
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [tab, page, search])

  useEffect(() => { load() }, [load])

  const handleTabChange = (key) => { setTab(key); setPage(1) }

  const handleSearch = (e) => {
    if (e.key === 'Enter') { setSearch(e.target.value); setPage(1) }
  }

  return (
    <Layout>
      <div className="p-5 space-y-4 max-w-6xl mx-auto" style={{ background: '#EDF0F3', minHeight: '100vh' }}>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#132E57', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>My Sales</h1>
          <p className="text-sm mt-0.5" style={{ color: '#5C5C5C' }}>All customer records you have submitted</p>
        </div>

        {/* Tabs + Search bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 shadow-sm"
          style={{ background: 'linear-gradient(135deg, #0E5F6E 0%, #1E8496 100%)', border: '1px solid #1A7888' }}>
          <div className="flex gap-1 overflow-x-auto" style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '3px' }}>
            {STATUS_TABS.map((t) => (
              <button key={t.key} onClick={() => handleTabChange(t.key)}
                className="px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all"
                style={tab === t.key
                  ? { background: 'linear-gradient(135deg, #132E57 0%, #1E8496 100%)', color: '#fff', fontFamily: "'Rajdhani', sans-serif" }
                  : { background: 'transparent', color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}
                onMouseEnter={e => { if(tab !== t.key) e.currentTarget.style.background='rgba(255,255,255,0.15)' }}
                onMouseLeave={e => { if(tab !== t.key) e.currentTarget.style.background='transparent' }}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 self-center" style={{ background: 'rgba(255,255,255,0.2)' }} />

          <input
            type="text"
            placeholder="Search by name or code… (press Enter)"
            defaultValue={search}
            onKeyDown={handleSearch}
            className="rounded-lg px-3 py-1.5 text-xs outline-none transition"
            style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', minWidth: 220 }}
            onFocus={e => { e.target.style.borderColor='#D7A520'; e.target.style.background='rgba(255,255,255,0.25)' }}
            onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.3)'; e.target.style.background='rgba(0,0,0,0.15)' }}
          />
          {loading && (
            <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
            </svg>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'linear-gradient(90deg, #4A5568 0%, #5A6880 100%)', borderBottom: '2px solid #3A4558' }}>
                  {['#','Code','Name','Phone','ZIP','Vertical','DID','Date','Status',''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase"
                      style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.07em', background: 'transparent' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">No records found.</td>
                  </tr>
                )}
                {customers.map((c, i) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{(meta?.from ?? 0) + i}</td>
                    <td className="px-4 py-3 font-mono font-bold text-xs text-gray-700">{c.customer_code}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.phone ?? 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.postal_code ?? 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.vertical_type ?? 'N/A'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.client?.did_code ?? 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3"><Badge status={c.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelected(c)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.last_page > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Showing {meta.from}–{meta.to} of {meta.total}
              </p>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-md border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  Prev
                </button>
                <button disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-md border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DetailModal customer={selected} onClose={() => setSelected(null)} />
    </Layout>
  )
}
