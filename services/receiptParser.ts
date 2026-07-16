import { Receipt } from '../types';
import { openaiParser } from './openaiParser';

// Swap implementations here — never need to touch the rest of the app
export type ReceiptParser = (imageUri: string) => Promise<Receipt>;

// Credit-card / service / processing surcharges are sometimes printed as line
// items. They aren't anyone's order — they must ride in `receipt.fees` so they
// split proportionally across everyone (like tax/tip), not sit in the item grid
// as an assignable dish. Match on the name and on the auto-* ids the parser
// occasionally emits.
// NOTE: "cc" is word-boundaried AND requires a fee/charge word — bare "cc"
// unanchored matched real dishes (broCColi, cappuCCino, proseCCo, foCACcia).
const FEE_NAME = /credit\s*card\s*(fee|surcharge|charge)?|\bcc\b\s*(fee|surcharge|charge)|service\s*(charge|fee)|sur[-\s]?charge|processing\s*fee|convenience\s*fee|non[-\s]?cash|admin(istrative)?\s*fee|card\s*fee|delivery\s*(fee|charge)/i;
const FEE_IDS = new Set(['auto-surcharge', 'auto-fee']);

function isFeeItem(name: string, id: string): boolean {
  return FEE_IDS.has(id) || FEE_NAME.test(name);
}

// Move fee-like items out of `items` and into `fees`; recompute subtotal from
// the remaining real items so the proportional-split math stays consistent.
export function reclassifyFees(receipt: Receipt): Receipt {
  const feeItems = receipt.items.filter((it) => isFeeItem(it.name, it.id) && it.price > 0);
  if (feeItems.length === 0) return receipt;

  const keep = receipt.items.filter((it) => !feeItems.includes(it));
  const movedFees = feeItems.reduce((sum, it) => sum + it.price, 0);
  const subtotal = Math.round(keep.reduce((sum, it) => sum + it.price, 0) * 100) / 100;

  // Anchor fees to the receipt total: the parser can report a surcharge BOTH as
  // a line item AND in `fees`, so blindly summing double-counts it. Clamp to the
  // residual (total − subtotal − tax − tip) when the total is trustworthy.
  const rawFees = Math.round(((receipt.fees ?? 0) + movedFees) * 100) / 100;
  const residual = Math.round((receipt.total - subtotal - receipt.tax - receipt.tip) * 100) / 100;
  const fees = receipt.total > 0 && residual >= 0 ? Math.min(rawFees, residual) : rawFees;

  return { ...receipt, items: keep, subtotal, fees };
}

// $0.00 lines are freebies / modifiers — assigning them does nothing and just
// clutters the grid. Drop them (they contribute nothing to the split). Negative
// prices are discounts and are kept (they're split across everyone elsewhere).
export function dropZeroItems(receipt: Receipt): Receipt {
  const nonZero = receipt.items.filter((it) => Math.abs(it.price) >= 0.005);
  if (nonZero.length === receipt.items.length) return receipt;
  return { ...receipt, items: nonZero };
}

export const activeParser: ReceiptParser = (imageUri) =>
  openaiParser(imageUri).then(reclassifyFees).then(dropZeroItems);

async function mockParser(imageUri: string): Promise<Receipt> {
  await new Promise((res) => setTimeout(res, 1200)); // simulate latency

  return {
    merchantName: 'Osteria Italiana',
    date: new Date().toISOString().split('T')[0],
    items: [
      { id: '1', name: 'Margherita Pizza', price: 18.0, quantity: 1, assignedTo: [] },
      { id: '2', name: 'Caesar Salad', price: 12.5, quantity: 1, assignedTo: [] },
      { id: '3', name: 'Pasta Carbonara', price: 22.0, quantity: 1, assignedTo: [] },
      { id: '4', name: 'Sparkling Water', price: 4.0, quantity: 2, assignedTo: [] },
      { id: '5', name: 'Tiramisu', price: 9.0, quantity: 1, assignedTo: [] },
    ],
    subtotal: 65.5,
    tax: 5.9,
    fees: 0,
    tip: 13.1,
    total: 84.5,
    tipIsFromReceipt: true,
  };
}
