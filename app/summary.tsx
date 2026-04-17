import { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  FlatList, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const PERSON_COLORS = ['#4F8EF7','#F7874F','#A855F7','#22C55E','#F43F5E','#14B8A6','#EAB308','#EC4899'];
const getPersonColor = (index: number) => PERSON_COLORS[index % PERSON_COLORS.length];
import Button from '../components/Button';
import ReceiptPreviewSheet from '../components/ReceiptPreviewSheet';
import { useBillStore } from '../store/useBillStore';
import { calcSplit } from '../utils/calcSplit';
import { openVenmo } from '../utils/venmo';
import { PersonBreakdown } from '../types';


export default function SummaryScreen() {
  const router = useRouter();
  const { receipt, people } = useBillStore();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showOriginalReceipt, setShowOriginalReceipt] = useState(false);
  const [previewPerson, setPreviewPerson] = useState<{ breakdown: PersonBreakdown; colorIndex: number } | null>(null);

  if (!receipt) return null;

  const summary = calcSplit(people, receipt);

  const toggleExpand = (id: string) => {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleVenmo = (b: PersonBreakdown) => {
    openVenmo(b, receipt.merchantName);
  };

  const handleStartOver = () => {
    Alert.alert(
      'Start Over?',
      'This will clear the current receipt and all assignments.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Over', style: 'destructive', onPress: () => router.replace('/') },
      ]
    );
  };

  const handlePersonShare = (b: PersonBreakdown, colorIndex: number) => {
    setPreviewPerson({ breakdown: b, colorIndex });
  };

return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        data={summary.people}
        keyExtractor={(b) => b.person.id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <View style={styles.header}>
            {receipt.merchantName && (
              <Text style={styles.merchant}>{receipt.merchantName}</Text>
            )}
            <Text style={styles.title}>Summary</Text>
            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Receipt total</Text>
              <Text style={styles.receiptTotalValue}>${receipt.total.toFixed(2)}</Text>
            </View>
            <View style={[
              styles.reconcileBadge,
              summary.reconciles ? styles.reconcileOk : styles.reconcileOff,
            ]}>
              <Text style={styles.reconcileText}>
                {summary.reconciles
                  ? '✓ Split matches receipt total'
                  : `⚠ Off by $${Math.abs(summary.calculatedTotal - summary.receiptTotal).toFixed(2)}`}
              </Text>
            </View>
            {summary.unassignedItems.length > 0 && (
              <View style={styles.unassignedBadge}>
                <Text style={styles.unassignedBadgeText}>
                  ⚠ {summary.unassignedItems.length} unassigned item{summary.unassignedItems.length !== 1 ? 's' : ''} not included
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item: b, index }) => {
          const isExpanded = expanded.includes(b.person.id);
          const isHost = b.person.isHost;
          const personColor = getPersonColor(index);

          return (
            <TouchableOpacity
              style={[styles.card, isHost && styles.hostCard]}
              onPress={() => toggleExpand(b.person.id)}
              activeOpacity={0.85}
            >
              <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={30} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.03)' }]} />
              {/* Left color accent */}
              <View style={[styles.cardAccent, { backgroundColor: personColor }]} />
              {/* Card header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <View style={styles.nameRow}>
                    <Text style={styles.personName}>{b.person.name}</Text>
                    {isHost && (
                      <View style={styles.hostBadge}>
                        <Text style={styles.hostBadgeText}>paid</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.itemCount}>
                    {b.assignedItems.length} item{b.assignedItems.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.totalOwed, { color: isHost ? '#888' : personColor }]}>
                    ${b.totalOwed.toFixed(2)}
                  </Text>
                  <Text style={styles.expandHint}>{isExpanded ? '▲' : '▼'}</Text>
                </View>
              </View>

              {/* Expanded breakdown */}
              {isExpanded && (
                <View style={styles.breakdown}>
                  <View style={styles.breakdownDivider} />
                  {b.assignedItems.map(({ item, share }, i) => (
                    <View key={i} style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.breakdownValue}>${share.toFixed(2)}</Text>
                    </View>
                  ))}
                  <View style={styles.breakdownSpacer} />
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Subtotal</Text>
                    <Text style={styles.breakdownValue}>${b.subtotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Tax</Text>
                    <Text style={styles.breakdownValue}>${b.taxShare.toFixed(2)}</Text>
                  </View>
                  {b.feesShare > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Fees & Surcharges</Text>
                      <Text style={styles.breakdownValue}>${b.feesShare.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Tip</Text>
                    <Text style={styles.breakdownValue}>${b.tipShare.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                    <Text style={styles.breakdownTotalLabel}>Total owed</Text>
                    <Text style={styles.breakdownTotalValue}>${b.totalOwed.toFixed(2)}</Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.actions}>
                    <View style={styles.primaryActions}>
                      <TouchableOpacity
                        style={styles.pdfBtn}
                        onPress={() => {
                          handlePersonShare(b, index);
                        }}
                      >
                        <Ionicons name="receipt-outline" size={22} color="#999" />
                      </TouchableOpacity>
                      {!isHost && (
                        <TouchableOpacity
                          style={styles.venmoBtn}
                          onPress={() => handleVenmo(b)}
                        >
                          <View style={styles.venmoLogo}>
                            <Text style={styles.venmoLogoText}>V</Text>
                          </View>
                          <Text style={styles.venmoBtnText}>Request on Venmo</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.calculatedRow}>
              <Text style={styles.calculatedLabel}>Calculated total</Text>
              <Text style={styles.calculatedValue}>${summary.calculatedTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.footerBtn}
                onPress={() => {
                  setShowOriginalReceipt(true);
                }}
              >
                <Ionicons name="receipt-outline" size={18} color="#D0D0D0" style={{ opacity: 0.8 }} />
                <Text style={styles.footerBtnText}>Original Receipt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerBtn}
                onPress={() => setShowReceipt(true)}
              >
                <Ionicons name="share-outline" size={18} color="#D0D0D0" style={{ opacity: 0.8 }} />
                <Text style={styles.footerBtnText}>Share Split</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.startOverBtn} onPress={handleStartOver} activeOpacity={0.75}>
              <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={20} />
              <View style={[StyleSheet.absoluteFill, styles.startOverGlass]} />
              <Text style={styles.startOverText}>Start Over</Text>
            </TouchableOpacity>
          </View>
        }
      />
      <ReceiptPreviewSheet
        visible={showReceipt}
        receipt={receipt}
        allPeople={summary.people}
        onClose={() => setShowReceipt(false)}
        showPeopleSummary
      />
      <ReceiptPreviewSheet
        visible={showOriginalReceipt}
        receipt={receipt}
        onClose={() => setShowOriginalReceipt(false)}
      />
      <ReceiptPreviewSheet
        visible={previewPerson !== null}
        receipt={receipt}
        person={previewPerson ?? undefined}
        onClose={() => setPreviewPerson(null)}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#151515' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },

  header: { marginBottom: 20, gap: 6 },
  merchant: { fontSize: 13, fontWeight: '600', color: '#777', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 32, fontWeight: '800', color: '#D0D0D0', marginBottom: 4 },
  receiptTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  receiptTotalLabel: { fontSize: 15, color: '#B0B0B0' },
  receiptTotalValue: { fontSize: 17, fontWeight: '700', color: '#D0D0D0' },
  reconcileBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  reconcileOk: { backgroundColor: '#0A2E1A' },
  reconcileOff: { backgroundColor: '#2E0A0A' },
  reconcileText: { fontSize: 13, fontWeight: '600', color: '#D0D0D0' },
  unassignedBadge: {
    backgroundColor: '#2A1F00', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  unassignedBadgeText: { fontSize: 13, fontWeight: '500', color: '#F59E0B' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18,
    padding: 16, paddingLeft: 20, marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  hostCard: { borderColor: 'rgba(220,220,220,0.35)' },
  cardAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
    borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personName: { fontSize: 17, fontWeight: '700', color: '#D0D0D0' },
  hostBadge: {
    backgroundColor: '#D8D8D8', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  hostBadgeText: { fontSize: 11, fontWeight: '700', color: '#000' },
  itemCount: { fontSize: 13, color: '#777' },
  cardRight: { alignItems: 'flex-end', gap: 2 },
  totalOwed: { fontSize: 24, fontWeight: '800', color: '#D0D0D0' },
  expandHint: { fontSize: 11, color: '#888' },

  breakdown: { marginTop: 12 },
  breakdownDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.13)', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  breakdownLabel: { fontSize: 14, color: '#B0B0B0', flex: 1, marginRight: 8 },
  breakdownValue: { fontSize: 14, color: '#D0D0D0', fontWeight: '500' },
  breakdownSpacer: { height: 8 },
  breakdownTotal: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.13)',
    marginTop: 6, paddingTop: 10,
  },
  breakdownTotalLabel: { fontSize: 15, fontWeight: '700', color: '#D0D0D0' },
  breakdownTotalValue: { fontSize: 15, fontWeight: '700', color: '#D0D0D0' },

  actions: { marginTop: 14, gap: 8 },
  primaryActions: { flexDirection: 'row', gap: 8 },
  venmoBtn: {
    flex: 1, backgroundColor: 'rgba(61,149,206,0.20)', borderRadius: 12,
    height: 48, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: 'rgba(61,149,206,0.40)',
  },
  pdfBtn: {
    width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  venmoLogo: {
    width: 26, height: 26, borderRadius: 6,
    backgroundColor: 'rgba(61,149,206,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(61,149,206,0.30)',
  },
  venmoLogoText: { fontSize: 14, fontWeight: '900', color: '#3D95CE' },
  venmoBtnText: { color: '#3D95CE', fontSize: 15, fontWeight: '700' },

  footer: { gap: 10, marginTop: 4 },
  footerRow: { flexDirection: 'row', gap: 10 },
  footerBtn: {
    flex: 1, height: 52, backgroundColor: '#2E2E2E',
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  footerBtnSecondary: {},
  footerBtnText: { fontSize: 15, fontWeight: '600', color: '#D0D0D0' },
  footerBtnTextSecondary: { color: '#D0D0D0' },
  calculatedRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingBottom: 4,
  },
  calculatedLabel: { fontSize: 14, color: '#888' },
  calculatedValue: { fontSize: 14, fontWeight: '600', color: '#D0D0D0' },
  startOverBtn: {
    height: 36, borderRadius: 10, overflow: 'hidden',
    alignSelf: 'center', paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  startOverGlass: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
  },
  startOverText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.30)', zIndex: 1 },
});
