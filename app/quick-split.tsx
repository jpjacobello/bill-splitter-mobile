import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActionSheet from '../components/ActionSheet';
import AnimatedMoney from '../components/AnimatedMoney';
import Perforation from '../components/Perforation';
import { ui as C, moneyText } from '../theme';
import { useBillStore } from '../store/useBillStore';
import { Receipt } from '../types';
import { getVenmoHandle, setVenmoHandle } from '../utils/proStorage';
import { createSession } from '../services/billSession';
import { addSession } from '../utils/sessionStorage';
import { formatCurrency, getActiveCurrency, currencySymbol } from '../utils/currency';

import { WEB_BASE_URL } from '../utils/config';

const SAVED_NAME_KEY = 'savedHostName';
const HAS_LAUNCHED_KEY = 'hasLaunched';
const TIP_PRESETS = [0, 15, 18, 20];
const MIN_PEOPLE = 2;
const MAX_PEOPLE = 20;

function r2(n: number) { return Math.round(n * 100) / 100; }

export default function QuickSplitScreen() {
  const router = useRouter();
  const { reset, setHostName, addPerson, setReceipt, setActiveSessionId } = useBillStore();

  const [merchantName, setMerchantName] = useState('');
  const [total, setTotal] = useState('');
  const [tipPct, setTipPct] = useState(0);
  const [numPeople, setNumPeople] = useState(2);
  const [hostName, setHostNameLocal] = useState('You');
  const [sharing, setSharing] = useState(false);
  const [venmoOpen, setVenmoOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SAVED_NAME_KEY).then((name) => { if (name) setHostNameLocal(name); });
  }, []);

  const totalNum = parseFloat(total) || 0;
  const tipAmount = r2(totalNum * tipPct / 100);
  const grandTotal = r2(totalNum + tipAmount);
  const canSplit = grandTotal > 0;
  const perPerson = canSplit ? r2(grandTotal / numPeople) : 0;

  const adjustPeople = (delta: number) => {
    Haptics.selectionAsync();
    setNumPeople((prev) => Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, prev + delta)));
  };

  const buildReceipt = (assignedTo: string[]): Receipt => ({
    merchantName: merchantName.trim() || undefined,
    items: [{ id: 'equal-split', name: 'Equal split', price: r2(grandTotal - tipAmount), quantity: 1, assignedTo }],
    subtotal: r2(grandTotal - tipAmount),
    tax: 0, fees: 0, tip: tipAmount, total: grandTotal, tipIsFromReceipt: false,
  });

  const handleSplit = async () => {
    if (!canSplit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.multiSet([[SAVED_NAME_KEY, hostName], [HAS_LAUNCHED_KEY, 'true']]);
    reset();
    setHostName(hostName);
    for (let i = 2; i <= numPeople; i++) addPerson(`Person ${i}`);
    const { people: storePeople } = useBillStore.getState();
    setReceipt(buildReceipt(storePeople.map((p) => p.id)));
    router.replace('/summary');
  };

  const createAndShare = async (handle: string) => {
    if (!canSplit || sharing) return;
    setSharing(true);
    try {
      await AsyncStorage.multiSet([[SAVED_NAME_KEY, hostName], [HAS_LAUNCHED_KEY, 'true']]);
      const receipt = buildReceipt([]);
      const sessionId = await createSession(receipt, hostName, handle, {
        splitType: 'equal', peopleCount: numPeople, currency: getActiveCurrency(),
      });
      setActiveSessionId(sessionId);
      await addSession({ sessionId, merchantName: receipt.merchantName ?? '', createdAt: new Date().toISOString(), creatorVenmoHandle: handle });
      const url = `${WEB_BASE_URL}/split/${sessionId}`;
      await Share.share({ message: `${receipt.merchantName ? receipt.merchantName + ' — ' : ''}grab your share · ${formatCurrency(perPerson)} each`, url });
      if (router.canDismiss()) router.dismissAll();
      router.push('/activity?tab=live');
    } catch {
      setErrorOpen(true);
    } finally {
      setSharing(false);
    }
  };

  const handleShareLink = async () => {
    if (!canSplit || sharing) return;
    const handle = await getVenmoHandle();
    if (!handle) { setVenmoOpen(true); return; }
    createAndShare(handle);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <SymbolView name="chevron.left" size={20} tintColor={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quick Split</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TextInput
            style={styles.merchantInput}
            placeholder="Occasion (optional)"
            placeholderTextColor={C.faint}
            value={merchantName}
            onChangeText={setMerchantName}
            returnKeyType="done"
          />

          <Text style={styles.sectionLabel}>TOTAL</Text>
          <View style={styles.totalCard}>
            <Text style={styles.dollarSign}>{currencySymbol()}</Text>
            <TextInput
              style={styles.totalInput}
              placeholder="0.00"
              placeholderTextColor={C.faint}
              value={total}
              onChangeText={setTotal}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>

          <Text style={styles.sectionLabel}>TIP</Text>
          <View style={styles.tipRow}>
            {TIP_PRESETS.map((pct) => (
              <TouchableOpacity key={pct} style={[styles.tipPill, tipPct === pct && styles.tipPillActive]} onPress={() => setTipPct(pct)} activeOpacity={0.75}>
                <Text style={[styles.tipPillText, tipPct === pct && styles.tipPillTextActive]}>{pct === 0 ? 'No tip' : `${pct}%`}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>PEOPLE</Text>
          <View style={styles.peopleCard}>
            <TouchableOpacity style={[styles.counterBtn, numPeople <= MIN_PEOPLE && styles.counterBtnDisabled]} onPress={() => adjustPeople(-1)} disabled={numPeople <= MIN_PEOPLE} activeOpacity={0.7}>
              <SymbolView name="minus" size={20} tintColor={numPeople <= MIN_PEOPLE ? C.faint : C.text} />
            </TouchableOpacity>
            <View style={styles.counterCenter}>
              <Text style={styles.counterNum}>{numPeople}</Text>
              <Text style={styles.counterLabel}>people</Text>
            </View>
            <TouchableOpacity style={[styles.counterBtn, numPeople >= MAX_PEOPLE && styles.counterBtnDisabled]} onPress={() => adjustPeople(1)} disabled={numPeople >= MAX_PEOPLE} activeOpacity={0.7}>
              <SymbolView name="plus" size={20} tintColor={numPeople >= MAX_PEOPLE ? C.faint : C.text} />
            </TouchableOpacity>
          </View>

          {canSplit && (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>EACH PERSON OWES</Text>
              <AnimatedMoney value={perPerson} style={styles.previewAmount} duration={450} />
              <Perforation dots={26} />
              <Text style={styles.previewSub}>{formatCurrency(grandTotal)} ÷ {numPeople} people</Text>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.shareLinkBtn, (!canSplit || sharing) && styles.splitBtnDisabled]} onPress={handleShareLink} disabled={!canSplit || sharing} activeOpacity={canSplit ? 0.85 : 1}>
            <SymbolView name="link" size={18} tintColor={canSplit && !sharing ? C.bg : C.faint} />
            <Text style={[styles.shareLinkBtnText, (!canSplit || sharing) && styles.splitBtnTextDisabled]}>{sharing ? 'Creating link…' : 'Share a Link'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.splitTextBtn} onPress={handleSplit} disabled={!canSplit} activeOpacity={canSplit ? 0.7 : 1}>
            <Text style={[styles.splitTextBtnText, !canSplit && styles.splitBtnTextDisabled]}>Split it myself</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ActionSheet
        visible={venmoOpen}
        title="Your Venmo @handle"
        message="Friends need this to pay you back. Enter without the @."
        input={{ placeholder: 'venmo-handle', submitLabel: 'Save & Share', onSubmit: async (v) => { await setVenmoHandle(v); createAndShare(v.replace(/^@/, '')); } }}
        onClose={() => setVenmoOpen(false)}
      />
      <ActionSheet
        visible={errorOpen}
        title="Couldn't create link"
        message="Check your internet connection and try again."
        options={[{ label: 'Try Again', icon: 'refresh-outline', onPress: handleShareLink }]}
        onClose={() => setErrorOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  merchantInput: {
    height: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 14, paddingHorizontal: 16,
    fontSize: 15, color: C.text, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 24,
  },
  sectionLabel: { fontSize: 12.5, fontWeight: '700', color: C.faint, letterSpacing: 1.2, marginBottom: 10, marginLeft: 2 },
  totalCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 18, marginBottom: 24, height: 76,
  },
  dollarSign: { fontSize: 28, fontWeight: '400', color: C.dim, marginRight: 4 },
  totalInput: { flex: 1, fontSize: 38, fontWeight: '700', color: C.text, paddingVertical: 0, letterSpacing: -1 },

  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  tipPill: { flex: 1, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  tipPillActive: { backgroundColor: C.accent, borderColor: C.accent },
  tipPillText: { fontSize: 13.5, fontWeight: '600', color: C.dim },
  tipPillTextActive: { color: '#fff' },

  peopleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 8, marginBottom: 24, height: 82,
  },
  counterBtn: { width: 54, height: 54, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  counterBtnDisabled: { opacity: 0.3 },
  counterCenter: { flex: 1, alignItems: 'center' },
  counterNum: { fontSize: 40, fontWeight: '800', color: C.text, lineHeight: 44, letterSpacing: -1 },
  counterLabel: { fontSize: 12, color: C.dim, fontWeight: '500' },

  previewCard: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 22, alignItems: 'center' },
  previewLabel: { fontSize: 12, color: C.accent, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  previewAmount: { fontSize: 46, fontWeight: '800', color: C.text, letterSpacing: -1.4 },
  previewSub: { fontSize: 13.5, color: C.dim },

  footer: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg },
  splitBtnDisabled: { backgroundColor: C.card },
  splitBtnTextDisabled: { color: C.faint },
  shareLinkBtn: { height: 54, borderRadius: 15, backgroundColor: C.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareLinkBtnText: { fontSize: 16.5, fontWeight: '700', color: C.bg },
  splitTextBtn: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  splitTextBtnText: { fontSize: 15, fontWeight: '600', color: C.dim },
});
