import { useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BillHistoryEntry } from '../types';
import { calcSplit } from '../utils/calcSplit';
import { formatCurrency } from '../utils/currency';
import { colors, moneyText } from '../theme';
import ReceiptPreviewSheet from './ReceiptPreviewSheet';

const getPersonColor = (i: number) => colors.person[i % colors.person.length];

// Tap a past bill in Activity to open this: per-person breakdown, the original
// receipt photo (pinch-to-zoom), and share of the digitized receipt. Recovered
// from the old standalone history screen.
export default function BillDetailSheet({
  entry, onClose, onRequestDelete,
}: {
  entry: BillHistoryEntry | null;
  onClose: () => void;
  onRequestDelete: (entry: BillHistoryEntry) => void;
}) {
  return (
    <Modal
      visible={entry !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {entry && <Detail entry={entry} onClose={onClose} onDelete={() => onRequestDelete(entry)} />}
    </Modal>
  );
}

function Detail({ entry, onClose, onDelete }: { entry: BillHistoryEntry; onClose: () => void; onDelete: () => void }) {
  const [showPhoto, setShowPhoto] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const summary = calcSplit(entry.people, entry.receipt);
  const dateStr = new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-down" size={24} color={colors.textDim} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{entry.merchantName || 'Bill Split'}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowShare(true)} style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          {entry.receiptImageUri ? (
            <TouchableOpacity style={styles.photoThumb} onPress={() => setShowPhoto(true)} activeOpacity={0.8}>
              <Image source={{ uri: entry.receiptImageUri }} style={styles.photoThumbImg} />
              <View style={styles.photoThumbOverlay}><Ionicons name="expand-outline" size={10} color="#fff" /></View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onDelete} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.dateRow}>
          <Text style={styles.date}>{dateStr}</Text>
          {entry.receiptImageUri && (
            <TouchableOpacity onPress={onDelete} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={18} color={colors.textDisabled} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Receipt total</Text>
          <Text style={[styles.totalValue, moneyText]}>{formatCurrency(entry.receipt.total)}</Text>
        </View>

        {summary.people.map((b, index) => {
          const isHost = b.person.isHost;
          const color = getPersonColor(index);
          return (
            <View key={b.person.id} style={[styles.personCard, isHost && styles.personCardHost]}>
              <View style={[styles.accent, { backgroundColor: color }]} />
              <View style={styles.personInner}>
                <View style={styles.nameRow}>
                  <Text style={styles.personName}>{b.person.name}</Text>
                  {isHost && <View style={styles.hostBadge}><Text style={styles.hostBadgeText}>paid</Text></View>}
                </View>
                <Text style={styles.itemCount}>{b.assignedItems.length} item{b.assignedItems.length !== 1 ? 's' : ''}</Text>
              </View>
              <Text style={[styles.owed, moneyText, { color: isHost ? colors.textMuted : color }]}>{formatCurrency(b.totalOwed)}</Text>
            </View>
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Calculated total</Text>
          <Text style={[styles.footerValue, moneyText]}>{formatCurrency(summary.calculatedTotal)}</Text>
        </View>
      </ScrollView>

      <ReceiptPreviewSheet
        visible={showShare}
        receipt={entry.receipt}
        allPeople={summary.people}
        showPeopleSummary
        onClose={() => setShowShare(false)}
      />

      {entry.receiptImageUri && (
        <Modal visible={showPhoto} transparent animationType="fade" onRequestClose={() => setShowPhoto(false)}>
          <View style={styles.photoModal}>
            <ScrollView
              style={StyleSheet.absoluteFill}
              contentContainerStyle={styles.photoZoom}
              minimumZoomScale={1}
              maximumZoomScale={5}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri: entry.receiptImageUri }} style={styles.photoFull} resizeMode="contain" />
            </ScrollView>
            <TouchableOpacity style={styles.photoClose} onPress={() => setShowPhoto(false)}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.textDim, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },

  photoThumb: {
    width: 44, height: 58, borderRadius: 7, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  photoThumbImg: { width: '100%', height: '100%' },
  photoThumbOverlay: { position: 'absolute', bottom: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 3, padding: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 10 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 14, color: colors.textMuted, marginBottom: 4 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  totalLabel: { fontSize: 15, color: colors.textSecondary },
  totalValue: { fontSize: 17, fontWeight: '700', color: colors.textDim },

  personCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    paddingVertical: 12, paddingRight: 16, paddingLeft: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', overflow: 'hidden',
  },
  personCardHost: { borderColor: 'rgba(220,220,220,0.20)' },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  personInner: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personName: { fontSize: 15, fontWeight: '700', color: colors.textDim },
  hostBadge: { backgroundColor: colors.btnPrimary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  hostBadgeText: { fontSize: 10, fontWeight: '700', color: '#000' },
  itemCount: { fontSize: 12, color: colors.textMuted },
  owed: { fontSize: 18, fontWeight: '800' },

  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 4 },
  footerLabel: { fontSize: 14, color: colors.textMuted },
  footerValue: { fontSize: 14, fontWeight: '600', color: colors.textDim },

  photoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  photoZoom: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoFull: { width: '100%', aspectRatio: 3 / 4 },
  photoClose: {
    position: 'absolute', top: 56, right: 20,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
});
