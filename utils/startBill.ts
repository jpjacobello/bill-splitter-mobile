import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBillStore } from '../store/useBillStore';

const SAVED_NAME_KEY = 'savedHostName';

// Resets the bill store and seeds the host from the saved name, so a fresh scan
// flow starts clean. Call before navigating into /receipt-upload.
export async function startNewBill(): Promise<void> {
  const saved = (await AsyncStorage.getItem(SAVED_NAME_KEY))?.trim();
  const store = useBillStore.getState();
  store.reset();
  store.setHostName(saved || 'You');
}
