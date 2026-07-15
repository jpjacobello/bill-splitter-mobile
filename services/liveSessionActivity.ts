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
  const claimed = claimerBreakdown(session).reduce((sum, c) => sum + c.amount, 0);
  return {
    total: session.receipt.total,
    claimed,
    count: claimersCount(session),
    currency: session.currency ?? 'USD',
  };
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
