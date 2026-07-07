import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Absolute base URL where the web build is hosted — must match the domain the
// shared /split/:id links point at, so link-preview crawlers resolve the image.
const WEB_URL = 'https://dist-omega-opal-62.vercel.app';

const TITLE = 'Divi — Split the bill';
const DESCRIPTION = 'Tap the items you ordered and pay your share. No app needed.';
const OG_IMAGE = `${WEB_URL}/og-image.png`;

/**
 * Root HTML document for the static web export. Every exported page (including
 * every /split/:id share link) uses this <head>, so the Open Graph / Twitter
 * tags below control how the link unfurls in iMessage, WhatsApp, etc.
 *
 * Note: static export = one shared card for all links (can't show the specific
 * merchant/amount per bill without server-side rendering).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />

        {/* Open Graph (iMessage, WhatsApp, Facebook, etc.) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Divi" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={OG_IMAGE} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
