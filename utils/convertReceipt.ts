import { Receipt } from '../types';
import { currencyInfo } from './currency';

// Convert-on-scan: scale every monetary field of a Receipt by an FX rate so the
// whole bill becomes a single home-currency bill. All downstream split math
// (calcSplit/calcShare) then runs unchanged — it already reconciles sub-cent
// rounding drift, so converting each field independently is safe.
//
// Revert is a snapshot swap by the caller (keep the pre-conversion Receipt and
// setReceipt(original)), NOT a divide-back — dividing would compound rounding.

export function convertReceipt(receipt: Receipt, rate: number, targetCode: string): Receipt {
  const decimals = currencyInfo(targetCode).decimals ?? 2;
  const factor = Math.pow(10, decimals);
  const conv = (n: number) => Math.round(n * rate * factor) / factor;

  return {
    ...receipt,
    items: receipt.items.map((it) => ({
      ...it,
      price: conv(it.price),
      unitPrice: it.unitPrice != null ? conv(it.unitPrice) : it.unitPrice,
    })),
    subtotal: conv(receipt.subtotal),
    tax: conv(receipt.tax),
    fees: conv(receipt.fees),
    tip: conv(receipt.tip),
    total: conv(receipt.total),
    currency: targetCode,
    originalCurrency: receipt.currency,
    fxRate: rate,
  };
}
