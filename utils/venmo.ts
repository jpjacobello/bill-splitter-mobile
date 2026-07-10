import { Linking, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { PersonBreakdown } from '../types';
import { getEmoji } from './buildReceiptHtml';
import { formatCurrency } from './currency';

const MAX_NOTE_LENGTH = 280;
const APP_TAG = 'Split with Divi';


function toTitleCase(str: string): string {
  // If the string is already mixed case, leave it alone
  if (str !== str.toUpperCase()) return str;
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildVenmoNote(b: PersonBreakdown, merchantName?: string, isPro?: boolean): string {
  const merchant = merchantName ? toTitleCase(merchantName) : null;

  const itemLines = b.assignedItems.map((a) => {
    const displayName = a.item.name.replace(/\s*\(\d+\)\s*$/, '').trim();
    return `- ${getEmoji(a.item.name)} ${displayName} (${formatCurrency(a.share)})`;
  });

  const footer = isPro ? [] : ['', APP_TAG];
  const parts = [
    ...(merchant ? [merchant] : []),
    ...itemLines,
    ...footer,
  ];
  const note = parts.join('\n');

  if (note.length <= MAX_NOTE_LENGTH) return note;

  // Too long — drop item detail, keep merchant + optional footer
  const short = [...(merchant ? [merchant] : []), ...(isPro ? [] : [APP_TAG])].join('\n');
  return short;
}

export function buildVenmoUrl(b: PersonBreakdown, merchantName?: string, isPro?: boolean): string {
  const note = buildVenmoNote(b, merchantName, isPro);
  const amount = b.totalOwed.toFixed(2);
  return `venmo://paycharge?txn=charge&amount=${amount}&note=${encodeURIComponent(note)}`;
}

export async function openVenmo(b: PersonBreakdown, merchantName?: string, isPro?: boolean): Promise<void> {
  const url = buildVenmoUrl(b, merchantName, isPro);
  try {
    await Linking.openURL(url);
  } catch {
    const text = buildFallbackText(b, merchantName, isPro);
    await Clipboard.setStringAsync(text);
    Alert.alert(
      'Venmo not found',
      'Payment details copied to clipboard.',
      [{ text: 'OK' }]
    );
  }
}

function buildFallbackText(b: PersonBreakdown, merchantName?: string, isPro?: boolean): string {
  const lines = [
    merchantName ? `${merchantName} — Bill Split (via Divi)` : 'Bill Split (via Divi)',
    `${b.person.name} owes ${formatCurrency(b.totalOwed)}`,
    '',
    ...b.assignedItems.map((a) => `• ${a.item.name.replace(/\s*\(\d+\)\s*$/, '').trim()}  ${formatCurrency(a.share)}`),
    ...(isPro ? [] : ['', APP_TAG]),
  ];
  return lines.join('\n');
}
