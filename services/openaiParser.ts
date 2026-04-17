import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Receipt, ReceiptItem } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const PROMPT = `You are a receipt parser. Extract all data from this receipt image and return it as JSON.

Return exactly this structure (no other text):
{
  "merchantName": "string or null",
  "date": "YYYY-MM-DD or null",
  "items": [
    {
      "name": "item name",
      "quantity": 1,
      "price": 0.00
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "tip": 0.00,
  "fees": 0.00,
  "total": 0.00
}

Rules:
- quantity: the exact number from the QTY column. Default 1 if not shown.
- price: the LINE TOTAL for that item (the rightmost price column). Example: if the receipt shows "Guinness Draught  7  $11.00  $77.00", price is $77.00 not $11.00.
- For discounts or comps, use a negative price (e.g. -10.00)
- fees = surcharges, credit card fees, service charges (not tax, not tip)
- If a value is not present, use 0
- subtotal = sum of all item prices (before tax, tip, fees)
- total = the final amount charged (use the credit card total if one exists)`;

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

  const rawItems: ReceiptItem[] = (parsed.items ?? []).map((item: any, index: number) => {
    const quantity = Math.max(1, Math.round(Number(item.quantity)) || 1);
    const price = Number(item.price) || 0;
    const unitPrice = parseFloat((price / quantity).toFixed(4));
    return {
      id: `item-${index}`,
      name: String(item.name ?? 'Unknown Item').trim(),
      price,
      quantity,
      unitPrice,
      assignedTo: [],
    };
  });

  const subtotal = Number(parsed.subtotal) || rawItems.reduce((s, i) => s + i.price, 0);
  const tax = Number(parsed.tax) || 0;
  const tip = Number(parsed.tip) || 0;
  const fees = Number(parsed.fees) || 0;
  const total = Number(parsed.total) || subtotal + tax + tip + fees;

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
  };
}
