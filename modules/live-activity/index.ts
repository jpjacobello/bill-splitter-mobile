import { requireOptionalNativeModule } from 'expo-modules-core';

const LiveActivity = requireOptionalNativeModule('LiveActivity');

export type SessionActivityState = {
  total: number;
  claimed: number;
  count: number;
  currency: string;
};

// True only on iOS 16.2+ with Live Activities enabled and the native module present.
export function isLiveActivitySupported(): boolean {
  try {
    return !!LiveActivity && LiveActivity.isSupported();
  } catch {
    return false;
  }
}

export async function startSessionActivity(
  merchant: string,
  sessionId: string,
  state: SessionActivityState,
): Promise<string | null> {
  try {
    if (!LiveActivity) return null;
    return await LiveActivity.start(merchant, sessionId, state.total, state.claimed, state.count, state.currency);
  } catch {
    return null;
  }
}

export async function updateSessionActivity(state: SessionActivityState): Promise<void> {
  try {
    if (!LiveActivity) return;
    await LiveActivity.update(state.total, state.claimed, state.count, state.currency);
  } catch {
    // ignore — activity may have been dismissed
  }
}

export async function endSessionActivity(): Promise<void> {
  try {
    if (!LiveActivity) return;
    await LiveActivity.end();
  } catch {
    // ignore
  }
}
