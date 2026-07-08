import { useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../components/Button';
import { colors } from '../theme';

const HAS_LAUNCHED_KEY = 'hasLaunched';
const SAVED_NAME_KEY = 'savedHostName';

export default function OnboardingScreen() {
  const router = useRouter();
  const [name, setName] = useState('');

  const handleContinue = async () => {
    if (!name.trim()) return;
    await AsyncStorage.multiSet([
      [SAVED_NAME_KEY, name.trim()],
      [HAS_LAUNCHED_KEY, 'true'],
    ]);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <View style={styles.hero}>
            <View style={styles.badge}><Text style={styles.badgeText}>DIVI</Text></View>
            <Text style={styles.title}>Split the bill,{'\n'}not the{'\n'}friendship.</Text>
            <Text style={styles.subtitle}>Scan a receipt, assign items,{'\n'}and settle up in seconds.</Text>
          </View>
          <View style={styles.actions}>
            <TextInput
              style={styles.nameInput}
              placeholder="Your name"
              placeholderTextColor="#777"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
            <Button label="Get Started" onPress={handleContinue} disabled={!name.trim()} />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 24, paddingBottom: 70, justifyContent: 'flex-end' },
  hero: { marginBottom: 48 },
  badge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: { color: 'rgba(255,255,255,0.70)', fontSize: 15, fontWeight: '700', letterSpacing: 3 },
  title: { fontSize: 42, fontWeight: '800', color: colors.text, lineHeight: 50, marginBottom: 16 },
  subtitle: { fontSize: 16, color: colors.textMuted, lineHeight: 24 },
  actions: { gap: 12, marginBottom: 40 },
  nameInput: {
    height: 52, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 14,
    paddingHorizontal: 16, fontSize: 17, color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.13)',
  },
});
