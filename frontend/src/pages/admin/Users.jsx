import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Layout from '../../components/Layout'
import DateInput from '../../components/DateInput'
import Toast from '../../components/Toast'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'

// ── Constants ─────────────────────────────────────────────────────────────────
const VISIBLE_ROLES = {
  admin:    ['admin', 'director', 'manager', 'agent'],
  director: ['director', 'manager', 'agent'],
  manager:  ['manager', 'agent'],
}

const ROLE_BADGE = {
  admin:    { bg: '#EDE9FE', color: '#6D28D9' },
  director: { bg: '#DBEAFE', color: '#1D4ED8' },
  manager:  { bg: '#E0E7FF', color: '#4338CA' },
  agent:    { bg: '#CFFAFE', color: '#0E7490' },
}

const DEPARTMENTS  = ['Medicare', 'Final Expense', 'ACA', 'Management']
const AGENT_TYPES    = ['Closer', 'Verifier', 'Self Closer', 'Fronter']
const MANAGER_TYPES  = ['Floor Manager/Team Lead', 'QA Manager', 'HR Manager', 'Accountant']

/** Auto-format CNIC as user types: XXXXX-XXXXXXX-X */
function formatCNIC(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 5)  return digits
  if (digits.length <= 12) return digits.slice(0, 5) + '-' + digits.slice(5)
  return digits.slice(0, 5) + '-' + digits.slice(5, 12) + '-' + digits.slice(12)
}

const ALL_COLUMNS = [
  { key: 'user_id',    label: 'User ID'     },
  { key: 'name',       label: 'Name'        },
  { key: 'role',       label: 'Role'        },
  { key: 'role_type',  label: 'Role Type'   },
  { key: 'department', label: 'Department'  },
  { key: 'contact',    label: 'Contact'     },
  { key: 'joined',     label: 'Joined'      },
  { key: 'salary',     label: 'Basic Salary'},
  { key: 'status',     label: 'Status'      },
]

// ── Unified header cell style (no per-cell bg — bg set on <tr>) ───────────────
const thStyle = (alignRight = false) => ({
  color:         '#FFFFFF',
  fontFamily:    "'Rajdhani', sans-serif",
  letterSpacing: '0.07em',
  textAlign:     alignRight ? 'right' : 'left',
  background:    'transparent',
})
const ALL_COL_KEYS   = ALL_COLUMNS.map(c => c.key)
const LS_COLS        = 'mv_users_cols_v2'   // bumped so new default (with role_type) takes effect
const LS_ROLE        = 'mv_users_role'
const LS_STATUS      = 'mv_users_status'

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback }
  catch { return fallback }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* ignore */ }
}

const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-400'
const selectCls = inputCls + ' cursor-pointer'

function fmt(dateStr) {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtPKR(val) {
  if (!val || val === '0.00' || val === 0) return 'N/A'
  return 'PKR ' + Number(val).toLocaleString('en-PK', { minimumFractionDigits: 0 })
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
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

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} max-h-[90vh] flex flex-col`}>
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

// ── Disable modal (asks for inactive_since date) ──────────────────────────────
function DisableModal({ user, onConfirm, onCancel, loading }) {
  const [date, setDate] = useState('')
  const [err, setErr]   = useState('')

  const submit = () => {
    if (!date) { setErr('Please select the inactivity date.'); return }
    onConfirm(date)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Disable "{user.display_name}"</p>
            <p className="text-xs text-gray-500 mt-0.5">This user will no longer be able to log in.</p>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
            Inactive From <span className="text-red-500">*</span>
          </label>
          <DateInput
            value={date}
            onChange={e => { setDate(e.target.value); setErr('') }}
            className={`${inputCls} ${err ? 'border-red-400' : ''}`}
            max={new Date().toISOString().split('T')[0]}
          />
          {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
          <p className="mt-1.5 text-xs text-gray-400">Enter the date from which the employee is considered inactive (e.g. their last working day).</p>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Disabling…' : 'Disable User'}
          </button>
        </div>
      </div>
    </div>
  )
}

const AUTO_PREFIX    = { director: 'D', manager: 'M', agent: 'A' }
const DEFAULT_PASSWORD = '12345678'

// Core user field keys (managed via CRM settings but rendered as hardcoded or dynamic fields)
const USER_CORE_KEYS = new Set([
  'first_name', 'mid_name', 'last_name', 'email', 'phone',
  'date_of_birth', 'date_of_joining', 'department', 'experience',
  'cnic', 'permanent_address', 'current_address',
  'basic_salary', 'punctuality_allowance', 'travelling_allowance', 'other_allowance',
  'bank', 'account_title', 'bank_account_no', 'iban_no',
])

// Salary keys (to track total)
const SALARY_KEYS = ['basic_salary', 'punctuality_allowance', 'travelling_allowance', 'other_allowance']

const COL_SPAN_MAP_U = { full: 6, two_thirds: 4, half: 3, third: 2 }

// ── Generic renderer for extra (custom) user fields ───────────────────────────
function UserExtraField({ field, value, onChange, error }) {
  const span   = COL_SPAN_MAP_U[field.col_span] ?? 3
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

// ── Dynamic field renderer for core fields (with CNIC special handling) ───────
function UserCoreField({ field, value, onChange, disabled, error }) {
  const span   = COL_SPAN_MAP_U[field.col_span] ?? 2
  const errCls = error ? 'border-red-400' : ''
  const handle = (e) => onChange(field.field_key, e.target.value)

  let input
  if (field.field_key === 'cnic') {
    input = (
      <>
        <input type="text" value={value}
          onChange={e => onChange(field.field_key, formatCNIC(e.target.value))}
          disabled={disabled} placeholder={field.placeholder ?? '00000-0000000-0'}
          maxLength={15} className={`${inputCls} ${disabled ? '' : ''} ${errCls}`} />
        <p className="mt-1 text-xs text-gray-400">Format: XXXXX-XXXXXXX-X</p>
      </>
    )
  } else if (field.field_key === 'department') {
    input = (
      <select name={field.field_key} value={value} onChange={handle} disabled={disabled}
        className={`${selectCls} ${errCls}`}>
        <option value="">Select Department</option>
        {(field.options ?? DEPARTMENTS).map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    )
  } else if (field.field_type === 'date') {
    input = <DateInput name={field.field_key} value={value} onChange={handle} disabled={disabled}
              className={`${inputCls} ${errCls}`} />
  } else if (field.field_type === 'textarea') {
    input = <textarea name={field.field_key} value={value} onChange={handle} disabled={disabled}
              placeholder={field.placeholder ?? ''} rows={field.textarea_rows || 2}
              className={`${inputCls} resize-none ${errCls}`} />
  } else if (field.field_type === 'amount_pkr') {
    input = (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold select-none">₨</span>
        <input type="number" name={field.field_key} value={value} onChange={handle} disabled={disabled}
          min={0} step="0.01" placeholder={field.placeholder ?? '0.00'}
          className={`${inputCls} pl-7 ${errCls}`} />
      </div>
    )
  } else if (field.field_type === 'amount_usd') {
    input = (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold select-none">$</span>
        <input type="number" name={field.field_key} value={value} onChange={handle} disabled={disabled}
          min={0} step="0.01" placeholder={field.placeholder ?? '0.00'}
          className={`${inputCls} pl-7 ${errCls}`} />
      </div>
    )
  } else if (field.field_type === 'number') {
    input = <input type="number" name={field.field_key} value={value} onChange={handle} disabled={disabled}
              placeholder={field.placeholder ?? ''} className={`${inputCls} ${errCls}`} />
  } else {
    // text / email / tel
    const typeAttr = field.field_key === 'email' ? 'email' : field.field_key === 'phone' ? 'tel' : 'text'
    input = <input type={typeAttr} name={field.field_key} value={value} onChange={handle} disabled={disabled}
              placeholder={field.placeholder ?? ''} className={`${inputCls} ${errCls}`} />
  }

  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <Field label={field.label} required={field.is_required} error={error}>{input}</Field>
    </div>
  )
}

// ── User form (create / edit) ─────────────────────────────────────────────────
function UserForm({ initial, allowedRoles, onSubmit, loading, errors }) {
  const isEdit = !!initial
  const toDateStr = (v) => (v ? String(v).slice(0, 10) : '')

  const EMPTY = {
    username: '', password: DEFAULT_PASSWORD, role: allowedRoles[0] ?? '',
    display_name: '', first_name: '', mid_name: '', last_name: '',
    email: '', phone: '', date_of_birth: '', date_of_joining: '',
    address: '', cnic: '', permanent_address: '', current_address: '',
    experience: '', department: '', agent_type: '', manager_type: '',
    bank: '', account_title: '', bank_account_no: '', iban_no: '',
    basic_salary: '', punctuality_allowance: '', travelling_allowance: '', other_allowance: '',
  }

  const [form, setForm]               = useState(isEdit ? {
    ...EMPTY, ...initial, password: DEFAULT_PASSWORD,
    date_of_joining: toDateStr(initial.date_of_joining),
    date_of_birth:   toDateStr(initial.date_of_birth),
    inactive_since:  toDateStr(initial.inactive_since),
  } : EMPTY)
  const [extraFields, setExtraFields] = useState(initial?.extra_fields ?? {})
  const [fieldConfigs, setFieldConfigs] = useState([])
  const [codeLoading, setCodeLoading] = useState(false)

  // Fetch field configs on mount
  useEffect(() => {
    api.get('/crm/form-fields/public', { params: { form_type: 'user' } })
      .then(res => setFieldConfigs(res.data))
      .catch(() => {})
  }, [])

  // Config helpers
  const cfg      = (key) => fieldConfigs.find(f => f.field_key === key) ?? null
  const isVis    = (key) => cfg(key)?.is_visible !== false
  const getLabel = (key, fb) => cfg(key)?.label ?? fb

  // Group field configs by section (in order from API)
  const { sectionOrder, grouped } = useMemo(() => {
    const order = [], map = {}
    fieldConfigs.forEach(f => {
      const s = f.section || 'General'
      if (!order.includes(s)) order.push(s)
      if (!map[s]) map[s] = []
      map[s].push(f)
    })
    return { sectionOrder: order, grouped: map }
  }, [fieldConfigs])

  // Custom (non-core) fields
  const customFields = useMemo(
    () => fieldConfigs.filter(f => !USER_CORE_KEYS.has(f.field_key)),
    [fieldConfigs]
  )

  const fetchNextCode = useCallback(async (role) => {
    if (isEdit || !AUTO_PREFIX[role]) return
    setCodeLoading(true)
    try {
      const { data } = await api.get('/users/next-code', { params: { role } })
      setForm(p => ({ ...p, username: data.code, password: DEFAULT_PASSWORD }))
    } catch { /* ignore */ } finally { setCodeLoading(false) }
  }, [isEdit])

  useEffect(() => {
    if (!isEdit && allowedRoles[0]) fetchNextCode(allowedRoles[0])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (e) => {
    const { name, value } = e.target
    const val = name === 'cnic' ? formatCNIC(value) : value
    if (name === 'role') {
      fetchNextCode(value)
      setForm(p => ({ ...p, role: value, agent_type: '', manager_type: '' }))
    } else {
      setForm(p => ({ ...p, [name]: val }))
    }
  }

  // Unified field-change handler (core keys go to form, custom to extraFields)
  const handleFieldChange = (key, val) => {
    if (USER_CORE_KEYS.has(key)) setForm(p => ({ ...p, [key]: val }))
    else setExtraFields(p => ({ ...p, [key]: val }))
  }

  const err = (k) => errors[k]?.[0]

  const inp = (name, props = {}) => (
    <input name={name} value={form[name] ?? ''} onChange={set}
      className={`${inputCls} ${err(name) ? 'border-red-400' : ''}`} {...props} />
  )

  // Salary total (live, across all salary fields)
  const total = SALARY_KEYS.reduce((s, k) => s + (parseFloat(form[k]) || 0), 0)

  // Render a section's fields in 6-col grid
  const renderSection = (sectionName) => {
    const sectionFields = grouped[sectionName] ?? []
    if (sectionFields.length === 0) return null
    const isSalarySection = SALARY_KEYS.some(k => sectionFields.some(f => f.field_key === k))

    return (
      <div key={sectionName}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest pt-2 pb-1">{sectionName}</p>
        <div className={isSalarySection ? 'rounded-xl border border-gray-200 bg-gray-50 p-4' : ''}>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            {sectionFields.map(field => (
              <UserCoreField
                key={field.field_key}
                field={field}
                value={USER_CORE_KEYS.has(field.field_key) ? (form[field.field_key] ?? '') : (extraFields[field.field_key] ?? '')}
                onChange={handleFieldChange}
                disabled={false}
                error={err(field.field_key)}
              />
            ))}
          </div>
          {/* Salary total — only shown inside salary section */}
          {isSalarySection && total > 0 && (
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Package</span>
              <span className="text-sm font-bold" style={{ color: '#AA7F56' }}>
                PKR {total.toLocaleString('en-PK', { minimumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (Object.keys(extraFields).length > 0) payload.extra_fields = extraFields
    onSubmit(payload)
  }

  return (
    <form id="user-form" onSubmit={handleSubmit} className="space-y-4">

      {/* ── Account (always hardcoded — role logic, auto-username, password) ── */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Account</p>
      <div className={`grid gap-4 ${(form.role === 'agent' || form.role === 'manager') ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Field label="Role" required error={err('role')}>
          <select name="role" value={form.role} onChange={set} disabled={isEdit}
            className={`${selectCls} ${err('role') ? 'border-red-400' : ''} ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`} required>
            {allowedRoles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </Field>
        {form.role === 'agent' && (
          <Field label="Agent Type" error={err('agent_type')}>
            <select name="agent_type" value={form.agent_type ?? ''} onChange={set} className={selectCls}>
              <option value="">Select Type</option>
              {AGENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        )}
        {form.role === 'manager' && (
          <Field label="Manager Type" error={err('manager_type')}>
            <select name="manager_type" value={form.manager_type ?? ''} onChange={set} className={selectCls}>
              <option value="">Select Type</option>
              {MANAGER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        )}
        <Field label="Display Name" required error={err('display_name')}>
          {inp('display_name', { placeholder: 'e.g. John Smith', required: true })}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Username" required error={err('username')}>
          <div className="relative">
            {inp('username', { placeholder: codeLoading ? 'Generating…' : '—', required: true, disabled: true })}
            {codeLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-4 h-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                </svg>
              </span>
            )}
          </div>
        </Field>
        <Field label="Password" required error={err('password')}>
          {inp('password', { type: 'text', placeholder: DEFAULT_PASSWORD })}
        </Field>
      </div>

      {/* ── Dynamic sections (from field config) ── */}
      {sectionOrder.map(sectionName => renderSection(sectionName))}

      {/* ── Custom extra fields ── */}
      {customFields.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest pt-2 pb-1">Additional Fields</p>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            {customFields.map(field => (
              <UserExtraField
                key={field.field_key}
                field={field}
                value={extraFields[field.field_key] ?? ''}
                onChange={handleFieldChange}
                error={err(field.field_key)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" form="user-form" disabled={loading}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)', color: '#ffffff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
          onMouseEnter={e => { if(!loading) e.currentTarget.style.background='linear-gradient(135deg, #2296AA 0%, #1E8496 100%)' }}
          onMouseLeave={e => { if(!loading) e.currentTarget.style.background='linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)' }}>
          {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
        </button>
      </div>
    </form>
  )
}

// ── Column toggle dropdown ────────────────────────────────────────────────────
function ColumnPicker({ visible, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allSelected = visible.length === ALL_COLUMNS.length
  const noneLeft    = visible.length === 1 // prevent deselecting last

  const toggleAll = () => {
    const next = allSelected ? [ALL_COL_KEYS[0]] : ALL_COL_KEYS
    onChange(next)
  }

  const toggle = (key) => {
    if (visible.includes(key) && noneLeft) return   // keep at least 1
    const next = visible.includes(key)
      ? visible.filter(k => k !== key)
      : [...visible, key]
    onChange(next)
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
        style={{ background: open ? 'linear-gradient(135deg,#132E57,#1E8496)' : 'rgba(255,255,255,0.15)',
          color: open ? '#fff' : '#FFFFFF',
          border: '1px solid', borderColor: open ? '#D7A520' : 'rgba(255,255,255,0.3)',
          fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M3.75 9h16.5M3.75 15h16.5" />
        </svg>
        Columns {visible.length < ALL_COLUMNS.length && <span className="ml-0.5 opacity-70">({visible.length}/{ALL_COLUMNS.length})</span>}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 rounded-xl shadow-xl border overflow-hidden w-52"
          style={{ background: '#0D1B2A', borderColor: '#3F4753' }}>

          {/* Select All row */}
          <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b"
            style={{ borderColor: '#3F4753', background: 'rgba(170,127,86,0.08)' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll}
              className="w-3.5 h-3.5 accent-amber-500 cursor-pointer" />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#FBDCB4' }}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </span>
          </label>

          {/* Individual columns */}
          {ALL_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-white/5">
              <input type="checkbox" checked={visible.includes(col.key)} onChange={() => toggle(col.key)}
                className="w-3.5 h-3.5 accent-amber-500 cursor-pointer" />
              <span className="text-xs" style={{ color: visible.includes(col.key) ? '#FBDCB4' : '#9FA7B2' }}>{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Users() {
  const { user: authUser } = useAuth()

  const HIERARCHY    = ['admin', 'director', 'manager', 'agent']
  const pos          = HIERARCHY.indexOf(authUser?.role)
  const allowedRoles = pos >= 0 ? HIERARCHY.slice(pos + 1) : []

  const canDisable   = ['admin', 'director', 'manager'].includes(authUser?.role)
  const canActivate  = ['admin', 'director', 'manager'].includes(authUser?.role)

  // ── State ──────────────────────────────────────────────────────────────────
  const [users, setUsers]           = useState([])
  const [meta, setMeta]             = useState(null)
  const [page, setPage]             = useState(1)
  const [roleFilter, setRoleFilter] = useState(() => lsGet(LS_ROLE, ''))
  const [statusFilter, setStatusFilter] = useState(() => lsGet(LS_STATUS, 'active'))
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser]     = useState(null)
  const [disableModal, setDisableModal] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  const [formLoading, setFormLoading] = useState(false)
  const [formErrors, setFormErrors]   = useState({})
  const [toast, setToast]             = useState(null)

  // All columns visible by default; persisted in localStorage
  const [visibleCols, setVisibleCols] = useState(() => lsGet(LS_COLS, ALL_COL_KEYS))

  // Persist column & filter prefs whenever they change
  useEffect(() => { lsSet(LS_COLS, visibleCols) }, [visibleCols])
  useEffect(() => { lsSet(LS_ROLE, roleFilter)   }, [roleFilter])
  useEffect(() => { lsSet(LS_STATUS, statusFilter) }, [statusFilter])

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (pg, role, status, q) => {
    setLoading(true)
    try {
      const params = { page: pg, status }
      if (role)  params.role   = role
      if (q)     params.search = q
      const { data } = await api.get('/users', { params })
      const items = Array.isArray(data) ? data : data.data ?? []
      setUsers(items)
      setMeta(Array.isArray(data) ? null : data)
    } catch {
      setToast({ message: 'Failed to load users.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers(page, roleFilter, statusFilter, search) },
    [page, roleFilter, statusFilter, search, fetchUsers])

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const params = { format: 'csv', per_page: 'all', status: statusFilter }
      if (roleFilter) params.role = roleFilter
      if (search)     params.search = search
      const { data } = await api.get('/users', { params })
      const blob = new Blob([data.csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = data.filename; a.click()
      URL.revokeObjectURL(url)
    } catch {
      setToast({ message: 'Export failed.', type: 'error' })
    }
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreate = async (form) => {
    setFormLoading(true); setFormErrors({})
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
    )
    try {
      await api.post('/users', payload)
      setToast({ message: 'User created successfully.', type: 'success' })
      setShowCreate(false)
      fetchUsers(page, roleFilter, statusFilter, search)
    } catch (err) {
      if (err.response?.status === 422) setFormErrors(err.response.data?.errors ?? {})
      else setToast({ message: err.response?.data?.message ?? 'Failed to create user.', type: 'error' })
    } finally { setFormLoading(false) }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  const handleEdit = async (form) => {
    setFormLoading(true); setFormErrors({})
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
    )
    if (!payload.password) delete payload.password
    // Safety: never wipe date_of_joining if it was already set
    if (!payload.date_of_joining) delete payload.date_of_joining
    try {
      await api.put(`/users/${editUser.id}`, payload)
      setToast({ message: 'User updated successfully.', type: 'success' })
      setEditUser(null)
      fetchUsers(page, roleFilter, statusFilter, search)
    } catch (err) {
      if (err.response?.status === 422) setFormErrors(err.response.data?.errors ?? {})
      else setToast({ message: err.response?.data?.message ?? 'Failed to update user.', type: 'error' })
    } finally { setFormLoading(false) }
  }

  // ── Disable ────────────────────────────────────────────────────────────────
  const handleDisable = async (inactiveSince) => {
    setActionLoading(true)
    const u = disableModal
    try {
      await api.delete(`/users/${u.id}`, { data: { inactive_since: inactiveSince } })
      setToast({ message: `${u.display_name} disabled.`, type: 'success' })
      setDisableModal(null)
      fetchUsers(page, roleFilter, statusFilter, search)
    } catch (err) {
      setToast({ message: err.response?.data?.message ?? 'Failed to disable user.', type: 'error' })
    } finally { setActionLoading(false) }
  }

  // ── Activate ───────────────────────────────────────────────────────────────
  const handleActivate = async (u) => {
    setConfirmAction(null)
    try {
      await api.post(`/users/${u.id}/activate`)
      setToast({ message: `${u.display_name} re-activated.`, type: 'success' })
      fetchUsers(page, roleFilter, statusFilter, search)
    } catch (err) {
      setToast({ message: err.response?.data?.message ?? 'Failed to activate user.', type: 'error' })
    }
  }

  // ── Toggle lock ────────────────────────────────────────────────────────────
  const handleToggleLock = async () => {
    const u = confirmAction.user
    setConfirmAction(null)
    try {
      const { data } = await api.post(`/users/${u.id}/toggle-lock`)
      setToast({ message: `${u.display_name} ${data.profile_locked ? 'locked' : 'unlocked'}.`, type: 'success' })
      fetchUsers(page, roleFilter, statusFilter, search)
    } catch (err) {
      setToast({ message: err.response?.data?.message ?? 'Failed to toggle lock.', type: 'error' })
    }
  }

  const canManage = (u) => allowedRoles.includes(u.role)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Create modal */}
      {showCreate && (
        <Modal title="Create New User" onClose={() => { setShowCreate(false); setFormErrors({}) }} wide>
          <UserForm allowedRoles={allowedRoles} onSubmit={handleCreate} loading={formLoading} errors={formErrors} />
        </Modal>
      )}

      {/* Edit modal */}
      {editUser && (
        <Modal title={`Edit — ${editUser.display_name}`} onClose={() => { setEditUser(null); setFormErrors({}) }} wide>
          <UserForm initial={editUser} allowedRoles={allowedRoles} onSubmit={handleEdit} loading={formLoading} errors={formErrors} />
        </Modal>
      )}

      {/* Disable modal */}
      {disableModal && (
        <DisableModal
          user={disableModal}
          onConfirm={handleDisable}
          onCancel={() => setDisableModal(null)}
          loading={actionLoading}
        />
      )}

      {/* Lock confirm */}
      {confirmAction?.type === 'lock' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="text-sm text-gray-700 mb-5">
              {confirmAction.user.profile_locked ? 'Unlock' : 'Lock'} profile of "{confirmAction.user.display_name}"?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleToggleLock} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Activate confirm */}
      {confirmAction?.type === 'activate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Re-activate "{confirmAction.user.display_name}"?</p>
                <p className="text-xs text-gray-500 mt-0.5">They will regain access to the system.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => handleActivate(confirmAction.user)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors">Re-activate</button>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 space-y-4" style={{ background: '#EDF0F3', minHeight: '100vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{
              color: '#132E57',
              fontFamily: "'Rajdhani', sans-serif",
              letterSpacing: '0.04em',
            }}>My Team</h1>
            <p className="text-sm mt-0.5" style={{ color: '#5C5C5C' }}>
              {authUser?.role === 'manager' ? 'Manage your agents' : 'Create and manage system users'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Export */}
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: 'rgba(170,127,86,0.12)', color: '#AA7F56', border: '1px solid rgba(170,127,86,0.3)',
                fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(170,127,86,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(170,127,86,0.12)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export
            </button>
            {allowedRoles.length > 0 && (
              <button
                onClick={() => { setShowCreate(true); setFormErrors({}) }}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
                style={{ background: 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)', color: '#ffffff',
                  fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
                onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, #2296AA 0%, #1E8496 100%)'}
                onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New User
              </button>
            )}
          </div>
        </div>

        {/* ── Filters bar ── */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 shadow-sm"
          style={{ background: 'linear-gradient(135deg, #0E5F6E 0%, #1E8496 100%)', border: '1px solid #1A7888' }}>

          {/* Role tabs */}
          {authUser?.role !== 'manager' && (
            <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(0,0,0,0.15)' }}>
              {[{ label: 'All Roles', value: '' }, ...(VISIBLE_ROLES[authUser?.role] ?? []).map((r) => ({ label: r.charAt(0).toUpperCase() + r.slice(1), value: r }))]
                .map(({ label, value }) => (
                  <button key={value} onClick={() => { setRoleFilter(value); setPage(1) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={roleFilter === value
                      ? { background: 'linear-gradient(135deg, #132E57 0%, #1E8496 100%)', color: '#fff',
                          fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em', boxShadow: '0 2px 8px rgba(19,46,87,0.4)' }
                      : { background: 'transparent', color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}
                    onMouseEnter={e => { if(roleFilter !== value) { e.currentTarget.style.background='rgba(255,255,255,0.2)'; e.currentTarget.style.color='#fff' }}}
                    onMouseLeave={e => { if(roleFilter !== value) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#FFFFFF' }}}>
                    {label}
                  </button>
                ))}
            </div>
          )}

          <div className="w-px h-6 self-center" style={{ background: 'rgba(255,255,255,0.2)' }} />

          {/* Status tabs */}
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(0,0,0,0.15)' }}>
            {[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'All', value: 'all' }]
              .map(({ label, value }) => (
                <button key={value} onClick={() => { setStatusFilter(value); setPage(1) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={statusFilter === value
                    ? { background: value === 'inactive'
                          ? 'linear-gradient(135deg, #C25A1F 0%, #E07840 100%)'
                          : value === 'all'
                          ? 'linear-gradient(135deg, #132E57 0%, #1E8496 100%)'
                          : 'linear-gradient(135deg, #132E57 0%, #1E8496 100%)',
                        color: '#fff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em',
                        boxShadow: value === 'inactive' ? '0 2px 8px rgba(194,90,31,0.4)' : '0 2px 8px rgba(19,46,87,0.4)' }
                    : { background: 'transparent', color: '#FFFFFF', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}
                  onMouseEnter={e => { if(statusFilter !== value) { e.currentTarget.style.background='rgba(255,255,255,0.2)'; e.currentTarget.style.color='#fff' }}}
                  onMouseLeave={e => { if(statusFilter !== value) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#FFFFFF' }}}>
                  {label}
                </button>
              ))}
          </div>

          <div className="w-px h-6 self-center" style={{ background: 'rgba(255,255,255,0.2)' }} />

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#FFFFFF">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input type="text" placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none transition w-44"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}
              onFocus={e => { e.target.style.borderColor='#D7A520'; e.target.style.background='rgba(255,255,255,0.25)' }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.3)'; e.target.style.background='rgba(255,255,255,0.15)' }} />
          </div>

          <div className="w-px h-6 self-center" style={{ background: 'rgba(255,255,255,0.2)' }} />

          {/* Column picker */}
          <ColumnPicker visible={visibleCols} onChange={setVisibleCols} />

          {/* Count badge */}
          {meta && (
            <span className="ml-auto text-xs font-bold" style={{ color: '#FFFFFF' }}>
              {meta.total ?? users.length} user{(meta.total ?? users.length) !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Table ── */}
        <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #E0DDD5', background: '#FFFFFF' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'linear-gradient(90deg, #4A5568 0%, #5A6880 100%)', borderBottom: '2px solid #3A4558' }}>
                  {visibleCols.includes('user_id') && (
                    <th className="px-4 py-2.5 text-xs font-bold uppercase" style={thStyle()}>User ID</th>
                  )}
                  {visibleCols.includes('name') && (
                    <th className="px-4 py-2.5 text-xs font-bold uppercase" style={thStyle()}>Name</th>
                  )}
                  {visibleCols.includes('role') && (
                    <th className="px-4 py-2.5 text-xs font-bold uppercase" style={thStyle()}>Role</th>
                  )}
                  {visibleCols.includes('role_type') && (
                    <th className="px-4 py-2.5 text-xs font-bold uppercase" style={thStyle()}>Role Type</th>
                  )}
                  {visibleCols.includes('department') && (
                    <th className="px-4 py-2.5 text-xs font-bold uppercase" style={thStyle()}>Department</th>
                  )}
                  {visibleCols.includes('contact') && (
                    <th className="px-4 py-2.5 text-xs font-bold uppercase" style={thStyle()}>Contact</th>
                  )}
                  {visibleCols.includes('joined') && (
                    <th className="px-4 py-2.5 text-xs font-bold uppercase" style={thStyle()}>Joined</th>
                  )}
                  {visibleCols.includes('salary') && (
                    <th className="px-4 py-2.5 text-xs font-bold uppercase" style={thStyle()}>Basic Salary</th>
                  )}
                  {visibleCols.includes('status') && (
                    <th className="px-4 py-2.5 text-xs font-bold uppercase" style={thStyle()}>Status</th>
                  )}
                  <th className="px-4 py-2.5 text-xs font-bold uppercase" style={thStyle(true)}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: visibleCols.length + 1 }).map((__, j) => (
                        <td key={j} className="px-4 py-2.5">
                          <div className="h-3 bg-gray-100 rounded animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCols.length + 1} className="px-5 py-10 text-center">
                      <p className="text-gray-400 text-sm">No users found.</p>
                      {statusFilter === 'inactive' && (
                        <p className="text-gray-300 text-xs mt-1">No inactive users on record.</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const badge = ROLE_BADGE[u.role] ?? { bg: '#F3F4F6', color: '#6B7280' }
                    const isInactive = !u.is_active
                    return (
                      <tr key={u.id}
                        className="bg-white transition-colors hover:bg-gray-50"
                        style={{ borderBottom: '1px solid #F3F4F6', ...(isInactive ? { opacity: 0.65 } : {}) }}>

                        {/* User ID */}
                        {visibleCols.includes('user_id') && (
                          <td className="px-4 py-2">
                            <span className="font-mono text-xs font-semibold text-gray-500">{u.username}</span>
                          </td>
                        )}

                        {/* Name */}
                        {visibleCols.includes('name') && (
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ background: isInactive ? '#9CA3AF' : '#3F4753' }}>
                                {(u.display_name ?? u.username)[0].toUpperCase()}
                              </div>
                              <div>
                                <span className="font-medium text-gray-800 text-sm">{u.display_name}</span>
                              </div>
                            </div>
                          </td>
                        )}

                        {/* Role */}
                        {visibleCols.includes('role') && (
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                              style={{ background: badge.bg, color: badge.color }}>
                              {u.role}
                            </span>
                          </td>
                        )}

                        {/* Role Type */}
                        {visibleCols.includes('role_type') && (
                          <td className="px-4 py-2">
                            {(u.agent_type || u.manager_type) ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                style={u.agent_type
                                  ? { background: '#FEF3C7', color: '#92400E' }
                                  : { background: '#EDE9FE', color: '#5B21B6' }}>
                                {u.agent_type ?? u.manager_type}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">N/A</span>
                            )}
                          </td>
                        )}

                        {/* Department */}
                        {visibleCols.includes('department') && (
                          <td className="px-4 py-2 text-xs text-gray-500">{u.department ?? 'N/A'}</td>
                        )}

                        {/* Contact */}
                        {visibleCols.includes('contact') && (
                          <td className="px-4 py-2 text-xs text-gray-500">{u.email ?? u.phone ?? 'N/A'}</td>
                        )}

                        {/* Joined */}
                        {visibleCols.includes('joined') && (
                          <td className="px-4 py-2 text-xs text-gray-500">{fmt(u.date_of_joining ?? u.created_at)}</td>
                        )}

                        {/* Salary */}
                        {visibleCols.includes('salary') && (
                          <td className="px-4 py-2 text-xs font-medium" style={{ color: u.basic_salary ? '#AA7F56' : '#9CA3AF' }}>
                            {fmtPKR(u.basic_salary)}
                          </td>
                        )}

                        {/* Status */}
                        {visibleCols.includes('status') && (
                          <td className="px-4 py-2">
                            <div className="flex flex-col gap-0.5">
                              {isInactive ? (
                                <>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600 w-fit">Inactive</span>
                                  {u.inactive_since && (
                                    <span className="text-xs text-gray-400">since {fmt(u.inactive_since)}</span>
                                  )}
                                </>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 w-fit">Active</span>
                              )}
                              {u.profile_locked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 w-fit">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                  </svg>
                                  Locked
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Actions */}
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit — only for active users the caller can manage */}
                            {canManage(u) && !isInactive && (
                              <button onClick={() => { setEditUser(u); setFormErrors({}) }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                </svg>
                              </button>
                            )}

                            {/* Lock — admin only, active users */}
                            {authUser?.role === 'admin' && canManage(u) && !isInactive && (
                              <button onClick={() => setConfirmAction({ type: 'lock', user: u })}
                                className={`p-1.5 rounded-lg transition-colors ${u.profile_locked ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}
                                title={u.profile_locked ? 'Unlock profile' : 'Lock profile'}>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                              </button>
                            )}

                            {/* Disable — admin or director, only active users */}
                            {canDisable && canManage(u) && !isInactive && (
                              <button onClick={() => setDisableModal(u)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Disable user">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                                </svg>
                              </button>
                            )}

                            {/* Re-activate — director or admin, only inactive users */}
                            {canActivate && canManage(u) && isInactive && (
                              <button onClick={() => setConfirmAction({ type: 'activate', user: u })}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Re-activate user">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.last_page > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Showing {meta.from}–{meta.to} of {meta.total} users
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={meta.current_page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Previous
                </button>
                <span className="text-xs text-gray-500">{meta.current_page} / {meta.last_page}</span>
                <button onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))} disabled={meta.current_page === meta.last_page}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
