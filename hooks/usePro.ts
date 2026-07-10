import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  fetchProStatus, onProChange, purchasePackage, restorePurchases,
} from '../services/purchases';

// Shared module-level store so every screen sees the same Pro state. Source of
// truth is RevenueCat's `pro` entitlement (via services/purchases, guarded).
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
  fetchProStatus().then((v) => set({ isPro: v, loading: false }));
  onProChange((v) => set({ isPro: v }));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function getSnapshot() { return state; }

export function usePro() {
  useEffect(() => { ensureInit(); }, []);
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    const ok = await purchasePackage(pkg);
    if (ok) set({ isPro: true });
    return ok;
  }, []);

  const restore = useCallback(async () => {
    const ok = await restorePurchases();
    if (ok) set({ isPro: true });
    return ok;
  }, []);

  // DEV-only: flip Pro in-memory to eyeball gated features before RevenueCat
  // is wired up (no-op in production builds).
  const devSetPro = useCallback((v: boolean) => { if (__DEV__) set({ isPro: v }); }, []);

  return { isPro: snap.isPro, loading: snap.loading, purchase, restore, devSetPro };
}
