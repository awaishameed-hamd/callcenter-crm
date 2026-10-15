// ── META-VOICE CRM — Master Colour Palette ────────────────────────────────────
// Single source of truth. Import from here in every file.
// To add / remove colours, edit ONLY this file.

export const P = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  bgMain:    '#EDF0F3',   // warm cream — main page area + sidebar
  bgCard:    '#FFFFFF',   // white card surfaces

  // ── Primary brand colours ─────────────────────────────────────────────────
  navy:      '#132E57',
  teal:      '#1E8496',
  deepTeal:  '#1A5560',
  gold:      '#D7A520',
  forest:    '#3A6B3A',
  brick:     '#C25A1F',
  khaki:     '#CBB26A',

  // ── Secondary / accent ────────────────────────────────────────────────────
  purple:    '#7B2D8E',
  red:       '#D62828',
  peach:     '#F4B58A',
  sage:      '#A8C58A',
  sky:       '#8AB8E0',
  terra:     '#B85C38',
  cream:     '#FFF2B8',
  gray:      '#808080',
  slate:     '#5C5C5C',

  // ── Stat-card light fills (gradient end) ──────────────────────────────────
  fillNavy:  '#E8EEF7',
  fillTeal:  '#E5F3F5',
  fillGold:  '#FAEFD0',
  fillBrick: '#F5E0D2',

  // ── UI chrome ─────────────────────────────────────────────────────────────
  border:      '#E0DDD5',
  gridLine:    '#F0EDE5',
  textHeading: '#132E57',
  textLabel:   '#5C5C5C',
  textMuted:   '#808080',
  shadow:      '0 1px 6px rgba(0,0,0,0.06)',
}

// Chart fill order — use in sequence for pie / bar series
export const CHART_COLORS = [
  '#132E57', '#1E8496', '#D7A520', '#CBB26A', '#C25A1F', '#808080',
]

// Top-agents bar colours (5 distinct)
export const AGENT_BAR_COLORS = [
  '#132E57', '#1E8496', '#D7A520', '#CBB26A', '#C25A1F',
]

// 3-D cancellation pie slice colours
export const CANCEL_COLORS_3D = [
  { top: '#C25A1F', side: '#8E3A10' },
  { top: '#3A6B3A', side: '#2A4D2A' },
  { top: '#F4B58A', side: '#9E6840' },
  { top: '#1E8496', side: '#1A5560' },
  { top: '#D7A520', side: '#9A7010' },
  { top: '#7B2D8E', side: '#5A1A6A' },
]
