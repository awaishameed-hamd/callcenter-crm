import { useState, useEffect, useMemo } from 'react'
import Layout from '../../components/Layout'
import DateInput from '../../components/DateInput'
import Toast from '../../components/Toast'
import api from '../../api/axios'

const CAMPAIGNS = ['Medicare', 'Final Expense', 'ACA']

// Core client field keys (always rendered with special hardcoded UI)
const CLIENT_CORE_KEYS = new Set([
  'company_name', 'campaign', 'did_code', 'sale_type',
  'rate_type', 'rate_of_sale_amount', 'opening_balance',
  'cycle_of_day', 'billing_start_after_days', 'notes',
])

const COL_SPAN_MAP = { full: 6, two_thirds: 4, half: 3, third: 2 }

const CAMPAIGN_BADGE = {
  'Medicare':       'bg-blue-100 text-blue-700',
  'Final Expense':  'bg-purple-100 text-purple-700',
  'ACA':            'bg-emerald-100 text-emerald-700',
}

const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-400'
const selectCls = inputCls + ' cursor-pointer'

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Confirm({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <p className="text-sm text-gray-700 mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  company_name: '',
  campaign: '',
  did_code: '',
  sale_type: '',
  rate_type: 'fixed',
  rate_of_sale_amount: '',
  opening_balance: '',
  cycle_of_day: '',
  billing_start_after_days: '',
  notes: '',
}

// ── Generic extra-field renderer (for custom non-core fields) ─────────────────
function ClientExtraField({ field, value, onChange, error }) {
  const span = COL_SPAN_MAP[field.col_span] ?? 3
  const errCls = error ? 'border-red-400' : ''
  const handle = (e) => onChange(field.field_key, e.target.value)

  let input
  switch (field.field_type) {
    case 'date':
      input = <DateInput value={value} onChange={handle} className={`${inputCls} ${errCls}`} />
      break
    case 'number':
      input = <input type="number" value={value} onChange={handle} placeholder={field.placeholder ?? ''}
                className={`${inputCls} ${errCls}`} />
      break
    case 'textarea':
      input = <textarea value={value} onChange={handle} rows={field.textarea_rows || 3}
                placeholder={field.placeholder ?? ''}
                className={`${inputCls} resize-none ${errCls}`} />
      break
    case 'select':
      input = (
        <select value={value} onChange={handle} className={`${selectCls} ${errCls}`}>
          <option value="">Select…</option>
          {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
      break
    case 'amount_usd':
      input = (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold select-none">$</span>
          <input type="number" value={value} onChange={handle} placeholder={field.placeholder ?? '0.00'}
            className={`${inputCls} pl-7 ${errCls}`} />
        </div>
      )
      break
    case 'amount_pkr':
      input = (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold select-none">₨</span>
          <input type="number" value={value} onChange={handle} placeholder={field.placeholder ?? '0.00'}
            className={`${inputCls} pl-7 ${errCls}`} />
        </div>
      )
      break
    default:
      input = <input type="text" value={value} onChange={handle} placeholder={field.placeholder ?? ''}
                className={`${inputCls} ${errCls}`} />
  }

  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <Field label={field.label} required={field.is_required} error={error}>{input}</Field>
    </div>
  )
}

// ── Client Form ───────────────────────────────────────────────────────────────
function ClientForm({ initial, onSubmit, loading, errors }) {
  const isEdit = !!initial
  const [form, setForm] = useState(
    isEdit
      ? { ...EMPTY_FORM, ...initial, rate_of_sale_amount: initial.rate_of_sale_amount ?? '', sale_type: initial.sale_type ?? '' }
      : EMPTY_FORM
  )
  const [extraFields, setExtraFields] = useState(initial?.extra_fields ?? {})
  const [availableDids, setAvailableDids] = useState([])
  const [didsLoading, setDidsLoading]     = useState(false)
  const [fieldConfigs, setFieldConfigs]   = useState([])

  // Fetch field configs on mount
  useEffect(() => {
    api.get('/crm/form-fields/public', { params: { form_type: 'client' } })
      .then(res => setFieldConfigs(res.data))
      .catch(() => {})
  }, [])

  // Config helpers
  const cfg         = (key) => fieldConfigs.find(f => f.field_key === key) ?? null
  const isVis       = (key) => cfg(key)?.is_visible !== false   // default visible if not in config
  const getLabel    = (key, fb) => cfg(key)?.label ?? fb
  const isReq       = (key, fb = false) => cfg(key)?.is_required ?? fb
  const getPlaceholder = (key, fb = '') => cfg(key)?.placeholder ?? fb

  // Custom (non-core) fields from config
  const customFields = useMemo(
    () => fieldConfigs.filter(f => !CLIENT_CORE_KEYS.has(f.field_key)),
    [fieldConfigs]
  )

  const set = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }))
  const err = (k) => errors[k]?.[0]

  const inp = (name, props = {}) => (
    <input name={name} value={form[name] ?? ''} onChange={set}
      className={`${inputCls} ${err(name) ? 'border-red-400' : ''}`} {...props} />
  )

  const loadDids = async (campaign, currentDid) => {
    if (!campaign) { setAvailableDids([]); return }
    setDidsLoading(true)
    try {
      const params = { campaign }
      if (currentDid) params.current_did = currentDid
      const { data } = await api.get('/clients/available-dids', { params })
      setAvailableDids(data)
    } catch {
      setAvailableDids([])
    } finally {
      setDidsLoading(false)
    }
  }

  useEffect(() => {
    loadDids(form.campaign, isEdit ? initial.did_code : null)
  }, [form.campaign])

  const handleCampaignChange = (e) => {
    const newCampaign = e.target.value
    setForm((p) => ({ ...p, campaign: newCampaign, did_code: '' }))
  }

  const handleRateTypeChange = (type) => {
    setForm((p) => ({ ...p, rate_type: type, rate_of_sale_amount: type === 'variable' ? '' : p.rate_of_sale_amount }))
  }

  const handleExtraChange = (key, val) => setExtraFields(p => ({ ...p, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (Object.keys(extraFields).length > 0) payload.extra_fields = extraFields
    onSubmit(payload)
  }

  return (
    <form id="client-form" onSubmit={handleSubmit} className="space-y-4">

      {/* Company Name */}
      {isVis('company_name') && (
        <Field label={getLabel('company_name', 'Company Name')} required={isReq('company_name', true)} error={err('company_name')}>
          {inp('company_name', { placeholder: getPlaceholder('company_name', 'e.g. Acme Insurance Co.'), required: isReq('company_name', true) })}
        </Field>
      )}

      {/* Campaign */}
      {isVis('campaign') && (
        <Field label={getLabel('campaign', 'Campaign')} required={isReq('campaign', true)} error={err('campaign')}>
          <select name="campaign" value={form.campaign} onChange={handleCampaignChange}
            className={`${selectCls} ${err('campaign') ? 'border-red-400' : ''}`} required={isReq('campaign', true)}>
            <option value="">Select campaign…</option>
            {CAMPAIGNS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      )}

      {/* DID Assignment — always hardcoded special UI */}
      {isVis('did_code') && (
        <Field label={getLabel('did_code', 'Assign DID')} error={err('did_code')}>
          <select name="did_code" value={form.did_code} onChange={set}
            disabled={!form.campaign || didsLoading}
            className={`${selectCls} ${err('did_code') ? 'border-red-400' : ''}`}>
            <option value="">
              {!form.campaign ? 'Select a campaign first…' : didsLoading ? 'Loading DIDs…' : '— No DID assigned —'}
            </option>
            {availableDids.map((d) => (
              <option key={d.id} value={d.did_code}>{d.did_code}</option>
            ))}
          </select>
          {form.campaign && !didsLoading && availableDids.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">No available DIDs for {form.campaign}.</p>
          )}
        </Field>
      )}

      {/* Sale Type */}
      {isVis('sale_type') && (
        <Field label={getLabel('sale_type', 'Type')} required={isReq('sale_type', true)} error={err('sale_type')}>
          <select name="sale_type" value={form.sale_type} onChange={set}
            className={`${selectCls} ${err('sale_type') ? 'border-red-400' : ''}`} required={isReq('sale_type', true)}>
            <option value="">Select type</option>
            <option value="CPA">CPA</option>
            <option value="CPL">CPL</option>
          </select>
        </Field>
      )}

      {/* Opening Balance */}
      {isVis('opening_balance') && (
        <Field label={getLabel('opening_balance', 'Opening Balance (USD)')} error={err('opening_balance')}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold select-none">$</span>
            <input name="opening_balance" type="number" min="0" step="0.01" value={form.opening_balance ?? ''} onChange={set}
              placeholder={getPlaceholder('opening_balance', '0.00')}
              className={`${inputCls} pl-7 ${err('opening_balance') ? 'border-red-400' : ''}`} />
          </div>
          <p className="mt-1 text-xs text-gray-400">Enter the existing balance for clients being migrated.</p>
        </Field>
      )}

      {/* Rate Type toggle — always special UI */}
      {isVis('rate_type') && (
        <Field label={getLabel('rate_type', 'Rate Type')} required={isReq('rate_type', true)} error={err('rate_type')}>
          <div className="flex gap-3">
            {['fixed', 'variable'].map((type) => (
              <button key={type} type="button" onClick={() => handleRateTypeChange(type)}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.rate_type === type ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* Rate amount — conditional on rate_type */}
      {isVis('rate_of_sale_amount') && form.rate_type === 'fixed' && (
        <Field label={getLabel('rate_of_sale_amount', 'Rate Per Sale (USD)')} required error={err('rate_of_sale_amount')}>
          {inp('rate_of_sale_amount', { type: 'number', min: '0', step: '0.01', placeholder: getPlaceholder('rate_of_sale_amount', '0.00'), required: true })}
        </Field>
      )}

      {form.rate_type === 'variable' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          Variable rate — actual rate determined per sale.
        </div>
      )}

      {/* Cycle settings */}
      <div className="grid grid-cols-2 gap-4">
        {isVis('cycle_of_day') && (
          <Field label={getLabel('cycle_of_day', 'Cycle (Days)')} required={isReq('cycle_of_day', true)} error={err('cycle_of_day')}>
            {inp('cycle_of_day', { type: 'number', min: '1', placeholder: getPlaceholder('cycle_of_day', 'e.g. 30'), required: isReq('cycle_of_day', true) })}
          </Field>
        )}
        {isVis('billing_start_after_days') && (
          <Field label={getLabel('billing_start_after_days', 'Billing Starts After (Days)')} required={isReq('billing_start_after_days', true)} error={err('billing_start_after_days')}>
            {inp('billing_start_after_days', { type: 'number', min: '0', placeholder: getPlaceholder('billing_start_after_days', 'e.g. 0'), required: isReq('billing_start_after_days', true) })}
          </Field>
        )}
      </div>

      {/* Notes */}
      {isVis('notes') && (
        <Field label={getLabel('notes', 'Notes')} error={err('notes')}>
          <textarea name="notes" value={form.notes ?? ''} onChange={set}
            rows={cfg('notes')?.textarea_rows ?? 3}
            placeholder={getPlaceholder('notes', 'Optional notes…')}
            className={`${inputCls} resize-none ${err('notes') ? 'border-red-400' : ''}`} />
        </Field>
      )}

      {/* ── Custom extra fields ─────────────────────────────────────────── */}
      {customFields.length > 0 && (
        <div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            {customFields.map(field => (
              <ClientExtraField
                key={field.field_key}
                field={field}
                value={extraFields[field.field_key] ?? ''}
                onChange={handleExtraChange}
                error={err(field.field_key)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-60">
          {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Client'}
        </button>
      </div>
    </form>
  )
}

export default function Clients() {
  const [clients, setClients]   = useState([])
  const [meta, setMeta]         = useState(null)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [statusFilter, setStatusFilter]     = useState('')
  const [loading, setLoading]   = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [editClient, setEditClient] = useState(null)
  const [confirmToggle, setConfirmToggle] = useState(null)

  const [formLoading, setFormLoading] = useState(false)
  const [formErrors, setFormErrors]   = useState({})
  const [toast, setToast]             = useState(null)

  const fetchClients = async (pg, srch, campaign, status) => {
    setLoading(true)
    try {
      const params = { page: pg }
      if (srch)     params.search   = srch
      if (campaign) params.campaign = campaign
      if (status)   params.status   = status
      const { data } = await api.get('/clients', { params })
      setClients(data.data ?? [])
      setMeta(data)
    } catch {
      setToast({ message: 'Failed to load clients.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClients(page, search, campaignFilter, statusFilter) }, [page, search, campaignFilter, statusFilter])

  const handleSearch = (e) => { e.preventDefault(); setPage(1); setSearch(searchInput) }

  const handleCreate = async (form) => {
    setFormLoading(true); setFormErrors({})
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]))
    try {
      await api.post('/clients', payload)
      setToast({ message: 'Client created successfully.', type: 'success' })
      setShowCreate(false)
      fetchClients(page, search, campaignFilter, statusFilter)
    } catch (err) {
      if (err.response?.status === 422) setFormErrors(err.response.data?.errors ?? {})
      else setToast({ message: err.response?.data?.message ?? 'Failed to create client.', type: 'error' })
    } finally { setFormLoading(false) }
  }

  const handleEdit = async (form) => {
    setFormLoading(true); setFormErrors({})
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]))
    try {
      await api.put(`/clients/${editClient.id}`, payload)
      setToast({ message: 'Client updated successfully.', type: 'success' })
      setEditClient(null)
      fetchClients(page, search, campaignFilter, statusFilter)
    } catch (err) {
      if (err.response?.status === 422) setFormErrors(err.response.data?.errors ?? {})
      else setToast({ message: err.response?.data?.message ?? 'Failed to update client.', type: 'error' })
    } finally { setFormLoading(false) }
  }

  const handleToggleActive = async () => {
    const c = confirmToggle; setConfirmToggle(null)
    try {
      await api.post(`/clients/${c.id}/toggle-active`)
      setToast({ message: `${c.company_name} ${c.is_active ? 'deactivated' : 'activated'}.`, type: 'success' })
      fetchClients(page, search, campaignFilter, statusFilter)
    } catch {
      setToast({ message: 'Failed to update client status.', type: 'error' })
    }
  }

  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {showCreate && (
        <Modal title="New Client" onClose={() => { setShowCreate(false); setFormErrors({}) }}>
          <ClientForm onSubmit={handleCreate} loading={formLoading} errors={formErrors} />
        </Modal>
      )}
      {editClient && (
        <Modal title={`Edit Client — ${editClient.company_name}`} onClose={() => { setEditClient(null); setFormErrors({}) }}>
          <ClientForm initial={editClient} onSubmit={handleEdit} loading={formLoading} errors={formErrors} />
        </Modal>
      )}
      {confirmToggle && (
        <Confirm
          message={`${confirmToggle.is_active ? 'Deactivate' : 'Activate'} client "${confirmToggle.company_name}"? ${confirmToggle.is_active && confirmToggle.did_code ? `DID ${confirmToggle.did_code} will become available again.` : ''}`}
          onConfirm={handleToggleActive}
          onCancel={() => setConfirmToggle(null)}
        />
      )}

      <div className="p-5 space-y-4" style={{ background: '#EDF0F3', minHeight: '100vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#132E57', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>Client Management</h1>
            <p className="text-sm mt-0.5" style={{ color: '#5C5C5C' }}>Manage real clients and their DID assignments</p>
          </div>
          <button onClick={() => { setShowCreate(true); setFormErrors({}) }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all"
            style={{ background: 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)', color: '#ffffff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
            onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, #2296AA 0%, #1E8496 100%)'}
            onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)'}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Client
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 shadow-sm"
          style={{ background: 'linear-gradient(135deg, #0E5F6E 0%, #1E8496 100%)', border: '1px solid #1A7888' }}>

          {/* Campaign tabs */}
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(0,0,0,0.15)' }}>
            {[{ label: 'All', value: '' }, ...CAMPAIGNS.map((c) => ({ label: c, value: c }))].map(({ label, value }) => (
              <button key={value} onClick={() => { setCampaignFilter(value); setPage(1) }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={campaignFilter === value
                  ? { background: 'linear-gradient(135deg, #132E57 0%, #1E8496 100%)', color: '#fff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }
                  : { background: 'transparent', color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}
                onMouseEnter={e => { if(campaignFilter !== value) { e.currentTarget.style.background='rgba(255,255,255,0.15)' }}}
                onMouseLeave={e => { if(campaignFilter !== value) { e.currentTarget.style.background='transparent' }}}>
                {label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-7 self-center" style={{ background: 'rgba(255,255,255,0.2)' }} />

          {/* Status tabs */}
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(0,0,0,0.15)' }}>
            {[{ label: 'All', value: '' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }].map(({ label, value }) => (
              <button key={value} onClick={() => { setStatusFilter(value); setPage(1) }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={statusFilter === value
                  ? { background: 'linear-gradient(135deg, #132E57 0%, #1E8496 100%)', color: '#fff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }
                  : { background: 'transparent', color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif" }}
                onMouseEnter={e => { if(statusFilter !== value) { e.currentTarget.style.background='rgba(255,255,255,0.15)' }}}
                onMouseLeave={e => { if(statusFilter !== value) { e.currentTarget.style.background='transparent' }}}>
                {label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-7 self-center" style={{ background: 'rgba(255,255,255,0.2)' }} />

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#5C6D82">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input type="text" placeholder="Search company or DID…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg text-xs outline-none transition w-48"
                style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}
                onFocus={e => { e.target.style.borderColor='#D7A520'; e.target.style.background='rgba(255,255,255,0.25)' }}
                onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.3)'; e.target.style.background='rgba(0,0,0,0.15)' }} />
            </div>
            <button type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: 'linear-gradient(135deg, #132E57 0%, #1E8496 100%)', color: '#fff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
              onMouseEnter={e => e.currentTarget.style.opacity='0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity='1'}>
              Search
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: 'linear-gradient(90deg, #4A5568 0%, #5A6880 100%)', borderBottom: '2px solid #3A4558' }}>
                  {['Company','Campaign','Assigned DID','Type','Rate Type','Rate','Opening Bal.','Cycle','Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-bold uppercase"
                      style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.07em', background: 'transparent' }}>{h}</th>
                  ))}
                  <th className="px-5 py-3 text-xs font-bold uppercase text-right"
                    style={{ color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.07em', background: 'transparent' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse w-20" /></td>
                    ))}</tr>
                  ))
                ) : clients.length === 0 ? (
                  <tr><td colSpan={10} className="px-5 py-12 text-center text-sm">
                    <p className="text-gray-400">No clients found.</p>
                    <p className="text-gray-300 text-xs mt-1">Click <span className="font-semibold">+ New Client</span> to add one.</p>
                  </td></tr>
                ) : (
                  clients.map((c) => (
                    <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${!c.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3.5 font-medium text-gray-800">{c.company_name}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CAMPAIGN_BADGE[c.campaign] ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.campaign ?? 'N/A'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.did_code
                          ? <span className="font-mono font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{c.did_code}</span>
                          : <span className="text-gray-400 text-xs">N/A</span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        {c.sale_type
                          ? <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${c.sale_type === 'CPA' ? 'bg-violet-100 text-violet-700' : 'bg-teal-100 text-teal-700'}`}>{c.sale_type}</span>
                          : <span className="text-gray-400 text-xs">N/A</span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.rate_type === 'fixed' ? 'bg-slate-100 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                          {c.rate_type === 'fixed' ? 'Fixed' : 'Variable'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.rate_type === 'fixed' && c.rate_of_sale_amount != null
                          ? <span className="text-gray-600 text-xs font-mono">${Number(c.rate_of_sale_amount).toLocaleString()}</span>
                          : <span className="text-gray-400 text-xs">N/A</span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        {c.opening_balance != null && Number(c.opening_balance) > 0
                          ? <span className="text-emerald-700 text-xs font-mono font-semibold">${Number(c.opening_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          : <span className="text-gray-400 text-xs">N/A</span>
                        }
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{c.cycle_of_day ? `${c.cycle_of_day}d` : 'N/A'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setEditClient(c); setFormErrors({}) }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button onClick={() => setConfirmToggle(c)}
                            className={`p-1.5 rounded-lg transition-colors ${c.is_active ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                            title={c.is_active ? 'Deactivate' : 'Activate'}>
                            {c.is_active ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {meta && meta.last_page > 1 && (
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">Showing {meta.from}–{meta.to} of {meta.total} clients</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={meta.current_page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Previous</button>
                <button onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))} disabled={meta.current_page === meta.last_page}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
