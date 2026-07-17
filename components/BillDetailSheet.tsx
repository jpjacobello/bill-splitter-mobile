import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { BillHistoryEntry } from '../types';
import { calcSplit } from '../utils/calcSplit';
import { formatCurrency } from '../utils/currency';
import { colors, ui as C, moneyText } from '../theme';
import Perforation from './Perforation';
import ReceiptPreviewSheet from './ReceiptPreviewSheet';
import SwipeSheet, { SheetScrollView } from './SwipeSheet';

const getPersonColor = (i: number) => colors.person[i % colors.person.length];

// Tap a past bill in Activity to open this: per-person breakdown (as a receipt),
// the original photo (pinch-to-zoom), and share of the digitized receipt.
// Presents through SwipeSheet (gorhom) so the drag follows your finger 1:1 and
// scrolling the body couples with the dismiss gesture.
export default function BillDetailSheet({
  entry, onClose, onRequestDelete, onClosed,
}: {
  entry: BillHistoryEntry | null;
  onClose: () => void;
  onRequestDelete: (entry: BillHistoryEntry) => void;
  onClosed?: () => void; // fires after the sheet has fully animated out + unmounted
}) {
  // Retain the entry through the slide-out so the sheet animates down with its
  // dark content instead of flashing empty when the parent nulls `entry`.
  const [rendered, setRendered] = useState(entry);
  const [showPhoto, setShowPhoto] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (entry) setRendered(entry);
    else { setShowPhoto(false); setShowShare(false); }
  }, [entry]);

  const e = rendered;
  const summary = useMemo(() => (e ? calcSplit(e.people, e.receipt) : null), [e]);
  const dateStr = e
    ? new Date(e.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
      <SwipeSheet
        visible={entry !== null}
        onClose={onClose}
        onClosed={onClosed}
        tall
        background={C.bg}
        headerStyle={styles.headerWrap}
        header={
          e && (
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.7}>
                <SymbolView name="chevron.down" size={20} tintColor={C.text} />
              </TouchableOpacity>
              <Text style={styles.title} numberOfLines={1}>{e.merchantName || 'Bill Split'}</Text>
              <View style={styles.headerRight}>
                <TouchableOpacity onPress={() => setShowShare(true)} style={styles.iconBtn} activeOpacity={0.7}>
                  <SymbolView name="square.and.arrow.up" size={19} tintColor={C.dim} />
                </TouchableOpacity>
                {e.receiptImageUri ? (
                  <TouchableOpacity style={styles.photoThumb} onPress={() => setShowPhoto(true)} activeOpacity={0.8}>
                    <Image source={{ uri: e.receiptImageUri }} style={styles.photoThumbImg} />
                    <View style={styles.photoThumbOverlay}><SymbolView name="arrow.up.left.and.arrow.down.right" size={9} tintColor="#fff" /></View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => onRequestDelete(e)} style={styles.iconBtn} activeOpacity={0.7}>
                    <SymbolView name="trash" size={18} tintColor={C.dim} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )
        }
      >
        {e && summary && (
          <>
          <SheetScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.date}>{dateStr}</Text>

            <View style={styles.receipt}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Receipt total</Text>
                <Text style={[styles.totalValue, moneyText]}>{formatCurrency(e.receipt.total)}</Text>
              </View>

              <Perforation dots={32} />

              {summary.people.map((b, index) => {
                const isHost = b.person.isHost;
                const color = getPersonColor(index);
                return (
                  <View key={b.person.id} style={styles.person}>
                    <View style={styles.personLeft}>
                      <View style={[styles.dot, { backgroundColor: color }]} />
                      <View>
                        <View style={styles.nameRow}>
                          <Text style={styles.personName}>{b.person.name}</Text>
                          {isHost && <View style={styles.hostBadge}><Text style={styles.hostBadgeText}>paid</Text></View>}
                        </View>
                        <Text style={styles.itemCount}>{b.assignedItems.length} item{b.assignedItems.length !== 1 ? 's' : ''}</Text>
                      </View>
                    </View>
                    <Text style={[styles.owed, moneyText, { color: isHost ? C.dim : C.text }]}>{formatCurrency(b.totalOwed)}</Text>
                  </View>
                );
              })}

              <Perforation dots={32} />

              <View style={styles.totalRow}>
                <Text style={styles.calcLabel}>Calculated total</Text>
                <Text style={[styles.calcValue, moneyText]}>{formatCurrency(summary.calculatedTotal)}</Text>
              </View>
            </View>

            {e.receiptImageUri && (
              <TouchableOpacity style={styles.deleteRow} onPress={() => onRequestDelete(e)} activeOpacity={0.7}>
                <SymbolView name="trash" size={15} tintColor="#E86A78" />
                <Text style={styles.deleteText}>Delete bill</Text>
              </TouchableOpacity>
            )}
          </SheetScrollView>

          <ReceiptPreviewSheet visible={showShare} receipt={e.receipt} allPeople={summary.people} showPeopleSummary onClose={() => setShowShare(false)} />

          {e.receiptImageUri && (
            <Modal visible={showPhoto} transparent animationType="fade" onRequestClose={() => setShowPhoto(false)}>
              <View style={styles.photoModal}>
                <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={styles.photoZoom}
                  minimumZoomScale={1} maximumZoomScale={5} centerContent showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
                  <Image source={{ uri: e.receiptImageUri }} style={styles.photoFull} resizeMode="contain" />
                </ScrollView>
                <TouchableOpacity style={styles.photoClose} onPress={() => setShowPhoto(false)}>
                  <SymbolView name="xmark" size={20} tintColor="#fff" />
                </TouchableOpacity>
              </View>
            </Modal>
          )}
          </>
        )}
      </SwipeSheet>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: C.text, flex: 1, letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },

  photoThumb: { width: 40, height: 52, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoThumbOverlay: { position: 'absolute', bottom: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 3, padding: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  date: { fontSize: 13, color: C.faint, fontWeight: '600', letterSpacing: 0.3, marginBottom: 14, marginLeft: 2, textTransform: 'uppercase' },

  receipt: { backgroundColor: C.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: C.line },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontSize: 15, color: C.dim, fontWeight: '500' },
  totalValue: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.4 },

  person: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 11 },
  personLeft: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personName: { fontSize: 15.5, fontWeight: '700', color: C.text },
  hostBadge: { backgroundColor: C.accent, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  hostBadgeText: { fontSize: 10, fontWeight: '700', color: C.bg },
  itemCount: { fontSize: 12.5, color: C.dim, marginTop: 2 },
  owed: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },

  calcLabel: { fontSize: 13, color: C.dim, fontWeight: '500' },
  calcValue: { fontSize: 15, fontWeight: '700', color: C.text },

  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, marginTop: 6 },
  deleteText: { fontSize: 14.5, fontWeight: '600', color: '#E86A78' },

  photoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  photoZoom: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoFull: { width: '100%', aspectRatio: 3 / 4 },
  photoClose: {
    position: 'absolute', top: 56, right: 20,
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 20, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
});
