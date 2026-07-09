import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getIsPro, setIsPro } from '../utils/proStorage';

// Shared module-level store so every screen sees the same Pro state. Previously
// each usePro() call had its own useState, so flipping Pro in Settings left
// already-mounted screens (People, etc.) stale.
type ProState = { isPro: boolean; loading: boolean };
let state: ProState = { isPro: false, loading: true };
const listeners = new Set<() => void>();

function set(next: Partial<ProState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

let initialized = false;
function ensureInit() {
  if (initialized) return;
  initialized = true;
  getIsPro().then((v) => set({ isPro: v, loading: false }));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function getSnapshot() { return state; }

export function usePro() {
  useEffect(() => { ensureInit(); }, []);
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  const activatePro = useCallback(async () => {
    // TODO: Replace with RevenueCat / StoreKit purchase flow before charging users.
    await setIsPro(true);
    set({ isPro: true });
  }, []);

  const deactivatePro = useCallback(async () => {
    await setIsPro(false);
    set({ isPro: false });
  }, []);

  return { isPro: snap.isPro, loading: snap.loading, activatePro, deactivatePro };
}
