import { Receipt } from '../types';

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ClaimInput = { itemId: string; fraction: number };

export type ShareBreakdown = {
  subtotal: number;
  taxShare: number;
  feesShare: number;
  tipShare: number;
  totalOwed: number;
};

export function calcShare(receipt: Receipt, claims: ClaimInput[]): ShareBreakdown {
  const claimMap = new Map<string, number>();
  for (const { itemId, fraction } of claims) {
    claimMap.set(itemId, (claimMap.get(itemId) ?? 0) + fraction);
  }

  let subtotal = 0;
  for (const item of receipt.items) {
    if (item.price <= 0) continue;
    const fraction = claimMap.get(item.id) ?? 0;
    if (fraction > 0) {
      subtotal += item.price * fraction;
    }
  }
  subtotal = r2(subtotal);

  const base = receipt.subtotal > 0 ? receipt.subtotal : 1;
  const ratio = subtotal / base;

  const taxShare = r2(receipt.tax * ratio);
  const feesShare = r2((receipt.fees ?? 0) * ratio);
  const tipShare = r2(receipt.tip * ratio);
  const totalOwed = r2(subtotal + taxShare + feesShare + tipShare);

  return { subtotal, taxShare, feesShare, tipShare, totalOwed };
}
