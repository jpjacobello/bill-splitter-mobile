import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getCurrency } from '../utils/proStorage';
import { setActiveCurrency } from '../utils/currency';

export default function RootLayout() {
  useEffect(() => {
    getCurrency().then(setActiveCurrency);
  }, []);

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </SafeAreaProvider>
  );
}
