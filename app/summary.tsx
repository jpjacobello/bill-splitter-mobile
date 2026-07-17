import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { MotiView } from 'moti';
import Perforation from '../components/Perforation';
import ReceiptPreviewSheet from '../components/ReceiptPreviewSheet';
import ShareableReceiptCard, { calcCardScale } from '../components/ShareableReceiptCard';
import { shareReceiptImage } from '../utils/shareCard';
import ActionSheet from '../components/ActionSheet';
import { VenmoLogo } from '../components/BrandLogos';
import { colors, ui as C, moneyText } from '../theme';
import { useBillStore } from '../store/useBillStore';
import { calcSplit } from '../utils/calcSplit';
import { openVenmo } from '../utils/venmo';
import { PersonBreakdown } from '../types';
import { usePro } from '../hooks/usePro';
import { saveBillToHistory } from '../utils/proStorage';
import { formatCurrency } from '../utils/currency';

const getPersonColor = (index: number) => colors.person[index % colors.person.length];

export default function SummaryScreen() {
  const router = useRouter();
  const { receipt, people, reset, receiptImageUri, paidById, setPaidById } = useBillStore();
  const { isPro } = usePro();
  const [showReceipt, setShowReceipt] = useState(false);
  const [showOriginalReceipt, setShowOriginalReceipt] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ breakdown: PersonBreakdown; colorIndex: number } | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [whoPaidOpen, setWhoPaidOpen] = useState(false);
  const shareCardRef = useRef<View>(null);

  // Capture + share once the off-screen card for shareTarget has painted.
  useEffect(() => {
    if (!shareTarget || !receipt) return;
    const t = setTimeout(async () => {
      await shareReceiptImage(shareCardRef, receipt.merchantName, shareTarget.breakdown.person.name);
      setShareTarget(null);
    }, 120);
    return () => clearTimeout(t);
  }, [shareTarget]);

  if (!receipt) return null;

  const summary = calcSplit(people, receipt);

  const handleVenmo = (b: PersonBreakdown) => {
    openVenmo(b, receipt.merchantName, isPro);
    setRequestedIds((prev) => new Set(prev).add(b.person.id));
  };

  const confirmStartOver = async () => {
    await saveBillToHistory({ merchantName: receipt.merchantName, people, receipt, receiptImageUri: receiptImageUri ?? undefined });
    reset();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 420 }}>

            <Text style={styles.eyebrow}>SUMMARY</Text>
            <Text style={styles.merchant}>{receipt.merchantName || 'The Bill'}</Text>

            {/* Receipt-framed card */}
            <View style={styles.receipt}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Receipt total</Text>
                <Text style={[styles.totalValue, moneyText]}>{formatCurrency(receipt.total)}</Text>
              </View>
              <View style={[styles.reconcile, summary.reconciles ? styles.recOk : styles.recOff]}>
                <SymbolView name={summary.reconciles ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'} size={13}
                  tintColor={summary.reconciles ? C.accent : '#E8B04B'} />
                <Text style={[styles.reconcileText, { color: summary.reconciles ? C.accent : '#E8B04B' }]}>
                  {summary.reconciles ? 'Split matches receipt total' : `Off by ${formatCurrency(Math.abs(summary.calculatedTotal - summary.receiptTotal))}`}
                </Text>
              </View>
              {summary.unassignedItems.length > 0 && (
                <Text style={styles.unassigned}>
                  {summary.unassignedItems.length} unassigned item{summary.unassignedItems.length !== 1 ? 's' : ''} not included
                </Text>
              )}

              <Perforation dots={32} />

              {summary.people.map((b, index) => {
                const isHost = b.person.isHost;
                const personColor = getPersonColor(index);
                const hasPaid = b.person.id === paidById;
                const requested = requestedIds.has(b.person.id);
                return (
                  <View key={b.person.id} style={styles.person}>
                    <View style={styles.personTop}>
                      <View style={styles.personLeft}>
                        <View style={[styles.dot, { backgroundColor: personColor }]} />
                        <View>
                          <View style={styles.nameRow}>
                            <Text style={styles.personName}>{b.person.name}</Text>
                            {hasPaid && (
                              <TouchableOpacity style={styles.paidChip} onPress={() => setWhoPaidOpen(true)} activeOpacity={0.7}>
                                <Text style={styles.paidChipText}>paid</Text>
                                <SymbolView name="pencil" size={9} tintColor={C.bg} />
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={styles.itemCount}>{b.assignedItems.length} item{b.assignedItems.length !== 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                      <Text style={[styles.owed, moneyText, { color: isHost ? C.dim : C.text }]}>{formatCurrency(b.totalOwed)}</Text>
                    </View>
                    <View style={styles.personActions}>
                      <TouchableOpacity style={styles.ghostBtn} onPress={() => setShareTarget({ breakdown: b, colorIndex: index })} activeOpacity={0.7}>
                        <SymbolView name="doc.text" size={14} tintColor={C.dim} />
                        <Text style={styles.ghostText}>Receipt</Text>
                      </TouchableOpacity>
                      {!isHost && (
                        <TouchableOpacity style={[styles.venmoBtn, requested && styles.venmoDone]} onPress={() => handleVenmo(b)} activeOpacity={0.85}>
                          {requested
                            ? <SymbolView name="checkmark" size={14} tintColor={C.accent} />
                            : <VenmoLogo size={16} />}
                          <Text style={[styles.venmoText, requested && { color: C.accent }]}>{requested ? 'Sent' : 'Request'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}

              <Perforation dots={32} />

              <View style={styles.totalRow}>
                <Text style={styles.calcLabel}>Calculated total</Text>
                <Text style={[styles.calcValue, moneyText]}>{formatCurrency(summary.calculatedTotal)}</Text>
              </View>
            </View>

            {/* Footer actions */}
            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.footerBtn} onPress={() => setShowOriginalReceipt(true)} activeOpacity={0.85}>
                <SymbolView name="photo" size={16} tintColor={C.text} />
                <Text style={styles.footerText}>Original</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerBtn} onPress={() => setShowReceipt(true)} activeOpacity={0.85}>
                <SymbolView name="square.and.arrow.up" size={16} tintColor={C.text} />
                <Text style={styles.footerText}>Share split</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.startOver} onPress={() => setStartOverOpen(true)} activeOpacity={0.7}>
              <Text style={styles.startOverText}>New split</Text>
            </TouchableOpacity>

          </MotiView>
        </ScrollView>
      </SafeAreaView>

      <ReceiptPreviewSheet visible={showReceipt} receipt={receipt} allPeople={summary.people} onClose={() => setShowReceipt(false)} showPeopleSummary paidById={paidById} />
      <ReceiptPreviewSheet visible={showOriginalReceipt} receipt={receipt} onClose={() => setShowOriginalReceipt(false)} />

      {/* Off-screen card captured for the native share sheet */}
      {shareTarget && (
        <View style={styles.offScreen} pointerEvents="none">
          <ShareableReceiptCard
            ref={shareCardRef}
            receipt={receipt}
            person={shareTarget.breakdown}
            scale={calcCardScale(shareTarget.breakdown.assignedItems.length)}
            paidById={paidById ?? undefined}
          />
        </View>
      )}

      <ActionSheet
        visible={startOverOpen}
        title="Start a new split?"
        message="This clears the current receipt and all assignments. It's saved to your history first."
        options={[{ label: 'New Split', icon: 'refresh-outline', destructive: true, onPress: confirmStartOver }]}
        onClose={() => setStartOverOpen(false)}
      />
      <ActionSheet
        visible={whoPaidOpen}
        title="Who paid?"
        message="Select the person who paid the bill."
        options={summary.people.map((p) => ({ label: p.person.name, icon: 'person-outline' as const, onPress: () => setPaidById(p.person.id) }))}
        onClose={() => setWhoPaidOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 60 },

  eyebrow: { fontSize: 12, fontWeight: '700', color: C.faint, letterSpacing: 1.4, marginLeft: 2 },
  merchant: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.4, marginTop: 4, marginBottom: 18 },

  receipt: { backgroundColor: C.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: C.line },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontSize: 15, color: C.dim, fontWeight: '500' },
  totalValue: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  reconcile: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  recOk: { backgroundColor: C.accentDim },
  recOff: { backgroundColor: 'rgba(232,176,75,0.12)' },
  reconcileText: { fontSize: 12.5, fontWeight: '600' },
  unassigned: { fontSize: 12.5, color: '#E8B04B', marginTop: 8 },

  person: { paddingVertical: 12 },
  personTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  personLeft: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personName: { fontSize: 16, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  paidChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.accent, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  paidChipText: { fontSize: 10.5, fontWeight: '700', color: C.bg },
  itemCount: { fontSize: 12.5, color: C.dim, marginTop: 2 },
  owed: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  personActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingLeft: 20 },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.line },
  ghostText: { fontSize: 13, fontWeight: '600', color: C.dim },
  venmoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 11, backgroundColor: '#3D95CE' },
  venmoDone: { backgroundColor: C.accentDim },
  venmoText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  calcLabel: { fontSize: 13, color: C.dim, fontWeight: '500' },
  calcValue: { fontSize: 15, fontWeight: '700', color: C.text },

  footerRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  footerText: { fontSize: 14.5, fontWeight: '700', color: C.text },
  startOver: { alignItems: 'center', paddingVertical: 16, marginTop: 6 },
  startOverText: { fontSize: 14.5, fontWeight: '600', color: C.dim },
  offScreen: { position: 'absolute', top: -9999, left: -9999 },
});
