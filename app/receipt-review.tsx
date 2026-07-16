import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
  Modal, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActionSheet from '../components/ActionSheet';
import { colors, ui as C } from '../theme';
import { useBillStore } from '../store/useBillStore';
import { DEFAULT_TIP_KEY } from '../utils/tipPrefs';
import { formatCurrency } from '../utils/currency';

const TIP_PRESETS = [0.15, 0.18, 0.2, 0.25];

function parseDollar(text: string): number {
  const n = parseFloat(text.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

export default function ReceiptReviewScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { receipt, receiptImageUri, updateItem, deleteItem, addItem, updateReceiptField, updateTip } = useBillStore();
  const [showPhoto, setShowPhoto] = useState(false);
  const [tipWarnOpen, setTipWarnOpen] = useState(false);

  // Apply default tip if receipt has no tip and it wasn't on the original receipt
  useEffect(() => {
    if (!receipt || !!receipt.tip || receipt.tipIsFromReceipt) return;
    AsyncStorage.getItem(DEFAULT_TIP_KEY).then((val) => {
      if (!val) return;
      const pct = parseFloat(val);
      const tip = parseFloat((receipt.subtotal * pct).toFixed(2));
      updateTip(tip);
      updateReceiptField('total', parseFloat((receipt.subtotal + receipt.tax + (receipt.fees ?? 0) + tip).toFixed(2)));
    });
  }, []);

  type PendingRow = { id: string; name: string; price: string; qty: string };
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);
  const [taxInput, setTaxInput] = useState('');
  const [tipInput, setTipInput] = useState('');
  const [tipFocused, setTipFocused] = useState(false);
  const [itemPriceInputs, setItemPriceInputs] = useState<Record<string, string>>({});
  const [itemQtyInputs, setItemQtyInputs] = useState<Record<string, string>>({});
  const itemQtyRefs = useRef<Record<string, string>>({});
  const [pendingRowError, setPendingRowError] = useState(false);
  const [tipError, setTipError] = useState(false);
  const [tipWarningAcknowledged, setTipWarningAcknowledged] = useState(false);
  const addPendingRow = () =>
    setPendingRows((prev) => [...prev, { id: Date.now().toString(), name: '', price: '', qty: '1' }]);

  const updatePendingRow = (id: string, field: 'name' | 'price' | 'qty', value: string) => {
    setPendingRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const removePendingRow = (id: string) => {
    setPendingRows((prev) => prev.filter((r) => r.id !== id));
    setPendingRowError(false);
  };

  const commitPendingRow = (row: PendingRow) => {
    if (!row.name.trim() || !row.price.trim()) return;
    const price = parseDollar(row.price);
    if (price === 0 && !row.price.trim()) return;
    const quantity = Math.max(1, parseInt(row.qty, 10) || 1);
    addItem({ name: row.name.trim(), price, quantity });
    syncTotals([...receipt!.items, { id: '', name: '', price, quantity, assignedTo: [] }]);
    removePendingRow(row.id);
  };

  if (!receipt) return null;

  const regularItems = receipt.items.filter((i) => i.price >= 0);
  const discountItems = receipt.items.filter((i) => i.price < 0);
  const calculatedSubtotal = receipt.items.reduce((s, i) => s + i.price, 0);
  const calculatedTotal = calculatedSubtotal + receipt.tax + (receipt.fees ?? 0) + receipt.tip;
  const diff = Math.abs(calculatedTotal - receipt.total);
  const reconciles = diff < 0.05;

  const syncTotals = (items = receipt.items, tax = receipt.tax, tip = receipt.tip) => {
    const subtotal = parseFloat(items.reduce((s, i) => s + i.price, 0).toFixed(2));
    updateReceiptField('subtotal', subtotal);
    updateReceiptField('total', parseFloat((subtotal + tax + (receipt.fees ?? 0) + tip).toFixed(2)));
  };

  const handleDeleteItem = (id: string) => {
    const remaining = receipt.items.filter((i) => i.id !== id);
    deleteItem(id);
    syncTotals(remaining);
  };

  const handleItemPriceChange = (id: string, text: string) => {
    const price = parseDollar(text);
    // Also recompute unitPrice from the new price, else a later quantity edit
    // (handleItemQtyChange recomputes price = unitPrice * qty) silently reverts
    // this correction from the now-stale unitPrice.
    const item = receipt.items.find((i) => i.id === id);
    const qty = item?.quantity ?? 1;
    const updates = { price, unitPrice: qty > 0 ? price / qty : price };
    updateItem(id, updates);
    const updated = receipt.items.map((i) => i.id === id ? { ...i, ...updates } : i);
    syncTotals(updated);
  };

  const handleItemQtyChange = (id: string, text: string) => {
    const qty = Math.max(1, parseInt(text.replace(/[^0-9]/g, ''), 10) || 1);
    const item = receipt.items.find((i) => i.id === id);
    if (!item) return;
    const updates: Partial<typeof item> = { quantity: qty };
    if (item.unitPrice != null) updates.price = parseFloat((item.unitPrice * qty).toFixed(2));
    updateItem(id, updates);
    const updated = receipt.items.map((i) => i.id === id ? { ...i, ...updates } : i);
    syncTotals(updated);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={16}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Review</Text>
                {receipt.merchantName && (
                  <Text style={styles.merchant}>{receipt.merchantName}</Text>
                )}
              </View>
              {receiptImageUri && (
                <TouchableOpacity style={styles.photoThumb} onPress={() => setShowPhoto(true)} activeOpacity={0.8}>
                  <Image source={{ uri: receiptImageUri }} style={styles.photoThumbImg} />
                  <View style={styles.photoThumbOverlay}>
                    <Ionicons name="expand-outline" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── RECONCILIATION ── */}
          <View style={[styles.reconcileBadge, reconciles ? styles.reconcileOk : styles.reconcileOff]}>
            <Text style={styles.reconcileText}>
              {reconciles
                ? `✓ Totals match  ·  ${formatCurrency(calculatedTotal)}`
                : `⚠ Off by ${formatCurrency(diff)}  ·  Calculated ${formatCurrency(calculatedTotal)} vs receipt ${formatCurrency(receipt.total)}`}
            </Text>
          </View>

          {/* ── ITEMS ── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Items</Text>
          {regularItems.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <TextInput
                style={styles.itemQtyInput}
                value={itemQtyInputs[item.id] !== undefined ? itemQtyInputs[item.id] : String(item.quantity)}
                onFocus={() => {
                  const v = String(item.quantity);
                  itemQtyRefs.current[item.id] = v;
                  setItemQtyInputs((p) => ({ ...p, [item.id]: v }));
                }}
                onChangeText={(t) => {
                  itemQtyRefs.current[item.id] = t;
                  setItemQtyInputs((p) => ({ ...p, [item.id]: t }));
                }}
                onBlur={() => {
                  handleItemQtyChange(item.id, itemQtyRefs.current[item.id] ?? '1');
                  delete itemQtyRefs.current[item.id];
                  setItemQtyInputs((p) => { const n = { ...p }; delete n[item.id]; return n; });
                }}
                keyboardType="number-pad"
                selectTextOnFocus
              />
              <TextInput
                style={styles.itemNameInput}
                value={item.name}
                onChangeText={(t) => updateItem(item.id, { name: t })}
                placeholder="Item name"
                placeholderTextColor={C.faint}
                numberOfLines={1}
              />
              <TextInput
                style={styles.itemPriceInput}
                value={itemPriceInputs[item.id] !== undefined ? itemPriceInputs[item.id] : item.price.toFixed(2)}
                onFocus={() => setItemPriceInputs((p) => ({ ...p, [item.id]: item.price.toFixed(2) }))}
                onChangeText={(t) => setItemPriceInputs((p) => ({ ...p, [item.id]: t }))}
                onBlur={() => {
                  handleItemPriceChange(item.id, itemPriceInputs[item.id] ?? '');
                  setItemPriceInputs((p) => { const n = { ...p }; delete n[item.id]; return n; });
                }}
                keyboardType="numbers-and-punctuation"
                selectTextOnFocus
              />
              <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={15} color="#636366" />
              </TouchableOpacity>
            </View>
          ))}

          {/* Pending new rows */}
          {pendingRows.map((row, idx) => {
            const isIncomplete = pendingRowError && (!row.name.trim() || !row.price.trim());
            return (
            <View key={row.id} style={[styles.itemRow, isIncomplete && styles.itemRowError]}>
              <TextInput
                style={styles.itemQtyInput}
                value={row.qty}
                onChangeText={(t) => updatePendingRow(row.id, 'qty', t.replace(/[^0-9]/g, '') || '1')}
                keyboardType="number-pad"
                selectTextOnFocus
              />
              <TextInput
                style={styles.itemNameInput}
                placeholder="Item name"
                placeholderTextColor={C.faint}
                value={row.name}
                autoFocus={idx === pendingRows.length - 1}
                numberOfLines={1}
                onChangeText={(t) => {
                  updatePendingRow(row.id, 'name', t);
                  if (t.trim() && row.price.trim()) commitPendingRow({ ...row, name: t });
                }}
              />
              <TextInput
                style={styles.itemPriceInput}
                placeholder="0.00"
                placeholderTextColor={C.faint}
                value={row.price}
                onChangeText={(t) => updatePendingRow(row.id, 'price', t)}
                onBlur={() => {
                  if (row.price.trim() && row.name.trim()) commitPendingRow(row);
                }}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <TouchableOpacity onPress={() => removePendingRow(row.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={15} color="#636366" />
              </TouchableOpacity>
            </View>
            );
          })}
          <TouchableOpacity style={styles.addItemBtn} onPress={addPendingRow} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={16} color="#8E8E93" />
            <Text style={styles.addItemBtnText}>Add item</Text>
          </TouchableOpacity>

          {/* ── DISCOUNTS ── */}
          {discountItems.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Discounts & Comps</Text>
              {discountItems.map((item) => (
                <View key={item.id} style={styles.discountRow}>
                  <Text style={styles.discountName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.discountAmount}>−{formatCurrency(Math.abs(item.price))}</Text>
                  <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={15} color="#636366" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* ── TOTALS ── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Totals</Text>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.readOnlyValue}>{calculatedSubtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <TextInput
              style={styles.totalInput}
              value={taxInput !== '' ? taxInput : receipt.tax.toFixed(2)}
              onFocus={() => setTaxInput(receipt.tax.toFixed(2))}
              onChangeText={setTaxInput}
              onBlur={() => {
                const tax = parseDollar(taxInput);
                updateReceiptField('tax', tax);
                syncTotals(receipt.items, tax, receipt.tip);
                setTaxInput('');
              }}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>

          {(receipt.fees ?? 0) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Fees & Surcharges</Text>
              <Text style={styles.readOnlyValue}>{(receipt.fees ?? 0).toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.tipRow}>
            <Text style={styles.totalLabel}>Tip</Text>
            <View style={styles.tipRight}>
              <View style={styles.tipPresets}>
                {TIP_PRESETS.map((pct) => {
                  const val = parseFloat((receipt.subtotal * pct).toFixed(2));
                  const active = Math.abs(receipt.tip - val) < 0.01;
                  return (
                    <TouchableOpacity
                      key={pct}
                      style={[styles.tipChip, active && styles.tipChipActive]}
                      onPress={() => { updateTip(val); syncTotals(receipt.items, receipt.tax, val); setTipInput(''); setTipError(false); }}
                    >
                      <Text style={[styles.tipChipText, active && styles.tipChipTextActive]}>
                        {Math.round(pct * 100)}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={styles.totalInput}
                value={tipFocused ? tipInput : receipt.tip.toFixed(2)}
                onFocus={() => { setTipFocused(true); setTipInput(receipt.tip.toFixed(2)); }}
                onChangeText={setTipInput}
                onBlur={() => {
                  setTipFocused(false);
                  const tip = parseDollar(tipInput);
                  updateTip(tip);
                  syncTotals(receipt.items, receipt.tax, tip);
                  setTipInput('');
                  if (tip > 0) setTipError(false);
                }}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
            </View>
          </View>

          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={[styles.readOnlyValue, styles.grandTotalValue]}>{calculatedTotal.toFixed(2)}</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {receiptImageUri && (
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
              <Image source={{ uri: receiptImageUri }} style={styles.photoFull} resizeMode="contain" />
            </ScrollView>
            <TouchableOpacity style={styles.photoCloseBtn} onPress={() => setShowPhoto(false)}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      <View style={styles.stickyFooter}>
        {pendingRowError && (
          <Text style={styles.footerError}>Please complete or remove unfinished items.</Text>
        )}
        {tipError && (
          <Text style={styles.footerError}>Please select or enter a tip amount.</Text>
        )}
        <TouchableOpacity
          style={styles.continueBtn}
          activeOpacity={0.85}
          onPress={() => {
            const hasIncomplete = pendingRows.some((r) => !r.name.trim() || !r.price.trim());
            if (hasIncomplete) { setPendingRowError(true); return; }
            setPendingRowError(false);
            setTipError(false);

            if (receipt.tip === 0 && !tipWarningAcknowledged) {
              setTipWarnOpen(true);
              return;
            }

            if (from === 'assign-items') {
              router.back();
            } else {
              router.push('/assign-items');
            }
          }}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <ActionSheet
        visible={tipWarnOpen}
        title="No Tip Added"
        message="The receipt shows $0.00 for tip. Make sure to add a tip below if needed before continuing."
        options={[
          {
            label: 'Continue Without Tip',
            onPress: () => {
              setTipWarningAcknowledged(true);
              if (from === 'assign-items') { router.back(); } else { router.push('/assign-items'); }
            },
          },
        ]}
        onClose={() => setTipWarnOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 4 },
  merchant: { fontSize: 15, color: C.dim },
  photoThumb: {
    width: 52, height: 68, borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  photoThumbImg: { width: '100%', height: '100%' },
  photoThumbOverlay: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4,
    padding: 2,
  },
  photoModal: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
  },
  photoZoomContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  photoFull: { width: '100%', aspectRatio: 3 / 4 },
  photoCloseBtn: {
    position: 'absolute', top: 56, right: 20,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },

  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: C.dim,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },

  // Reconciliation
  reconcileBadge: {
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4,
  },
  reconcileOk: { backgroundColor: 'rgba(62,173,116,0.10)', borderWidth: 1, borderColor: 'rgba(62,173,116,0.28)' },
  reconcileOff: { backgroundColor: 'rgba(210,60,60,0.10)', borderWidth: 1, borderColor: 'rgba(210,60,60,0.28)' },
  reconcileText: { fontSize: 13, fontWeight: '500', color: C.text },

  // Items
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 6,
  },
  itemNameInput: {
    flex: 1, fontSize: 15, color: C.text,
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  itemPriceInput: {
    width: 76, fontSize: 15, color: C.text, textAlign: 'right',
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  itemQtyInput: {
    width: 32, fontSize: 13, color: C.text, fontWeight: '600', textAlign: 'center',
    paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  itemRowError: { borderBottomColor: 'rgba(220,38,38,0.40)', backgroundColor: 'rgba(220,38,38,0.06)', borderRadius: 8 },
  deleteBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    marginTop: 2,
  },
  addItemBtnText: { fontSize: 14, color: C.dim, fontWeight: '500' },
  discountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(62,173,116,0.05)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(62,173,116,0.15)',
    marginBottom: 6,
  },
  discountName: {
    flex: 1, fontSize: 15, color: C.dim, fontStyle: 'italic',
  },
  discountAmount: {
    fontSize: 15, fontWeight: '600', color: colors.green,
  },

  // Totals
  totalRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.13)',
  },
  tipRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.13)',
    flexWrap: 'wrap', gap: 8,
  },
  tipRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipPresets: { flexDirection: 'row', gap: 6 },
  tipChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  tipChipActive: { backgroundColor: 'rgba(220,220,220,0.95)' },
  tipChipText: { fontSize: 12, fontWeight: '600', color: C.dim },
  tipChipTextActive: { color: C.bg },
  totalLabel: { fontSize: 15, color: C.dim },
  totalInput: {
    fontSize: 15, color: C.text, fontWeight: '500',
    textAlign: 'right', minWidth: 76,
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  readOnlyValue: {
    fontSize: 15, color: C.dim, fontWeight: '500',
    textAlign: 'right', minWidth: 76,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  grandTotalRow: { borderBottomWidth: 0, marginTop: 4, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' },
  grandTotalLabel: { fontSize: 17, fontWeight: '700', color: C.text },
  grandTotalValue: { fontSize: 17, fontWeight: '700', color: C.text },

  footerError: { fontSize: 13, color: '#E53E3E', marginBottom: 8, textAlign: 'center' },
  stickyFooter: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8, backgroundColor: C.bg },
  continueBtn: { height: 56, borderRadius: 15, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' },
  continueBtnText: { fontSize: 16.5, fontWeight: '700', color: C.bg },
});
