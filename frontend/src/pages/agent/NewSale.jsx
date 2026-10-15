import { useState, useEffect, useMemo } from 'react'
import Layout from '../../components/Layout'
import Toast from '../../components/Toast'
import DateInput from '../../components/DateInput'
import api from '../../api/axios'

// ── Static styles ─────────────────────────────────────────────────────────────
const inputCls  = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'
const selectCls = inputCls + ' cursor-pointer'

// ── Width → CSS grid span (out of 6 columns) ─────────────────────────────────
const COL_SPAN_MAP = {
  full:       6,
  two_thirds: 4,
  half:       3,
  third:      2,
}

// ── Known standard columns in the customers table ────────────────────────────
// Everything else goes into extra_fields JSON
const STANDARD_KEYS = new Set([
  'vertical_type', 'vertical_other', 'client_id',
  'first_name', 'mid_name', 'last_name', 'age', 'date_of_birth', 'phone',
  'address', 'city', 'state', 'postal_code',
  'transferred_from', 'did_comments', 'reason',
])

// Campaign mapping for DID loading
const VERTICAL_TO_CAMPAIGN = {
  'Medicare':      'Medicare',
  'Final Expense': 'Final Expense',
  'ACA':           'ACA',
}

// ── Shared field components ───────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

// ── Generic field renderer ────────────────────────────────────────────────────
function GenericField({ field, value, onChange, error }) {
  const cls = `${inputCls} ${error ? 'border-red-400' : ''}`

  switch (field.field_type) {
    case 'textarea':
      return (
        <textarea
          name={field.field_key}
          value={value}
          onChange={onChange}
          rows={field.textarea_rows || 3}
          placeholder={field.placeholder || ''}
          required={field.is_required}
          className={`${cls} resize-none`}
        />
      )
    case 'date':
      return (
        <DateInput
          name={field.field_key}
          value={value}
          onChange={onChange}
          required={field.is_required}
          className={cls}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          name={field.field_key}
          value={value}
          onChange={onChange}
          placeholder={field.placeholder || ''}
          required={field.is_required}
          className={cls}
        />
      )
    case 'amount_usd':
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold select-none"
            style={{ color: '#065F46' }}>$</span>
          <input
            type="number" min="0" step="0.01"
            name={field.field_key}
            value={value}
            onChange={onChange}
            placeholder="0.00"
            required={field.is_required}
            className={`${cls} pl-7`}
          />
        </div>
      )
    case 'amount_pkr':
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold select-none"
            style={{ color: '#92400E' }}>₨</span>
          <input
            type="number" min="0" step="0.01"
            name={field.field_key}
            value={value}
            onChange={onChange}
            placeholder="0.00"
            required={field.is_required}
            className={`${cls} pl-7`}
          />
        </div>
      )
    case 'select':
      return (
        <select
          name={field.field_key}
          value={value}
          onChange={onChange}
          required={field.is_required}
          className={`${selectCls} ${error ? 'border-red-400' : ''}`}>
          <option value="">Select…</option>
          {(field.options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    default: // text
      return (
        <input
          type="text"
          name={field.field_key}
          value={value}
          onChange={onChange}
          placeholder={field.placeholder || ''}
          required={field.is_required}
          className={cls}
        />
      )
  }
}

// ── Vertical & DID section (core logic, always rendered) ─────────────────────
function VerticalDIDSection({ verticalField, didField, form, clients, didsLoading, set, err }) {
  const verticalOptions = verticalField?.options ?? ['Medicare', 'Final Expense', 'ACA', 'Other']
  const showOther       = form.vertical_type === 'Other'
  const showDID         = form.vertical_type && form.vertical_type !== 'Other'

  return (
    <Section title={verticalField?.section ?? 'Vertical & DID'}>
      <div className="grid grid-cols-2 gap-4 items-start">

        {/* Vertical Type */}
        <Field label={verticalField?.label ?? 'Vertical Type'}
          required={verticalField?.is_required ?? true}
          error={err('vertical_type')}>
          <select name="vertical_type" value={form.vertical_type} onChange={set}
            className={`${selectCls} ${err('vertical_type') ? 'border-red-400' : ''}`}
            required={verticalField?.is_required ?? true}>
            <option value="">Select vertical…</option>
            {verticalOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>

        {/* Specify Other */}
        {showOther && (
          <Field label="Specify Other" error={err('vertical_other')}>
            <input name="vertical_other" type="text" value={form.vertical_other} onChange={set}
              placeholder="Specify vertical type"
              className={`${inputCls} ${err('vertical_other') ? 'border-red-400' : ''}`} />
          </Field>
        )}

        {/* DID selector */}
        {showDID && didField && (
          <Field label={didField.label ?? 'Select DID'}
            required={didField.is_required ?? true}
            error={err('client_id')}>
            {didsLoading ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-300 bg-gray-50">
                <svg className="h-4 w-4 animate-spin text-teal-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                </svg>
                <span className="text-sm text-gray-400">Loading DIDs…</span>
              </div>
            ) : clients.length === 0 ? (
              <div className="px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-600">
                No active DIDs found for {form.vertical_type}
              </div>
            ) : (
              <div className="space-y-1.5">
                <select name="client_id" value={form.client_id} onChange={set}
                  className={`${selectCls} ${err('client_id') ? 'border-red-400' : ''}`}
                  required={didField.is_required ?? true}>
                  <option value="">Select DID</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.did_code}</option>)}
                </select>
                {form.client_id && (() => {
                  const sel = clients.find(c => String(c.id) === String(form.client_id))
                  if (!sel?.sale_type) return null
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Sale Type:</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${sel.sale_type === 'CPA' ? 'bg-violet-100 text-violet-700' : 'bg-teal-100 text-teal-700'}`}>
                        {sel.sale_type}
                      </span>
                    </div>
                  )
                })()}
              </div>
            )}
          </Field>
        )}
      </div>
    </Section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function NewSale() {
  const [formConfig, setFormConfig] = useState(null)  // null = loading
  const [form, setForm]             = useState({})
  const [clients, setClients]       = useState([])
  const [didsLoading, setDidsLoading] = useState(false)
  const [errors, setErrors]         = useState({})
  const [loading, setLoading]       = useState(false)
  const [toast, setToast]           = useState(null)

  // ── Fetch form config from backend ────────────────────────────────────────
  useEffect(() => {
    api.get('/crm/form-fields/public')
      .then(({ data }) => {
        setFormConfig(data)
        // Build initial empty form state from field keys
        const empty = { vertical_other: '' }
        data.forEach(f => { empty[f.field_key] = '' })
        setForm(empty)
      })
      .catch(() => {
        // Fallback to hardcoded defaults
        setFormConfig([])
        setForm({
          vertical_type: '', vertical_other: '', client_id: '',
          first_name: '', mid_name: '', last_name: '', age: '',
          date_of_birth: '', phone: '', address: '', city: '',
          state: '', postal_code: '', transferred_from: '',
          did_comments: '', reason: '',
        })
      })
  }, [])

  // ── Load DIDs when vertical changes ──────────────────────────────────────
  useEffect(() => {
    const campaign = VERTICAL_TO_CAMPAIGN[form.vertical_type]
    setForm(p => ({ ...p, client_id: '' }))
    setClients([])
    if (!campaign) return
    setDidsLoading(true)
    api.get('/clients/dropdown', { params: { campaign } })
      .then(({ data }) => setClients(data))
      .catch(() => setClients([]))
      .finally(() => setDidsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vertical_type])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const set = (e) => {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: value }))
    if (errors[name]) setErrors(p => ({ ...p, [name]: undefined }))
  }

  const err = (k) => errors[k]?.[0]

  const resetForm = () => {
    const empty = { vertical_other: '' }
    ;(formConfig || []).forEach(f => { empty[f.field_key] = '' })
    setForm(empty)
    setClients([])
    setErrors({})
  }

  // ── Derived: group non-core fields by section (skip Vertical & DID) ───────
  const sections = useMemo(() => {
    if (!formConfig) return {}
    const SKIP = new Set(['vertical_type', 'client_id'])
    const map  = {}
    const order = []
    formConfig.forEach(f => {
      if (SKIP.has(f.field_key)) return
      const s = f.section || 'Other'
      if (!map[s]) { map[s] = []; order.push(s) }
      map[s].push(f)
    })
    return { map, order }
  }, [formConfig])

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    if (form.vertical_type && form.vertical_type !== 'Other' && !form.client_id) {
      setErrors({ client_id: ['DID selection is required.'] })
      setToast({ message: 'Please select a DID before submitting.', type: 'error' })
      setLoading(false)
      return
    }

    // Split standard vs custom fields
    const standard  = {}
    const extraData = {}
    Object.entries(form).forEach(([k, v]) => {
      const val = v === '' ? null : v
      if (STANDARD_KEYS.has(k)) standard[k] = val
      else if (k !== 'vertical_other') extraData[k] = val  // vertical_other is standard but handled separately
    })
    standard.vertical_other = form.vertical_other === '' ? null : form.vertical_other

    const payload = {
      ...standard,
      ...(Object.keys(extraData).length > 0 ? { extra_fields: extraData } : {}),
    }

    try {
      await api.post('/customers', payload)
      setToast({ message: 'Sale recorded successfully!', type: 'success' })
      resetForm()
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data?.errors ?? {})
        setToast({ message: 'Please fix the highlighted errors.', type: 'error' })
      } else {
        setToast({ message: err.response?.data?.message ?? 'Submission failed. Please try again.', type: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (formConfig === null) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" />
        </div>
      </Layout>
    )
  }

  // ── Field lookup helpers ──────────────────────────────────────────────────
  const verticalField = formConfig.find(f => f.field_key === 'vertical_type')
  const didField      = formConfig.find(f => f.field_key === 'client_id')

  // ── Render a single dynamic field ─────────────────────────────────────────
  const renderField = (field) => {
    // vertical_other is rendered inline inside VerticalDIDSection
    if (field.field_key === 'vertical_other') return null

    return (
      <Field
        key={field.field_key}
        label={field.label}
        required={field.is_required}
        error={err(field.field_key)}>
        <GenericField
          field={field}
          value={form[field.field_key] ?? ''}
          onChange={set}
          error={err(field.field_key)}
        />
      </Field>
    )
  }

  // ── Render section fields in a 6-column CSS grid ────────────────────────
  // Each field spans its own col_span (full=6, two_thirds=4, half=3, third=2).
  // No row-grouping needed — CSS grid wraps automatically.
  const renderSectionFields = (sectionFields) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
      {sectionFields.map(field => {
        const span = COL_SPAN_MAP[field.col_span] ?? 2
        return (
          <div key={field.field_key} style={{ gridColumn: `span ${span}` }}>
            {renderField(field)}
          </div>
        )
      })}
    </div>
  )

  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="p-6 max-w-3xl mx-auto space-y-5">

        <div>
          <h1 className="text-2xl font-black" style={{ color: '#132E57', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
            New Sale
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Submit a new customer record</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Core: Vertical & DID ── */}
          <VerticalDIDSection
            verticalField={verticalField}
            didField={didField}
            form={form}
            clients={clients}
            didsLoading={didsLoading}
            set={set}
            err={err}
          />

          {/* ── Dynamic sections (everything except Vertical & DID) ── */}
          {(sections.order || []).map(sectionName => {
            const sectionFields = (sections.map[sectionName] || [])
              .filter(f => f.field_key !== 'vertical_other')
            if (sectionFields.length === 0) return null
            return (
              <Section key={sectionName} title={sectionName}>
                {renderSectionFields(sectionFields)}
              </Section>
            )
          })}

          {/* ── Submit row ── */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <button type="button" onClick={resetForm}
              className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ border: '1px solid #5C6D82', color: '#9FA7B2', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.color='#ffffff'; e.currentTarget.style.borderColor='#1E8496' }}
              onMouseLeave={e => { e.currentTarget.style.color='#9FA7B2'; e.currentTarget.style.borderColor='#5C6D82' }}>
              Reset
            </button>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)', color: '#ffffff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #2296AA 0%, #1E8496 100%)' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)' }}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                  </svg>
                  Submitting…
                </span>
              ) : 'Record Sale'}
            </button>
          </div>

        </form>
      </div>
    </Layout>
  )
}
