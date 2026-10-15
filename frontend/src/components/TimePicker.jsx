import { useState, useEffect } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseTime(str) {
  if (!str) return { hour: 7, minute: 0, period: 'PM' }
  const m = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return { hour: 7, minute: 0, period: 'PM' }
  return {
    hour:   parseInt(m[1], 10),
    minute: parseInt(m[2], 10),
    period: m[3].toUpperCase(),
  }
}

function formatTime(h, m, p) {
  return `${h}:${String(m).padStart(2, '0')} ${p}`
}

const HOURS   = Array.from({ length: 12 }, (_, i) => i + 1)      // 1–12
const MINUTES = Array.from({ length: 60 }, (_, i) => i)           // 0–59

const selectBase = {
  background: '#061321',
  border: '1px solid #5C6D82',
  color: '#FBDCB4',
  borderRadius: 6,
  padding: '4px 6px',
  fontSize: '0.85rem',
  outline: 'none',
  cursor: 'pointer',
  fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 700,
  letterSpacing: '0.04em',
}

/**
 * TimePicker — inline clock picker with Hour / Minute / AM-PM dropdowns.
 *
 * Props:
 *   value      — current time string "7:10 PM" (or null/empty)
 *   onConfirm  — called with formatted string when ✓ is clicked
 *   onCancel   — called when ✕ is clicked
 *   dark       — if true, renders on dark bg (filter bar); default false (table bg)
 */
export default function TimePicker({ value, onConfirm, onCancel, dark = false }) {
  const parsed = parseTime(value)
  const [hour,   setHour]   = useState(parsed.hour)
  const [minute, setMinute] = useState(parsed.minute)
  const [period, setPeriod] = useState(parsed.period)

  // Re-parse if value prop changes from outside
  useEffect(() => {
    const p = parseTime(value)
    setHour(p.hour); setMinute(p.minute); setPeriod(p.period)
  }, [value])

  const sel = dark
    ? selectBase
    : { ...selectBase, background: '#f9fafb', border: '1px solid #d1d5db', color: '#1f2937', fontFamily: "'Rajdhani', sans-serif" }

  const confirmBtn = {
    padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
    background: '#059669', color: '#fff',
    fontSize: '0.8rem', fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em',
  }
  const cancelBtn = {
    padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
    background: 'transparent', color: dark ? '#9FA7B2' : '#9ca3af',
    border: `1px solid ${dark ? '#3F4753' : '#e5e7eb'}`,
    fontSize: '0.8rem', fontFamily: "'Rajdhani', sans-serif",
  }
  const colonStyle = {
    color: dark ? '#AA7F56' : '#AA7F56',
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 700,
    fontSize: '0.9rem',
    userSelect: 'none',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>

      {/* Hour */}
      <select value={hour} onChange={e => setHour(Number(e.target.value))} style={sel}>
        {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
      </select>

      <span style={colonStyle}>:</span>

      {/* Minute */}
      <select value={minute} onChange={e => setMinute(Number(e.target.value))} style={{ ...sel, minWidth: 54 }}>
        {MINUTES.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
      </select>

      {/* AM / PM */}
      <select value={period} onChange={e => setPeriod(e.target.value)} style={{ ...sel, minWidth: 56 }}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>

      {/* Confirm */}
      <button
        style={confirmBtn}
        onClick={() => onConfirm(formatTime(hour, minute, period))}
        onMouseEnter={e => e.currentTarget.style.background = '#047857'}
        onMouseLeave={e => e.currentTarget.style.background = '#059669'}
      >✓</button>

      {/* Cancel */}
      <button
        style={cancelBtn}
        onClick={onCancel}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >✕</button>

    </div>
  )
}
