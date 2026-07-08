import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActionSheet from '../components/ActionSheet';
import { colors } from '../theme';
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

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

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
    AsyncStorage.getItem(SAVED_NAME_KEY).then((name) => {
      if (name) setHostNameLocal(name);
    });
  }, []);

  const totalNum = parseFloat(total) || 0;
  const tipAmount = r2(totalNum * tipPct / 100);
  const grandTotal = r2(totalNum + tipAmount);
  const canSplit = grandTotal > 0;
  const perPerson = canSplit ? r2(grandTotal / numPeople) : 0;

  const adjustPeople = (delta: number) => {
    setNumPeople((prev) => Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, prev + delta)));
  };

  const buildReceipt = (assignedTo: string[]): Receipt => ({
    merchantName: merchantName.trim() || undefined,
    items: [{
      id: 'equal-split',
      name: 'Equal split',
      price: r2(grandTotal - tipAmount),
      quantity: 1,
      assignedTo,
    }],
    subtotal: r2(grandTotal - tipAmount),
    tax: 0,
    fees: 0,
    tip: tipAmount,
    total: grandTotal,
    tipIsFromReceipt: false,
  });

  const handleSplit = async () => {
    if (!canSplit) return;

    await AsyncStorage.multiSet([
      [SAVED_NAME_KEY, hostName],
      [HAS_LAUNCHED_KEY, 'true'],
    ]);

    reset();
    setHostName(hostName);
    for (let i = 2; i <= numPeople; i++) {
      addPerson(`Person ${i}`);
    }

    const { people: storePeople } = useBillStore.getState();
    const allIds = storePeople.map((p) => p.id);

    setReceipt(buildReceipt(allIds));
    router.replace('/summary');
  };

  const createAndShare = async (handle: string) => {
    if (!canSplit || sharing) return;
    setSharing(true);
    try {
      await AsyncStorage.multiSet([
        [SAVED_NAME_KEY, hostName],
        [HAS_LAUNCHED_KEY, 'true'],
      ]);

      const receipt = buildReceipt([]);
      const sessionId = await createSession(receipt, hostName, handle, {
        splitType: 'equal',
        peopleCount: numPeople,
        currency: getActiveCurrency(),
      });
      setActiveSessionId(sessionId);
      await addSession({
        sessionId,
        merchantName: receipt.merchantName ?? '',
        createdAt: new Date().toISOString(),
        creatorVenmoHandle: handle,
      });

      const url = `${WEB_BASE_URL}/split/${sessionId}`;
      await Share.share({
        message: `${receipt.merchantName ? receipt.merchantName + ' — ' : ''}grab your share · ${formatCurrency(perPerson)} each`,
        url,
      });

      if (router.canDismiss()) router.dismissAll();
      router.push('/activity');
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick Split</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Occasion */}
        <TextInput
          style={styles.merchantInput}
          placeholder="Occasion (optional)"
          placeholderTextColor={colors.textMuted}
          value={merchantName}
          onChangeText={setMerchantName}
          returnKeyType="done"
        />

        {/* Total */}
        <Text style={styles.sectionLabel}>Total</Text>
        <View style={styles.totalCard}>
          <Text style={styles.dollarSign}>{currencySymbol()}</Text>
          <TextInput
            style={styles.totalInput}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            value={total}
            onChangeText={setTotal}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </View>

        {/* Tip */}
        <Text style={styles.sectionLabel}>Tip</Text>
        <View style={styles.tipRow}>
          {TIP_PRESETS.map((pct) => (
            <TouchableOpacity
              key={pct}
              style={[styles.tipPill, tipPct === pct && styles.tipPillActive]}
              onPress={() => setTipPct(pct)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tipPillText, tipPct === pct && styles.tipPillTextActive]}>
                {pct === 0 ? 'No tip' : `${pct}%`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* People */}
        <Text style={styles.sectionLabel}>People</Text>
        <View style={styles.peopleCard}>
          <TouchableOpacity
            style={[styles.counterBtn, numPeople <= MIN_PEOPLE && styles.counterBtnDisabled]}
            onPress={() => adjustPeople(-1)}
            disabled={numPeople <= MIN_PEOPLE}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={22} color={numPeople <= MIN_PEOPLE ? colors.textDisabled : colors.text} />
          </TouchableOpacity>
          <View style={styles.counterCenter}>
            <Text style={styles.counterNum}>{numPeople}</Text>
            <Text style={styles.counterLabel}>people</Text>
          </View>
          <TouchableOpacity
            style={[styles.counterBtn, numPeople >= MAX_PEOPLE && styles.counterBtnDisabled]}
            onPress={() => adjustPeople(1)}
            disabled={numPeople >= MAX_PEOPLE}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color={numPeople >= MAX_PEOPLE ? colors.textDisabled : colors.text} />
          </TouchableOpacity>
        </View>

        {/* Per-person preview */}
        {canSplit && (
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Each person owes</Text>
            <Text style={styles.previewAmount}>{formatCurrency(perPerson)}</Text>
            <Text style={styles.previewSub}>
              {formatCurrency(grandTotal)} ÷ {numPeople} people
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.shareLinkBtn, (!canSplit || sharing) && styles.splitBtnDisabled]}
          onPress={handleShareLink}
          disabled={!canSplit || sharing}
          activeOpacity={canSplit ? 0.85 : 1}
        >
          <Ionicons name="link-outline" size={18} color={canSplit && !sharing ? '#000' : colors.textMuted} />
          <Text style={[styles.shareLinkBtnText, (!canSplit || sharing) && styles.splitBtnTextDisabled]}>
            {sharing ? 'Creating link…' : 'Share a Link'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.splitTextBtn}
          onPress={handleSplit}
          disabled={!canSplit}
          activeOpacity={canSplit ? 0.7 : 1}
        >
          <Text style={[styles.splitTextBtnText, !canSplit && styles.splitBtnTextDisabled]}>
            Split it myself
          </Text>
        </TouchableOpacity>
      </View>

      <ActionSheet
        visible={venmoOpen}
        title="Your Venmo @handle"
        message="Friends need this to pay you back. Enter without the @."
        input={{
          placeholder: 'venmo-handle',
          submitLabel: 'Save & Share',
          onSubmit: async (v) => {
            await setVenmoHandle(v);
            createAndShare(v.replace(/^@/, ''));
          },
        }}
        onClose={() => setVenmoOpen(false)}
      />
      <ActionSheet
        visible={errorOpen}
        title="Couldn't create link"
        message="Check your internet connection and try again."
        options={[{ label: 'Try Again', icon: 'refresh-outline', onPress: handleShareLink }]}
        onClose={() => setErrorOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
  },
  backBtn: { padding: 8, marginRight: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  merchantInput: {
    height: 48, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, fontSize: 15,
    color: colors.text, backgroundColor: colors.surface, marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: colors.textMuted,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10,
  },
  totalCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 18, marginBottom: 24, height: 72,
  },
  dollarSign: { fontSize: 28, fontWeight: '300', color: colors.textSecondary, marginRight: 4 },
  totalInput: { flex: 1, fontSize: 36, fontWeight: '600', color: colors.text, paddingVertical: 0 },

  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  tipPill: {
    flex: 1, height: 40, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  tipPillActive: { backgroundColor: colors.green, borderColor: colors.green },
  tipPillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tipPillTextActive: { color: '#fff' },

  peopleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 8, marginBottom: 24, height: 80,
  },
  counterBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  counterBtnDisabled: { opacity: 0.3 },
  counterCenter: { flex: 1, alignItems: 'center' },
  counterNum: { fontSize: 40, fontWeight: '700', color: colors.text, lineHeight: 44 },
  counterLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },

  previewCard: {
    backgroundColor: 'rgba(62,173,116,0.10)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(62,173,116,0.25)',
    padding: 20, alignItems: 'center',
  },
  previewLabel: {
    fontSize: 13, color: colors.green, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  previewAmount: { fontSize: 48, fontWeight: '700', color: colors.text, marginBottom: 4 },
  previewSub: { fontSize: 14, color: colors.textMuted },

  footer: {
    paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg,
  },
  splitBtnDisabled: { backgroundColor: colors.surface },
  splitBtnTextDisabled: { color: colors.textMuted },
  shareLinkBtn: {
    height: 54, borderRadius: 14, backgroundColor: colors.btnPrimary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  shareLinkBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
  splitTextBtn: {
    height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  splitTextBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
});
