import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Linking, Modal, Pressable, TouchableOpacity, Animated, Alert } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSwipeDismiss } from '../../hooks/useSwipeDismiss';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Host, Form, Section, TextField, Switch, LabeledContent, Button,
  Text as UIText,
} from '@expo/ui/swift-ui';
import { buttonStyle } from '@expo/ui/swift-ui/modifiers';
import ActionSheet from '../../components/ActionSheet';
import { useBillStore } from '../../store/useBillStore';
import { usePro } from '../../hooks/usePro';
import { colors, ui as C } from '../../theme';
import { getVenmoHandle, setVenmoHandle, getCurrency, setCurrency } from '../../utils/proStorage';
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

  // TextField is uncontrolled: seed values feed defaultValue once (set after
  // storage loads, Form gated on `loaded`) so the field never remounts mid-typing.
  // beta.9 has no blur/submit event, so we persist on each change.
  const [seedName, setSeedName] = useState('');
  const [seedVenmo, setSeedVenmo] = useState('');
  const [loaded, setLoaded] = useState(false);

  const [defaultTip, setDefaultTip] = useState<number | null>(null);
  const [tipReminder, setTipReminder] = useState<TipReminderMode>('always');
  const [currency, setCurrencyState] = useState('USD');
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [tipSheetOpen, setTipSheetOpen] = useState(false);
  const currencySwipe = useSwipeDismiss(() => setCurrencyModalOpen(false));
  useEffect(() => { if (currencyModalOpen) currencySwipe.reset(); }, [currencyModalOpen]);

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
      setLoaded(true); // mount the Form only once every field's seed is ready
    })();
  }, []);

  const persistName = async (raw: string) => {
    const trimmed = raw.trim();
    setSeedName(trimmed);
    // Persist the cleared state too — early-returning on empty meant deleting
    // the field silently reverted to the old saved value.
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
    // Always write (empty clears it) — skipping on empty resurrected the old handle.
    await setVenmoHandle(trimmed);
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
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* marginBottom clears the floating tab bar so the last rows scroll into view */}
      {loaded && (
      <Host style={[styles.host, { marginBottom: insets.bottom + 76 }]} colorScheme="dark" useViewportSizeMeasurement>
        <Form>
          <Section title="Profile">
            <TextField defaultValue={seedName} placeholder="Your name" autocorrection={false} multiline={false} allowNewlines={false} onChangeText={persistName} />
          </Section>

          <Section title="Payment">
            <TextField defaultValue={seedVenmo} placeholder="Venmo @handle" autocorrection={false} multiline={false} allowNewlines={false} onChangeText={persistVenmo} />
          </Section>

          <Section title="Bill Preferences">
            {/* Button + plain style = the whole row is tappable, not just the text. */}
            <Button onPress={() => setCurrencyModalOpen(true)} modifiers={[buttonStyle('plain')]}>
              <LabeledContent label="Home currency"><UIText>{currencyLabel}</UIText></LabeledContent>
            </Button>
            <Button onPress={() => setTipSheetOpen(true)} modifiers={[buttonStyle('plain')]}>
              <LabeledContent label="Default Tip"><UIText>{tipLabel}</UIText></LabeledContent>
            </Button>
            <Switch
              value={tipReminder === 'always'}
              label="Tip Reminder"
              color={C.accent}
              onValueChange={(v) => handleSetTipReminder(v ? 'always' : 'never')}
            />
          </Section>

          {!proLoading && (isPro ? (
            <Section title="Subscription">
              <Button onPress={() => setResetProOpen(true)} modifiers={[buttonStyle('plain')]}>
                <LabeledContent label="Status"><UIText>Pro (Active)</UIText></LabeledContent>
              </Button>
              <Button onPress={() => Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')}>Manage Subscription</Button>
              <Button
                onPress={async () => {
                  setRestoreMsg('Checking for purchases…');
                  setRestoreOpen(true);
                  const ok = await restore();
                  setRestoreMsg(ok ? 'Divi Pro restored.' : 'No purchases found to restore.');
                }}
              >Restore Purchases</Button>
            </Section>
          ) : (
            <Section title="Divi Pro">
              <Button onPress={() => router.push('/paywall')}>Upgrade to Pro</Button>
            </Section>
          ))}

          <Section title="Widget">
            <Button systemImage="plus.viewfinder" onPress={showWidgetHelp}>Add the Divi widget</Button>
          </Section>

          <Section title="Feedback">
            <Button systemImage="envelope" onPress={() => Linking.openURL('mailto:jpjacobello@gmail.com?subject=Divi Feedback')}>Contact Us</Button>
            <Button systemImage="heart" onPress={() => setComingSoon('App Store listing coming soon!')}>Leave a Review</Button>
          </Section>

          <Section title="About & Legal">
            <LabeledContent label="App Version"><UIText>{APP_VERSION}</UIText></LabeledContent>
            <Button onPress={() => setComingSoon('Privacy policy coming soon!')}>Privacy Policy</Button>
            <Button onPress={() => setComingSoon('Terms of service coming soon!')}>Terms of Service</Button>
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
          <Animated.View
            style={[styles.currencySheet, { paddingBottom: insets.bottom + 8, transform: [{ translateY: currencySwipe.dragTranslate }] }]}
          >
            {/* Inner Pressable blocks tap-through to the backdrop without stealing
                the pan gesture (onStartShouldSetResponder did steal it). Drag the
                header to dismiss; the list below scrolls normally. */}
            <Pressable onPress={() => {}}>
              <PanGestureHandler {...currencySwipe.pan}>
                <View>
                  <View style={styles.currencyHandle} />
                  <Text style={styles.currencySheetTitle}>Home currency</Text>
                  <Text style={styles.currencySheetHint}>Displays amounts everywhere (including shared links), and scanned foreign receipts convert to it.</Text>
                </View>
              </PanGestureHandler>
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
          </Animated.View>
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
