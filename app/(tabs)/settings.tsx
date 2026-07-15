import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, Linking, Modal, Pressable, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Host, Form, Section, TextField, Switch, LabeledContent, Button, Label,
  Text as UIText,
} from '@expo/ui/swift-ui';
import { onTapGesture } from '@expo/ui/swift-ui/modifiers';
import ActionSheet from '../../components/ActionSheet';
import { useBillStore } from '../../store/useBillStore';
import { usePro } from '../../hooks/usePro';
import { colors, ui as C } from '../../theme';
import { getVenmoHandle, setVenmoHandle, getCashAppHandle, setCashAppHandle, getCurrency, setCurrency } from '../../utils/proStorage';
import { CURRENCIES, currencyInfo, setActiveCurrency } from '../../utils/currency';

const SAVED_NAME_KEY = 'savedHostName';
import { DEFAULT_TIP_KEY, TIP_REMINDER_KEY, TipReminderMode } from '../../utils/tipPrefs';
const TIP_PRESETS = [0.15, 0.18, 0.20, 0.25];
const APP_VERSION = '1.0.0';

// Native iOS Settings via @expo/ui (SwiftUI Form). Data/handlers preserved from
// the previous custom RN implementation; only the presentation is now native.
export default function SettingsScreen() {
  const router = useRouter();
  const { setHostName } = useBillStore();
  const { isPro, loading: proLoading, restore, devSetPro } = usePro();
  const insets = useSafeAreaInsets();

  const [resetProOpen, setResetProOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('Checking for purchases…');
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  // TextField is uncontrolled: seed values feed defaultValue (set once after
  // storage loads), refs hold live edits, persisted on blur/submit. Never drive
  // defaultValue/key from live state — that remounts the field mid-typing.
  const [seedName, setSeedName] = useState('');
  const [seedVenmo, setSeedVenmo] = useState('');
  const [seedCash, setSeedCash] = useState('');
  const [loaded, setLoaded] = useState(false);
  const nameRef = useRef('');
  const venmoRef = useRef('');
  const cashRef = useRef('');

  const [defaultTip, setDefaultTip] = useState<number | null>(null);
  const [tipReminder, setTipReminder] = useState<TipReminderMode>('always');
  const [currency, setCurrencyState] = useState('USD');
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [tipSheetOpen, setTipSheetOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [savedName, savedTip, savedReminder] = await AsyncStorage.multiGet([SAVED_NAME_KEY, DEFAULT_TIP_KEY, TIP_REMINDER_KEY]);
      const v = await getVenmoHandle();
      const c = await getCashAppHandle();
      const cur = await getCurrency();
      const nm = savedName[1] ?? ''; setSeedName(nm); nameRef.current = nm;
      const vv = v ?? ''; setSeedVenmo(vv); venmoRef.current = vv;
      const cv = c ?? ''; setSeedCash(cv); cashRef.current = cv;
      setDefaultTip(savedTip[1] !== null ? parseFloat(savedTip[1]) : null);
      setTipReminder((savedReminder[1] as TipReminderMode) ?? 'always');
      setCurrencyState(cur);
      setLoaded(true); // mount the Form only once every field's seed is ready
    })();
  }, []);

  const persistName = async (raw: string) => {
    const trimmed = raw.trim();
    setSeedName(trimmed);
    if (!trimmed) return;
    await AsyncStorage.setItem(SAVED_NAME_KEY, trimmed);
    setHostName(trimmed);
  };
  const persistVenmo = async (raw: string) => {
    const trimmed = raw.trim().replace(/^@/, '');
    setSeedVenmo(trimmed);
    if (trimmed) await setVenmoHandle(trimmed);
  };
  const persistCash = async (raw: string) => {
    const trimmed = raw.trim().replace(/^\$/, '');
    setSeedCash(trimmed);
    if (trimmed) await setCashAppHandle(trimmed);
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

  const currencyLabel = `${currencyInfo(currency).flag} ${currency}`;
  const tipLabel = defaultTip === null ? 'None' : `${Math.round(defaultTip * 100)}%`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {loaded && (
      <Host style={styles.host} colorScheme="dark" useViewportSizeMeasurement>
        <Form>
          <Section title="Profile">
            <TextField
              defaultValue={seedName}
              placeholder="Your name"
              autocorrection={false}
              onChangeText={(t) => { nameRef.current = t; }}
              onChangeFocus={(focused) => { if (!focused) persistName(nameRef.current); }}
              onSubmit={persistName}
            />
          </Section>

          <Section title="Payment">
            <TextField
              defaultValue={seedVenmo}
              placeholder="Venmo @handle"
              autocorrection={false}
              onChangeText={(t) => { venmoRef.current = t; }}
              onChangeFocus={(focused) => { if (!focused) persistVenmo(venmoRef.current); }}
              onSubmit={persistVenmo}
            />
            <TextField
              defaultValue={seedCash}
              placeholder="Cash App $cashtag"
              autocorrection={false}
              onChangeText={(t) => { cashRef.current = t; }}
              onChangeFocus={(focused) => { if (!focused) persistCash(cashRef.current); }}
              onSubmit={persistCash}
            />
          </Section>

          <Section title="Bill Preferences">
            <LabeledContent label="Currency" modifiers={[onTapGesture(() => setCurrencyModalOpen(true))]}>
              <UIText>{currencyLabel}</UIText>
            </LabeledContent>
            <LabeledContent label="Default Tip" modifiers={[onTapGesture(() => setTipSheetOpen(true))]}>
              <UIText>{tipLabel}</UIText>
            </LabeledContent>
            <Switch
              value={tipReminder === 'always'}
              label="Tip Reminder"
              color={C.accent}
              onValueChange={(v) => handleSetTipReminder(v ? 'always' : 'never')}
            />
          </Section>

          {!proLoading && (isPro ? (
            <Section title="Subscription" footer="You can manage your subscription in the App Store.">
              <LabeledContent label="Status" modifiers={[onTapGesture(() => setResetProOpen(true))]}>
                <UIText>Pro (Active)</UIText>
              </LabeledContent>
              <Button label="Manage Subscription" onPress={() => Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')} />
              <Button
                label="Restore Purchases"
                onPress={async () => {
                  setRestoreMsg('Checking for purchases…');
                  setRestoreOpen(true);
                  const ok = await restore();
                  setRestoreMsg(ok ? 'Divi Pro restored.' : 'No purchases found to restore.');
                }}
              />
            </Section>
          ) : (
            <Section title="Divi Pro">
              <Label title="Bill history — revisit every past split" systemImage="checkmark" />
              <Label title="Saved groups — reload your usual crew" systemImage="checkmark" />
              <Label title="No “Split with Divi” in Venmo notes" systemImage="checkmark" />
              <Button label="Upgrade to Pro" onPress={() => router.push('/paywall')} />
            </Section>
          ))}

          <Section title="Feedback">
            <Button label="Contact Us" systemImage="envelope" onPress={() => Linking.openURL('mailto:jpjacobello@gmail.com?subject=Divi Feedback')} />
            <Button label="Leave a Review" systemImage="heart" onPress={() => setComingSoon('App Store listing coming soon!')} />
          </Section>

          <Section title="About & Legal">
            <LabeledContent label="App Version"><UIText>{APP_VERSION}</UIText></LabeledContent>
            <Button label="Privacy Policy" onPress={() => setComingSoon('Privacy policy coming soon!')} />
            <Button label="Terms of Service" onPress={() => setComingSoon('Terms of service coming soon!')} />
          </Section>
        </Form>
      </Host>
      )}

      {/* Currency picker — kept as the existing RN sheet (rich list w/ flags). */}
      <Modal
        visible={currencyModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCurrencyModalOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.currencyBackdrop} onPress={() => setCurrencyModalOpen(false)}>
          <Pressable style={[styles.currencySheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.currencyHandle} />
            <Text style={styles.currencySheetTitle}>Currency</Text>
            <Text style={styles.currencySheetHint}>Used to display amounts everywhere, including shared bill links.</Text>
            <ScrollView style={styles.currencyList} showsVerticalScrollIndicator={false}>
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
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  host: { flex: 1 },

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
  currencyOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  currencyFlag: { fontSize: 24 },
  currencyName: { fontSize: 15.5, color: C.text, fontWeight: '500' },
  currencyNameActive: { color: C.text, fontWeight: '700' },
  currencyMeta: { fontSize: 12.5, color: C.dim, marginTop: 1 },
});
