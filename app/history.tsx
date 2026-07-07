import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  FlatList, Alert, Modal, ScrollView, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { usePro } from '../hooks/usePro';
import { getBillHistory, deleteBillFromHistory } from '../utils/proStorage';
import { calcSplit } from '../utils/calcSplit';
import { BillHistoryEntry } from '../types';
import ReceiptPreviewSheet from '../components/ReceiptPreviewSheet';
import { colors } from '../theme';
import { formatCurrency } from '../utils/currency';

const PERSON_COLORS = colors.person;
const getPersonColor = (index: number) => PERSON_COLORS[index % PERSON_COLORS.length];

export default function HistoryScreen() {
  const router = useRouter();
  const { isPro, loading: proLoading } = usePro();
  const [entries, setEntries] = useState<BillHistoryEntry[]>([]);
  const [selected, setSelected] = useState<BillHistoryEntry | null>(null);

  const loadHistory = useCallback(() => {
    getBillHistory().then(setEntries);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete Bill?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteBillFromHistory(id);
          loadHistory();
          setSelected((prev) => (prev?.id === id ? null : prev));
        },
      },
    ]);
  }, [loadHistory]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#D0D0D0" />
        </TouchableOpacity>
        <Text style={styles.title}>Bill History</Text>
      </View>

      {!proLoading && !isPro ? (
        <View style={styles.paywallContainer}>
          <View style={styles.paywallCard}>
            <Text style={styles.paywallIcon}>🕐</Text>
            <Text style={styles.paywallTitle}>Bill History is Pro</Text>
            <Text style={styles.paywallSubtitle}>
              Save and revisit every split. Upgrade to Divi Pro to unlock.
            </Text>
            <TouchableOpacity
              style={styles.paywallBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.paywallBtnText}>Go to Settings to Upgrade</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !proLoading ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color="#333" />
                <Text style={styles.emptyTitle}>No bills yet</Text>
                <Text style={styles.emptySubtitle}>
                  Completed splits will appear here after you tap Start Over.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item: entry }) => {
            const nonHostCount = entry.people.filter((p) => !p.isHost).length;
            const date = new Date(entry.createdAt);
            const dateStr = date.toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });
            return (
              <TouchableOpacity
                style={styles.entryCard}
                onPress={() => setSelected(entry)}
                onLongPress={() => handleDelete(entry.id)}
                delayLongPress={500}
                activeOpacity={0.75}
              >
                <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={20} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.03)' }]} />
                <View style={styles.entryCardContent}>
                  <View style={styles.entryLeft}>
                    <Text style={styles.entryMerchant} numberOfLines={1}>
                      {entry.merchantName || 'Bill Split'}
                    </Text>
                    <Text style={styles.entryMeta}>
                      {nonHostCount + 1} people · {dateStr}
                    </Text>
                  </View>
                  <View style={styles.entryRight}>
                    <Text style={styles.entryTotal}>{formatCurrency(entry.receipt.total)}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#444" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal
        visible={selected !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <HistoryDetailView
            entry={selected}
            onClose={() => setSelected(null)}
            onDelete={() => handleDelete(selected.id)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

type DetailProps = {
  entry: BillHistoryEntry;
  onClose: () => void;
  onDelete: () => void;
};

function HistoryDetailView({ entry, onClose, onDelete }: DetailProps) {
  const [showPhoto, setShowPhoto] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const summary = calcSplit(entry.people, entry.receipt);
  const date = new Date(entry.createdAt);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-down" size={24} color="#D0D0D0" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {entry.merchantName || 'Bill Split'}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowShare(true)} style={styles.shareBtn} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={22} color="#888" />
          </TouchableOpacity>
          {entry.receiptImageUri ? (
            <TouchableOpacity style={styles.photoThumb} onPress={() => setShowPhoto(true)} activeOpacity={0.8}>
              <Image source={{ uri: entry.receiptImageUri }} style={styles.photoThumbImg} />
              <View style={styles.photoThumbOverlay}>
                <Ionicons name="expand-outline" size={10} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
        {entry.receiptImageUri && (
          <View style={styles.detailHeaderRow}>
            <Text style={styles.detailDate}>{dateStr}</Text>
            <TouchableOpacity onPress={onDelete} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={18} color="#555" />
            </TouchableOpacity>
          </View>
        )}
        {!entry.receiptImageUri && <Text style={styles.detailDate}>{dateStr}</Text>}
        <View style={styles.receiptTotalRow}>
          <Text style={styles.receiptTotalLabel}>Receipt total</Text>
          <Text style={styles.receiptTotalValue}>{formatCurrency(entry.receipt.total)}</Text>
        </View>

        {summary.people.map((b, index) => {
          const isHost = b.person.isHost;
          const color = getPersonColor(index);
          return (
            <View key={b.person.id} style={[styles.detailCard, isHost && styles.detailCardHost]}>
              <View style={[styles.cardAccent, { backgroundColor: color }]} />
              <View style={styles.detailCardInner}>
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
              <Text style={[styles.totalOwed, { color: isHost ? '#888' : color }]}>
                {formatCurrency(b.totalOwed)}
              </Text>
            </View>
          );
        })}

        <View style={styles.detailFooter}>
          <Text style={styles.detailFooterLabel}>Calculated total</Text>
          <Text style={styles.detailFooterValue}>{formatCurrency(summary.calculatedTotal)}</Text>
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
              contentContainerStyle={styles.photoZoomContainer}
              minimumZoomScale={1}
              maximumZoomScale={5}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri: entry.receiptImageUri }} style={styles.photoFull} resizeMode="contain" />
            </ScrollView>
            <TouchableOpacity style={styles.photoCloseBtn} onPress={() => setShowPhoto(false)}>
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
  deleteBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 'auto',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  shareBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.textDim, flex: 1 },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48, gap: 10 },

  entryCard: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  entryCardContent: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  entryLeft: { flex: 1, gap: 4 },
  entryMerchant: { fontSize: 16, fontWeight: '700', color: colors.textDim },
  entryMeta: { fontSize: 13, color: '#666' },
  entryRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryTotal: { fontSize: 17, fontWeight: '700', color: colors.textDim },

  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 100, gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#444' },
  emptySubtitle: { fontSize: 14, color: '#555', textAlign: 'center', paddingHorizontal: 32 },

  paywallContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  paywallCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24, padding: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', gap: 12,
  },
  paywallIcon: { fontSize: 40 },
  paywallTitle: { fontSize: 20, fontWeight: '800', color: colors.textDim, textAlign: 'center' },
  paywallSubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  paywallBtn: {
    marginTop: 4, backgroundColor: colors.btnPrimary,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24,
  },
  paywallBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },

  // Photo thumbnail
  photoThumb: {
    width: 44, height: 58, borderRadius: 7, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    marginLeft: 'auto',
  },
  photoThumbImg: { width: '100%', height: '100%' },
  photoThumbOverlay: {
    position: 'absolute', bottom: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 3, padding: 2,
  },
  // Photo full-screen modal
  photoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  photoZoomContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoFull: { width: '100%', aspectRatio: 3 / 4 },
  photoCloseBtn: {
    position: 'absolute', top: 56, right: 20,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  // Detail view
  detailScroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 10 },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailDate: { fontSize: 14, color: '#666', marginBottom: 4 },
  receiptTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  receiptTotalLabel: { fontSize: 15, color: '#B0B0B0' },
  receiptTotalValue: { fontSize: 17, fontWeight: '700', color: colors.textDim },
  detailCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, paddingVertical: 12, paddingRight: 16, paddingLeft: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  detailCardHost: { borderColor: 'rgba(220,220,220,0.20)' },
  cardAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
    borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
  },
  detailCardInner: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personName: { fontSize: 15, fontWeight: '700', color: colors.textDim },
  hostBadge: {
    backgroundColor: colors.btnPrimary, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  hostBadgeText: { fontSize: 10, fontWeight: '700', color: '#000' },
  itemCount: { fontSize: 12, color: '#666' },
  totalOwed: { fontSize: 18, fontWeight: '800' },
  detailFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingTop: 4,
  },
  detailFooterLabel: { fontSize: 14, color: '#666' },
  detailFooterValue: { fontSize: 14, fontWeight: '600', color: colors.textDim },

});
