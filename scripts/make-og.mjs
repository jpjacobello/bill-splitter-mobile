import sharp from 'sharp';

// Generates og-image.png — the link-preview card shown in iMessage/social.
// Just the rounded app icon, centered on brand dark bg, no text (the link
// title/description already render in iMessage's own caption row).
const W = 1200, H = 630;
const BG = '#151515';
const ICON = 430;
const radius = 96;

const mask = `<svg width="${ICON}" height="${ICON}"><rect width="${ICON}" height="${ICON}" rx="${radius}" ry="${radius}"/></svg>`;
const icon = await sharp('assets/icon.png')
  .resize(ICON, ICON, { fit: 'cover' })
  .composite([{ input: Buffer.from(mask), blend: 'dest-in' }])
  .png()
  .toBuffer();

await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
  .composite([{ input: icon, top: Math.round((H - ICON) / 2), left: Math.round((W - ICON) / 2) }])
  .png()
  .toFile('og-image.png');

console.log('wrote og-image.png');
