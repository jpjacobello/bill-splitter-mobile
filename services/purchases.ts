import { Platform } from 'react-native';
import type {
  CustomerInfo, PurchasesOffering, PurchasesPackage,
} from 'react-native-purchases';

// RevenueCat wrapper. Lazily required + fully guarded so a build WITHOUT the
// native module (current Expo Go / pre-rebuild) degrades to "free", never crashes.
// The `pro` entitlement is granted by all three products (monthly/annual/lifetime).

const ENTITLEMENT = 'pro';
const KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY;

let mod: typeof import('react-native-purchases').default | null = null;
let available = false;
let configured = false;

function rc() {
  if (mod) return mod;
  try {
    mod = require('react-native-purchases').default;
  } catch {
    mod = null;
  }
  return mod;
}

const hasPro = (info: CustomerInfo | null | undefined) =>
  !!info?.entitlements.active[ENTITLEMENT];

export function configurePurchases() {
  if (configured) return; // idempotent — safe to call from both _layout and usePro
  if (Platform.OS !== 'ios' || !KEY) return; // iOS-only for now; no key = skip
  try {
    rc()?.configure({ apiKey: KEY });
    available = true;
    configured = true;
  } catch {
    available = false;
  }
}

export function isPurchasesAvailable() {
  return available;
}

export async function fetchProStatus(): Promise<boolean> {
  if (!available) return false;
  try {
    return hasPro(await rc()!.getCustomerInfo());
  } catch {
    return false;
  }
}

export function onProChange(cb: (isPro: boolean) => void): () => void {
  if (!available) return () => {};
  try {
    const listener = (info: CustomerInfo) => cb(hasPro(info));
    rc()!.addCustomerInfoUpdateListener(listener);
    return () => { try { rc()!.removeCustomerInfoUpdateListener(listener); } catch {} };
  } catch {
    return () => {};
  }
}

export async function getProOffering(): Promise<PurchasesOffering | null> {
  if (!available) return null;
  try {
    return (await rc()!.getOfferings()).current ?? null;
  } catch {
    return null;
  }
}

// Returns true if the purchase left the user with the pro entitlement.
export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  if (!available) return false;
  const { customerInfo } = await rc()!.purchasePackage(pkg);
  return hasPro(customerInfo);
}

export async function restorePurchases(): Promise<boolean> {
  if (!available) return false;
  try {
    return hasPro(await rc()!.restorePurchases());
  } catch {
    return false;
  }
}
