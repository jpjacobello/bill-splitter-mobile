import { BillSession } from '../types';

// What others still owe the host for a live session — shown on Home ("owed to
// you") and the Activity live cards. Unlike raw claim totals, this reflects the
// expected outstanding amount immediately, before anyone claims.
export function outstandingOwed(session: BillSession | null): number {
  if (!session) return 0;

  // Equal split: host is one of `peopleCount` seats, so the other seats owe the
  // rest. Known up front (before any claims), and drops as seats get paid.
  if (session.splitType === 'equal' && session.peopleCount && session.peopleCount > 0) {
    const share = session.receipt.total / session.peopleCount;
    const paidSeats = Object.values(session.claims ?? {}).filter((c) => c.itemId === 'equal-split').length;
    const remaining = Math.max(0, session.peopleCount - 1 - paidSeats);
    return remaining * share;
  }

  // Itemized: we only know a share once it's claimed, so sum claimed shares.
  return Object.values(session.claims ?? {}).reduce((sum, c) => {
    const item = session.receipt.items.find((i) => i.id === c.itemId);
    return item ? sum + item.price * c.fraction : sum;
  }, 0);
}

export type Claimer = { name: string; amount: number };

// Per-claimer breakdown for the read-only live ledger: group itemized claims by
// name, sum shares. (No paid tracking — Divi isn't a ledger you manage.)
export function claimerBreakdown(session: BillSession | null): Claimer[] {
  if (!session) return [];
  const byName: Record<string, number> = {};
  for (const c of Object.values(session.claims ?? {})) {
    if (c.itemId === 'equal-split') continue;
    const item = session.receipt.items.find((i) => i.id === c.itemId);
    if (!item) continue;
    byName[c.claimerName] = (byName[c.claimerName] ?? 0) + item.price * c.fraction;
  }
  return Object.entries(byName).map(([name, amount]) => ({ name, amount }));
}

// How many people have CLAIMED on a session (for the "N claimed" stat).
// Equal: seats taken. Itemized: distinct claimer names.
export function claimersCount(session: BillSession | null): number {
  if (!session) return 0;
  if (session.splitType === 'equal') {
    return Object.values(session.claims ?? {}).filter((c) => c.itemId === 'equal-split').length;
  }
  return new Set(Object.values(session.claims ?? {}).map((c) => c.claimerName)).size;
}
