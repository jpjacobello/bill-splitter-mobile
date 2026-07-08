// Single source of truth for the guest web-link host.
// Fallback must match the live Vercel production domain (see project memory:
// trydivi.vercel.app is NOT ours — never use it as a fallback).
export const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://dist-omega-opal-62.vercel.app';
