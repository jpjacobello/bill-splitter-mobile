import { useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Receipt, PersonBreakdown } from '../types';
import { getEmoji } from '../utils/buildReceiptHtml';
import ShareableReceiptCard, { calcCardScale } from './ShareableReceiptCard';
import { formatCurrency } from '../utils/currency';

type Props = {
  visible: boolean;
  receipt: Receipt;
  onClose: () => void;
  person?: { breakdown: PersonBreakdown; colorIndex: number };
  allPeople?: PersonBreakdown[];
  showPeopleSummary?: boolean;
  paidById?: string;
};

export default function ReceiptPreviewSheet({ visible, receipt, onClose, person, allPeople, showPeopleSummary, paidById }: Props) {
  const cardRef = useRef<View>(null);

  const cardItemCount = person
    ? person.breakdown.assignedItems.length
    : allPeople
    ? allPeople.length
    : receipt.items.length;
  const cardScale = calcCardScale(cardItemCount);

  const handleShare = async () => {
    try {
      const { captureRef } = require('react-native-view-shot');
      const tmpUri = await captureRef(cardRef, { format: 'png', quality: 1, width: 320 });
      const tmpFile = tmpUri.startsWith('file://') ? tmpUri : `file://${tmpUri}`;

      // Try to copy to a nicely named file; fall back to sharing the raw tmp path
      let shareUri = tmpFile;
      try {
        const merchant = (receipt.merchantName ?? 'Receipt').replace(/[^a-zA-Z0-9 ]/g, '').trim();
        const fileName = person ? `${merchant} ${person.breakdown.person.name}.png` : `${merchant}.png`;
        const namedUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.deleteAsync(namedUri, { idempotent: true });
        await FileSystem.copyAsync({ from: tmpFile, to: namedUri });
        shareUri = namedUri;
      } catch {
        // rename failed — share the tmp file as-is
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri, { mimeType: 'image/png', UTI: 'public.png' });
      }
    } catch {
      // ignore cancels / capture failures
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const normalized = date.replace(/\//g, '-');
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized + 'T00:00' : normalized);
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const title = person ? person.breakdown.person.name : showPeopleSummary ? 'Split Summary' : (receipt.merchantName || 'Receipt');
  const subtitle = person ? (receipt.merchantName || '') : showPeopleSummary ? (receipt.merchantName || '') : formatDate(receipt.date);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Glass background */}
        <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={85} />
        <View style={[StyleSheet.absoluteFill, styles.glassSheen]} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.receiptThumb}>
              <Ionicons name="receipt-outline" size={18} color="rgba(255,255,255,0.5)" />
            </View>
            <View>
              <Text style={styles.merchantName}>{title}</Text>
              {!!subtitle && <Text style={styles.dateText}>{subtitle}</Text>}
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#D0D0D0" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Items */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {person
            ? person.breakdown.assignedItems.map(({ item, share }) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemEmoji}>{getEmoji(item.name)}</Text>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemPrice}>{formatCurrency(share)}</Text>
                </View>
              ))
            : showPeopleSummary && allPeople
            ? allPeople.map((b) => (
                <View key={b.person.id} style={styles.itemRow}>
                  <Text style={styles.itemEmoji}>{b.person.isHost ? '💳' : '👤'}</Text>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {b.person.name}{b.person.id === paidById ? ' (paid)' : ''}
                  </Text>
                  <Text style={styles.itemPrice}>{formatCurrency(b.totalOwed)}</Text>
                </View>
              ))
            : receipt.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemEmoji}>{getEmoji(item.name)}</Text>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                </View>
              ))
          }

          {/* Totals */}
          <View style={styles.divider} />
          {showPeopleSummary ? (
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Receipt Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(receipt.total)}</Text>
            </View>
          ) : person ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatCurrency(person.breakdown.subtotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>{formatCurrency(person.breakdown.taxShare)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tip</Text>
                <Text style={styles.totalValue}>{formatCurrency(person.breakdown.tipShare)}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Total owed</Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(person.breakdown.totalOwed)}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatCurrency(receipt.subtotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>{formatCurrency(receipt.tax)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tip</Text>
                <Text style={styles.totalValue}>{formatCurrency(receipt.tip)}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(receipt.total)}</Text>
              </View>
            </>
          )}
        </ScrollView>

        {/* Share button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color="#3D95CE" />
            <Text style={styles.shareBtnText}>
              {person ? `Share ${person.breakdown.person.name}'s Receipt` : 'Share Receipt'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Off-screen card for capture */}
        <View style={styles.offScreen}>
          <ShareableReceiptCard
            ref={cardRef}
            receipt={receipt}
            person={person?.breakdown}
            allPeople={!person ? allPeople : undefined}
            scale={cardScale}
            paidById={paidById}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 34,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  glassSheen: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  receiptThumb: {
    width: 42,
    height: 42,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D0D0D0',
  },
  dateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  itemEmoji: {
    fontSize: 20,
    width: 28,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    color: '#D0D0D0',
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D0D0D0',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.40)',
  },
  totalValue: {
    fontSize: 14,
    color: '#A0A0A0',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  grandTotalRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D0D0D0',
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D0D0D0',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(61,149,206,0.15)',
    borderRadius: 14,
    height: 52,
    borderWidth: 0.5,
    borderColor: 'rgba(61,149,206,0.35)',
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3D95CE',
  },
  offScreen: { position: 'absolute', top: -9999, left: -9999 },
});
