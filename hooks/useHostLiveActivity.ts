import { useEffect } from 'react';
import { useBillStore } from '../store/useBillStore';
import { subscribeToSession } from '../services/billSession';
import { isSessionFullyClaimed } from '../utils/sessionArchive';
import {
  liveActivityAvailable,
  beginSessionActivity,
  refreshSessionActivity,
  stopSessionActivity,
} from '../services/liveSessionActivity';

/*
 * Drives the host's Live Activity off the store's active session, so it starts,
 * updates as claims land, and ends independent of which screen the host is on.
 * No-ops when Live Activities aren't supported (Expo Go / pre-rebuild / <iOS 16.2).
 */
export function useHostLiveActivity() {
  const activeSessionId = useBillStore((s) => s.activeSessionId);

  useEffect(() => {
    if (!activeSessionId || !liveActivityAvailable()) return;

    let started = false;
    let ended = false;
    const unsub = subscribeToSession(activeSessionId, (session) => {
      if (ended) return;
      // End on a closed/expired session OR once everyone has claimed — otherwise
      // a fully-claimed-but-still-open session leaves the activity stuck at 100%.
      if (!session || session.status === 'closed' || isSessionFullyClaimed(session)) {
        ended = true;
        stopSessionActivity();
        // Clear the persisted id so a cold launch doesn't re-subscribe to a dead session.
        useBillStore.getState().setActiveSessionId(null);
        return;
      }
      if (!started) {
        started = true;
        beginSessionActivity(session);
      } else {
        refreshSessionActivity(session);
      }
    });

    return () => {
      unsub();
      stopSessionActivity();
    };
  }, [activeSessionId]);
}
