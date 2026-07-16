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

  let posSubtotal = 0;
  let totalPositive = 0;
  let totalDiscount = 0;
  for (const item of receipt.items) {
    if (item.price > 0) {
      totalPositive += item.price;
      const fraction = claimMap.get(item.id) ?? 0;
      if (fraction > 0) posSubtotal += item.price * fraction;
    } else if (item.price < 0) {
      totalDiscount += item.price; // discounts are negative
    }
  }
  // Give this claim its proportional slice of any discount (by positive spend),
  // matching the host-side calcSplit — otherwise guests were charged the full
  // pre-discount subtotal while the discount shrank the ratio base, so their
  // shares collectively overshot the bill.
  const discountShare = totalPositive > 0 ? totalDiscount * (posSubtotal / totalPositive) : 0;
  const subtotal = r2(posSubtotal + discountShare);

  const base = receipt.subtotal > 0 ? receipt.subtotal : 1;
  const ratio = subtotal / base;

  const taxShare = r2(receipt.tax * ratio);
  const feesShare = r2((receipt.fees ?? 0) * ratio);
  const tipShare = r2(receipt.tip * ratio);
  const totalOwed = r2(subtotal + taxShare + feesShare + tipShare);

  return { subtotal, taxShare, feesShare, tipShare, totalOwed };
}
