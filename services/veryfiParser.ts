import * as FileSystem from 'expo-file-system/legacy';
import { Receipt, ReceiptItem } from '../types';

const CLIENT_ID = process.env.EXPO_PUBLIC_VERYFI_CLIENT_ID!;
const USERNAME = process.env.EXPO_PUBLIC_VERYFI_USERNAME!;
const API_KEY = process.env.EXPO_PUBLIC_VERYFI_API_KEY!;

export async function veryfiParser(imageUri: string): Promise<Receipt> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: 'base64',
  });

  const response = await fetch('https://api.veryfi.com/api/v8/partner/documents', {
    method: 'POST',
    headers: {
      'CLIENT-ID': CLIENT_ID,
      AUTHORIZATION: `apikey ${USERNAME}:${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_data: base64,
      file_name: 'receipt.jpg',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Veryfi error ${response.status}: ${text}`);
  }

  const data = await response.json();

  const items: ReceiptItem[] = (data.line_items ?? []).map(
    (item: { id?: number; description?: string; total?: number; price?: number; quantity?: number }, index: number) => ({
      id: String(item.id ?? index),
      name: item.description ?? 'Unknown Item',
      price: item.total ?? item.price ?? 0,
      quantity: item.quantity ?? 1,
      assignedTo: [],
    })
  );

  const subtotal: number = data.subtotal ?? 0;
  const tax: number = data.tax ?? 0;
  const rawTip: number = data.tip ?? 0;
  const total: number = data.total ?? 0;

  // If Veryfi's "tip" is less than 10% of subtotal it's almost certainly a surcharge, not a gratuity
  const isSurcharge = rawTip > 0 && subtotal > 0 && rawTip / subtotal < 0.10;
  const tip = isSurcharge ? 0 : rawTip;
  let fees = isSurcharge ? rawTip : 0;

  // If total > subtotal + tax + rawTip by more than $0.05, Veryfi missed a fee
  const accounted = Math.round((subtotal + tax + rawTip) * 100);
  const gap = Math.round(total * 100) - accounted;
  if (gap > 5) {
    fees = parseFloat((fees + gap / 100).toFixed(2));
  }

  return {
    merchantName: data.vendor?.name,
    date: data.date ? String(data.date).split('T')[0] : undefined,
    items,
    subtotal,
    tax,
    fees,
    tip,
    total,
    tipIsFromReceipt: tip > 0,
  };
}
