import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TextInput,
  TouchableOpacity, ScrollView, Keyboard, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActionSheet from '../../components/ActionSheet';
import { useBillStore } from '../../store/useBillStore';
import { usePro } from '../../hooks/usePro';
import { colors } from '../../theme';
import { getVenmoHandle, setVenmoHandle, getCashAppHandle, setCashAppHandle, getCurrency, setCurrency } from '../../utils/proStorage';
import { CURRENCIES, currencyInfo, setActiveCurrency } from '../../utils/currency';

const SAVED_NAME_KEY = 'savedHostName';
import { DEFAULT_TIP_KEY, TIP_REMINDER_KEY, TipReminderMode } from '../../utils/tipPrefs';
const TIP_PRESETS = [0.15, 0.18, 0.20, 0.25];
const APP_VERSION = '1.0.0';

// ── Reusable primitives ────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function SettingRow({
  label,
  value,
  icon,
  onPress,
  chevron = true,
  last = false,
  labelColor,
  children,
}: {
  label: string;
  value?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
  labelColor?: string;
  children?: React.ReactNode;
}) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <>
      <Wrapper
        style={styles.row}
        onPress={onPress}
        activeOpacity={0.65}
      >
        <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : undefined]}>{label}</Text>
        <View style={styles.rowRight}>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {icon ? <Ionicons name={icon} size={18} color="#555" /> : null}
          {chevron && onPress ? <Ionicons name="chevron-forward" size={16} color="#444" style={{ marginLeft: 2 }} /> : null}
        </View>
      </Wrapper>
      {!last && <View style={styles.separator} />}
      {children}
    </>
  );
}

function GroupCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { setHostName } = useBillStore();
  const { isPro, loading: proLoading, activatePro, deactivatePro } = usePro();
  const [resetProOpen, setResetProOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [defaultTip, setDefaultTip] = useState<number | null>(null);
  const [tipReminder, setTipReminder] = useState<TipReminderMode>('always');
  const [venmoHandle, setVenmoHandleState] = useState('');
  const [cashHandle, setCashHandleState] = useState('');
  const [venmoSaved, setVenmoSaved] = useState(false);
  const [cashSaved, setCashSaved] = useState(false);
  const [nameExpanded, setNameExpanded] = useState(false);
  const [venmoExpanded, setVenmoExpanded] = useState(false);
  const [cashExpanded, setCashExpanded] = useState(false);
  const [tipExpanded, setTipExpanded] = useState(false);
  const [tipReminderExpanded, setTipReminderExpanded] = useState(false);
  const [currency, setCurrencyState] = useState('USD');
  const [currencyExpanded, setCurrencyExpanded] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const venmoInputRef = useRef<TextInput>(null);
  const cashInputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.multiGet([SAVED_NAME_KEY, DEFAULT_TIP_KEY, TIP_REMINDER_KEY]).then(([savedName, savedTip, savedReminder]) => {
      if (savedName[1]) setName(savedName[1]);
      setDefaultTip(savedTip[1] !== null ? parseFloat(savedTip[1]) : null);
      setTipReminder((savedReminder[1] as TipReminderMode) ?? 'always');
    });
    getVenmoHandle().then((h) => { if (h) setVenmoHandleState(h); });
    getCashAppHandle().then((h) => { if (h) setCashHandleState(h); });
    getCurrency().then(setCurrencyState);
  }, []);

  const handleSetCurrency = async (code: string) => {
    setCurrencyState(code);
    setActiveCurrency(code);
    await setCurrency(code);
    setCurrencyExpanded(false);
  };

  const handleSaveVenmo = async () => {
    const trimmed = venmoHandle.trim().replace(/^@/, '');
    if (!trimmed) return;
    Keyboard.dismiss();
    await setVenmoHandle(trimmed);
    setVenmoSaved(true);
    setVenmoExpanded(false);
    setTimeout(() => setVenmoSaved(false), 2000);
  };

  const handleSaveCash = async () => {
    const trimmed = cashHandle.trim().replace(/^\$/, '');
    if (!trimmed) return;
    Keyboard.dismiss();
    await setCashAppHandle(trimmed);
    setCashSaved(true);
    setCashExpanded(false);
    setTimeout(() => setCashSaved(false), 2000);
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    await AsyncStorage.setItem(SAVED_NAME_KEY, trimmed);
    setHostName(trimmed);
    setNameSaved(true);
    setNameExpanded(false);
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

  const handleSetTipReminder = async (mode: TipReminderMode) => {
    setTipReminder(mode);
    await AsyncStorage.setItem(TIP_REMINDER_KEY, mode);
  };

  const currencyLabel = `${currencyInfo(currency).flag} ${currency}`;
  const tipLabel = defaultTip === null ? 'None' : `${Math.round(defaultTip * 100)}%`;
  const tipReminderLabel = tipReminder === 'always' ? 'Always' : 'Never';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile ── */}
        <SectionHeader label="Profile" />
        <GroupCard>
          <SettingRow
            label="Your Name"
            value={name || 'Not set'}
            last
            onPress={() => {
              setNameExpanded((v) => !v);
              setTimeout(() => nameInputRef.current?.focus(), 80);
            }}
          />
          {nameExpanded && (
            <View style={styles.expandedArea}>
              <View style={styles.nameRow}>
                <TextInput
                  ref={nameInputRef}
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
            </View>
          )}
        </GroupCard>

        {/* ── Payment ── */}
        <SectionHeader label="Payment" />
        <GroupCard>
          <SettingRow
            label="Venmo @handle"
            value={venmoHandle ? `@${venmoHandle}` : 'Not set'}
            onPress={() => {
              setVenmoExpanded((v) => !v);
              setCashExpanded(false);
              setTimeout(() => venmoInputRef.current?.focus(), 80);
            }}
          />
          {venmoExpanded && (
            <View style={styles.expandedArea}>
              <View style={styles.nameRow}>
                <TextInput
                  ref={venmoInputRef}
                  style={styles.nameInput}
                  value={venmoHandle}
                  onChangeText={(t) => { setVenmoHandleState(t); setVenmoSaved(false); }}
                  placeholder="yourhandle"
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveVenmo}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, venmoSaved && styles.saveBtnDone, !venmoHandle.trim() && styles.saveBtnDisabled]}
                  onPress={handleSaveVenmo}
                  disabled={!venmoHandle.trim()}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.saveBtnText, venmoSaved && styles.saveBtnTextDone]}>
                    {venmoSaved ? '✓' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={styles.separator} />
          <SettingRow
            label="Cash App $cashtag"
            value={cashHandle ? `$${cashHandle}` : 'Not set'}
            last
            onPress={() => {
              setCashExpanded((v) => !v);
              setVenmoExpanded(false);
              setTimeout(() => cashInputRef.current?.focus(), 80);
            }}
          />
          {cashExpanded && (
            <View style={styles.expandedArea}>
              <View style={styles.nameRow}>
                <TextInput
                  ref={cashInputRef}
                  style={styles.nameInput}
                  value={cashHandle}
                  onChangeText={(t) => { setCashHandleState(t); setCashSaved(false); }}
                  placeholder="yourcashtag"
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveCash}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, cashSaved && styles.saveBtnDone, !cashHandle.trim() && styles.saveBtnDisabled]}
                  onPress={handleSaveCash}
                  disabled={!cashHandle.trim()}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.saveBtnText, cashSaved && styles.saveBtnTextDone]}>
                    {cashSaved ? '✓' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </GroupCard>

        {/* ── Bill Preferences ── */}
        <SectionHeader label="Bill Preferences" />
        <GroupCard>
          <SettingRow
            label="Currency"
            value={currencyLabel}
            onPress={() => { setCurrencyExpanded((v) => !v); setTipExpanded(false); setTipReminderExpanded(false); }}
          />
          {currencyExpanded && (
            <View style={styles.expandedArea}>
              <Text style={styles.expandedHint}>Used to display amounts everywhere, including shared bill links.</Text>
              <View style={styles.currencyChips}>
                {CURRENCIES.map((c) => (
                  <TouchableOpacity
                    key={c.code}
                    style={[styles.currencyChip, currency === c.code && styles.tipChipActive]}
                    onPress={() => handleSetCurrency(c.code)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.tipChipText, currency === c.code && styles.tipChipTextActive]}>
                      {c.flag} {c.code} {c.symbol}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          <View style={styles.separator} />
          <SettingRow
            label="Default Tip"
            value={tipLabel}
            onPress={() => { setTipExpanded((v) => !v); setTipReminderExpanded(false); setCurrencyExpanded(false); }}
          />
          {tipExpanded && (
            <View style={styles.expandedArea}>
              <Text style={styles.expandedHint}>Applied automatically when a receipt has no tip.</Text>
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
            </View>
          )}
          <View style={styles.separator} />
          <SettingRow
            label="Tip Reminder"
            value={tipReminderLabel}
            last
            onPress={() => { setTipReminderExpanded((v) => !v); setTipExpanded(false); }}
          />
          {tipReminderExpanded && (
            <View style={styles.expandedArea}>
              {([
                { mode: 'always' as TipReminderMode, title: 'Always', desc: 'Show a warning whenever no tip is detected on a receipt.' },
                { mode: 'never' as TipReminderMode, title: 'Never', desc: 'Never show a tip warning.' },
              ]).map(({ mode, title, desc }) => (
                <TouchableOpacity
                  key={mode}
                  style={styles.radioRow}
                  onPress={() => handleSetTipReminder(mode)}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioTextGroup}>
                    <Text style={styles.radioTitle}>{title}</Text>
                    <Text style={styles.radioDesc}>{desc}</Text>
                  </View>
                  {tipReminder === mode && (
                    <Ionicons name="checkmark" size={18} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </GroupCard>

        {/* ── Subscription ── */}
        <SectionHeader label="Subscription" />
        {!proLoading && (
          isPro ? (
            <>
              <GroupCard>
                <TouchableOpacity
                  style={styles.proActiveRow}
                  activeOpacity={1}
                  onLongPress={() => setResetProOpen(true)}
                  delayLongPress={800}
                >
                  <Text style={styles.rowLabel}>Status</Text>
                  <View style={styles.rowRight}>
                    <Text style={styles.proActiveValue}>Pro (Active)</Text>
                  </View>
                </TouchableOpacity>
              </GroupCard>

              <SectionHeader label="Subscription Management" />
              <GroupCard>
                <SettingRow
                  label="Manage Subscription"
                  chevron={false}
                  labelColor="#3B82F6"
                  onPress={() => Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')}
                />
                <SettingRow
                  label="Restore Purchases"
                  chevron={false}
                  labelColor="#3B82F6"
                  last
                  onPress={() => setRestoreOpen(true)}
                />
              </GroupCard>
              <Text style={styles.subFootnote}>You can manage your subscription in the App Store.</Text>
            </>
          ) : (
            <View style={styles.proCard}>
              <Text style={styles.proCardTitle}>Divi Pro</Text>
              <View style={styles.proFeatureList}>
                {[
                  'Bill history — revisit every past split',
                  'Saved groups — reload your usual crew',
                  'No "Split with Divi" in Venmo notes',
                ].map((f) => (
                  <View key={f} style={styles.proFeatureRow}>
                    <Text style={styles.proFeatureCheck}>✓</Text>
                    <Text style={styles.proFeatureText}>{f}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.upgradeBtn}
                activeOpacity={0.8}
                onPress={activatePro}
              >
                <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {/* ── Feedback ── */}
        <SectionHeader label="Feedback" />
        <GroupCard>
          <SettingRow
            label="Contact Us"
            icon="mail-outline"
            onPress={() => Linking.openURL('mailto:jpjacobello@gmail.com?subject=Divi Feedback')}
          />
          <SettingRow
            label="Leave a Review"
            icon="heart-outline"
            last
            onPress={() => setComingSoon('App Store listing coming soon!')}
          />
        </GroupCard>

        {/* ── About & Legal ── */}
        <SectionHeader label="About & Legal" />
        <GroupCard>
          <SettingRow
            label="App Version"
            value={APP_VERSION}
            chevron={false}
          />
          <SettingRow
            label="Privacy Policy"
            onPress={() => setComingSoon('Privacy policy coming soon!')}
          />
          <SettingRow
            label="Terms of Service"
            last
            onPress={() => setComingSoon('Terms of service coming soon!')}
          />
        </GroupCard>

      </ScrollView>

      <ActionSheet
        visible={resetProOpen}
        title="Reset to Free?"
        message="For testing only — removes Pro status."
        options={[{ label: 'Reset', destructive: true, onPress: deactivatePro }]}
        onClose={() => setResetProOpen(false)}
      />
      <ActionSheet
        visible={restoreOpen}
        title="Restore Purchases"
        message="No purchases found to restore."
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
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.textDim },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120 },

  sectionHeader: {
    fontSize: 12, fontWeight: '600', color: '#666',
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginBottom: 8, marginTop: 28, marginLeft: 4,
  },

  card: {
    backgroundColor: '#1C1C1C',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  rowLabel: { fontSize: 15, color: colors.textDim, fontWeight: '400' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 15, color: '#666' },
  separator: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)', marginLeft: 16 },

  expandedArea: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  expandedHint: {
    fontSize: 12, color: '#555', marginBottom: 12, marginTop: 12,
  },
  nameRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12 },
  nameInput: {
    flex: 1, height: 44,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, paddingHorizontal: 14,
    fontSize: 15, color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  saveBtn: {
    height: 44, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  saveBtnDone: {
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderColor: 'rgba(22,163,74,0.40)',
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  saveBtnTextDone: { color: '#16A34A' },

  radioRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  radioTextGroup: { flex: 1, gap: 2, paddingRight: 12 },
  radioTitle: { fontSize: 15, color: colors.textDim, fontWeight: '400' },
  radioDesc: { fontSize: 12, color: '#555' },

  tipChips: { flexDirection: 'row', gap: 8 },
  currencyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  currencyChip: {
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  tipChip: {
    flex: 1, paddingVertical: 8,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  tipChipActive: { backgroundColor: 'rgba(220,220,220,0.95)', borderColor: 'rgba(255,255,255,0.40)' },
  tipChipText: { fontSize: 13, fontWeight: '600', color: '#888' },
  tipChipTextActive: { color: '#000' },

  proActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  proActiveValue: { fontSize: 15, color: '#22C55E', fontWeight: '600' },
  subFootnote: {
    fontSize: 12, color: '#555', marginTop: 8, marginLeft: 4,
  },

  proCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 18,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)',
    gap: 14,
  },
  proCardTitle: { fontSize: 18, fontWeight: '800', color: colors.textDim },
  proFeatureList: { gap: 8 },
  proFeatureRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  proFeatureCheck: { fontSize: 14, fontWeight: '700', color: '#22C55E', width: 16 },
  proFeatureText: { fontSize: 14, color: '#AAA', flex: 1 },
  upgradeBtn: {
    backgroundColor: colors.btnPrimary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  upgradeBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
