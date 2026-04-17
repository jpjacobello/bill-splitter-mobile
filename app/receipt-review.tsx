import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../components/Button';
import { useBillStore } from '../store/useBillStore';
import { DEFAULT_TIP_KEY } from './settings';

const TIP_PRESETS = [0.15, 0.18, 0.2, 0.25];

function parseDollar(text: string): number {
  const n = parseFloat(text.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

export default function ReceiptReviewScreen() {
  const router = useRouter();
  const { receipt, updateItem, deleteItem, addItem, updateReceiptField, updateTip } = useBillStore();

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
    updateItem(id, { price });
    const updated = receipt.items.map((i) => i.id === id ? { ...i, price } : i);
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
            <Text style={styles.title}>Review</Text>
            {receipt.merchantName && (
              <Text style={styles.merchant}>{receipt.merchantName}</Text>
            )}
          </View>

          {/* ── RECONCILIATION ── */}
          <View style={[styles.reconcileBadge, reconciles ? styles.reconcileOk : styles.reconcileOff]}>
            <Text style={styles.reconcileText}>
              {reconciles
                ? `✓ Totals match  ·  $${calculatedTotal.toFixed(2)}`
                : `⚠ Off by $${diff.toFixed(2)}  ·  Calculated $${calculatedTotal.toFixed(2)} vs receipt $${receipt.total.toFixed(2)}`}
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
                placeholderTextColor="#555"
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
                <Text style={styles.deleteBtnText}>✕</Text>
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
                placeholderTextColor="#555"
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
                placeholderTextColor="#555"
                value={row.price}
                onChangeText={(t) => updatePendingRow(row.id, 'price', t)}
                onBlur={() => {
                  if (row.price.trim() && row.name.trim()) commitPendingRow(row);
                }}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <TouchableOpacity onPress={() => removePendingRow(row.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            );
          })}
          <TouchableOpacity style={styles.addItemBtn} onPress={addPendingRow}>
            <Text style={styles.addItemBtnText}>+ Add item</Text>
          </TouchableOpacity>

          {/* ── DISCOUNTS ── */}
          {discountItems.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Discounts & Comps</Text>
              {discountItems.map((item) => (
                <View key={item.id} style={styles.discountRow}>
                  <Text style={styles.discountName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.discountAmount}>−${Math.abs(item.price).toFixed(2)}</Text>
                  <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>✕</Text>
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

      <View style={styles.stickyFooter}>
        {pendingRowError && (
          <Text style={styles.footerError}>Please complete or remove unfinished items.</Text>
        )}
        {tipError && (
          <Text style={styles.footerError}>Please select or enter a tip amount.</Text>
        )}
        <Button
          label="Assign Items"
          onPress={() => {
            const hasIncomplete = pendingRows.some((r) => !r.name.trim() || !r.price.trim());
            if (hasIncomplete) { setPendingRowError(true); return; }
            setPendingRowError(false);
            setTipError(false);

            if (receipt.tip === 0 && !tipWarningAcknowledged) {
              Alert.alert(
                'No Tip Added',
                'The receipt shows $0.00 for tip. Make sure to add a tip below if needed before continuing.',
                [
                  { text: 'Add Tip', style: 'cancel' },
                  {
                    text: 'Continue Without Tip',
                    onPress: () => { setTipWarningAcknowledged(true); router.push('/assign-items'); },
                  },
                ]
              );
              return;
            }

            router.push('/assign-items');
          }}
          height={60}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#151515' },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#D0D0D0', marginBottom: 4 },
  merchant: { fontSize: 15, color: '#777' },

  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: '#888',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },

  // Reconciliation
  reconcileBadge: {
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4,
  },
  reconcileOk: { backgroundColor: '#0A2E1A' },
  reconcileOff: { backgroundColor: '#2E0A0A' },
  reconcileText: { fontSize: 13, fontWeight: '500', color: '#D0D0D0' },

  // Items
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  itemNameInput: {
    flex: 1, fontSize: 15, color: '#D0D0D0',
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  itemPriceInput: {
    width: 76, fontSize: 15, color: '#D0D0D0', textAlign: 'right',
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  itemQtyInput: {
    width: 32, fontSize: 13, color: '#888', fontWeight: '600', textAlign: 'center',
    paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  itemRowError: { borderBottomColor: 'rgba(220,38,38,0.40)', backgroundColor: 'rgba(220,38,38,0.06)', borderRadius: 8 },
  deleteBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  deleteBtnText: { fontSize: 14, color: '#888' },
  addItemBtn: { paddingVertical: 6, alignSelf: 'flex-start' },
  addItemBtnText: { fontSize: 15, color: '#D0D0D0', fontWeight: '700' },
  discountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  discountName: {
    flex: 1, fontSize: 15, color: '#A0C4A0', fontStyle: 'italic',
  },
  discountAmount: {
    fontSize: 15, fontWeight: '600', color: '#4ADE80',
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
  tipChipText: { fontSize: 12, fontWeight: '600', color: '#D0D0D0' },
  tipChipTextActive: { color: '#000' },
  totalLabel: { fontSize: 15, color: '#B0B0B0' },
  totalInput: {
    fontSize: 15, color: '#D0D0D0', fontWeight: '500',
    textAlign: 'right', minWidth: 76,
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  readOnlyValue: {
    fontSize: 15, color: '#999', fontWeight: '500',
    textAlign: 'right', minWidth: 76,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  grandTotalRow: { borderBottomWidth: 0, marginTop: 4, paddingTop: 14 },
  grandTotalLabel: { fontSize: 17, fontWeight: '700', color: '#D0D0D0' },
  grandTotalValue: { fontSize: 17, fontWeight: '700', color: '#D0D0D0' },

  footerError: { fontSize: 13, color: '#E53E3E', marginBottom: 8, textAlign: 'center' },
  stickyFooter: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8, backgroundColor: '#151515' },
});
