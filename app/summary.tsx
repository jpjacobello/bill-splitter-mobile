import { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  FlatList, Alert, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '../components/Button';
import { colors } from '../theme';
import ReceiptPreviewSheet from '../components/ReceiptPreviewSheet';

const PERSON_COLORS = colors.person;
const getPersonColor = (index: number) => PERSON_COLORS[index % PERSON_COLORS.length];
import { useBillStore } from '../store/useBillStore';
import { calcSplit } from '../utils/calcSplit';
import { openVenmo } from '../utils/venmo';
import { PersonBreakdown } from '../types';
import { usePro } from '../hooks/usePro';
import { saveBillToHistory, getCashAppHandle, setCashAppHandle } from '../utils/proStorage';
import { formatCurrency } from '../utils/currency';


export default function SummaryScreen() {
  const router = useRouter();
  const { receipt, people, reset, receiptImageUri, paidById, setPaidById } = useBillStore();
  const { isPro } = usePro();
  const [showReceipt, setShowReceipt] = useState(false);
  const [showOriginalReceipt, setShowOriginalReceipt] = useState(false);
  const [previewPerson, setPreviewPerson] = useState<{ breakdown: PersonBreakdown; colorIndex: number } | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [cashRequestedIds, setCashRequestedIds] = useState<Set<string>>(new Set());

  if (!receipt) return null;

  const summary = calcSplit(people, receipt);

  const handleVenmo = (b: PersonBreakdown) => {
    openVenmo(b, receipt.merchantName, isPro);
    setRequestedIds((prev) => new Set(prev).add(b.person.id));
  };

  const handleCashApp = async (b: PersonBreakdown) => {
    let handle = await getCashAppHandle();
    if (!handle) {
      await new Promise<void>((resolve) => {
        Alert.prompt(
          'Your Cash App $cashtag',
          'Included in the copied text so friends know who to pay. Enter without the $.',
          [
            { text: 'Skip', style: 'cancel', onPress: () => resolve() },
            {
              text: 'Save',
              onPress: async (value?: string) => {
                if (value?.trim()) {
                  await setCashAppHandle(value.trim());
                  handle = value.trim().replace(/^\$/, '');
                }
                resolve();
              },
            },
          ],
          'plain-text'
        );
      });
    }
    const note = receipt.merchantName ? receipt.merchantName : 'your share';
    const handlePart = handle ? ` to $${handle}` : '';
    await Clipboard.setStringAsync(`Pay${handlePart} ${formatCurrency(b.totalOwed)} for ${note}`);
    setCashRequestedIds((prev) => new Set(prev).add(b.person.id));
    Linking.openURL('cashapp://').catch(() => Linking.openURL('https://cash.app'));
  };

  const handleStartOver = () => {
    Alert.alert(
      'Start Over?',
      'This will clear the current receipt and all assignments.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Over', style: 'destructive', onPress: async () => {
            if (isPro) {
              await saveBillToHistory({ merchantName: receipt.merchantName, people, receipt, receiptImageUri: receiptImageUri ?? undefined });
            }
            reset();
            router.replace('/');
          },
        },
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
              <Text style={styles.receiptTotalValue}>{formatCurrency(receipt.total)}</Text>
            </View>
            <View style={[
              styles.reconcileBadge,
              summary.reconciles ? styles.reconcileOk : styles.reconcileOff,
            ]}>
              <Text style={styles.reconcileText}>
                {summary.reconciles
                  ? '✓ Split matches receipt total'
                  : `⚠ Off by ${formatCurrency(Math.abs(summary.calculatedTotal - summary.receiptTotal))}`}
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
          const isHost = b.person.isHost;
          const personColor = getPersonColor(index);
          const hasPaid = b.person.id === paidById;

          const handlePaidChipPress = () => {
            Alert.alert(
              'Who paid?',
              'Select the person who paid the bill.',
              summary.people.map((p) => ({
                text: p.person.name,
                onPress: () => setPaidById(p.person.id),
              })).concat([{ text: 'Cancel', style: 'cancel' } as any])
            );
          };

          return (
            <View style={[styles.card, isHost && styles.hostCard]}>
              <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={30} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.03)' }]} />
              <View style={[styles.cardAccent, { backgroundColor: personColor }]} />
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <View style={styles.nameRow}>
                    <Text style={styles.personName}>{b.person.name}</Text>
                    {hasPaid && (
                      <TouchableOpacity style={styles.hostBadge} onPress={handlePaidChipPress}>
                        <Text style={styles.hostBadgeText}>paid ✎</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.itemCount}>
                    {b.assignedItems.length} item{b.assignedItems.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.totalOwed, { color: isHost ? colors.textMuted : personColor }]}>
                    {formatCurrency(b.totalOwed)}
                  </Text>
                  <View style={styles.inlineActions}>
                    <TouchableOpacity
                      style={styles.pdfBtn}
                      onPress={() => handlePersonShare(b, index)}
                    >
                      <Ionicons name="receipt-outline" size={18} color="#AEAEB2" />
                    </TouchableOpacity>
                    {!isHost && (
                      <>
                        <TouchableOpacity
                          style={[styles.venmoBtn, requestedIds.has(b.person.id) && styles.venmoBtnRequested]}
                          onPress={() => handleVenmo(b)}
                        >
                          <View style={styles.venmoLogo}>
                            <Text style={styles.venmoLogoText}>V</Text>
                          </View>
                          <Text style={[styles.venmoBtnText, requestedIds.has(b.person.id) && styles.venmoBtnTextRequested]}>
                            {requestedIds.has(b.person.id) ? 'Sent ✓' : 'Request'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cashBtn, cashRequestedIds.has(b.person.id) && styles.cashBtnCopied]}
                          onPress={() => handleCashApp(b)}
                        >
                          <Text style={[styles.cashBtnText, cashRequestedIds.has(b.person.id) && styles.cashBtnTextCopied]}>
                            {cashRequestedIds.has(b.person.id) ? '$ Copied' : '$ Cash'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.calculatedRow}>
              <Text style={styles.calculatedLabel}>Calculated total</Text>
              <Text style={styles.calculatedValue}>{formatCurrency(summary.calculatedTotal)}</Text>
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
        paidById={paidById}
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
        paidById={paidById}
      />


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },

  header: { marginBottom: 20, gap: 6 },
  merchant: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, marginBottom: 4 },
  receiptTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  receiptTotalLabel: { fontSize: 15, color: colors.textSecondary },
  receiptTotalValue: { fontSize: 17, fontWeight: '700', color: colors.text },
  reconcileBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  reconcileOk: { backgroundColor: 'rgba(62,173,116,0.18)' },
  reconcileOff: { backgroundColor: 'rgba(210,60,60,0.18)' },
  reconcileText: { fontSize: 13, fontWeight: '600', color: colors.text },
  unassignedBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  unassignedBadgeText: { fontSize: 13, fontWeight: '500', color: colors.amber },

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
  personName: { fontSize: 17, fontWeight: '700', color: colors.text },
  hostBadge: {
    backgroundColor: '#D8D8D8', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  hostBadgeText: { fontSize: 11, fontWeight: '700', color: '#000' },
  itemCount: { fontSize: 13, color: colors.textMuted },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  totalOwed: { fontSize: 24, fontWeight: '800', color: '#D0D0D0' },
  inlineActions: { flexDirection: 'row', gap: 6 },
  venmoBtn: {
    backgroundColor: 'rgba(61,149,206,0.20)', borderRadius: 10,
    height: 36, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1, borderColor: 'rgba(61,149,206,0.40)',
  },
  pdfBtn: {
    width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  venmoLogo: {
    width: 20, height: 20, borderRadius: 5,
    backgroundColor: 'rgba(61,149,206,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(61,149,206,0.30)',
  },
  venmoLogoText: { fontSize: 11, fontWeight: '900', color: '#3D95CE' },
  venmoBtnText: { color: '#3D95CE', fontSize: 13, fontWeight: '700' },
  venmoBtnRequested: {
    backgroundColor: 'rgba(62,173,116,0.15)',
    borderColor: 'rgba(62,173,116,0.35)',
  },
  venmoBtnTextRequested: { color: colors.green },

  cashBtn: {
    backgroundColor: 'rgba(0,214,79,0.15)', borderRadius: 10,
    height: 36, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1, borderColor: 'rgba(0,214,79,0.35)',
  },
  cashBtnCopied: {
    backgroundColor: 'rgba(62,173,116,0.15)',
    borderColor: 'rgba(62,173,116,0.35)',
  },
  cashBtnText: { fontSize: 13, fontWeight: '700', color: '#00D64F' },
  cashBtnTextCopied: { color: colors.green },

  footer: { gap: 10, marginTop: 4 },
  footerRow: { flexDirection: 'row', gap: 10 },
  footerBtn: {
    flex: 1, height: 52, backgroundColor: '#2C2C2E',
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  footerBtnSecondary: {},
  footerBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
  footerBtnTextSecondary: { color: colors.text },
  calculatedRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingBottom: 4,
  },
  calculatedLabel: { fontSize: 14, color: colors.textMuted },
  calculatedValue: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
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
