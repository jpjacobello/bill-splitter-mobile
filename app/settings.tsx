import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput,
  TouchableOpacity, ScrollView, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBillStore } from '../store/useBillStore';

const SAVED_NAME_KEY = 'savedHostName';
export const DEFAULT_TIP_KEY = 'defaultTipPct';
const TIP_PRESETS = [0.15, 0.18, 0.20, 0.25];

export default function SettingsScreen() {
  const router = useRouter();
  const { setHostName } = useBillStore();
  const [name, setName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [defaultTip, setDefaultTip] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.multiGet([SAVED_NAME_KEY, DEFAULT_TIP_KEY]).then(([savedName, savedTip]) => {
      if (savedName[1]) setName(savedName[1]);
      setDefaultTip(savedTip[1] !== null ? parseFloat(savedTip[1]) : null);
    });
  }, []);

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    await AsyncStorage.setItem(SAVED_NAME_KEY, trimmed);
    setHostName(trimmed);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const handleSetDefaultTip = async (pct: number | null) => {
    setDefaultTip(pct);
    if (pct === null) {
      await AsyncStorage.removeItem(DEFAULT_TIP_KEY);
    } else {
      await AsyncStorage.setItem(DEFAULT_TIP_KEY, String(pct));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#D0D0D0" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Your Name ── */}
        <Text style={styles.sectionLabel}>Your Name</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={(t) => { setName(t); setNameSaved(false); }}
            placeholder="Your name"
            placeholderTextColor="#555"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleSaveName}
          />
          <TouchableOpacity
            style={[styles.saveBtn, nameSaved && styles.saveBtnDone, !name.trim() && styles.saveBtnDisabled]}
            onPress={handleSaveName}
            disabled={!name.trim()}
            activeOpacity={0.75}
          >
            <Text style={[styles.saveBtnText, nameSaved && styles.saveBtnTextDone]}>
              {nameSaved ? '✓' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Default Tip ── */}
        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>Default Tip</Text>
        <Text style={styles.sectionHint}>Applied automatically when a scanned receipt has no tip.</Text>
        <View style={styles.tipChips}>
          <TouchableOpacity
            style={[styles.tipChip, defaultTip === null && styles.tipChipActive]}
            onPress={() => handleSetDefaultTip(null)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tipChipText, defaultTip === null && styles.tipChipTextActive]}>None</Text>
          </TouchableOpacity>
          {TIP_PRESETS.map((pct) => (
            <TouchableOpacity
              key={pct}
              style={[styles.tipChip, defaultTip === pct && styles.tipChipActive]}
              onPress={() => handleSetDefaultTip(pct)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tipChipText, defaultTip === pct && styles.tipChipTextActive]}>
                {Math.round(pct * 100)}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Subscription ── */}
        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>Subscription</Text>
        <View style={styles.subscriptionRow}>
          <View style={styles.subscriptionLeft}>
            <Text style={styles.subscriptionTitle}>Divi Pro</Text>
            <Text style={styles.subscriptionSubtitle}>Unlimited scans, priority support, and more</Text>
          </View>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Soon</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#151515' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#D0D0D0' },
  scroll: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.60)',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
  },
  sectionHint: {
    fontSize: 13, color: '#888', marginBottom: 12, marginTop: -6,
  },

  // Name
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  nameInput: {
    flex: 1, height: 48,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14, paddingHorizontal: 16,
    fontSize: 16, color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  saveBtn: {
    height: 48, paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  saveBtnDone: {
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderColor: 'rgba(22,163,74,0.40)',
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#D0D0D0' },
  saveBtnTextDone: { color: '#16A34A' },

  // Tip
  tipChips: { flexDirection: 'row', gap: 8 },
  tipChip: {
    flex: 1, paddingVertical: 8,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  tipChipActive: { backgroundColor: 'rgba(220,220,220,0.95)', borderColor: 'rgba(255,255,255,0.40)' },
  tipChipText: { fontSize: 13, fontWeight: '600', color: '#B8B8B8' },
  tipChipTextActive: { color: '#000' },

  // Subscription
  subscriptionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  subscriptionLeft: { flex: 1, gap: 4 },
  subscriptionTitle: { fontSize: 16, fontWeight: '700', color: '#D0D0D0' },
  subscriptionSubtitle: { fontSize: 13, color: '#888' },
  comingSoonBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  comingSoonText: { fontSize: 12, fontWeight: '600', color: '#888' },
});
