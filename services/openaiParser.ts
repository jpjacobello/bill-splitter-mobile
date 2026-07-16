import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Receipt, ReceiptItem } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const PROMPT = `You are a receipt parser. Return your response as JSON. If this image clearly contains no pricing or transaction data (e.g. it is a selfie, meme, landscape, or social media post), return exactly:
{"isReceipt": false}

Otherwise attempt to parse it and return exactly this structure (no other text):
{
  "isReceipt": true,
  "merchantName": "string or null",
  "date": "YYYY-MM-DD or null",
  "items": [
    {
      "name": "item name",
      "quantity": 1,
      "price": 0.00,
      "parentIndex": null
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "tip": 0.00,
  "fees": 0.00,
  "total": 0.00,
  "currency": "USD"
}

Rules:
- currency: the 3-letter ISO 4217 code the amounts are printed in, inferred from the currency symbol (¥ → JPY or CNY by context, € → EUR, £ → GBP, ₩ → KRW, ₹ → INR, etc.), the receipt language, or the merchant's country. Use null if genuinely unclear.
- quantity: the exact number from the QTY column. If there is no QTY column but the item name starts with a number (e.g. "3 Aperol Spritz" or "2 BTL Downeast Cider"), extract that leading number as the quantity and use the rest as the name. Default 1 if not shown.
- price: the LINE TOTAL for that item (the rightmost price column). Example: if the receipt shows "Guinness Draught  7  $11.00  $77.00", price is $77.00 not $11.00.
- For discounts or comps, use a negative price (e.g. -10.00)
- fees = surcharges, credit card fees, service charges (not tax, not tip)
- If a value is not present, use 0
- subtotal = sum of all item prices (before tax, tip, fees)
- total = the final amount charged (use the credit card total if one exists)
- parentIndex: if a line item is a modifier or add-on for the item directly above it (e.g. indented on the receipt, or starts with "Add", "No", "Sub", "Mod", "Extra", "Upgrade", "w/", or represents a customization like "no onion" or "extra sauce"), set parentIndex to the 0-based index of its parent in this items array. Otherwise null. Example: if index 1 is "Virginia's Burger" and index 2 is "Add Bacon", then index 2 has parentIndex: 1.`;

export async function openaiParser(imageUri: string): Promise<Receipt> {
  if (!API_KEY) {
    throw new Error('OpenAI API key is not configured. Set EXPO_PUBLIC_OPENAI_API_KEY.');
  }

  const jpeg = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 1800 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );
  const base64 = await FileSystem.readAsStringAsync(jpeg.uri, { encoding: 'base64' });

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'high' },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Could not parse OpenAI response as JSON');
  }

  if (parsed.isReceipt === false) {
    return { merchantName: undefined, date: undefined, items: [], subtotal: 0, tax: 0, fees: 0, tip: 0, total: 0, tipIsFromReceipt: false };
  }

  const rawItems: ReceiptItem[] = (parsed.items ?? []).map((item: any, index: number) => {
    let quantity = Math.max(1, Math.round(Number(item.quantity)) || 1);
    const price = Number(item.price) || 0;
    let name = String(item.name ?? 'Unknown Item').trim();

    // Fallback: extract leading quantity from name if GPT didn't separate it
    if (quantity === 1) {
      const match = name.match(/^(\d+)\s+(.+)$/);
      if (match) {
        quantity = Math.max(1, parseInt(match[1], 10));
        name = match[2].trim();
      }
    }

    const unitPrice = parseFloat((price / quantity).toFixed(4));
    return {
      id: `item-${index}`,
      name,
      price,
      quantity,
      unitPrice,
      assignedTo: [],
    };
  });

  // Resolve parentIndex references to parentId
  (parsed.items ?? []).forEach((item: any, index: number) => {
    const parentIndex = item.parentIndex;
    if (parentIndex != null && typeof parentIndex === 'number' && parentIndex >= 0 && parentIndex < rawItems.length && parentIndex !== index) {
      rawItems[index].parentId = rawItems[parentIndex].id;
    }
  });

  const subtotal = Number(parsed.subtotal) || rawItems.reduce((s, i) => s + i.price, 0);
  const tax = Number(parsed.tax) || 0;
  const tip = Number(parsed.tip) || 0;
  const fees = Number(parsed.fees) || 0;
  const total = Number(parsed.total) || subtotal + tax + tip + fees;

  const currency = typeof parsed.currency === 'string' && parsed.currency.trim()
    ? parsed.currency.trim().toUpperCase()
    : undefined;

  return {
    merchantName: parsed.merchantName ?? undefined,
    date: parsed.date ?? undefined,
    items: rawItems,
    subtotal,
    tax,
    fees,
    tip,
    total,
    tipIsFromReceipt: tip > 0,
    currency,
  };
}
