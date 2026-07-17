import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, ScrollView, StyleSheet, Text,
  TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import SwipeSheet, { SheetScrollView } from './SwipeSheet';
import { VenmoLogo } from './BrandLogos';
import ReceiptPreviewSheet from './ReceiptPreviewSheet';
import ShareableReceiptCard, { calcCardScale } from './ShareableReceiptCard';
import { shareReceiptImage } from '../utils/shareCard';
import { colors, ui as C, moneyText } from '../theme';
import { calcSplit } from '../utils/calcSplit';
import { openVenmo } from '../utils/venmo';
import { getEmoji } from '../utils/buildReceiptHtml';
import { formatCurrency } from '../utils/currency';
import { Person, Receipt, PersonBreakdown } from '../types';

const getPersonColor = (index: number) => colors.person[index % colors.person.length];

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Confetti ────────────────────────────────────────────────────────────────
// Lightweight one-shot burst; no dependency. Skips motion when reduced.

const CONFETTI_COLORS = [C.accent, colors.person[0], colors.person[1], colors.person[2], '#F5B44A'];

function ConfettiPiece({ index, width, run }: { index: number; width: number; run: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  const startX = useMemo(() => Math.random() * width, [width]);
  const drift = useMemo(() => (Math.random() - 0.5) * 90, []);
  const rot = useMemo(() => Math.random() * 360, []);
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const delay = useMemo(() => Math.random() * 240, []);
  const size = useMemo(() => 6 + Math.random() * 5, []);

  useEffect(() => {
    if (!run) return;
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1, duration: 1400 + Math.random() * 700, delay,
      easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, [run]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: -14, left: startX,
        width: size, height: size * 1.5, borderRadius: 2, backgroundColor: color,
        opacity: t.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }) },
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: [`${rot}deg`, `${rot + 220}deg`] }) },
        ],
      }}
    />
  );
}

function Confetti({ run, width }: { run: boolean; width: number }) {
  return (
    <View style={styles.confettiLayer} pointerEvents="none">
      {Array.from({ length: 26 }).map((_, i) => (
        <ConfettiPiece key={i} index={i} width={width} run={run} />
      ))}
    </View>
  );
}

// ─── Sheet ───────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  receipt: Receipt;
  people: Person[];
  isPro: boolean;
  paidById?: string | null;
  onClose: () => void;
  onFixReceipt: () => void;
  onDone: () => void;
  celebrate: boolean;
};

export default function CompletionSheet({ visible, receipt, people, isPro, paidById, onClose, onFixReceipt, onDone, celebrate }: Props) {
  const { width } = useWindowDimensions();
  const [runConfetti, setRunConfetti] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [showShare, setShowShare] = useState(false);
  const cardRef = useRef<View>(null);

  const summary = useMemo(() => calcSplit(people, receipt), [people, receipt]);

  // Default to the first person in the list (the first avatar shown).
  useEffect(() => {
    if (!visible) return;
    setSelectedId(people[0]?.id ?? '');
    setRequestedIds(new Set());
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Confetti only when the screen says to celebrate (first auto-pop per receipt).
    if (celebrate) {
      setRunConfetti(true);
      const t = setTimeout(() => setRunConfetti(false), 2400);
      return () => clearTimeout(t);
    }
    setRunConfetti(false);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedIndex = people.findIndex((p) => p.id === selectedId);
  const selected = summary.people[selectedIndex];
  const otherCharges = selected ? summary.people[selectedIndex].taxShare + selected.feesShare + selected.tipShare : 0;

  // Tip is nudged early on the assign screen, so the completion sheet only flags
  // a genuine reconciliation gap (item totals not matching the receipt total).
  const gate = !summary.reconciles
    ? { text: `Split is off by ${formatCurrency(Math.abs(summary.calculatedTotal - summary.receiptTotal))}`, action: 'Edit' as const }
    : null;

  const handleVenmo = (b: PersonBreakdown) => {
    openVenmo(b, receipt.merchantName, isPro);
    setRequestedIds((prev) => new Set(prev).add(b.person.id));
  };

  // Capture the selected person's receipt card and hand it to the native share
  // sheet (iMessage, copy, save, etc.). No intermediate preview — the sheet
  // already shows their receipt inline.
  const handleShareReceipt = () => {
    if (!selected) return;
    shareReceiptImage(cardRef, receipt.merchantName, selected.person.name);
  };

  // Guard against an accidental tap — starting over clears everything.
  const confirmStartOver = () => {
    Alert.alert(
      'Start a new split?',
      'This clears the current receipt and all assignments and returns Home. Your split is saved to history first.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'New Split', style: 'destructive', onPress: onDone },
      ],
    );
  };

  return (
    <SwipeSheet
      visible={visible}
      onClose={onClose}
      header={
        <>
          {/* Only mount when celebrating — otherwise resting pieces show as stray
              confetti bits pinned to the top of the modal on every reopen. */}
          {runConfetti && <Confetti run={runConfetti} width={width} />}
          <View style={styles.top}>
            <Text style={styles.eyebrow}>SPLIT COMPLETE</Text>
            <Text style={[styles.total, moneyText]}>
              {formatCurrency(receipt.total)} · {people.length} way{people.length !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.sub}>Tap a person to see their share</Text>
          </View>
        </>
      }
    >
      <View style={styles.bodyPad}>
        {gate && (
          <TouchableOpacity
            style={styles.banner}
            onPress={onFixReceipt}
            activeOpacity={0.8}
          >
            <Ionicons name="warning-outline" size={16} color={colors.amber} />
            <Text style={styles.bannerText}>{gate.text}</Text>
            <Text style={styles.bannerAction}>{gate.action} ›</Text>
          </TouchableOpacity>
        )}

        {/* person tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabs}
        >
          {people.map((p, i) => {
            const color = getPersonColor(i);
            const active = p.id === selectedId;
            return (
              <TouchableOpacity key={p.id} style={styles.tab} onPress={() => { setSelectedId(p.id); Haptics.selectionAsync(); }} activeOpacity={0.8}>
                <View style={[
                  styles.tabAv,
                  { backgroundColor: color + '33', borderColor: color + '99' },
                  active && { borderColor: color, borderWidth: 2 },
                ]}>
                  <Text style={[styles.tabAvText, { color }]}>{initials(p.name)}</Text>
                </View>
                <Text style={[styles.tabName, active && { color: C.text }]} numberOfLines={1}>
                  {p.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* selected person's receipt */}
        {selected && (
          <View style={styles.card}>
            <SheetScrollView style={styles.itemsScroll} showsVerticalScrollIndicator={false}>
              {selected.assignedItems.map((a, i) => {
                const shared = a.item.assignedTo.length > 1;
                return (
                  <View key={a.item.id + i} style={styles.line}>
                    <Text style={styles.lineLabel} numberOfLines={1}>
                      {getEmoji(a.item.name)} {a.item.name.replace(/\s*\(\d+\)\s*$/, '').trim()}
                      {shared && <Text style={styles.shareTag}>  1/{a.item.assignedTo.length}</Text>}
                    </Text>
                    <Text style={[styles.lineValue, moneyText]}>{formatCurrency(a.share)}</Text>
                  </View>
                );
              })}
            </SheetScrollView>

            <View style={styles.dash} />
            <View style={styles.line}>
              <Text style={styles.lineLabel}>Tax, fees &amp; tip</Text>
              <Text style={[styles.lineValue, moneyText]}>{formatCurrency(otherCharges)}</Text>
            </View>
            <View style={styles.dash} />
            <View style={styles.line}>
              <Text style={styles.owesLabel}>{selected.person.name}{selected.person.id === paidById ? ' paid' : ' owes'}</Text>
              <Text style={[styles.owesValue, moneyText]}>{formatCurrency(selected.totalOwed)}</Text>
            </View>
          </View>
        )}

        {/* actions */}
        {selected && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={handleShareReceipt}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={18} color={C.text} />
            </TouchableOpacity>
            {selected.person.id === paidById || selected.person.isHost ? (
              <TouchableOpacity style={styles.shareBtn} onPress={() => setShowShare(true)} activeOpacity={0.85}>
                <Ionicons name="share-outline" size={18} color={C.bg} />
                <Text style={styles.shareBtnText}>Share the split</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.venmoBtn, requestedIds.has(selected.person.id) && styles.venmoDone]}
                onPress={() => handleVenmo(selected)}
                activeOpacity={0.85}
              >
                {requestedIds.has(selected.person.id)
                  ? <Ionicons name="checkmark" size={18} color={C.accent} />
                  : <VenmoLogo size={17} />}
                <Text style={[styles.venmoText, requestedIds.has(selected.person.id) && { color: C.accent }]}>
                  {requestedIds.has(selected.person.id) ? 'Requested' : `Request ${formatCurrency(selected.totalOwed)}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.startOver} onPress={confirmStartOver} activeOpacity={0.7}>
          <Text style={styles.startOverText}>New split</Text>
        </TouchableOpacity>

        <ReceiptPreviewSheet
          visible={showShare}
          receipt={receipt}
          allPeople={summary.people}
          showPeopleSummary
          paidById={paidById ?? undefined}
          onClose={() => setShowShare(false)}
        />

        {/* Off-screen card captured for the native share sheet */}
        {selected && (
          <View style={styles.offScreen} pointerEvents="none">
            <ShareableReceiptCard
              ref={cardRef}
              receipt={receipt}
              person={selected}
              scale={calcCardScale(selected.assignedItems.length)}
              paidById={paidById ?? undefined}
            />
          </View>
        )}
      </View>
    </SwipeSheet>
  );
}

const styles = StyleSheet.create({
  bodyPad: { paddingHorizontal: 20, paddingBottom: 8 },
  confettiLayer: { position: 'absolute', top: 0, left: -20, right: -20, height: 260 },

  top: { alignItems: 'center', marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: '800', color: C.accent, letterSpacing: 1.4 },
  total: { fontSize: 23, fontWeight: '800', color: C.text, letterSpacing: -0.4, marginTop: 5 },
  sub: { fontSize: 13, color: C.dim, marginTop: 3 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 14,
    backgroundColor: 'rgba(245,180,74,0.12)', borderWidth: 1, borderColor: 'rgba(245,180,74,0.35)',
  },
  bannerText: { flex: 1, fontSize: 12.5, color: '#EBCB94', fontWeight: '500' },
  bannerAction: { fontSize: 12.5, fontWeight: '800', color: colors.amber },

  tabsScroll: { marginHorizontal: -20, marginBottom: 16 },
  tabs: { paddingHorizontal: 20, gap: 16, alignItems: 'center' },
  tab: { alignItems: 'center', gap: 5, width: 54 },
  tabAv: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  tabAvText: { fontSize: 14, fontWeight: '800' },
  tabName: { fontSize: 11.5, fontWeight: '600', color: C.faint },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    borderWidth: 1, borderColor: C.line, padding: 15, marginBottom: 14,
  },
  itemsScroll: { maxHeight: 180 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 4 },
  lineLabel: { flex: 1, fontSize: 13.5, color: C.dim, marginRight: 10 },
  shareTag: { color: C.faint, fontSize: 12 },
  lineValue: { fontSize: 13.5, color: C.text, fontWeight: '600' },
  dash: { height: 1, backgroundColor: C.line, marginVertical: 8 },
  owesLabel: { fontSize: 16, fontWeight: '800', color: C.text },
  owesValue: { fontSize: 16, fontWeight: '800', color: C.accent },

  actions: { flexDirection: 'row', gap: 10 },
  ghostBtn: {
    width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: C.line,
  },
  venmoBtn: {
    flex: 1, height: 52, borderRadius: 15, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#3D95CE',
  },
  venmoDone: { backgroundColor: C.accentDim },
  venmoText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  shareBtn: {
    flex: 1, height: 52, borderRadius: 15, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.text,
  },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: C.bg },

  startOver: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  startOverText: { fontSize: 14, fontWeight: '600', color: C.dim },

  offScreen: { position: 'absolute', top: -9999, left: -9999 },
});
