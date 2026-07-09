import { BillSession, BillHistoryEntry, Person, ReceiptItem } from '../types';

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function claimedFraction(session: BillSession, itemId: string): number {
  return Object.values(session.claims ?? {})
    .filter((c) => c.itemId === itemId)
    .reduce((s, c) => s + c.fraction, 0);
}

/** True once every claimable top-level item is fully spoken for. */
export function isSessionFullyClaimed(session: BillSession): boolean {
  const items = session.receipt.items.filter((i) => i.price > 0 && !i.parentId);
  return items.length > 0 && items.every((i) => claimedFraction(session, i.id) >= 0.999);
}

function personId(name: string, i: number): string {
  return `claimer-${i}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

/**
 * Convert a live BillSession into a BillHistoryEntry.
 * Each fractional claim becomes its own item assigned solely to that claimer,
 * so the existing calcSplit (even split among assignees) reproduces exact amounts.
 * Any unclaimed remainder, add-ons, and discounts are assigned to the host.
 */
export function sessionToHistory(session: BillSession): Omit<BillHistoryEntry, 'id' | 'createdAt'> {
  const claims = Object.values(session.claims ?? {});
  const claimerNames = [...new Set(claims.map((c) => c.claimerName))];

  const host: Person = { id: 'host', name: session.creatorName || 'You', isHost: true };
  const idByName = new Map(claimerNames.map((n, i) => [n, personId(n, i)]));
  const claimerPeople: Person[] = claimerNames.map((n) => ({
    id: idByName.get(n)!, name: n, isHost: false,
  }));

  const items: ReceiptItem[] = [];
  for (const item of session.receipt.items) {
    // discounts, zero-price, and add-ons → host
    if (item.price <= 0 || item.parentId) {
      items.push({ ...item, assignedTo: ['host'] });
      continue;
    }
    const itemClaims = claims.filter((c) => c.itemId === item.id);
    let claimedSum = 0;
    for (const c of itemClaims) {
      claimedSum += c.fraction;
      items.push({
        ...item,
        id: `${item.id}-${idByName.get(c.claimerName)}`,
        price: r2(item.price * c.fraction),
        quantity: 1,
        assignedTo: [idByName.get(c.claimerName)!],
      });
    }
    const remainder = 1 - claimedSum;
    if (remainder > 0.001) {
      items.push({
        ...item,
        id: `${item.id}-host`,
        price: r2(item.price * remainder),
        quantity: 1,
        assignedTo: ['host'],
      });
    }
  }

  return {
    merchantName: session.merchantName,
    people: [host, ...claimerPeople],
    receipt: { ...session.receipt, items },
  };
}
