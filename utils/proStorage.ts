import AsyncStorage from '@react-native-async-storage/async-storage';
import { BillHistoryEntry, SavedGroup } from '../types';

const PRO_KEY = 'diviPro';
const HISTORY_KEY = 'billHistory';
const GROUPS_KEY = 'savedGroups';
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
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveGroup(group: Omit<SavedGroup, 'id'>): Promise<SavedGroup> {
  const existing = await getSavedGroups();
  const newGroup: SavedGroup = {
    ...group,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify([...existing, newGroup]));
  return newGroup;
}

export async function deleteSavedGroup(id: string): Promise<void> {
  const existing = await getSavedGroups();
  await AsyncStorage.setItem(
    GROUPS_KEY,
    JSON.stringify(existing.filter((g) => g.id !== id))
  );
}
