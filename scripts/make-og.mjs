import sharp from 'sharp';

// Generates og-image.png — the link-preview card shown in iMessage/social.
// Balanced layout: app icon on top, "Divi" wordmark + tagline below, on brand dark bg.
const W = 1200, H = 630;
const BG = '#151515';
const ICON = 300;

const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <text x="${W / 2}" y="500" font-family="Helvetica, Arial, sans-serif" font-size="112" font-weight="800" fill="#F4F4F4" text-anchor="middle" letter-spacing="-2">Divi</text>
  <text x="${W / 2}" y="558" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="500" fill="#8E8E93" text-anchor="middle">Split the bill · Tap what you ordered · No app needed</text>
</svg>`;

const radius = 66;
const mask = `<svg width="${ICON}" height="${ICON}"><rect width="${ICON}" height="${ICON}" rx="${radius}" ry="${radius}"/></svg>`;
const icon = await sharp('assets/icon.png')
  .resize(ICON, ICON, { fit: 'cover' })
  .composite([{ input: Buffer.from(mask), blend: 'dest-in' }])
  .png()
  .toBuffer();

await sharp(Buffer.from(svg))
  .composite([{ input: icon, top: 90, left: Math.round((W - ICON) / 2) }])
  .png()
  .toFile('og-image.png');

console.log('wrote og-image.png');
