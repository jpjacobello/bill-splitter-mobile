import { Linking, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { PersonBreakdown } from '../types';

const APP_TAG = 'via Divi';
const MAX_NOTE_LENGTH = 280;

export function buildVenmoNote(b: PersonBreakdown, merchantName?: string): string {
  const items = b.assignedItems.map((a) => `  ${a.item.name} $${a.share.toFixed(2)}`);
  const joined = items.join('\n');
  const note = merchantName
    ? `${merchantName}\n${joined}\n${APP_TAG}`
    : `${joined}\n${APP_TAG}`;

  if (note.length <= MAX_NOTE_LENGTH) return note;

  // Too long — fall back to merchant name only
  return merchantName
    ? `${merchantName} · ${APP_TAG}`
    : APP_TAG;
}

export function buildVenmoUrl(b: PersonBreakdown, merchantName?: string): string {
  const note = buildVenmoNote(b, merchantName);
  const amount = b.totalOwed.toFixed(2);
  return `venmo://paycharge?txn=charge&amount=${amount}&note=${encodeURIComponent(note)}`;
}

export async function openVenmo(b: PersonBreakdown, merchantName?: string): Promise<void> {
  const url = buildVenmoUrl(b, merchantName);
  const canOpen = await Linking.canOpenURL(url);

  if (canOpen) {
    await Linking.openURL(url);
  } else {
    // Fallback: copy payment text to clipboard
    const text = buildFallbackText(b, merchantName);
    await Clipboard.setStringAsync(text);
    Alert.alert(
      'Venmo not found',
      'Payment details copied to clipboard.',
      [{ text: 'OK' }]
    );
  }
}

function buildFallbackText(b: PersonBreakdown, merchantName?: string): string {
  const lines = [
    merchantName ? `${merchantName} — Bill Split (via Divi)` : 'Bill Split (via Divi)',
    `${b.person.name} owes $${b.totalOwed.toFixed(2)}`,
    '',
    ...b.assignedItems.map((a) => `• ${a.item.name}  $${a.share.toFixed(2)}`),
    '',
    APP_TAG,
  ];
  return lines.join('\n');
}
