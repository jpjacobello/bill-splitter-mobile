// Generates 1024x1024 paywall review screenshots (one per product) via SVG->PNG.
// Run: node scripts/make-paywall.mjs   → writes to ./paywall-shots/
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'paywall-shots');
mkdirSync(OUT, { recursive: true });

const C = {
  bg: '#161619', card: '#232329', line: '#ffffff22', text: '#F6F6F8',
  dim: '#ABABB4', faint: '#7A7A85', accent: '#3ED88A', accentDim: '#3ED88A29', bgText: '#161619',
};
const F = 'Helvetica, Arial, sans-serif';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const PERKS = [
  ['Unlimited history', 'Revisit every past split, not just the last 3'],
  ['Saved groups', 'Reload your usual crew into any bill'],
  ['No watermark', 'Drop the Divi tag from your requests'],
];
const PKGS = {
  monthly:  { title: 'Monthly',  note: '$2.99 / month · 7-day free trial',  best: false },
  annual:   { title: 'Annual',   note: '$9.99 / year · 7-day free trial',   best: true },
  lifetime: { title: 'Lifetime', note: '$49.99 once · yours forever',       best: false },
};
const ORDER = ['annual', 'monthly', 'lifetime'];

// Canvas = 6.5" iPhone portrait (accepted App Store screenshot size)
const W = 1242, H = 2688, PAD = 120, CW = W - PAD * 2;

function perkRow(y, title, sub) {
  const r = 42, cx = PAD + r;
  return `
    <circle cx="${cx}" cy="${y}" r="${r}" fill="${C.accentDim}"/>
    <path d="M ${cx - 18} ${y + 2} l 12 12 l 22 -26" fill="none" stroke="${C.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${cx + r + 26}" y="${y - 6}" font-family="${F}" font-size="44" font-weight="700" fill="${C.text}">${esc(title)}</text>
    <text x="${cx + r + 26}" y="${y + 42}" font-family="${F}" font-size="34" fill="${C.dim}">${esc(sub)}</text>`;
}

function pkgRow(y, key, selectedKey) {
  const p = PKGS[key];
  const on = key === selectedKey;
  const x = PAD, h = 158, cy = y + h / 2;
  const radio = on
    ? `<circle cx="${x + 56}" cy="${cy}" r="22" fill="none" stroke="${C.accent}" stroke-width="4"/><circle cx="${x + 56}" cy="${cy}" r="11" fill="${C.accent}"/>`
    : `<circle cx="${x + 56}" cy="${cy}" r="22" fill="none" stroke="${C.faint}" stroke-width="4"/>`;
  const best = p.best
    ? `<rect x="${x + CW - 210}" y="${cy - 26}" width="180" height="52" rx="12" fill="${C.accent}"/>
       <text x="${x + CW - 120}" y="${cy + 10}" font-family="${F}" font-size="26" font-weight="800" fill="${C.bgText}" text-anchor="middle" letter-spacing="1">BEST VALUE</text>`
    : '';
  return `
    <rect x="${x}" y="${y}" width="${CW}" height="${h}" rx="30" fill="${on ? C.accentDim : C.card}" stroke="${on ? C.accent : C.line}" stroke-width="${on ? 4 : 2}"/>
    ${radio}
    <text x="${x + 100}" y="${cy - 8}" font-family="${F}" font-size="44" font-weight="700" fill="${C.text}">${esc(p.title)}</text>
    <text x="${x + 100}" y="${cy + 38}" font-family="${F}" font-size="33" fill="${C.dim}">${esc(p.note)}</text>
    ${best}`;
}

function svg(selectedKey) {
  const isSub = selectedKey !== 'lifetime';
  const cta = isSub ? 'Start 7-day free trial' : 'Unlock Divi Pro';
  const perks = PERKS.map(([t, s], i) => perkRow(940 + i * 200, t, s)).join('');
  const pkgs = ORDER.map((k, i) => pkgRow(1620 + i * 190, k, selectedKey)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    <rect x="${PAD}" y="300" width="252" height="72" rx="16" fill="${C.accentDim}"/>
    <text x="${PAD + 126}" y="348" font-family="${F}" font-size="34" font-weight="800" fill="${C.accent}" text-anchor="middle" letter-spacing="3">DIVI PRO</text>
    <text x="${PAD}" y="510" font-family="${F}" font-size="82" font-weight="800" fill="${C.text}" letter-spacing="-1.5">Split more,</text>
    <text x="${PAD}" y="610" font-family="${F}" font-size="82" font-weight="800" fill="${C.text}" letter-spacing="-1.5">remember everything.</text>
    ${perks}
    ${pkgs}
    <rect x="${PAD}" y="2260" width="${CW}" height="120" rx="60" fill="${C.accent}"/>
    <text x="${W / 2}" y="2336" font-family="${F}" font-size="42" font-weight="800" fill="${C.bgText}" text-anchor="middle">${cta}</text>
    <text x="${W / 2}" y="2450" font-family="${F}" font-size="30" fill="${C.dim}" text-anchor="middle">Restore    ·    Terms    ·    Privacy</text>
    <text x="${W / 2}" y="2510" font-family="${F}" font-size="24" fill="${C.faint}" text-anchor="middle">Auto-renews until cancelled. Cancel anytime in the App Store.</text>
  </svg>`;
}

for (const key of Object.keys(PKGS)) {
  const file = join(OUT, `paywall-${key}.png`);
  await sharp(Buffer.from(svg(key)))
    .flatten({ background: C.bg })  // remove alpha → flattened RGB (Apple requires this)
    .removeAlpha()
    .toColourspace('srgb')          // Apple wants sRGB
    .withMetadata({ density: 72 })  // 72 dpi
    .png({ compressionLevel: 9, palette: false })
    .toFile(file);
  console.log('wrote', file);
}
