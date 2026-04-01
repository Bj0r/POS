// ============================================================
// FILE: src/theme/warmEarth.ts
//
// PURPOSE: Single source of truth for the Warm Earth colour
//          palette used across every Ionic page.
//
//          Mirrors the W = { ... } object defined inline in
//          every web JSX page so colours stay in sync when
//          you change the web side — just update this file.
//
// USAGE:
//   import { W } from '../theme/warmEarth';
//   <View style={{ backgroundColor: W.cardBg }} />
// ============================================================

export const W = {
  // ── Backgrounds ─────────────────────────────────────────
  pageBg:      '#F7F3E8',
  cardBg:      '#EAE3D2',
  cardBgAlt:   '#E2D9C4',
  inputBg:     '#F0EBD8',
  headerBg:    '#2D6A1F',

  // ── Borders ─────────────────────────────────────────────
  border:      '#D4CAAF',
  borderDash:  '#C8BFA8',

  // ── Text ────────────────────────────────────────────────
  text:        '#1C2B1A',
  textMuted:   '#5A6B55',

  // ── Green (brand) ────────────────────────────────────────
  green:       '#2D6A1F',
  greenLt:     '#3E8A2A',
  greenPale:   '#D6EDD0',
  greenText:   '#1A5014',

  // ── Amber / warning ──────────────────────────────────────
  amber:       '#92600A',
  amberPale:   '#FBF0D0',
  amberText:   '#7A5C10',
  amberBorder: '#E8D49A',
  gold:        '#7A5C10',
  goldBg:      '#FBF0D0',
  goldBorder:  '#E8D49A',
  goldText:    '#7A5C10',
  goldTextDark:'#92600A',

  // ── Red / danger ─────────────────────────────────────────
  red:         '#B83220',
  redPale:     '#FAE3DF',

  // ── Blue / info ──────────────────────────────────────────
  bluePale:    '#D8E8F8',
  blueText:    '#2C4A70',
  blueBorder:  '#B0CCE8',
} as const;