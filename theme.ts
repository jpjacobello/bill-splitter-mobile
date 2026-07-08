export const colors = {
  bg: '#151515',

  surface: 'rgba(255,255,255,0.04)',
  surfaceMid: 'rgba(255,255,255,0.08)',

  // Modal/bottom-sheet tokens. `sheet` MUST be opaque — sheets sit above app
  // content, so a translucent panel lets the UI behind bleed through. `scrim`
  // is the dimming backdrop; keep it dark enough to fully hide the tab bar.
  sheet: '#1F1F22',
  scrim: 'rgba(0,0,0,0.72)',

  border: 'rgba(255,255,255,0.10)',
  borderMid: 'rgba(255,255,255,0.18)',

  text: '#F4F4F4',
  textDim: '#D0D0D0',
  textSecondary: '#AEAEB2',
  textMuted: '#8E8E93',
  textDisabled: '#636366',

  green: '#3EAD74',
  red: '#E05A6A',
  amber: '#F59E0B',

  btnPrimary: '#D8D8D8',
  btnSecondary: '#252525',
  divider: '#2C2C2C',

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
