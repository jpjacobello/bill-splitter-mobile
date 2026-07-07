// Post-export: inject Open Graph / Twitter tags into the SPA index.html so
// shared /split/:id links unfurl as a branded Divi card in iMessage, WhatsApp,
// etc. Needed because the web build uses `single` (SPA) output, where Expo
// ignores app/+html.tsx. Run after `expo export --platform web`.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'dist/index.html';
const WEB_URL = 'https://dist-omega-opal-62.vercel.app';
const TITLE = 'Divi — Split the bill';
const DESCRIPTION = 'Tap the items you ordered and pay your share. No app needed.';
const OG_IMAGE = `${WEB_URL}/og-image.png`;

const tags = `
    <meta name="description" content="${DESCRIPTION}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Divi" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESCRIPTION}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${DESCRIPTION}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />`;

let html = readFileSync(FILE, 'utf8');

// Upgrade the title
html = html.replace(/<title>[^<]*<\/title>/i, `<title>${TITLE}</title>`);

// Insert meta tags just before </head> (guard against double-injection)
if (!html.includes('property="og:title"')) {
  html = html.replace(/<\/head>/i, `${tags}\n  </head>`);
}

writeFileSync(FILE, html);
console.log('injected og tags into', FILE);
