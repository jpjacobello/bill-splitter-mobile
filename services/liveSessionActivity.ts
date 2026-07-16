import { BillSession } from '../types';
import { claimerBreakdown, claimersCount } from '../utils/sessionOwed';
import {
  isLiveActivitySupported,
  startSessionActivity,
  updateSessionActivity,
  endSessionActivity,
  addPushTokenListener,
  type SessionActivityState,
} from '../modules/live-activity';
import { setSessionPushToken } from './billSession';

// Register once: when ActivityKit issues the activity's push token, persist it to
// the session doc so the backend can push background updates (Phase B).
let tokenSub: { remove(): void } | null = null;
function ensurePushTokenSync() {
  if (tokenSub) return;
  tokenSub = addPushTokenListener(({ token, sessionId }) => {
    setSessionPushToken(sessionId, token).catch(() => {});
  });
}

function stateOf(session: BillSession): SessionActivityState {
  const total = session.receipt.total;
  let claimed: number;
  if (session.splitType === 'equal' && session.peopleCount && session.peopleCount > 0) {
    // Equal split: claimerBreakdown is itemized-only and returned $0 here. Each
    // paid seat + the host's own (already-covered) seat settles a per-head share.
    const perHead = total / session.peopleCount;
    const paidSeats = Object.values(session.claims ?? {}).filter((c) => c.itemId === 'equal-split').length;
    claimed = Math.min(total, (paidSeats + 1) * perHead);
  } else {
    // Itemized: claimerBreakdown now includes each claimer's tax/fees/tip, so the
    // sum can actually reach `total` once everything is claimed.
    claimed = claimerBreakdown(session).reduce((sum, c) => sum + c.amount, 0);
  }
  return { total, claimed, count: claimersCount(session), currency: session.currency ?? 'USD' };
}

export function liveActivityAvailable(): boolean {
  return isLiveActivitySupported();
}

export async function beginSessionActivity(session: BillSession): Promise<void> {
  ensurePushTokenSync();
  await startSessionActivity(session.merchantName, session.id, stateOf(session));
}

export async function refreshSessionActivity(session: BillSession): Promise<void> {
  await updateSessionActivity(stateOf(session));
}

export async function stopSessionActivity(): Promise<void> {
  await endSessionActivity();
}
