import { useState, useEffect, useCallback, useMemo } from 'react'
import Layout from '../components/Layout'
import api from '../api/axios'
import Toast from '../components/Toast'

// ── Design tokens ────────────────────────────────────────────────────────────
const NAVY  = '#132E57'
const TEAL  = '#1E8496'
const BG    = '#EDF0F3'
const WHITE = '#FFFFFF'

const TABS = ['User Access Level', 'Sale Form', 'Client Form', 'Profile Form', 'Attendance Time']

// ── Field type meta ───────────────────────────────────────────────────────────
const FIELD_TYPES = [
  { value: 'text',       label: 'Text' },
  { value: 'number',     label: 'Number' },
  { value: 'select',     label: 'Select' },
  { value: 'date',       label: 'Date' },
  { value: 'textarea',   label: 'Textarea' },
  { value: 'amount_usd', label: 'Amount (USD)' },
  { value: 'amount_pkr', label: 'Amount (PKR)' },
]

const TYPE_COLORS = {
  text:       { bg: '#EFF6FF', color: '#1D4ED8' },
  number:     { bg: '#FEF9C3', color: '#854D0E' },
  select:     { bg: '#F0FDF4', color: '#166534' },
  date:       { bg: '#FDF4FF', color: '#7E22CE' },
  textarea:   { bg: '#FFF7ED', color: '#9A3412' },
  amount_usd: { bg: '#ECFDF5', color: '#065F46' },
  amount_pkr: { bg: '#FFF7ED', color: '#92400E' },
}

const TYPE_LABELS = {
  text:       'Text',  number:     'Number', select:     'Select',
  date:       'Date',  textarea:   'Textarea',
  amount_usd: 'USD $', amount_pkr: 'PKR ₨',
}

// Width options: stored value → grid-span out of 6
const WIDTH_OPTS = [
  { value: 'full',       label: '100%', span: 6 },
  { value: 'two_thirds', label: '2/3',  span: 4 },
  { value: 'half',       label: '1/2',  span: 3 },
  { value: 'third',      label: '1/3',  span: 2 },
]

const NO_PLACEHOLDER = ['select', 'date', 'amount_usd', 'amount_pkr']

// ── Shared atoms ──────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const tc = TYPE_COLORS[type] ?? TYPE_COLORS.text
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap"
      style={{ background: tc.bg, color: tc.color }}>
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}

function CoreBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide"
      style={{ background: 'rgba(30,132,150,0.12)', color: TEAL, border: `1px solid ${TEAL}` }}>
      Core
    </span>
  )
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: checked ? TEAL : '#CBD5E1', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
      aria-checked={checked}>
      <span className="inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200"
        style={{ marginTop: 2, marginLeft: checked ? 18 : 2 }} />
    </button>
  )
}

// Small up/down arrow button
function ArrowBtn({ dir, disabled, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex items-center justify-center rounded transition-colors"
      style={{
        width: 20, height: 20,
        background: disabled ? 'transparent' : '#F1F5F9',
        color: disabled ? '#CBD5E1' : '#64748B',
        cursor: disabled ? 'default' : 'pointer',
        border: disabled ? '1px solid transparent' : '1px solid #E2E8F0',
      }}
      title={dir === 'up' ? 'Move up' : 'Move down'}>
      {dir === 'up'
        ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
        : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
      }
    </button>
  )
}

// ── Add Field Modal ───────────────────────────────────────────────────────────
function AddFieldModal({ defaultSection, sections, onAdd, onClose }) {
  const [form, setForm] = useState({
    label: '', field_key: '', field_type: 'text',
    placeholder: '', section: defaultSection || sections[0] || '',
    col_span: 'third', textarea_rows: 3,
    is_visible: true, is_required: false, options: [],
  })
  const [keyEdited, setKeyEdited] = useState(false)
  const [newOption, setNewOption] = useState('')
  const [saving, setSaving]       = useState(false)
  const [errors, setErrors]       = useState({})

  const autoKey = (label) =>
    label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
         .replace(/^_+|_+$/g, '').slice(0, 50)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleLabelChange = (val) => {
    setForm(f => ({ ...f, label: val, field_key: keyEdited ? f.field_key : autoKey(val) }))
    if (errors.label) setErrors(e => ({ ...e, label: undefined }))
  }
  const handleKeyChange = (val) => {
    setKeyEdited(true)
    setF('field_key', val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 50))
    if (errors.field_key) setErrors(e => ({ ...e, field_key: undefined }))
  }
  const handleTypeChange = (val) => {
    setF('field_type', val)
    // Auto-set sensible defaults
    if (val === 'textarea') setF('col_span', 'full')
    else if (form.col_span === 'full' && val !== 'textarea') setF('col_span', 'third')
  }
  const addOption = () => {
    if (!newOption.trim()) return
    setF('options', [...form.options, newOption.trim()])
    setNewOption('')
  }
  const removeOption = (i) => setF('options', form.options.filter((_, idx) => idx !== i))

  const validate = () => {
    const e = {}
    if (!form.label.trim()) e.label = 'Label is required'
    if (!form.field_key.trim()) e.field_key = 'Field key is required'
    if (form.field_key && !/^[a-z][a-z0-9_]*$/.test(form.field_key))
      e.field_key = 'Must start with a letter; only a–z, 0–9, underscores'
    if (form.field_type === 'select' && form.options.length === 0)
      e.options = 'Add at least one option'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await onAdd({
        label:         form.label,
        field_key:     form.field_key,
        field_type:    form.field_type,
        placeholder:   !NO_PLACEHOLDER.includes(form.field_type) ? (form.placeholder || null) : null,
        section:       form.section || null,
        col_span:      form.col_span,
        textarea_rows: form.field_type === 'textarea' ? (form.textarea_rows || 3) : 3,
        is_visible:    form.is_visible,
        is_required:   form.is_required,
        options:       form.field_type === 'select' ? form.options : null,
        sort_order:    9999,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: WHITE }}>
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})` }}>
          <h3 className="text-lg font-black text-white" style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
            Add New Field
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Section */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>Section</label>
            <select value={form.section} onChange={e => setF('section', e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: '#CBD5E1', color: NAVY }}>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>
              Label <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.label} onChange={e => handleLabelChange(e.target.value)}
              placeholder="e.g. Customer ID"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: errors.label ? '#ef4444' : '#CBD5E1', color: NAVY }} />
            {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label}</p>}
          </div>

          {/* Field Key */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>
              Field Key / ID <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.field_key} onChange={e => handleKeyChange(e.target.value)}
              placeholder="e.g. customer_id" className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none"
              style={{ borderColor: errors.field_key ? '#ef4444' : '#CBD5E1', color: '#475569' }} />
            {errors.field_key
              ? <p className="text-xs text-red-500 mt-1">{errors.field_key}</p>
              : <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers and underscores only.</p>}
          </div>

          {/* Field Type */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>
              Field Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {FIELD_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-all"
                  style={{
                    background:  form.field_type === t.value ? `linear-gradient(90deg, ${NAVY}, ${TEAL})` : WHITE,
                    color:       form.field_type === t.value ? WHITE : NAVY,
                    borderColor: form.field_type === t.value ? 'transparent' : '#CBD5E1',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Width + Rows row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>Width</label>
              <div className="flex gap-1">
                {WIDTH_OPTS.map(w => (
                  <button key={w.value} type="button" onClick={() => setF('col_span', w.value)}
                    className="flex-1 py-1 rounded-lg text-xs font-bold border transition-all"
                    style={{
                      background:  form.col_span === w.value ? `linear-gradient(90deg, ${NAVY}, ${TEAL})` : WHITE,
                      color:       form.col_span === w.value ? WHITE : NAVY,
                      borderColor: form.col_span === w.value ? 'transparent' : '#CBD5E1',
                    }}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
            {form.field_type === 'textarea' && (
              <div style={{ width: 80 }}>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>Rows</label>
                <input type="number" min={1} max={20} value={form.textarea_rows}
                  onChange={e => setF('textarea_rows', parseInt(e.target.value) || 3)}
                  className="w-full rounded-lg border px-2 py-1 text-sm text-center focus:outline-none"
                  style={{ borderColor: '#CBD5E1', color: NAVY }} />
              </div>
            )}
          </div>

          {/* Placeholder */}
          {!NO_PLACEHOLDER.includes(form.field_type) && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>Placeholder</label>
              <input type="text" value={form.placeholder} onChange={e => setF('placeholder', e.target.value)}
                placeholder="e.g. Enter value…"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#CBD5E1', color: NAVY }} />
            </div>
          )}

          {/* Options */}
          {form.field_type === 'select' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>
                Options <span className="text-red-500">*</span>
              </label>
              <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 px-3 py-1.5 rounded-lg text-sm" style={{ background: '#F7F9FC', color: NAVY }}>{opt}</span>
                    <button type="button" onClick={() => removeOption(i)}
                      className="text-red-400 hover:text-red-600 font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50">×</button>
                  </div>
                ))}
                {form.options.length === 0 && <p className="text-xs text-gray-400 italic">No options yet.</p>}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newOption} onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                  placeholder="Type and press Enter"
                  className="flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
                  style={{ borderColor: errors.options ? '#ef4444' : '#CBD5E1', color: NAVY }} />
                <button type="button" onClick={addOption}
                  className="px-4 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})`, color: WHITE }}>+ Add</button>
              </div>
              {errors.options && <p className="text-xs text-red-500 mt-1">{errors.options}</p>}
            </div>
          )}

          {/* Visible / Required */}
          <div className="flex gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <Toggle checked={form.is_visible} onChange={v => setF('is_visible', v)} />
              <span className="text-sm font-semibold" style={{ color: NAVY }}>Visible</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Toggle checked={form.is_required} onChange={v => setF('is_required', v)} disabled={!form.is_visible} />
              <span className="text-sm font-semibold" style={{ color: NAVY }}>Required</span>
            </label>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3 justify-end border-t border-gray-100 pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ border: '1px solid #CBD5E1', color: '#64748B' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white"
            style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})`, opacity: saving ? 0.65 : 1, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em' }}>
            {saving ? 'Adding…' : 'Add Field'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Options Modal ────────────────────────────────────────────────────────
function EditOptionsModal({ field, onSave, onClose }) {
  const [options, setOptions]     = useState([...(field.options || [])])
  const [newOption, setNewOption] = useState('')
  const [editIdx, setEditIdx]     = useState(null)
  const [editVal, setEditVal]     = useState('')

  const addOption   = () => { if (!newOption.trim()) return; setOptions(o => [...o, newOption.trim()]); setNewOption('') }
  const removeOption = (i) => setOptions(o => o.filter((_, idx) => idx !== i))
  const startEdit   = (i) => { setEditIdx(i); setEditVal(options[i]) }
  const commitEdit  = () => {
    if (!editVal.trim()) return
    setOptions(o => o.map((opt, i) => i === editIdx ? editVal.trim() : opt))
    setEditIdx(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: WHITE }}>
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})` }}>
          <div>
            <h3 className="text-base font-black text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Edit Options</h3>
            <p className="text-xs text-white/70">{field.label}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-5">
          <div className="space-y-1.5 mb-4 max-h-64 overflow-y-auto">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                {editIdx === i ? (
                  <>
                    <input type="text" value={editVal} onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && commitEdit()} autoFocus
                      className="flex-1 rounded-lg border px-2 py-1.5 text-sm focus:outline-none"
                      style={{ borderColor: TEAL, color: NAVY }} />
                    <button onClick={commitEdit} className="text-xs font-bold px-2 py-1 rounded"
                      style={{ background: TEAL, color: WHITE }}>✓</button>
                    <button onClick={() => setEditIdx(null)} className="text-xs text-gray-400 px-1">✕</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 px-3 py-1.5 rounded-lg text-sm" style={{ color: NAVY, background: '#F7F9FC' }}>{opt}</span>
                    <button onClick={() => startEdit(i)} className="text-blue-400 hover:text-blue-600 text-sm px-1">✎</button>
                    <button onClick={() => removeOption(i)}
                      className="text-red-400 hover:text-red-600 font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50">×</button>
                  </>
                )}
              </div>
            ))}
            {options.length === 0 && <p className="text-sm text-gray-400 text-center py-3 italic">No options. Add below.</p>}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newOption} onChange={e => setNewOption(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
              placeholder="New option…"
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
              style={{ borderColor: '#CBD5E1', color: NAVY }} />
            <button onClick={addOption} className="px-4 py-1.5 rounded-lg text-sm font-bold"
              style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})`, color: WHITE }}>+ Add</button>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-end border-t border-gray-100 pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ border: '1px solid #CBD5E1', color: '#64748B' }}>Cancel</button>
          <button onClick={() => onSave(options)} className="px-5 py-2 rounded-lg text-sm font-bold text-white"
            style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})`, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em' }}>
            Save Options
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Field Modal ──────────────────────────────────────────────────────────
function EditFieldModal({ field, sections, onSave, onClose }) {
  const [form, setForm] = useState({
    label:         field.label || '',
    field_type:    field.field_type || 'text',
    placeholder:   field.placeholder || '',
    section:       field.section || sections[0] || '',
    col_span:      field.col_span || 'third',
    textarea_rows: field.textarea_rows || 3,
    is_visible:    field.is_visible ?? true,
    is_required:   field.is_required ?? false,
    options:       Array.isArray(field.options) ? [...field.options] : [],
  })
  const [newOption, setNewOption] = useState('')
  const [saving, setSaving]       = useState(false)
  const [errors, setErrors]       = useState({})

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleTypeChange = (val) => {
    setF('field_type', val)
    if (val === 'textarea') setF('col_span', 'full')
    else if (form.col_span === 'full' && val !== 'textarea') setF('col_span', 'third')
  }

  const addOption    = () => { if (!newOption.trim()) return; setF('options', [...form.options, newOption.trim()]); setNewOption('') }
  const removeOption = (i) => setF('options', form.options.filter((_, idx) => idx !== i))

  const validate = () => {
    const e = {}
    if (!form.label.trim()) e.label = 'Label is required'
    if (form.field_type === 'select' && form.options.length === 0)
      e.options = 'Add at least one option'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await onSave({
        field_key:     field.field_key,
        sort_order:    field.sort_order ?? 0,
        label:         form.label.trim(),
        field_type:    form.field_type,
        placeholder:   !NO_PLACEHOLDER.includes(form.field_type) ? (form.placeholder || null) : null,
        section:       form.section || null,
        col_span:      form.col_span,
        textarea_rows: form.field_type === 'textarea' ? (form.textarea_rows || 3) : 3,
        is_visible:    form.is_visible,
        is_required:   form.is_required,
        options:       form.field_type === 'select' ? form.options : null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: WHITE }}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})` }}>
          <div>
            <h3 className="text-lg font-black text-white" style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
              Edit Field
            </h3>
            <p className="text-xs text-white/60 mt-0.5 font-mono">{field.field_key}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">

          {/* Section */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>Section</label>
            <select value={form.section} onChange={e => setF('section', e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: '#CBD5E1', color: NAVY }}>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>
              Label <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.label}
              onChange={e => { setF('label', e.target.value); if (errors.label) setErrors(p => ({ ...p, label: undefined })) }}
              placeholder="e.g. Customer ID"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: errors.label ? '#ef4444' : '#CBD5E1', color: NAVY }} />
            {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label}</p>}
          </div>

          {/* Field Type */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>Field Type</label>
            <div className="flex gap-1.5 flex-wrap">
              {FIELD_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-all"
                  style={{
                    background:  form.field_type === t.value ? `linear-gradient(90deg, ${NAVY}, ${TEAL})` : WHITE,
                    color:       form.field_type === t.value ? WHITE : NAVY,
                    borderColor: form.field_type === t.value ? 'transparent' : '#CBD5E1',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Width + Rows */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>Width</label>
              <div className="flex gap-1">
                {WIDTH_OPTS.map(w => (
                  <button key={w.value} type="button" onClick={() => setF('col_span', w.value)}
                    className="flex-1 py-1 rounded-lg text-xs font-bold border transition-all"
                    style={{
                      background:  form.col_span === w.value ? `linear-gradient(90deg, ${NAVY}, ${TEAL})` : WHITE,
                      color:       form.col_span === w.value ? WHITE : NAVY,
                      borderColor: form.col_span === w.value ? 'transparent' : '#CBD5E1',
                    }}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
            {form.field_type === 'textarea' && (
              <div style={{ width: 80 }}>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>Rows</label>
                <input type="number" min={1} max={20} value={form.textarea_rows}
                  onChange={e => setF('textarea_rows', parseInt(e.target.value) || 3)}
                  className="w-full rounded-lg border px-2 py-1 text-sm text-center focus:outline-none"
                  style={{ borderColor: '#CBD5E1', color: NAVY }} />
              </div>
            )}
          </div>

          {/* Placeholder */}
          {!NO_PLACEHOLDER.includes(form.field_type) && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>Placeholder</label>
              <input type="text" value={form.placeholder} onChange={e => setF('placeholder', e.target.value)}
                placeholder="e.g. Enter value…"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#CBD5E1', color: NAVY }} />
            </div>
          )}

          {/* Options (select type) */}
          {form.field_type === 'select' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: NAVY }}>
                Options <span className="text-red-500">*</span>
              </label>
              <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 px-3 py-1.5 rounded-lg text-sm" style={{ background: '#F7F9FC', color: NAVY }}>{opt}</span>
                    <button type="button" onClick={() => removeOption(i)}
                      className="text-red-400 hover:text-red-600 font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50">×</button>
                  </div>
                ))}
                {form.options.length === 0 && <p className="text-xs text-gray-400 italic">No options yet.</p>}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newOption} onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                  placeholder="Type and press Enter"
                  className="flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
                  style={{ borderColor: errors.options ? '#ef4444' : '#CBD5E1', color: NAVY }} />
                <button type="button" onClick={addOption}
                  className="px-4 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})`, color: WHITE }}>+ Add</button>
              </div>
              {errors.options && <p className="text-xs text-red-500 mt-1">{errors.options}</p>}
            </div>
          )}

          {/* Visible / Required */}
          <div className="flex gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <Toggle checked={form.is_visible} onChange={v => setF('is_visible', v)} />
              <span className="text-sm font-semibold" style={{ color: NAVY }}>Visible</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Toggle checked={form.is_required} onChange={v => setF('is_required', v)} disabled={!form.is_visible} />
              <span className="text-sm font-semibold" style={{ color: NAVY }}>Required</span>
            </label>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3 justify-end border-t border-gray-100 pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ border: '1px solid #CBD5E1', color: '#64748B' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white"
            style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})`, opacity: saving ? 0.65 : 1, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ name, hasFields, isFirst, isLast, onRename, onDelete, onMoveUp, onMoveDown }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(name)

  const commit = () => {
    if (val.trim() && val.trim() !== name) onRename(val.trim())
    setEditing(false)
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5"
      style={{ background: '#F1F5FA', borderBottom: '2px solid #E2E8F0' }}>
      <div className="flex items-center gap-2">
        {/* Section reorder arrows */}
        <div className="flex flex-col gap-0.5">
          <ArrowBtn dir="up"   disabled={isFirst} onClick={onMoveUp} />
          <ArrowBtn dir="down" disabled={isLast}  onClick={onMoveDown} />
        </div>

        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: TEAL }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" />
        </svg>

        {editing ? (
          <input type="text" value={val} autoFocus
            onChange={e => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            className="rounded-lg border px-2 py-0.5 text-sm font-bold focus:outline-none focus:ring-2"
            style={{ color: NAVY, borderColor: TEAL, fontFamily: "'Rajdhani', sans-serif", minWidth: 180 }} />
        ) : (
          <span className="text-sm font-bold" style={{ color: NAVY, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.03em' }}>
            {name}
          </span>
        )}

        <button onClick={() => { setEditing(true); setVal(name) }}
          className="text-gray-400 hover:text-gray-600" title="Rename section">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      {!hasFields && (
        <button onClick={onDelete} className="text-xs font-semibold px-2 py-1 rounded" style={{ color: '#ef4444' }}>
          Delete Section
        </button>
      )}
    </div>
  )
}

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldRow({ field, sectionIndex, sectionLength, onChange, onEditOptions, onDelete, onEdit, onMoveUp, onMoveDown }) {
  const showPlaceholder = !NO_PLACEHOLDER.includes(field.field_type)
  const currentWidth    = field.col_span || 'third'

  // Column widths — must match the hint row exactly
  const W = { arrows: 44, num: 24, label: 260, width: 132, type: 80, options: 80, visible: 96, required: 110, del: 36, edit: 36 }

  return (
    <div style={{ borderBottom: '1px solid #F1F5F9', background: sectionIndex % 2 === 0 ? WHITE : '#FAFBFC' }}>
      <div className="flex items-center px-4 py-2.5" style={{ gap: 8 }}>

        {/* ↑↓ arrows — explicit width so header aligns */}
        <div className="flex flex-col gap-0.5 flex-shrink-0" style={{ width: W.arrows }}>
          <ArrowBtn dir="up"   disabled={sectionIndex === 0}                 onClick={onMoveUp} />
          <ArrowBtn dir="down" disabled={sectionIndex === sectionLength - 1} onClick={onMoveDown} />
        </div>

        {/* # */}
        <div className="flex-shrink-0 text-xs font-mono text-right" style={{ width: W.num, color: '#94A3B8' }}>
          {String(sectionIndex + 1).padStart(2, '0')}
        </div>

        {/* Label + Placeholder */}
        <div className="flex-shrink-0 space-y-1.5" style={{ width: W.label }}>
          <input type="text" value={field.label} onChange={e => onChange({ label: e.target.value })}
            placeholder="Field label"
            className="w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 transition-colors"
            style={{ borderColor: '#CBD5E1', color: NAVY, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }} />
          {showPlaceholder && (
            <input type="text" value={field.placeholder || ''} onChange={e => onChange({ placeholder: e.target.value })}
              placeholder="Placeholder…"
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none transition-colors"
              style={{ borderColor: '#E2E8F0', color: '#64748B' }} />
          )}
        </div>

        {/* Width picker */}
        <div className="flex-shrink-0 space-y-1" style={{ width: W.width }}>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#CBD5E1' }}>
            {WIDTH_OPTS.map(w => (
              <button key={w.value} type="button" onClick={() => onChange({ col_span: w.value })}
                className="flex-1 text-xs font-bold py-1.5 transition-colors"
                style={{
                  background:  currentWidth === w.value ? `linear-gradient(90deg, ${NAVY}, ${TEAL})` : WHITE,
                  color:       currentWidth === w.value ? WHITE : '#64748B',
                  borderRight: w.value !== 'third' ? '1px solid #CBD5E1' : 'none',
                }}>
                {w.label}
              </button>
            ))}
          </div>
          {field.field_type === 'textarea' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: '#94A3B8' }}>Rows:</span>
              <input type="number" min={1} max={20} value={field.textarea_rows || 3}
                onChange={e => onChange({ textarea_rows: Math.max(1, Math.min(20, parseInt(e.target.value) || 3)) })}
                className="rounded-lg border px-1.5 py-1 text-xs text-center focus:outline-none"
                style={{ width: 44, borderColor: '#CBD5E1', color: NAVY }} />
            </div>
          )}
        </div>

        {/* Type badge */}
        <div className="flex-shrink-0" style={{ width: W.type }}>
          <TypeBadge type={field.field_type} />
        </div>

        {/* Options */}
        <div className="flex-shrink-0" style={{ width: W.options }}>
          {field.field_type === 'select' ? (
            <button onClick={onEditOptions}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-colors hover:border-teal-400"
              style={{ color: TEAL, borderColor: 'rgba(30,132,150,0.35)', background: 'rgba(30,132,150,0.06)' }}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {field.options?.length ?? 0} opts
            </button>
          ) : (
            <span className="text-xs font-semibold" style={{ color: '#CBD5E1' }}>N/A</span>
          )}
        </div>

        {/* Toggle + "Visible" label inline */}
        <div className="flex-shrink-0 flex items-center gap-1.5" style={{ width: W.visible }}>
          <Toggle
            checked={field.is_visible}
            disabled={field.is_core}
            onChange={val => onChange({ is_visible: val, is_required: val ? field.is_required : false })}
          />
          <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Visible</span>
        </div>

        {/* Toggle + "Required" label inline */}
        <div className="flex-shrink-0 flex items-center gap-1.5" style={{ width: W.required }}>
          <Toggle
            checked={field.is_required}
            disabled={!field.is_visible}
            onChange={val => onChange({ is_required: val })}
          />
          <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Required</span>
        </div>

        {/* Core badge or Delete */}
        <div className="flex-shrink-0 flex justify-center" style={{ width: W.del }}>
          {field.is_core ? (
            <CoreBadge />
          ) : (
            <button onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: '#F87171' }}
              onMouseEnter={e => { e.currentTarget.style.background='#FEF2F2' }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent' }}
              title="Delete field">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        {/* Edit — available for every field (core and non-core) */}
        <div className="flex-shrink-0 flex justify-center" style={{ width: W.edit }}>
          <button onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: '#3B82F6' }}
            onMouseEnter={e => { e.currentTarget.style.background='#EFF6FF' }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent' }}
            title="Edit field">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED — Form Management Tab (Sale / Profile / Client)
// ════════════════════════════════════════════════════════════════════════════
function FormManagementTab({ formType, formLabel, setToast }) {
  const [fields, setFields]             = useState([])
  const [sectionOrder, setSectionOrder] = useState([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)

  const [addFieldModal, setAddFieldModal]       = useState(null)
  const [editFieldModal, setEditFieldModal]     = useState(null)
  const [editOptionsModal, setEditOptionsModal] = useState(null)
  const [showAddSection, setShowAddSection]     = useState(false)
  const [newSectionName, setNewSectionName]     = useState('')

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadFields = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await api.get('/crm/form-fields', { params: { form_type: formType } })
      const data = res.data
      setFields(data)
      const order = []
      data.forEach(f => {
        const s = f.section || 'General'
        if (!order.includes(s)) order.push(s)
      })
      setSectionOrder(order)
    } catch {
      setToast({ type: 'error', message: 'Failed to load form fields.' })
    } finally {
      setLoading(false)
    }
  }, [formType, setToast])

  useEffect(() => { loadFields() }, [loadFields])

  const grouped = useMemo(() => {
    const map = {}
    sectionOrder.forEach(s => { map[s] = [] })
    fields.forEach(f => {
      const s = f.section || 'General'
      if (!map[s]) map[s] = []
      map[s].push(f)
    })
    return map
  }, [fields, sectionOrder])

  // ── Field operations ──────────────────────────────────────────────────────
  const updateField = (fieldKey, changes) =>
    setFields(fs => fs.map(f => f.field_key === fieldKey ? { ...f, ...changes } : f))

  const moveField = (sectionName, idx, dir) => {
    const sectionFields = fields.filter(f => (f.section || 'General') === sectionName)
    const targetIdx = idx + dir
    if (targetIdx < 0 || targetIdx >= sectionFields.length) return
    const newSF = [...sectionFields]
    ;[newSF[idx], newSF[targetIdx]] = [newSF[targetIdx], newSF[idx]]
    // Rebuild full fields array in section order
    const result = []
    sectionOrder.forEach(s => {
      if (s === sectionName) result.push(...newSF)
      else result.push(...fields.filter(f => (f.section || 'General') === s))
    })
    setFields(result)
  }

  // ── Section operations ────────────────────────────────────────────────────
  const renameSection = (oldName, newName) => {
    if (!newName || newName === oldName) return
    setFields(fs => fs.map(f => f.section === oldName ? { ...f, section: newName } : f))
    setSectionOrder(o => o.map(s => s === oldName ? newName : s))
  }

  const moveSection = (idx, dir) => {
    const targetIdx = idx + dir
    if (targetIdx < 0 || targetIdx >= sectionOrder.length) return
    const newOrder = [...sectionOrder]
    ;[newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]]
    setSectionOrder(newOrder)
  }

  const deleteSection = (name) => {
    if (fields.some(f => f.section === name)) {
      setToast({ type: 'error', message: 'Move or delete all fields in this section first.' })
      return
    }
    setSectionOrder(o => o.filter(s => s !== name))
  }

  const addSection = () => {
    const n = newSectionName.trim()
    if (!n) return
    if (sectionOrder.includes(n)) { setToast({ type: 'error', message: `Section "${n}" already exists.` }); return }
    setSectionOrder(o => [...o, n])
    setNewSectionName('')
    setShowAddSection(false)
  }

  // ── Add / Delete field (API) ──────────────────────────────────────────────
  const handleAddField = async (fieldData) => {
    try {
      const res = await api.post('/crm/form-fields', { ...fieldData, form_type: formType })
      const created = res.data
      setFields(fs => [...fs, created])
      if (created.section && !sectionOrder.includes(created.section))
        setSectionOrder(o => [...o, created.section])
      setAddFieldModal(null)
      setToast({ type: 'success', message: `Field "${created.label}" added.` })
    } catch (err) {
      const msg = err?.response?.data?.errors?.field_key?.[0] ?? err?.response?.data?.message ?? 'Failed to add field.'
      setToast({ type: 'error', message: msg })
      throw err
    }
  }

  const handleEditField = async (fieldData) => {
    try {
      await api.put('/crm/form-fields', {
        form_type: formType,
        fields: [{
          field_key:     fieldData.field_key,
          sort_order:    fieldData.sort_order ?? 0,
          label:         fieldData.label,
          field_type:    fieldData.field_type,
          placeholder:   fieldData.placeholder ?? null,
          is_visible:    fieldData.is_visible,
          is_required:   fieldData.is_required,
          section:       fieldData.section ?? null,
          col_span:      fieldData.col_span ?? 'third',
          textarea_rows: fieldData.textarea_rows ?? 3,
          options:       fieldData.options ?? null,
        }],
      })
      setFields(fs => fs.map(f => f.field_key === fieldData.field_key ? { ...f, ...fieldData } : f))
      // If section changed to one not yet in sectionOrder, append it
      if (fieldData.section && !sectionOrder.includes(fieldData.section)) {
        setSectionOrder(o => [...o, fieldData.section])
      }
      setEditFieldModal(null)
      setToast({ type: 'success', message: `Field "${fieldData.label}" updated.` })
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Failed to update field.'
      setToast({ type: 'error', message: msg })
      throw err
    }
  }

  const handleDeleteField = async (fieldKey) => {
    if (!window.confirm('Delete this field? This cannot be undone.')) return
    try {
      await api.delete(`/crm/form-fields/${formType}/${fieldKey}`)
      setFields(fs => fs.filter(f => f.field_key !== fieldKey))
      setToast({ type: 'success', message: 'Field deleted.' })
    } catch (err) {
      setToast({ type: 'error', message: err?.response?.data?.message ?? 'Failed to delete field.' })
    }
  }

  // ── Save all ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      const ordered = []
      sectionOrder.forEach(s => { if (grouped[s]) ordered.push(...grouped[s]) })
      await api.put('/crm/form-fields', {
        form_type: formType,
        fields: ordered.map((f, i) => ({
          field_key:     f.field_key,
          label:         f.label,
          placeholder:   f.placeholder ?? null,
          is_visible:    f.is_visible,
          is_required:   f.is_required,
          sort_order:    i + 1,
          section:       f.section ?? null,
          options:       f.options ?? null,
          col_span:      f.col_span ?? 'third',
          textarea_rows: f.textarea_rows ?? 3,
        })),
      })
      setToast({ type: 'success', message: 'Form configuration saved!' })
    } catch {
      setToast({ type: 'error', message: 'Failed to save changes.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: TEAL }} />
      </div>
    )
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs" style={{ color: '#64748B' }}>
        <span>Use ↑↓ arrows to reorder fields within a section, or to reorder sections.</span>
        <span>Width buttons set how much horizontal space the field takes on the {formLabel ?? 'form'}.</span>
      </div>

      {/* Sections */}
      {sectionOrder.map((sectionName, si) => {
        const sectionFields = grouped[sectionName] || []
        return (
          <div key={sectionName} className="mb-4 rounded-xl overflow-hidden"
            style={{ background: WHITE, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

            <SectionHeader
              name={sectionName}
              hasFields={sectionFields.length > 0}
              isFirst={si === 0}
              isLast={si === sectionOrder.length - 1}
              onRename={n => renameSection(sectionName, n)}
              onDelete={() => deleteSection(sectionName)}
              onMoveUp={() => moveSection(si, -1)}
              onMoveDown={() => moveSection(si, 1)}
            />

            {/* Column hint row — gap:8 and widths MUST match FieldRow W object exactly */}
            {sectionFields.length > 0 && (
              <div className="flex items-center px-4 py-1.5 text-xs font-bold uppercase tracking-wide"
                style={{ gap: 8, color: '#94A3B8', background: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ width: 44 }} />  {/* arrows */}
                <div style={{ width: 24 }} />  {/* # */}
                <div style={{ width: 260 }}>Label / Placeholder</div>
                <div style={{ width: 132 }}>Width</div>
                <div style={{ width: 80 }}>Type</div>
                <div style={{ width: 80 }}>Options</div>
                <div style={{ width: 96 }}>Visible</div>
                <div style={{ width: 110 }}>Required</div>
                <div style={{ width: 36 }} />  {/* delete */}
                <div style={{ width: 36 }} />  {/* edit */}
              </div>
            )}

            {sectionFields.map((field, fi) => (
              <FieldRow
                key={field.field_key}
                field={field}
                sectionIndex={fi}
                sectionLength={sectionFields.length}
                onChange={changes => updateField(field.field_key, changes)}
                onEditOptions={() => setEditOptionsModal({ ...field })}
                onDelete={() => handleDeleteField(field.field_key)}
                onEdit={() => setEditFieldModal({ ...field })}
                onMoveUp={() => moveField(sectionName, fi, -1)}
                onMoveDown={() => moveField(sectionName, fi, 1)}
              />
            ))}

            {/* Add field */}
            <div className="px-4 py-2.5 border-t border-dashed" style={{ borderColor: '#E2E8F0' }}>
              <button onClick={() => setAddFieldModal({ section: sectionName })}
                className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
                style={{ color: TEAL }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Field to "{sectionName}"
              </button>
            </div>
          </div>
        )
      })}

      {/* Add Section */}
      <div className="mb-6">
        {showAddSection ? (
          <div className="flex items-center gap-2 p-4 rounded-xl border-2 border-dashed"
            style={{ borderColor: TEAL, background: 'rgba(30,132,150,0.04)' }}>
            <input type="text" value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSection(); if (e.key === 'Escape') setShowAddSection(false) }}
              placeholder="Section name, e.g. Insurance Details" autoFocus
              className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: TEAL, color: NAVY }} />
            <button onClick={addSection} className="px-4 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})` }}>Create</button>
            <button onClick={() => setShowAddSection(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ border: '1px solid #CBD5E1', color: '#64748B' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowAddSection(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-dashed w-full text-sm font-semibold"
            style={{ borderColor: '#CBD5E1', color: '#64748B' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Section
          </button>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          Reordering, label edits, width and toggle changes are saved together via Save All.
          New fields and deletions apply immediately.
        </p>
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 rounded-xl font-bold text-white"
          style={{
            background: `linear-gradient(90deg, ${NAVY}, ${TEAL})`,
            fontFamily: "'Rajdhani', sans-serif", fontSize: '1rem',
            letterSpacing: '0.05em', opacity: saving ? 0.65 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(30,132,150,0.25)',
          }}>
          {saving ? 'Saving…' : 'Save All Changes'}
        </button>
      </div>

      {addFieldModal && (
        <AddFieldModal
          defaultSection={addFieldModal.section}
          sections={sectionOrder}
          onAdd={handleAddField}
          onClose={() => setAddFieldModal(null)}
        />
      )}
      {editFieldModal && (
        <EditFieldModal
          field={editFieldModal}
          sections={sectionOrder}
          onSave={handleEditField}
          onClose={() => setEditFieldModal(null)}
        />
      )}
      {editOptionsModal && (
        <EditOptionsModal
          field={editOptionsModal}
          onSave={opts => { updateField(editOptionsModal.field_key, { options: opts }); setEditOptionsModal(null) }}
          onClose={() => setEditOptionsModal(null)}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — User Access Level
// ════════════════════════════════════════════════════════════════════════════
function UserAccessTab({ setToast }) {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState({})
  const [saving, setSaving]   = useState({})

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/users')
      setUsers(res.data?.data ?? res.data ?? [])
    } catch { setToast({ type: 'error', message: 'Failed to load users.' }) }
    finally  { setLoading(false) }
  }, [setToast])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleSave = async (user) => {
    const newRole = pending[user.id]
    if (!newRole) return
    setSaving(s => ({ ...s, [user.id]: true }))
    try {
      await api.put(`/crm/users/${user.id}/role`, { role: newRole })
      setToast({ type: 'success', message: `Role updated for ${user.display_name ?? user.username}.` })
      setPending(p => { const n = { ...p }; delete n[user.id]; return n })
      setUsers(us => us.map(u => u.id === user.id ? { ...u, role: newRole } : u))
    } catch (err) {
      setToast({ type: 'error', message: err?.response?.data?.message ?? 'Failed to update role.' })
    } finally {
      setSaving(s => { const n = { ...s }; delete n[user.id]; return n })
    }
  }

  const ROLES        = ['agent', 'manager', 'director', 'admin']
  const ROLE_LABELS  = { agent: 'Agent', manager: 'Manager', director: 'Director', admin: 'Admin' }
  const STATUS_COLOR = { active: '#16a34a', inactive: '#dc2626', locked: '#d97706' }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: TEAL }} />
    </div>
  )

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: WHITE, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#F7F9FC', borderBottom: '2px solid #E2E8F0' }}>
              {['Name', 'Username', 'Role', 'Department', 'Status', 'Action'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-bold uppercase tracking-wide text-xs" style={{ color: NAVY }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No users found.</td></tr>}
            {users.map((user, i) => {
              const currentRole = pending[user.id] !== undefined ? pending[user.id] : user.role
              const isDirty     = pending[user.id] !== undefined && pending[user.id] !== user.role
              const status      = user.is_active === false ? 'inactive' : user.is_locked === true ? 'locked' : 'active'
              return (
                <tr key={user.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #F1F5F9' : 'none', background: i % 2 === 0 ? WHITE : '#FAFBFC' }}>
                  <td className="px-5 py-3 font-semibold" style={{ color: NAVY }}>{user.display_name ?? user.name ?? 'N/A'}</td>
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: '#475569' }}>{user.username ?? 'N/A'}</td>
                  <td className="px-5 py-3">
                    <select value={currentRole} onChange={e => setPending(p => ({ ...p, [user.id]: e.target.value }))}
                      className="rounded-lg border px-2 py-1 text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: isDirty ? TEAL : '#CBD5E1', color: NAVY, background: isDirty ? 'rgba(30,132,150,0.06)' : WHITE, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, minWidth: 110 }}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-sm" style={{ color: '#64748B' }}>{user.department ?? user.manager_type ?? 'N/A'}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                      style={{ background: `${STATUS_COLOR[status]}18`, color: STATUS_COLOR[status] }}>
                      {status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {isDirty && (
                      <button onClick={() => handleSave(user)} disabled={saving[user.id]}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                        style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})`, opacity: saving[user.id] ? 0.6 : 1, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em' }}>
                        {saving[user.id] ? 'Saving…' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LOGIN TIME TAB
// ════════════════════════════════════════════════════════════════════════════
function LoginTimeTab({ setToast }) {
  const [time, setTime]           = useState('')
  const [display, setDisplay]     = useState('')
  const [margin, setMargin]       = useState('15')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [savingMargin, setSavingMargin] = useState(false)

  useEffect(() => {
    api.get('/working-days/settings')
      .then(({ data }) => {
        const lt = data.settings?.find(x => x.key === 'default_login_time')
        if (lt) { setTime(lt.value); setDisplay(to12hr(lt.value)) }
        const lm = data.settings?.find(x => x.key === 'late_margin_minutes')
        if (lm) setMargin(lm.value)
      })
      .catch(() => setToast({ type: 'error', message: 'Failed to load settings.' }))
      .finally(() => setLoading(false))
  }, [])

  // Convert "17:00" → "05:00 PM"
  function to12hr(val) {
    if (!val) return ''
    const [h, m] = val.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12  = h % 12 || 12
    return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`
  }

  // Convert "05:00 PM" → "17:00"
  function to24hr(val) {
    const match = val.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match) return null
    let h = parseInt(match[1])
    const m = parseInt(match[2])
    const ampm = match[3].toUpperCase()
    if (ampm === 'PM' && h !== 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }

  const handleSave = async () => {
    const converted = to24hr(display)
    if (!converted) {
      setToast({ type: 'error', message: 'Invalid time format. Use HH:MM AM/PM (e.g. 06:00 PM)' })
      return
    }
    setSaving(true)
    try {
      await api.patch('/working-days/settings/default_login_time', { value: converted })
      setTime(converted)
      setToast({ type: 'success', message: 'Default attendance time updated successfully.' })
    } catch {
      setToast({ type: 'error', message: 'Failed to save. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMargin = async () => {
    const val = parseInt(margin, 10)
    if (isNaN(val) || val < 1 || val > 120) {
      setToast({ type: 'error', message: 'Late margin must be between 1 and 120 minutes.' })
      return
    }
    setSavingMargin(true)
    try {
      await api.patch('/working-days/settings/late_margin_minutes', { value: String(val) })
      setToast({ type: 'success', message: `Late margin updated to ${val} minutes.` })
    } catch {
      setToast({ type: 'error', message: 'Failed to save. Please try again.' })
    } finally {
      setSavingMargin(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <svg className="animate-spin h-6 w-6" style={{ color: TEAL }} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"/>
      </svg>
    </div>
  )

  return (
    <div className="max-w-xl">
      <div className="rounded-2xl overflow-hidden" style={{ background: WHITE, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})` }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width:18, height:18 }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-sm" style={{ fontFamily:"'Rajdhani',sans-serif", color: NAVY, letterSpacing:'0.04em' }}>
              DEFAULT ATTENDANCE TIME
            </h2>
            <p className="text-xs" style={{ color:'#64748B' }}>
              Attendance is marked on first login at or after this time
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">
          {/* Current value display */}
          <div className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: '#F0F9FA', border: `1px solid #C8E8ED` }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width:16, height:16, flexShrink:0 }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="text-sm" style={{ color: NAVY }}>
              Current Attendance Time: <strong style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:'1rem' }}>{to12hr(time)}</strong>
            </span>
          </div>

          {/* Time Picker */}
          <div>
            <label className="block text-xs font-bold mb-3 uppercase tracking-wide" style={{ color:'#64748B' }}>
              New Attendance Time
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Hour */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold" style={{ color:'#94A3B8' }}>Hour</span>
                <select
                  value={display.split(':')[0] || '05'}
                  onChange={e => {
                    const parts = display.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i)
                    const m = parts ? parts[2] : '00'
                    const ap = parts ? parts[3] : 'PM'
                    setDisplay(`${e.target.value}:${m} ${ap}`)
                  }}
                  className="rounded-lg px-3 py-2.5 text-center font-bold outline-none cursor-pointer"
                  style={{ border:`1.5px solid #CBD5E1`, color: NAVY, fontFamily:"'Rajdhani',sans-serif", fontSize:'1.1rem', width:70, appearance:'none', textAlign:'center' }}
                  onFocus={e => e.target.style.borderColor = TEAL}
                  onBlur={e => e.target.style.borderColor = '#CBD5E1'}>
                  {Array.from({ length:12 }, (_,i) => String(i+1).padStart(2,'0')).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <span className="font-black text-2xl pb-0.5" style={{ color: NAVY }}>:</span>

              {/* Minute */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold" style={{ color:'#94A3B8' }}>Minute</span>
                <select
                  value={display.match(/^(\d{2}):(\d{2})/)?.[2] || '00'}
                  onChange={e => {
                    const parts = display.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i)
                    const h = parts ? parts[1] : '05'
                    const ap = parts ? parts[3] : 'PM'
                    setDisplay(`${h}:${e.target.value} ${ap}`)
                  }}
                  className="rounded-lg px-3 py-2.5 text-center font-bold outline-none cursor-pointer"
                  style={{ border:`1.5px solid #CBD5E1`, color: NAVY, fontFamily:"'Rajdhani',sans-serif", fontSize:'1.1rem', width:70, appearance:'none', textAlign:'center' }}
                  onFocus={e => e.target.style.borderColor = TEAL}
                  onBlur={e => e.target.style.borderColor = '#CBD5E1'}>
                  {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* AM/PM */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold" style={{ color:'#94A3B8' }}>AM/PM</span>
                <div className="flex rounded-lg overflow-hidden" style={{ border:`1.5px solid #CBD5E1` }}>
                  {['AM','PM'].map(ap => {
                    const parts = display.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i)
                    const current = parts ? parts[3].toUpperCase() : 'PM'
                    const active = current === ap
                    return (
                      <button key={ap} type="button"
                        onClick={() => {
                          const p = display.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i)
                          const h = p ? p[1] : '05'
                          const m = p ? p[2] : '00'
                          setDisplay(`${h}:${m} ${ap}`)
                        }}
                        className="px-4 py-2.5 text-sm font-bold transition-all"
                        style={{
                          background: active ? `linear-gradient(135deg, ${NAVY}, ${TEAL})` : WHITE,
                          color: active ? WHITE : '#94A3B8',
                          fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.05em',
                          border:'none', cursor:'pointer', minWidth:52,
                        }}>
                        {ap}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Save */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold opacity-0">Save</span>
                <button onClick={handleSave} disabled={saving}
                  className="px-6 py-2.5 rounded-lg text-sm font-bold transition-all"
                  style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})`, color: WHITE, fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.05em', border:'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Late Margin Card */}
      <div className="rounded-2xl overflow-hidden mt-4" style={{ background: WHITE, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})` }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width:18, height:18 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-sm" style={{ fontFamily:"'Rajdhani',sans-serif", color: NAVY, letterSpacing:'0.04em' }}>
              LATE MARGIN
            </h2>
            <p className="text-xs" style={{ color:'#64748B' }}>
              Minutes after working day login time before marking as late
            </p>
          </div>
        </div>
        <div className="px-6 py-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-semibold" style={{ color:'#94A3B8' }}>Minutes</span>
              <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border:`1.5px solid #CBD5E1` }}>
                <button type="button"
                  onClick={() => setMargin(v => String(Math.max(1, parseInt(v||'15',10) - 1)))}
                  className="px-3 py-2.5 font-bold text-lg transition-colors"
                  style={{ background:'#F8FAFC', color: NAVY, border:'none', cursor:'pointer', lineHeight:1 }}>−</button>
                <input
                  type="number" min={1} max={120}
                  value={margin}
                  onChange={e => setMargin(e.target.value)}
                  className="text-center font-bold outline-none"
                  style={{ width:52, border:'none', color: NAVY, fontFamily:"'Rajdhani',sans-serif", fontSize:'1.1rem', padding:'10px 0' }}
                />
                <button type="button"
                  onClick={() => setMargin(v => String(Math.min(120, parseInt(v||'15',10) + 1)))}
                  className="px-3 py-2.5 font-bold text-lg transition-colors"
                  style={{ background:'#F8FAFC', color: NAVY, border:'none', cursor:'pointer', lineHeight:1 }}>+</button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-semibold opacity-0">Save</span>
              <button onClick={handleSaveMargin} disabled={savingMargin}
                className="px-6 py-2.5 rounded-lg text-sm font-bold transition-all"
                style={{ background: `linear-gradient(90deg, ${NAVY}, ${TEAL})`, color: WHITE, fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.05em', border:'none', cursor: savingMargin ? 'not-allowed' : 'pointer', opacity: savingMargin ? 0.7 : 1 }}>
                {savingMargin ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function CrmManagement() {
  const [activeTab, setActiveTab] = useState(0)
  const [toast, setToast]         = useState(null)

  return (
    <Layout>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div className="px-6 py-6 min-h-full" style={{ background: BG }}>
        <div className="mb-5">
          <h1 className="text-2xl font-black tracking-wide"
            style={{ fontFamily: "'Rajdhani', sans-serif", color: NAVY }}>CRM Management</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
            Configure user roles and form field settings across the system.
          </p>
        </div>

        <div className="flex gap-1 mb-6 p-1 rounded-xl"
          style={{ background: WHITE, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'inline-flex' }}>
          {TABS.map((tab, i) => {
            const isActive = i === activeTab
            return (
              <button key={tab} onClick={() => setActiveTab(i)}
                className="px-5 py-2 rounded-lg text-sm font-bold transition-all duration-150 focus:outline-none"
                style={{
                  fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em',
                  background: isActive ? `linear-gradient(90deg, ${NAVY}, ${TEAL})` : 'transparent',
                  color: isActive ? WHITE : '#64748B',
                  boxShadow: isActive ? '0 2px 8px rgba(30,132,150,0.2)' : 'none',
                  border: 'none', cursor: 'pointer',
                }}>
                {tab}
              </button>
            )
          })}
        </div>

        {activeTab === 0 && <UserAccessTab setToast={setToast} />}
        {activeTab === 1 && <FormManagementTab formType="sale"   formLabel="Sale Form"            setToast={setToast} />}
        {activeTab === 2 && <FormManagementTab formType="client" formLabel="Client Form"          setToast={setToast} />}
        {activeTab === 3 && <FormManagementTab formType="user"   formLabel="Profile Form"  setToast={setToast} />}
        {activeTab === 4 && <LoginTimeTab setToast={setToast} />}
      </div>
    </Layout>
  )
}
