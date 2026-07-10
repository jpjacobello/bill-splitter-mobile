import { BillSession } from '../types';

// What others still owe the host for a live session — shown on Home ("owed to
// you") and the Activity live cards. Unlike raw claim totals, this reflects the
// expected outstanding amount immediately, before anyone claims.
// `paidNames` = claimers the host has manually confirmed paid (host-side only;
// Divi can't detect the Venmo transfer). Their shares drop out of "owed".
export function outstandingOwed(session: BillSession | null, paidNames: string[] = []): number {
  if (!session) return 0;

  // Equal split: host is one of `peopleCount` seats, so the other seats owe the
  // rest. Known up front (before any claims), and drops as seats get paid.
  if (session.splitType === 'equal' && session.peopleCount && session.peopleCount > 0) {
    const share = session.receipt.total / session.peopleCount;
    const paidSeats = Object.values(session.claims ?? {}).filter((c) => c.itemId === 'equal-split').length;
    const remaining = Math.max(0, session.peopleCount - 1 - paidSeats);
    return remaining * share;
  }

  // Itemized: sum claimed shares, excluding claimers the host marked paid.
  const paid = new Set(paidNames);
  return Object.values(session.claims ?? {}).reduce((sum, c) => {
    if (paid.has(c.claimerName)) return sum;
    const item = session.receipt.items.find((i) => i.id === c.itemId);
    return item ? sum + item.price * c.fraction : sum;
  }, 0);
}

// How many people still owe the host for a session (for the "people owe you"
// stat). Equal splits have a known headcount; itemized counts distinct claimers.
export function owersCount(session: BillSession | null): number {
  if (!session) return 0;
  if (session.splitType === 'equal' && session.peopleCount && session.peopleCount > 0) {
    const paidSeats = Object.values(session.claims ?? {}).filter((c) => c.itemId === 'equal-split').length;
    return Math.max(0, session.peopleCount - 1 - paidSeats);
  }
  return new Set(Object.values(session.claims ?? {}).map((c) => c.claimerName)).size;
}
