import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Linking,
  TouchableOpacity, Alert, TextInput, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActionSheet from '../../components/ActionSheet';
import SwipeSheet, { SheetScrollView } from '../../components/SwipeSheet';
import { useBillStore } from '../../store/useBillStore';
import { usePro } from '../../hooks/usePro';
import { colors, ui as C } from '../../theme';
import { getVenmoHandle, setVenmoHandle, getCurrency, setCurrency } from '../../utils/proStorage';
import { CURRENCIES, currencyInfo, setActiveCurrency } from '../../utils/currency';
import { DEFAULT_TIP_KEY, TIP_REMINDER_KEY, TipReminderMode } from '../../utils/tipPrefs';

const SAVED_NAME_KEY = 'savedHostName';
const TIP_PRESETS = [0.15, 0.18, 0.20, 0.25];
const APP_VERSION = '1.0.0';

// ── Row primitives — plain RN so the whole screen is ONE continuous page
//    (header + body share the app background); the glass tab bar floats on top. ──
function Divider() {
  return <View style={styles.divider} />;
}
function NavRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={17} color={C.faint} />
      </View>
    </TouchableOpacity>
  );
}
function ActionRow({ icon, label, onPress, accent, chevron = true }: {
  icon?: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; accent?: boolean; chevron?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.rowLeft}>
        {icon && <Ionicons name={icon} size={18} color={accent ? C.accent : C.text} style={styles.rowIcon} />}
        <Text style={[styles.rowLabel, accent && { color: C.accent }]}>{label}</Text>
      </View>
      {chevron && <Ionicons name="chevron-forward" size={17} color={C.faint} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { setHostName } = useBillStore();
  const { isPro, loading: proLoading, restore, devSetPro } = usePro();
  const insets = useSafeAreaInsets();

  const [resetProOpen, setResetProOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('Checking for purchases…');
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  // TextInput is uncontrolled: seed feeds defaultValue once (after storage loads,
  // body gated on `loaded`) so the field never remounts mid-typing. Persist on change.
  const [seedName, setSeedName] = useState('');
  const [seedVenmo, setSeedVenmo] = useState('');
  const [loaded, setLoaded] = useState(false);

  const [defaultTip, setDefaultTip] = useState<number | null>(null);
  const [tipReminder, setTipReminder] = useState<TipReminderMode>('always');
  const [currency, setCurrencyState] = useState('USD');
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [tipSheetOpen, setTipSheetOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [savedName, savedTip, savedReminder] = await AsyncStorage.multiGet([SAVED_NAME_KEY, DEFAULT_TIP_KEY, TIP_REMINDER_KEY]);
      const v = await getVenmoHandle();
      const cur = await getCurrency();
      setSeedName(savedName[1] ?? '');
      setSeedVenmo(v ?? '');
      setDefaultTip(savedTip[1] !== null ? parseFloat(savedTip[1]) : null);
      setTipReminder((savedReminder[1] as TipReminderMode) ?? 'always');
      setCurrencyState(cur);
      setLoaded(true); // mount inputs only once every field's seed is ready
    })();
  }, []);

  const persistName = async (raw: string) => {
    const trimmed = raw.trim();
    setSeedName(trimmed);
    // Persist the cleared state too — early-returning on empty silently reverted.
    if (!trimmed) {
      await AsyncStorage.removeItem(SAVED_NAME_KEY);
      setHostName('');
      return;
    }
    await AsyncStorage.setItem(SAVED_NAME_KEY, trimmed);
    setHostName(trimmed);
  };
  const persistVenmo = async (raw: string) => {
    const trimmed = raw.trim().replace(/^@/, '');
    setSeedVenmo(trimmed);
    await setVenmoHandle(trimmed); // empty clears it
  };

  const handleSetCurrency = async (code: string) => {
    setCurrencyState(code);
    setActiveCurrency(code);
    await setCurrency(code);
    setCurrencyModalOpen(false);
  };
  const handleSetDefaultTip = async (pct: number | null) => {
    setDefaultTip(pct);
    if (pct === null) await AsyncStorage.removeItem(DEFAULT_TIP_KEY);
    else await AsyncStorage.setItem(DEFAULT_TIP_KEY, String(pct));
  };
  const handleSetTipReminder = async (mode: TipReminderMode) => {
    setTipReminder(mode);
    await AsyncStorage.setItem(TIP_REMINDER_KEY, mode);
  };

  const showWidgetHelp = () => Alert.alert(
    'Add the Divi widget',
    'Home screen — long-press, tap ＋, search “Divi”.\n\nLock screen — long-press, tap Customize, add Divi.\n\nEither opens straight to scanning.',
    [{ text: 'Done' }],
  );

  const currencyLabel = `${currencyInfo(currency).flag} ${currency}`;
  const tipLabel = defaultTip === null ? 'None' : `${Math.round(defaultTip * 100)}%`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Settings</Text>

        {loaded && (
          <>
            <Text style={styles.sectionLabel}>Profile</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                defaultValue={seedName}
                placeholder="Your name"
                placeholderTextColor={C.faint}
                autoCorrect={false}
                onChangeText={persistName}
                returnKeyType="done"
              />
            </View>

            <Text style={styles.sectionLabel}>Payment</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                defaultValue={seedVenmo}
                placeholder="Venmo @handle"
                placeholderTextColor={C.faint}
                autoCorrect={false}
                autoCapitalize="none"
                onChangeText={persistVenmo}
                returnKeyType="done"
              />
            </View>

            <Text style={styles.sectionLabel}>Bill Preferences</Text>
            <View style={styles.card}>
              <NavRow label="Home currency" value={currencyLabel} onPress={() => setCurrencyModalOpen(true)} />
              <Divider />
              <NavRow label="Default tip" value={tipLabel} onPress={() => setTipSheetOpen(true)} />
              <Divider />
              <View style={[styles.row, styles.switchRow]}>
                <Text style={styles.rowLabel}>Tip reminder</Text>
                <Switch
                  value={tipReminder === 'always'}
                  onValueChange={(v) => handleSetTipReminder(v ? 'always' : 'never')}
                  trackColor={{ true: C.accent, false: 'rgba(255,255,255,0.15)' }}
                  thumbColor="#fff"
                  style={styles.switch}
                />
              </View>
            </View>

            {!proLoading && (isPro ? (
              <>
                <Text style={styles.sectionLabel}>Subscription</Text>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Status</Text>
                    <Text style={[styles.rowValue, { color: C.accent, fontWeight: '600' }]}>Pro (Active)</Text>
                  </View>
                  <Divider />
                  <ActionRow label="Manage Subscription" onPress={() => Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')} />
                  <Divider />
                  <ActionRow
                    label="Restore Purchases"
                    onPress={async () => {
                      setRestoreMsg('Checking for purchases…');
                      setRestoreOpen(true);
                      const ok = await restore();
                      setRestoreMsg(ok ? 'Divi Pro restored.' : 'No purchases found to restore.');
                    }}
                  />
                  {__DEV__ && (<><Divider /><ActionRow label="[dev] Reset to Free" onPress={() => setResetProOpen(true)} /></>)}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Divi Pro</Text>
                <View style={styles.card}>
                  <ActionRow icon="star" label="Upgrade to Pro" onPress={() => router.push('/paywall')} accent />
                </View>
              </>
            ))}

            <Text style={styles.sectionLabel}>Widget</Text>
            <View style={styles.card}>
              <ActionRow icon="scan-outline" label="Add the Divi widget" onPress={showWidgetHelp} accent />
            </View>

            <Text style={styles.sectionLabel}>Feedback</Text>
            <View style={styles.card}>
              <ActionRow icon="mail-outline" label="Contact Us" onPress={() => Linking.openURL('mailto:jpjacobello@gmail.com?subject=Divi Feedback')} accent />
              <Divider />
              <ActionRow icon="heart-outline" label="Leave a Review" onPress={() => setComingSoon('App Store listing coming soon!')} accent />
            </View>

            <Text style={styles.sectionLabel}>About & Legal</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>App Version</Text>
                <Text style={styles.rowValue}>{APP_VERSION}</Text>
              </View>
              <Divider />
              <ActionRow label="Privacy Policy" onPress={() => setComingSoon('Privacy policy coming soon!')} accent />
              <Divider />
              <ActionRow label="Terms of Service" onPress={() => setComingSoon('Terms of service coming soon!')} accent />
            </View>
          </>
        )}
      </ScrollView>

      {/* Currency picker — rich list w/ flags, on the shared finger-follow sheet. */}
      <SwipeSheet
        visible={currencyModalOpen}
        onClose={() => setCurrencyModalOpen(false)}
        snap={['80%']}
        header={
          <>
            <Text style={styles.currencySheetTitle}>Home currency</Text>
            <Text style={styles.currencySheetHint}>Displays amounts everywhere (including shared links), and scanned foreign receipts convert to it.</Text>
          </>
        }
      >
        <SheetScrollView contentContainerStyle={[styles.currencyListContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {CURRENCIES.map((c) => {
            const active = currency === c.code;
            return (
              <TouchableOpacity key={c.code} style={styles.currencyOption} onPress={() => handleSetCurrency(c.code)} activeOpacity={0.7}>
                <Text style={styles.currencyFlag}>{c.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.currencyName, active && styles.currencyNameActive]}>{c.name}</Text>
                  <Text style={styles.currencyMeta}>{c.code} · {c.symbol}</Text>
                </View>
                {active && <Ionicons name="checkmark" size={20} color={C.accent} />}
              </TouchableOpacity>
            );
          })}
        </SheetScrollView>
      </SwipeSheet>

      <ActionSheet
        visible={tipSheetOpen}
        title="Default Tip"
        message="Applied automatically when a receipt has no tip."
        options={[
          { label: 'None', onPress: () => handleSetDefaultTip(null) },
          ...TIP_PRESETS.map((pct) => ({ label: `${Math.round(pct * 100)}%`, onPress: () => handleSetDefaultTip(pct) })),
        ]}
        onClose={() => setTipSheetOpen(false)}
      />
      <ActionSheet
        visible={resetProOpen}
        title="Reset to Free?"
        message="For testing only — removes Pro status."
        options={[{ label: 'Reset', destructive: true, onPress: () => devSetPro(false) }]}
        onClose={() => setResetProOpen(false)}
      />
      <ActionSheet
        visible={restoreOpen}
        title="Restore Purchases"
        message={restoreMsg}
        onClose={() => setRestoreOpen(false)}
      />
      <ActionSheet
        visible={!!comingSoon}
        title="Coming Soon"
        message={comingSoon ?? ''}
        onClose={() => setComingSoon(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1 },
  content: { paddingHorizontal: 20 },
  title: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.5, marginTop: 8, marginBottom: 4 },

  sectionLabel: {
    fontSize: 12.5, fontWeight: '600', color: C.dim, textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: 22, marginBottom: 8, marginLeft: 4,
  },
  card: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, minHeight: 52,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowIcon: { marginRight: 11 },
  // Fixed height + self-centered switch: with minHeight alone, the iOS switch's
  // 31.2pt intrinsic frame settles slightly low in the row.
  switchRow: { height: 52 },
  switch: { alignSelf: 'center' },
  rowLabel: { fontSize: 16, color: C.text, fontWeight: '500' },
  rowValue: { fontSize: 15, color: C.dim },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 16 },
  input: { fontSize: 16, color: C.text, paddingHorizontal: 16, paddingVertical: 15, minHeight: 52 },

  currencyBackdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  currencySheet: {
    backgroundColor: '#26262B', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingTop: 10, maxHeight: '78%',
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  currencyHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.24)', marginBottom: 16 },
  currencySheetTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  currencySheetHint: { fontSize: 12.5, color: C.dim, marginTop: 4, marginBottom: 8, lineHeight: 17 },
  currencyList: { marginTop: 2 },
  currencyListContent: { paddingHorizontal: 20 },
  currencyOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  currencyFlag: { fontSize: 24 },
  currencyName: { fontSize: 15.5, color: C.text, fontWeight: '500' },
  currencyNameActive: { color: C.text, fontWeight: '700' },
  currencyMeta: { fontSize: 12.5, color: C.dim, marginTop: 1 },
});
