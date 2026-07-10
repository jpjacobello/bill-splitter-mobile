import AsyncStorage from '@react-native-async-storage/async-storage';
import { BillSession } from '../types';

// Host-confirmed payments. Divi can't detect the actual Venmo transfer, so the
// host taps "paid" once money lands. Stored LOCALLY (host-side truth only) —
// never written to Firestore. Map: sessionId -> claimer names marked paid.
const KEY = 'sessionPaid';

type PaidMap = Record<string, string[]>;

async function readAll(): Promise<PaidMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PaidMap) : {};
  } catch {
    return {};
  }
}

export async function getPaidNames(sessionId: string): Promise<string[]> {
  return (await readAll())[sessionId] ?? [];
}

export async function getPaidMap(sessionIds: string[]): Promise<Record<string, string[]>> {
  const all = await readAll();
  const out: Record<string, string[]> = {};
  for (const id of sessionIds) out[id] = all[id] ?? [];
  return out;
}

export async function togglePaid(sessionId: string, name: string): Promise<string[]> {
  const all = await readAll();
  const cur = new Set(all[sessionId] ?? []);
  if (cur.has(name)) cur.delete(name); else cur.add(name);
  all[sessionId] = [...cur];
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
  return all[sessionId];
}

export type Claimer = { name: string; amount: number };

// Per-claimer owed on an itemized session: group claims by name, sum shares.
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
