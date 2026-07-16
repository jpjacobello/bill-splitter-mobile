import { BillSession } from '../types';
import { calcShare, ClaimInput } from './calcShare';

// Itemized amounts MUST include the claimer's proportional tax/fees/tip — that's
// what they actually pay via Venmo (see calcShare). Summing bare item.price*
// fraction understated every "owed"/ledger/Live-Activity number and meant the
// itemized progress bar could never reach 100% (total includes tax/tip).
function itemizedClaimInputs(session: BillSession, filter?: (claimerName: string) => boolean): ClaimInput[] {
  return Object.values(session.claims ?? {})
    .filter((c) => c.itemId !== 'equal-split' && (!filter || filter(c.claimerName)))
    .map((c) => ({ itemId: c.itemId, fraction: c.fraction }));
}

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

  // Itemized: we only know a share once it's claimed. Sum claimed shares WITH
  // their proportional tax/fees/tip, matching what claimers actually pay.
  return calcShare(session.receipt, itemizedClaimInputs(session)).totalOwed;
}

export type Claimer = { name: string; amount: number };

// Per-claimer breakdown for the read-only live ledger: group itemized claims by
// name, each claimer's amount = their subtotal + proportional tax/fees/tip
// (exactly what their Venmo request asks for). No paid tracking.
export function claimerBreakdown(session: BillSession | null): Claimer[] {
  if (!session) return [];
  const names = new Set<string>();
  for (const c of Object.values(session.claims ?? {})) {
    if (c.itemId === 'equal-split') continue;
    if (session.receipt.items.some((i) => i.id === c.itemId)) names.add(c.claimerName);
  }
  return Array.from(names).map((name) => ({
    name,
    amount: calcShare(session.receipt, itemizedClaimInputs(session, (n) => n === name)).totalOwed,
  }));
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
