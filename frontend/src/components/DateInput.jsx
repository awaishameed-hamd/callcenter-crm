import { useRef } from 'react'

/**
 * DateInput — drop-in replacement for <input type="date">
 * Adds a clickable 📅 calendar icon that opens the native date picker.
 * Accepts the same props as a regular <input> element.
 */
export default function DateInput({ value, onChange, required, disabled, min, max, name, className = '', style = {}, placeholder }) {
  const ref = useRef(null)

  const openPicker = () => {
    if (disabled) return
    try { ref.current?.showPicker() } catch { ref.current?.click() }
  }

  return (
    <div className="relative" style={{ display: 'inline-block', width: '100%' }}>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        name={name}
        placeholder={placeholder}
        className={className}
        style={{ ...style, paddingRight: 26, width: '100%', boxSizing: 'border-box' }}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        tabIndex={-1}
        className="absolute top-1/2 -translate-y-1/2"
        style={{ right: 6, background: 'none', border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer', lineHeight: 1, opacity: disabled ? 0.4 : 0.6 }}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}
          style={{ width: 13, height: 13, color: 'currentColor', display: 'block' }}>
          <rect x="1" y="2" width="14" height="13" rx="2" />
          <path strokeLinecap="round" d="M1 6h14M5 1v2M11 1v2" />
        </svg>
      </button>
    </div>
  )
}
