import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Receipt, ReceiptItem } from '../types';
import forge from 'node-forge';

const PROJECT_ID = process.env.EXPO_PUBLIC_GOOGLE_PROJECT_ID ?? '';
const LOCATION = process.env.EXPO_PUBLIC_GOOGLE_LOCATION ?? '';
const PROCESSOR_ID = process.env.EXPO_PUBLIC_GOOGLE_PROCESSOR_ID ?? '';
const CLIENT_EMAIL = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_EMAIL ?? '';
const PRIVATE_KEY = (process.env.EXPO_PUBLIC_GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

const ENDPOINT = `https://documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}:process`;

// Cache the access token to avoid re-fetching on every scan
let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// btoa chokes on arbitrary binary bytes in Hermes (production builds).
// Use forge's own base64 encoder for the RSA signature bytes.
function binaryBase64url(binaryStr: string): string {
  return forge.util.encode64(binaryStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.token;

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const signingInput = `${header}.${claims}`;
  const privateKey = forge.pki.privateKeyFromPem(PRIVATE_KEY);
  const md = forge.md.sha256.create();
  md.update(signingInput, 'utf8');
  const signature = binaryBase64url(privateKey.sign(md));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text}`);
  }

  const { access_token, expires_in } = await res.json();
  cachedToken = { token: access_token, expiresAt: now + expires_in };
  return access_token;
}

export async function googleParser(imageUri: string): Promise<Receipt> {
  if (!PROJECT_ID || !LOCATION || !PROCESSOR_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
    throw new Error('Google Document AI is not configured. Check that all EXPO_PUBLIC_GOOGLE_* environment variables are set.');
  }
  const [jpeg, accessToken] = await Promise.all([
    ImageManipulator.manipulateAsync(imageUri, [], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }),
    getAccessToken(),
  ]);
  const base64 = await FileSystem.readAsStringAsync(jpeg.uri, { encoding: 'base64' });

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      rawDocument: { content: base64, mimeType: 'image/jpeg' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Document AI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const entities: { type: string; mentionText: string; normalizedValue?: { moneyValue?: { units?: string; nanos?: number }; dateValue?: { year?: number; month?: number; day?: number } }; properties?: any[] }[] =
    data.document?.entities ?? [];

  const getMoney = (...types: string[]): number => {
    for (const type of types) {
      const entity = entities.find((e) => e.type === type);
      if (!entity) continue;
      if (entity.normalizedValue?.moneyValue) {
        const { units = '0', nanos = 0 } = entity.normalizedValue.moneyValue;
        return parseFloat(units) + nanos / 1e9;
      }
      const val = parseFloat(entity.mentionText.replace(/[^0-9.]/g, ''));
      if (!isNaN(val)) return val;
    }
    return 0;
  };

  const getText = (type: string): string | undefined =>
    entities.find((e) => e.type === type)?.mentionText;

  const getDate = (type: string): string | undefined => {
    const entity = entities.find((e) => e.type === type);
    if (!entity) return undefined;
    const dv = entity.normalizedValue?.dateValue;
    if (dv?.year && dv?.month && dv?.day) {
      const mm = String(dv.month).padStart(2, '0');
      const dd = String(dv.day).padStart(2, '0');
      return `${dv.year}-${mm}-${dd}`;
    }
    return entity.mentionText;
  };

  const items: ReceiptItem[] = entities
    .filter((e) => e.type === 'line_item')
    .map((entity, index) => {
      const props = entity.properties ?? [];
      const description = props.find((p) => p.type === 'line_item/description')?.mentionText ?? 'Unknown Item';
      const amountProp = props.find((p) => p.type === 'line_item/amount');
      const quantityProp = props.find((p) => p.type === 'line_item/quantity');
      let price = 0;
      if (amountProp?.normalizedValue?.moneyValue) {
        const { units = '0', nanos = 0 } = amountProp.normalizedValue.moneyValue;
        price = parseFloat(units) + nanos / 1e9;
      } else if (amountProp?.mentionText) {
        price = parseFloat(amountProp.mentionText.replace(/[^0-9.-]/g, '')) || 0;
      }
      // Fallback: if price is still 0, extract the last dollar amount from the
      // entity's raw mentionText. On receipts with PRICE + TOTAL columns, Google
      // sometimes fails to populate line_item/amount but the total is still in the
      // entity text (e.g. "Stella Draft  1  $10.00  $10.00" → last price = $10).
      if (price === 0 && entity.mentionText) {
        const matches = [...entity.mentionText.matchAll(/\$?([\d,]+\.\d{2})/g)]
          .map((m) => parseFloat(m[1].replace(/,/g, '')))
          .filter((p) => p > 0);
        if (matches.length > 0) price = matches[matches.length - 1];
      }
      const quantity = quantityProp?.normalizedValue?.moneyValue
        ? parseFloat(quantityProp.normalizedValue.moneyValue.units ?? '1') || 1
        : parseFloat((quantityProp?.mentionText ?? '1').replace(/[^0-9.]/g, '')) || 1;
      const unitPrice = quantity > 0 ? parseFloat((price / quantity).toFixed(4)) : price;
      return {
        id: `item-${index}`,
        name: description,
        price,
        quantity,
        unitPrice,
        assignedTo: [],
      };
    });

  // Post-process: merge zero-price named items with adjacent "Unknown Item" priced items.
  // Happens when Google Document AI separates PRICE and TOTAL columns into distinct
  // line_item entities — e.g. "Stella Draft $0" + "Unknown Item $10" → "Stella Draft $10".
  // Only merges when the two entities are directly adjacent to avoid cross-item mismatches.
  const consumedIds = new Set<string>();
  for (let i = 0; i < items.length - 1; i++) {
    const curr = items[i];
    const next = items[i + 1];
    // Case 1: named $0 followed by Unknown Item with price
    if (curr.price === 0 && curr.name !== 'Unknown Item' && next.name === 'Unknown Item' && next.price > 0) {
      curr.price = next.price;
      curr.unitPrice = parseFloat((next.price / curr.quantity).toFixed(4));
      consumedIds.add(next.id);
      i++;
    // Case 2: Unknown Item with price followed by named $0
    } else if (curr.name === 'Unknown Item' && curr.price > 0 && next.price === 0 && next.name !== 'Unknown Item') {
      next.price = curr.price;
      next.unitPrice = parseFloat((curr.price / next.quantity).toFixed(4));
      consumedIds.add(curr.id);
      i++;
    }
  }
  const finalItems = items.filter((i) => !consumedIds.has(i.id));

  const subtotal = getMoney('net_amount', 'subtotal_amount', 'subtotal') || finalItems.reduce((s, i) => s + i.price, 0);
  const tax = getMoney('total_tax_amount', 'tax', 'taxes', 'tax_amount');
  const rawTip = getMoney('gratuity', 'gratuity_amount', 'tip', 'tip_amount');
  const total = getMoney('total_amount', 'total');

  const tip = rawTip;
  let fees = 0;

  const accounted = Math.round((subtotal + tax + rawTip) * 100);
  const gap = Math.round(total * 100) - accounted;
  if (gap > 5) {
    fees = parseFloat((fees + gap / 100).toFixed(2));
  }

  return {
    merchantName: getText('supplier_name'),
    date: getDate('receipt_date'),
    items: finalItems,
    subtotal,
    tax,
    fees,
    tip,
    total,
    tipIsFromReceipt: tip > 0,
  };
}
