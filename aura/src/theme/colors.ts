// Exact Tailwind v3 values used in the Lovable design (dark theme)

export const COLORS = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  bg:         '#030712', // gray-950 — main screen background
  bgCard:     '#111827', // gray-900 — card background
  bgInput:    '#111827', // gray-900 — input background
  bgOverlay:  'rgba(3,7,18,0.9)',

  // ── Borders ───────────────────────────────────────────────────────────────
  border:      '#1f2937', // gray-800
  borderLight: '#374151', // gray-700
  borderDim:   '#4b5563', // gray-600

  // ── Text ──────────────────────────────────────────────────────────────────
  text:       '#ffffff',
  textSub:    '#9ca3af', // gray-400
  textMuted:  '#6b7280', // gray-500
  textDim:    '#4b5563', // gray-600

  // ── Purple — primary brand ────────────────────────────────────────────────
  purple200:   '#e9d5ff',
  purple400:   '#c084fc', // active tab icons, accent text
  purple500:   '#a855f7', // primary icon color
  purple600:   '#9333ea', // buttons, CTAs
  purple700:   '#7e22ce',
  purple900:   '#581c87',

  // Transparent purple backgrounds
  purpleBg10:  'rgba(147,51,234,0.10)',
  purpleBg20:  'rgba(147,51,234,0.20)',
  purpleBg40:  'rgba(88,28,135,0.40)',

  // ── Live / Alert ──────────────────────────────────────────────────────────
  live:        '#dc2626', // red-600 — LIVE pulse badge

  // ── States ────────────────────────────────────────────────────────────────
  success:     '#34d399', // emerald-400
  successDark: '#059669', // emerald-600
  successBg:   'rgba(5,150,105,0.20)',
  warning:     '#eab308', // yellow-500
  orange400:   '#fb923c',
  orangeBg:    'rgba(234,88,12,0.20)',
  blue400:     '#60a5fa',
  blueBg:      'rgba(37,99,235,0.20)',

  // ── Crowd levels (VenueCard legacy) ──────────────────────────────────────
  crowdLow:    '#34c759',
  crowdMed:    '#ff9500',
  crowdHigh:   '#ff2d55',

  // ── Absolute ──────────────────────────────────────────────────────────────
  black:       '#000000',
  white:       '#ffffff',
} as const;

export type ColorKey = keyof typeof COLORS;
