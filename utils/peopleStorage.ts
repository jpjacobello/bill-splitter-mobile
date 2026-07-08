import AsyncStorage from '@react-native-async-storage/async-storage';

const PEOPLE_KEY = 'people';

// A person you split with — either linked to a device contact (contactId set)
// or added manually (contactId absent).
export type TrackedPerson = {
  id: string;
  name: string;
  phone?: string;
  contactId?: string;
  venmoHandle?: string;
  cashtag?: string;
};

export async function getPeople(): Promise<TrackedPerson[]> {
  try {
    const raw = await AsyncStorage.getItem(PEOPLE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function save(list: TrackedPerson[]): Promise<void> {
  await AsyncStorage.setItem(PEOPLE_KEY, JSON.stringify(list));
}

export async function addPerson(p: Omit<TrackedPerson, 'id'>): Promise<TrackedPerson[]> {
  const list = await getPeople();
  // De-dupe: same contactId, or same name+phone for manual entries.
  const exists = list.some((x) =>
    (p.contactId && x.contactId === p.contactId) ||
    (!p.contactId && x.name.toLowerCase() === p.name.toLowerCase() && (x.phone ?? '') === (p.phone ?? ''))
  );
  if (exists) return list;
  const next = [...list, { ...p, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }];
  await save(next);
  return next;
}

export async function removePerson(id: string): Promise<TrackedPerson[]> {
  const next = (await getPeople()).filter((p) => p.id !== id);
  await save(next);
  return next;
}

export async function updatePerson(id: string, patch: Partial<Omit<TrackedPerson, 'id'>>): Promise<TrackedPerson[]> {
  const next = (await getPeople()).map((p) => (p.id === id ? { ...p, ...patch } : p));
  await save(next);
  return next;
}
