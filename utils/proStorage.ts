import AsyncStorage from '@react-native-async-storage/async-storage';
import { BillHistoryEntry, SavedGroup } from '../types';
import { getPeople, findOrCreatePerson, TrackedPerson } from './peopleStorage';

export type GroupWithMembers = SavedGroup & { members: TrackedPerson[] };

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const PRO_KEY = 'diviPro';
const HISTORY_KEY = 'billHistory';
const GROUPS_KEY = 'savedGroups';
const VENMO_HANDLE_KEY = 'venmoHandle';
const CASHAPP_HANDLE_KEY = 'cashAppHandle';
const CURRENCY_KEY = 'currencyCode';
const MAX_HISTORY = 25;

export async function getIsPro(): Promise<boolean> {
  const v = await AsyncStorage.getItem(PRO_KEY);
  return v === 'true';
}

export async function setIsPro(value: boolean): Promise<void> {
  if (value) {
    await AsyncStorage.setItem(PRO_KEY, 'true');
  } else {
    await AsyncStorage.removeItem(PRO_KEY);
  }
}

export async function getBillHistory(): Promise<BillHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveBillToHistory(
  entry: Omit<BillHistoryEntry, 'id' | 'createdAt'>
): Promise<void> {
  const existing = await getBillHistory();
  const newEntry: BillHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(
    HISTORY_KEY,
    JSON.stringify([newEntry, ...existing].slice(0, MAX_HISTORY))
  );
}

export async function deleteBillFromHistory(id: string): Promise<void> {
  const existing = await getBillHistory();
  await AsyncStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(existing.filter((e) => e.id !== id))
  );
}

export async function getSavedGroups(): Promise<SavedGroup[]> {
  try {
    const raw = await AsyncStorage.getItem(GROUPS_KEY);
    const stored: any[] = raw ? JSON.parse(raw) : [];
    let migrated = false;
    const out: SavedGroup[] = [];
    for (const g of stored) {
      if (Array.isArray(g.memberIds)) {
        out.push({ id: g.id, name: g.name, memberIds: g.memberIds });
        continue;
      }
      // Legacy shape: { members: string[] } (display names). Convert each name
      // to a roster person id so groups become people-backed.
      const ids: string[] = [];
      for (const name of (g.members ?? [])) {
        const person = await findOrCreatePerson(String(name));
        ids.push(person.id);
      }
      out.push({ id: g.id, name: g.name, memberIds: ids });
      migrated = true;
    }
    if (migrated) await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(out));
    return out;
  } catch {
    return [];
  }
}

// Groups joined with their roster people, for display. Drops any member id that
// no longer resolves (person was deleted).
export async function getGroupsWithMembers(): Promise<GroupWithMembers[]> {
  const [groups, people] = await Promise.all([getSavedGroups(), getPeople()]);
  const byId = new Map(people.map((p) => [p.id, p]));
  return groups.map((g) => ({
    ...g,
    members: g.memberIds.map((id) => byId.get(id)).filter(Boolean) as TrackedPerson[],
  }));
}

export async function saveGroup(input: { name: string; memberIds: string[] }): Promise<SavedGroup> {
  const existing = await getSavedGroups();
  const newGroup: SavedGroup = { id: genId(), name: input.name, memberIds: input.memberIds };
  await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify([...existing, newGroup]));
  return newGroup;
}

// Convenience for callers that only have typed names (e.g. the assign-items
// quick-create). Resolves names to roster people first.
export async function saveGroupFromNames(name: string, memberNames: string[]): Promise<SavedGroup> {
  const ids: string[] = [];
  for (const n of memberNames) {
    const person = await findOrCreatePerson(n);
    ids.push(person.id);
  }
  return saveGroup({ name, memberIds: ids });
}

export async function updateGroup(
  id: string,
  patch: { name?: string; memberIds?: string[] }
): Promise<void> {
  const groups = await getSavedGroups();
  const next = groups.map((g) => (g.id === id ? { ...g, ...patch } : g));
  await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(next));
}

export async function deleteSavedGroup(id: string): Promise<void> {
  const existing = await getSavedGroups();
  await AsyncStorage.setItem(
    GROUPS_KEY,
    JSON.stringify(existing.filter((g) => g.id !== id))
  );
}

export async function getVenmoHandle(): Promise<string> {
  return (await AsyncStorage.getItem(VENMO_HANDLE_KEY)) ?? '';
}

export async function setVenmoHandle(handle: string): Promise<void> {
  const normalized = handle.replace(/^@/, '').trim();
  await AsyncStorage.setItem(VENMO_HANDLE_KEY, normalized);
}

export async function getCashAppHandle(): Promise<string> {
  return (await AsyncStorage.getItem(CASHAPP_HANDLE_KEY)) ?? '';
}

export async function setCashAppHandle(handle: string): Promise<void> {
  const normalized = handle.replace(/^\$/, '').trim();
  await AsyncStorage.setItem(CASHAPP_HANDLE_KEY, normalized);
}

export async function getCurrency(): Promise<string> {
  return (await AsyncStorage.getItem(CURRENCY_KEY)) ?? 'USD';
}

export async function setCurrency(code: string): Promise<void> {
  await AsyncStorage.setItem(CURRENCY_KEY, code);
}
