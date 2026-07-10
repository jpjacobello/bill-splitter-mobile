import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSIONS_KEY = 'liveSessions';

export type StoredSession = {
  sessionId: string;
  merchantName: string;
  createdAt: string;
  creatorVenmoHandle: string;
  receiptImageUri?: string; // local photo, kept so archived shared bills keep the receipt
};

export async function getSessions(): Promise<StoredSession[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addSession(s: StoredSession): Promise<void> {
  const existing = await getSessions();
  const deduped = existing.filter((e) => e.sessionId !== s.sessionId);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify([s, ...deduped]));
}

export async function removeSession(id: string): Promise<void> {
  const existing = await getSessions();
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(existing.filter((e) => e.sessionId !== id)));
}
