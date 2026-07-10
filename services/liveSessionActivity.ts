import { BillSession } from '../types';
import { claimerBreakdown, claimersCount } from '../utils/sessionOwed';
import {
  isLiveActivitySupported,
  startSessionActivity,
  updateSessionActivity,
  endSessionActivity,
  type SessionActivityState,
} from '../modules/live-activity';

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
  await startSessionActivity(session.merchantName, session.id, stateOf(session));
}

export async function refreshSessionActivity(session: BillSession): Promise<void> {
  await updateSessionActivity(stateOf(session));
}

export async function stopSessionActivity(): Promise<void> {
  await endSessionActivity();
}
