import { Person, Receipt, PersonBreakdown, SplitSummary } from '../types';

// Round to 2 decimal places
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/*
 * calcSplit — main entry point
 *
 * Example:
 *   const summary = calcSplit(people, receipt);
 *   // summary.people[0].totalOwed  → $32.17
 *   // summary.reconciles           → true
 *   // summary.unassignedItems      → []
 *
 * Rounding strategy:
 *   Each person's shares are rounded to 2dp independently.
 *   Any remainder vs receipt.total is added to the largest payer.
 */
export function calcSplit(people: Person[], receipt: Receipt): SplitSummary {
  // Discount items are auto-distributed — exclude from unassigned tracking
  const unassignedItems = receipt.items.filter((i) => i.price >= 0 && i.assignedTo.length === 0);
  const unassignedTotal = r2(unassignedItems.reduce((s, i) => s + i.price, 0));

  // Step 1: build subtotals and item shares (positive items only)
  const breakdowns: PersonBreakdown[] = people.map((person) => {
    const assignedItems: PersonBreakdown['assignedItems'] = [];
    let subtotal = 0;
    receipt.items.forEach((item) => {
      if (item.price < 0) return; // discounts handled separately below
      if (item.assignedTo.includes(person.id)) {
        const share = item.price / item.assignedTo.length;
        subtotal += share;
        assignedItems.push({ item, share: r2(share) });
      }
    });
    return { person, assignedItems, subtotal: r2(subtotal), taxShare: 0, feesShare: 0, tipShare: 0, totalOwed: 0 };
  });

  // Step 1b: distribute discount items proportionally across assigned people
  const totalDiscount = r2(receipt.items.filter((i) => i.price < 0).reduce((s, i) => s + i.price, 0));
  if (totalDiscount < 0) {
    const positiveAssigned = r2(breakdowns.reduce((s, b) => s + b.subtotal, 0));
    if (positiveAssigned > 0) {
      const rawDiscountShares = breakdowns.map((b) => totalDiscount * (b.subtotal / positiveAssigned));
      const roundedDiscountShares = rawDiscountShares.map(r2);
      const discountRemainder = r2(totalDiscount - roundedDiscountShares.reduce((s, d) => s + d, 0));
      if (Math.abs(discountRemainder) >= 0.01) {
        const largestIdx = breakdowns.reduce(
          (maxIdx, b, i, arr) => (b.subtotal > arr[maxIdx].subtotal ? i : maxIdx), 0
        );
        roundedDiscountShares[largestIdx] = r2(roundedDiscountShares[largestIdx] + discountRemainder);
      }
      breakdowns.forEach((b, i) => { b.subtotal = r2(b.subtotal + roundedDiscountShares[i]); });
    }
  }

  // Sum of assigned subtotals. When items are UNASSIGNED this is less than
  // receipt.subtotal, so tax/fees/tip must be reconciled against only the
  // ASSIGNED portion — otherwise the unassigned items' entire tax/tip gets
  // dumped on the largest payer instead of staying unassigned. When everything
  // is assigned, assignedSubtotal == receipt.subtotal and behavior is unchanged.
  const assignedSubtotal = r2(breakdowns.reduce((s, b) => s + b.subtotal, 0));
  const portion = (amount: number): number =>
    receipt.subtotal > 0 ? r2(amount * (assignedSubtotal / receipt.subtotal)) : amount;

  // Step 2: compute raw tax shares (proportional) and round them
  const n = breakdowns.length || 1;
  const rawTaxShares = breakdowns.map((b) =>
    receipt.subtotal > 0 ? receipt.tax * (b.subtotal / receipt.subtotal) : receipt.tax / n
  );
  const roundedTaxShares = rawTaxShares.map(r2);
  const taxRemainder = r2(portion(receipt.tax) - roundedTaxShares.reduce((s, t) => s + t, 0));
  if (Math.abs(taxRemainder) >= 0.01) {
    const largestTaxIdx = breakdowns.reduce(
      (maxIdx, b, i, arr) => (b.subtotal > arr[maxIdx].subtotal ? i : maxIdx), 0
    );
    roundedTaxShares[largestTaxIdx] = r2(roundedTaxShares[largestTaxIdx] + taxRemainder);
  }

  // Step 3: compute raw fees shares (proportional like tax) and round them
  const totalFees = receipt.fees ?? 0;
  const rawFeesShares = breakdowns.map((b) =>
    receipt.subtotal > 0 ? totalFees * (b.subtotal / receipt.subtotal) : totalFees / n
  );
  const roundedFeesShares = rawFeesShares.map(r2);
  const feesRemainder = r2(portion(totalFees) - roundedFeesShares.reduce((s, f) => s + f, 0));
  if (Math.abs(feesRemainder) >= 0.01) {
    const largestIdx = breakdowns.reduce(
      (maxIdx, b, i, arr) => (b.subtotal > arr[maxIdx].subtotal ? i : maxIdx), 0
    );
    roundedFeesShares[largestIdx] = r2(roundedFeesShares[largestIdx] + feesRemainder);
  }

  // Step 4: compute raw tip shares (proportional to subtotal, like tax) and round them
  const rawTipShares = breakdowns.map((b) =>
    receipt.subtotal > 0 ? receipt.tip * (b.subtotal / receipt.subtotal) : receipt.tip / n
  );
  const roundedTipShares = rawTipShares.map(r2);
  const tipRemainder = r2(portion(receipt.tip) - roundedTipShares.reduce((s, t) => s + t, 0));
  if (Math.abs(tipRemainder) >= 0.01) {
    const largestTipIdx = breakdowns.reduce(
      (maxIdx, b, i, arr) => (b.subtotal > arr[maxIdx].subtotal ? i : maxIdx), 0
    );
    roundedTipShares[largestTipIdx] = r2(roundedTipShares[largestTipIdx] + tipRemainder);
  }

  // Step 5: apply corrected tax/fees/tip and compute totalOwed
  breakdowns.forEach((b, i) => {
    b.taxShare = roundedTaxShares[i];
    b.feesShare = roundedFeesShares[i];
    b.tipShare = roundedTipShares[i];
    b.totalOwed = r2(b.subtotal + b.taxShare + b.feesShare + b.tipShare);
  });

  const calculatedTotal = r2(breakdowns.reduce((s, b) => s + b.totalOwed, 0) + unassignedTotal);

  return {
    people: breakdowns,
    receiptTotal: receipt.total,
    calculatedTotal,
    reconciles: Math.abs(calculatedTotal - receipt.total) < 0.02,
    unassignedItems,
  };
}

/*
 * getUnassignedTotal — sum of items not assigned to anyone
 */
export function getUnassignedTotal(receipt: Receipt): number {
  return r2(
    receipt.items
      .filter((i) => i.price >= 0 && i.assignedTo.length === 0)
      .reduce((s, i) => s + i.price, 0)
  );
}

/*
 * reconcileCheck — compare two totals, return diff and whether they match
 *
 * Example:
 *   reconcileCheck(84.50, 84.51) → { diff: 0.01, reconciles: true }
 *   reconcileCheck(84.50, 86.00) → { diff: 1.50, reconciles: false }
 */
export function reconcileCheck(
  calculatedTotal: number,
  receiptTotal: number
): { diff: number; reconciles: boolean } {
  const diff = r2(Math.abs(calculatedTotal - receiptTotal));
  return { diff, reconciles: diff < 0.02 };
}
