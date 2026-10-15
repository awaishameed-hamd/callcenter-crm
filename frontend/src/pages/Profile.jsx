import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout'
import DateInput from '../components/DateInput'
import Toast from '../components/Toast'
import api from '../api/axios'

// ── Core user field keys — go into form state, never stored as extra_fields ──
// Must match all field_keys seeded under form_type='user' in form_field_settings.
const PROFILE_CORE_KEYS = new Set([
  'display_name', 'first_name', 'mid_name', 'last_name',
  'email', 'phone', 'date_of_birth',
  'date_of_joining', 'department', 'experience',
  'cnic', 'permanent_address', 'current_address',
  'basic_salary', 'punctuality_allowance', 'travelling_allowance', 'other_allowance',
  'bank', 'account_title', 'bank_account_no', 'iban_no',
])

// ── Admin-managed fields — shown in profile but always read-only for the user ──
const PROFILE_READONLY_KEYS = new Set([
  'date_of_joining', 'department',
  'basic_salary', 'punctuality_allowance', 'travelling_allowance', 'other_allowance',
])

// Maps col_span → CSS grid span (out of 6 cols)
const COL_SPAN_MAP = { full: 6, two_thirds: 4, half: 3, third: 2 }

/** Auto-format CNIC as user types: XXXXX-XXXXXXX-X */
function formatCNIC(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 5)  return digits
  if (digits.length <= 12) return digits.slice(0, 5) + '-' + digits.slice(5)
  return digits.slice(0, 5) + '-' + digits.slice(5, 12) + '-' + digits.slice(12)
}

function fmtPKR(val) {
  if (!val || val === '0.00' || Number(val) === 0) return null
  return 'PKR ' + Number(val).toLocaleString('en-PK', { minimumFractionDigits: 0 })
}

const inputCls     = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed'
const inputErrCls  = 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
const textareaCls  = inputCls + ' resize-none'

function Label({ children }) {
  return (
    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
      {children}
    </label>
  )
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Generic field renderer for both core and custom fields ───────────────────
function DynamicField({ field, value, onChange, disabled, error }) {
  const span   = COL_SPAN_MAP[field.col_span] ?? 2
  const isCls  = `${inputCls} ${error ? inputErrCls : ''}`

  const handleChange = (e) => onChange(field.field_key, e.target.value)

  let input
  switch (field.field_type) {
    case 'date':
      input = <DateInput value={value} onChange={handleChange} disabled={disabled} className={isCls} />
      break
    case 'number':
      input = <input type="number" value={value} onChange={handleChange} disabled={disabled}
                placeholder={field.placeholder ?? ''} className={isCls} />
      break
    case 'textarea':
      input = <textarea value={value} onChange={handleChange} disabled={disabled}
                placeholder={field.placeholder ?? ''} rows={field.textarea_rows || 3}
                className={textareaCls} />
      break
    case 'select':
      input = (
        <select value={value} onChange={handleChange} disabled={disabled}
          className={`${isCls} cursor-pointer`}>
          <option value="">Select…</option>
          {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
      break
    case 'amount_usd':
      input = (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold select-none">$</span>
          <input type="number" value={value} onChange={handleChange} disabled={disabled}
            placeholder={field.placeholder ?? '0.00'}
            className={`${isCls} pl-7`} />
        </div>
      )
      break
    case 'amount_pkr':
      input = (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold select-none">₨</span>
          <input type="number" value={value} onChange={handleChange} disabled={disabled}
            placeholder={field.placeholder ?? '0.00'}
            className={`${isCls} pl-7`} />
        </div>
      )
      break
    default: // text
      if (field.field_key === 'cnic') {
        // Special: CNIC auto-formatter
        input = <input type="text" value={value}
                  onChange={e => onChange(field.field_key, formatCNIC(e.target.value))}
                  disabled={disabled} placeholder={field.placeholder ?? '00000-0000000-0'}
                  maxLength={15} className={isCls} />
      } else {
        input = <input type="text" value={value} onChange={handleChange} disabled={disabled}
                  placeholder={field.placeholder ?? ''} className={isCls} />
      }
  }

  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <Field label={field.label} required={field.is_required} error={error}>
        {input}
      </Field>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Profile() {
  const [profile, setProfile]         = useState(null)
  const [editing, setEditing]         = useState(false)
  const [form, setForm]               = useState({})
  const [extraFields, setExtraFields] = useState({})
  const [fieldConfigs, setFieldConfigs] = useState([])

  const [pwForm, setPwForm]           = useState({ current_password: '', new_password: '', new_password_confirmation: '' })
  const [errors, setErrors]           = useState({})
  const [pwErrors, setPwErrors]       = useState({})
  const [loading, setLoading]         = useState(false)
  const [pwLoading, setPwLoading]     = useState(false)
  const [toast, setToast]             = useState(null)

  const toDateStr = (v) => (v ? String(v).slice(0, 10) : '')

  // ── Load profile data ────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      setProfile(data)
      setForm({
        ...data,
        date_of_joining: toDateStr(data.date_of_joining),
        date_of_birth:   toDateStr(data.date_of_birth),
      })
      setExtraFields(data.extra_fields ?? {})
    }).catch(() => {})
  }, [])

  // ── Load field configs ───────────────────────────────────────────────────
  useEffect(() => {
    api.get('/crm/form-fields/public', { params: { form_type: 'user' } })
      .then(res => setFieldConfigs(res.data))
      .catch(() => {})
  }, [])

  // ── Group field configs by section ───────────────────────────────────────
  const { sectionOrder, grouped } = useMemo(() => {
    const order = []
    const map   = {}
    fieldConfigs.forEach(f => {
      const s = f.section || 'General'
      if (!order.includes(s)) order.push(s)
      if (!map[s]) map[s] = []
      map[s].push(f)
    })
    return { sectionOrder: order, grouped: map }
  }, [fieldConfigs])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleFieldChange = (key, val) => {
    if (PROFILE_CORE_KEYS.has(key)) {
      setForm(p => ({ ...p, [key]: val }))
    } else {
      setExtraFields(p => ({ ...p, [key]: val }))
    }
    if (errors[key]) setErrors(p => ({ ...p, [key]: undefined }))
  }

  const set = (e) => handleFieldChange(e.target.name, e.target.value)

  const setPw = (e) => {
    const { name, value } = e.target
    setPwForm(p => ({ ...p, [name]: value }))
    if (pwErrors[name]) setPwErrors(p => ({ ...p, [name]: undefined }))
  }

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    if (!form.date_of_joining) {
      setErrors({ date_of_joining: ['Date of Joining is required.'] })
      setToast({ message: 'Please fix the highlighted errors.', type: 'error' })
      return
    }
    const syncDates = (u) => ({
      ...u,
      date_of_joining: toDateStr(u.date_of_joining),
      date_of_birth:   toDateStr(u.date_of_birth),
    })
    setLoading(true)
    setErrors({})
    try {
      const payload = { ...form }
      if (Object.keys(extraFields).length > 0) payload.extra_fields = extraFields
      const { data } = await api.put('/profile', payload)
      setProfile(data.user)
      setForm(syncDates(data.user))
      setExtraFields(data.user.extra_fields ?? {})
      setEditing(false)
      setToast({ message: 'Profile updated successfully.', type: 'success' })
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data?.errors ?? {})
        setToast({ message: 'Please fix the highlighted errors.', type: 'error' })
      } else {
        setToast({ message: err.response?.data?.message ?? 'Update failed.', type: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwLoading(true)
    setPwErrors({})
    try {
      await api.put('/profile/password', pwForm)
      setPwForm({ current_password: '', new_password: '', new_password_confirmation: '' })
      setToast({ message: 'Password changed successfully.', type: 'success' })
    } catch (err) {
      if (err.response?.status === 422) {
        setPwErrors(err.response.data?.errors ?? {})
        setToast({ message: 'Please fix the highlighted errors.', type: 'error' })
      } else {
        setToast({ message: err.response?.data?.message ?? 'Password change failed.', type: 'error' })
      }
    } finally {
      setPwLoading(false)
    }
  }

  const err    = (key) => errors[key]?.[0]
  const pwErr  = (key) => pwErrors[key]?.[0]
  const pwErrMsg = (key) => pwErr(key) ? <p className="mt-1 text-xs text-red-500">{pwErr(key)}</p> : null

  const locked   = profile?.profile_locked
  const disabled = !editing || locked

  // Get value for a field (core or extra)
  const getValue = (key) => PROFILE_CORE_KEYS.has(key) ? (form[key] ?? '') : (extraFields[key] ?? '')

  // Salary total (read-only display — computed from server data)
  const salaryTotal = ['basic_salary', 'punctuality_allowance', 'travelling_allowance', 'other_allowance']
    .reduce((s, k) => s + (parseFloat(profile?.[k]) || 0), 0)

  // Render a section from field configs.
  // "Salary (PKR)" gets the special card layout (always read-only).
  // All other sections render a 6-col grid; admin-managed fields are always disabled.
  const renderSection = (sectionName) => {
    const sectionFields = grouped[sectionName] ?? []
    if (sectionFields.length === 0) return null

    // ── Special salary display ─────────────────────────────────────────────
    if (sectionName === 'Salary (PKR)') {
      return (
        <SectionCard key={sectionName} title={sectionName}>
          {salaryTotal === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Salary details not set. Contact HR.</p>
          ) : (
            <div className="flex items-center divide-x divide-gray-200 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
              {sectionFields.map(field => (
                <div key={field.field_key} className="flex-1 px-4 py-3 text-center">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{field.label}</p>
                  <p className="text-sm font-bold"
                    style={{ color: profile?.[field.field_key] && Number(profile[field.field_key]) > 0 ? '#AA7F56' : '#9CA3AF' }}>
                    {fmtPKR(profile?.[field.field_key]) ?? 'N/A'}
                  </p>
                </div>
              ))}
              <div className="flex-1 px-4 py-3 text-center" style={{ background: 'rgba(170,127,86,0.06)' }}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Total</p>
                <p className="text-sm font-bold" style={{ color: '#AA7F56' }}>
                  PKR {salaryTotal.toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          )}
        </SectionCard>
      )
    }

    // ── Standard editable section (6-col grid) ────────────────────────────
    return (
      <SectionCard key={sectionName} title={sectionName}>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
          {sectionFields.map(field => (
            <DynamicField
              key={field.field_key}
              field={field}
              value={getValue(field.field_key)}
              onChange={handleFieldChange}
              disabled={disabled || PROFILE_READONLY_KEYS.has(field.field_key)}
              error={err(field.field_key)}
            />
          ))}
        </div>
      </SectionCard>
    )
  }

  const roleType = profile?.agent_type ?? profile?.manager_type ?? null

  if (!profile) {
    return (
      <Layout>
        <div className="p-6 max-w-3xl mx-auto space-y-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3 mb-4" />
              <div className="space-y-3">
                {[1, 2].map(j => <div key={j} className="h-10 bg-gray-100 rounded animate-pulse" />)}
              </div>
            </div>
          ))}
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="p-6 max-w-3xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#132E57', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>My Profile</h1>
            <p className="text-sm text-gray-500 mt-0.5">View and manage your account details</p>
          </div>

          {locked ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Profile Locked
            </div>
          ) : editing ? (
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => { setEditing(false); setForm({ ...profile, date_of_joining: toDateStr(profile.date_of_joining), date_of_birth: toDateStr(profile.date_of_birth) }); setExtraFields(profile.extra_fields ?? {}); setErrors({}) }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ border: '1px solid #5C6D82', color: '#9FA7B2', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.color='#FBDCB4'; e.currentTarget.style.borderColor='#AA7F56' }}
                onMouseLeave={e => { e.currentTarget.style.color='#9FA7B2'; e.currentTarget.style.borderColor='#5C6D82' }}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={loading}
                className="px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)', color: '#ffffff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
                onMouseEnter={e => { if(!loading) e.currentTarget.style.background='linear-gradient(135deg, #2296AA 0%, #1E8496 100%)' }}
                onMouseLeave={e => { if(!loading) e.currentTarget.style.background='linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)' }}>
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)}
              className="px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
              style={{ background: 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)', color: '#ffffff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
              onMouseEnter={e => e.currentTarget.style.background='linear-gradient(135deg, #2296AA 0%, #1E8496 100%)'}
              onMouseLeave={e => e.currentTarget.style.background='linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)'}>
              Edit Profile
            </button>
          )}
        </div>

        {/* ── Account (always hardcoded, read-only) ── */}
        <SectionCard title="Account">
          <div className={`grid gap-4 ${roleType ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
            <Field label="Username">
              <input value={profile.username} disabled className={inputCls} readOnly />
            </Field>
            <Field label="Role">
              <input value={profile.role ?? ''} disabled className={inputCls} readOnly />
            </Field>
            {roleType && (
              <Field label="Role Type">
                <input value={roleType} disabled className={inputCls} readOnly />
              </Field>
            )}
          </div>
        </SectionCard>

        {/* ── Dynamic managed sections (Personal Info, CNIC & Address, Banking) ── */}
        <form id="profile-form" onSubmit={handleSave} className="space-y-5">
          {sectionOrder.map(sectionName => renderSection(sectionName))}
        </form>

        {/* ── Change Password ── */}
        <SectionCard title="Change Password">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Current Password">
                <input name="current_password" type="password" value={pwForm.current_password} onChange={setPw}
                  placeholder="Current password"
                  className={`${inputCls} ${pwErr('current_password') ? inputErrCls : ''}`} />
                {pwErrMsg('current_password')}
              </Field>
              <Field label="New Password">
                <input name="new_password" type="password" value={pwForm.new_password} onChange={setPw}
                  placeholder="Min 8 characters"
                  className={`${inputCls} ${pwErr('new_password') ? inputErrCls : ''}`} />
                {pwErrMsg('new_password')}
              </Field>
              <Field label="Confirm New Password">
                <input name="new_password_confirmation" type="password" value={pwForm.new_password_confirmation} onChange={setPw}
                  placeholder="Repeat new password"
                  className={`${inputCls} ${pwErr('new_password_confirmation') ? inputErrCls : ''}`} />
                {pwErrMsg('new_password_confirmation')}
              </Field>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={pwLoading}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)', color: '#ffffff', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
                onMouseEnter={e => { if(!pwLoading) e.currentTarget.style.background='linear-gradient(135deg, #2296AA 0%, #1E8496 100%)' }}
                onMouseLeave={e => { if(!pwLoading) e.currentTarget.style.background='linear-gradient(135deg, #1E8496 0%, #0E5F6E 100%)' }}>
                {pwLoading ? 'Updating…' : 'Change Password'}
              </button>
            </div>
          </form>
        </SectionCard>

      </div>
    </Layout>
  )
}
