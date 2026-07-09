import { useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Perforation from '../components/Perforation';
import { ui as C } from '../theme';

const HAS_LAUNCHED_KEY = 'hasLaunched';
const SAVED_NAME_KEY = 'savedHostName';

export default function OnboardingScreen() {
  const router = useRouter();
  const [name, setName] = useState('');

  const handleContinue = async () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.multiSet([
      [SAVED_NAME_KEY, name.trim()],
      [HAS_LAUNCHED_KEY, 'true'],
    ]);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.inner}>
          <View style={styles.hero}>
            <View style={styles.badge}><Text style={styles.badgeText}>DIVI</Text></View>
            <Text style={styles.title}>Split the bill,{'\n'}not the{'\n'}friendship.</Text>
            <Text style={styles.subtitle}>Scan a receipt, assign items,{'\n'}and settle up in seconds.</Text>
            <Perforation dots={30} />
          </View>
          <View style={styles.actions}>
            <TextInput
              style={styles.nameInput}
              placeholder="Your name"
              placeholderTextColor={C.faint}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
            <TouchableOpacity
              style={[styles.cta, !name.trim() && styles.ctaDisabled]}
              onPress={handleContinue}
              disabled={!name.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 64, justifyContent: 'flex-start' },
  hero: { marginBottom: 32 },
  badge: {
    alignSelf: 'flex-start', backgroundColor: C.card, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 9, marginBottom: 24,
    borderWidth: 1, borderColor: C.line,
  },
  badgeText: { color: C.dim, fontSize: 14, fontWeight: '800', letterSpacing: 3 },
  title: { fontSize: 42, fontWeight: '800', color: C.text, lineHeight: 49, letterSpacing: -0.8, marginBottom: 16 },
  subtitle: { fontSize: 16, color: C.dim, lineHeight: 24 },
  actions: { gap: 12 },
  nameInput: {
    height: 54, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 14,
    paddingHorizontal: 16, fontSize: 17, color: C.text, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cta: { height: 54, borderRadius: 14, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 16, fontWeight: '700', color: C.bg },
});
