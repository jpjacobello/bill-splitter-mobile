import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Receipt, ReceiptItem } from '../types';
import forge from 'node-forge';

const PROJECT_ID = process.env.EXPO_PUBLIC_GOOGLE_PROJECT_ID!;
const LOCATION = process.env.EXPO_PUBLIC_GOOGLE_LOCATION!;
const PROCESSOR_ID = process.env.EXPO_PUBLIC_GOOGLE_PROCESSOR_ID!;
const CLIENT_EMAIL = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_EMAIL!;
const PRIVATE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n');

const ENDPOINT = `https://documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}:process`;

// Cache the access token to avoid re-fetching on every scan
let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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
  const signature = base64url(privateKey.sign(md));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get Google access token: ${text}`);
  }

  const { access_token, expires_in } = await res.json();
  cachedToken = { token: access_token, expiresAt: now + expires_in };
  return access_token;
}

export async function googleParser(imageUri: string): Promise<Receipt> {
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

  const getMoney = (type: string): number => {
    const entity = entities.find((e) => e.type === type);
    if (!entity) return 0;
    if (entity.normalizedValue?.moneyValue) {
      const { units = '0', nanos = 0 } = entity.normalizedValue.moneyValue;
      return parseFloat(units) + nanos / 1e9;
    }
    return parseFloat(entity.mentionText.replace(/[^0-9.]/g, '')) || 0;
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
        price = parseFloat(amountProp.mentionText.replace(/[^0-9.]/g, '')) || 0;
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

  const subtotal = getMoney('net_amount') || getMoney('subtotal_amount') || items.reduce((s, i) => s + i.price, 0);
  const tax = getMoney('total_tax_amount');
  const rawTip = getMoney('gratuity_amount') || getMoney('tip_amount');
  const total = getMoney('total_amount');

  const isSurcharge = rawTip > 0 && subtotal > 0 && rawTip / subtotal < 0.10;
  const tip = isSurcharge ? 0 : rawTip;
  let fees = isSurcharge ? rawTip : 0;

  const accounted = Math.round((subtotal + tax + rawTip) * 100);
  const gap = Math.round(total * 100) - accounted;
  if (gap > 5) {
    fees = parseFloat((fees + gap / 100).toFixed(2));
  }

  return {
    merchantName: getText('supplier_name'),
    date: getDate('receipt_date'),
    items,
    subtotal,
    tax,
    fees,
    tip,
    total,
    tipIsFromReceipt: tip > 0,
  };
}
