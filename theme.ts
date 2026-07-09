// Refined-native design language (approved 2026-07-08). New screens use these;
// legacy `colors` below stays until every screen migrates.
export const ui = {
  // Higher-contrast dark (2026-07-09): lifted bg + clearly separated cards so
  // surfaces read in bright light. See theme-contrast preview.
  bg: '#161619',
  card: '#232329',
  cardHi: '#2C2C33',
  line: 'rgba(255,255,255,0.13)',
  text: '#F6F6F8',
  dim: '#ABABB4',
  faint: '#7A7A85',
  accent: '#3ED88A',
  accentDim: 'rgba(62,216,138,0.16)',
  blue: '#6AA6F5',
} as const;

export const colors = {
  // Lifted to match the higher-contrast `ui` scheme (2026-07-09). Translucent
  // surfaces below ride on the lighter bg, so they lift automatically.
  bg: '#161619',

  surface: 'rgba(255,255,255,0.05)',
  surfaceMid: 'rgba(255,255,255,0.09)',

  // Modal/bottom-sheet tokens. `sheet` MUST be opaque — sheets sit above app
  // content, so a translucent panel lets the UI behind bleed through. `scrim`
  // is the dimming backdrop; keep it dark enough to fully hide the tab bar.
  sheet: '#26262B',
  scrim: 'rgba(0,0,0,0.72)',

  border: 'rgba(255,255,255,0.13)',
  borderMid: 'rgba(255,255,255,0.20)',

  text: '#F4F4F4',
  textDim: '#D0D0D0',
  textSecondary: '#AEAEB2',
  textMuted: '#8E8E93',
  textDisabled: '#636366',

  green: '#3EAD74',
  red: '#E05A6A',
  amber: '#F59E0B',

  btnPrimary: '#D8D8D8',
  btnSecondary: '#2C2C33',
  divider: '#34343B',

  person: [
    '#6497D4',
    '#D4834A',
    '#9B72CF',
    '#3EAD74',
    '#D95F6B',
    '#2AABA0',
    '#C49B15',
    '#C4548A',
  ] as string[],
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20 } as const;
export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 40 } as const;

// Shared style for any currency amount — keeps digits monospaced so totals don't jitter.
import type { TextStyle } from 'react-native';
export const moneyText: TextStyle = { fontVariant: ['tabular-nums'] };

// One motion language for presses and sheets across the app.
export const motion = {
  pressIn: { speed: 120, bounciness: 0 },   // scale to 0.965
  settle: { speed: 20, bounciness: 10 },    // back to 1
  sheet: { friction: 11, tension: 90 },
  fillFade: 180, // ms
} as const;
