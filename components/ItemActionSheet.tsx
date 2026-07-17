import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { ReceiptItem, Person } from '../types';
import SwipeSheet, { SheetScrollView } from './SwipeSheet';
import { colors } from '../theme';
import { formatCurrency } from '../utils/currency';

type Props = {
  item: ReceiptItem | null;
  people: Person[];
  allItems: ReceiptItem[];
  onClose: () => void;
  onSplitAmong: (itemId: string, personIds: string[]) => void;
  onSplitIntoUnits: (itemId: string) => void;
  onConsolidateLikeItems: (itemId: string) => void;
  onToggleDrink: (itemId: string) => void;
  onSplitDrinksEvenly: () => void;
};

export default function ItemActionSheet({
  item, people, allItems, onClose,
  onSplitAmong, onSplitIntoUnits, onConsolidateLikeItems, onToggleDrink, onSplitDrinksEvenly,
}: Props) {
  // Retain the last item through the slide-out so the sheet animates down with
  // its content instead of vanishing when the parent nulls `item`.
  const [rendered, setRendered] = useState(item);
  useEffect(() => {
    if (item) setRendered(item);
  }, [item]);

  const it = item ?? rendered;
  if (!it) return null;

  const isDrink = it.tags?.includes('drink');
  const assignedIds = it.assignedTo;
  const baseName = it.name.replace(/\s*\(\d+\)\s*$/, '').trim();
  const likeItemCount = allItems.filter(
    (i) => i.name.replace(/\s*\(\d+\)\s*$/, '').trim() === baseName
  ).length;
  const canConsolidate = likeItemCount > 1;

  const handleTogglePerson = (personId: string) => {
    const already = assignedIds.includes(personId);
    const updated = already
      ? assignedIds.filter((id) => id !== personId)
      : [...assignedIds, personId];
    onSplitAmong(it.id, updated);
  };

  return (
    <SwipeSheet
      visible={item !== null}
      onClose={onClose}
      blur
      headerStyle={styles.pad}
      header={
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{it.name}</Text>
          <Text style={styles.itemPrice}>{formatCurrency(it.price)}</Text>
        </View>
      }
    >
      <SheetScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>

        {/* Assign To */}
        <Text style={styles.sectionLabel}>Assign To</Text>
        <View style={styles.peopleGrid}>
          {people.map((person) => {
            const selected = assignedIds.includes(person.id);
            return (
              <TouchableOpacity
                key={person.id}
                style={[styles.personToggle, selected && styles.personToggleActive]}
                onPress={() => handleTogglePerson(person.id)}
              >
                <Text style={[styles.personToggleText, selected && styles.personToggleTextActive]}>
                  {person.name}
                </Text>
                <Text style={[styles.personToggleCheck, { opacity: selected ? 1 : 0 }]}>✓</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quantity split */}
        {(it.quantity > 1 || canConsolidate) && (
          <>
            <Text style={styles.sectionLabel}>Quantity</Text>
            {it.quantity > 1 && (
              <TouchableOpacity style={styles.actionRow} onPress={() => { onSplitIntoUnits(it.id); onClose(); }}>
                <View>
                  <Text style={styles.actionLabel}>Split into {it.quantity} individual items</Text>
                  <Text style={styles.actionHint}>{formatCurrency((it.price / it.quantity))} each</Text>
                </View>
                <Text style={styles.actionArrow}>→</Text>
              </TouchableOpacity>
            )}
            {canConsolidate && (
              <TouchableOpacity style={styles.actionRow} onPress={() => { onConsolidateLikeItems(it.id); onClose(); }}>
                <View>
                  <Text style={styles.actionLabel}>Consolidate like items</Text>
                  <Text style={styles.actionHint}>Merge all "{baseName}" into one line</Text>
                </View>
                <Text style={styles.actionArrow}>→</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Drink actions */}
        <Text style={styles.sectionLabel}>Drinks</Text>
        <TouchableOpacity style={styles.actionRow} onPress={() => onToggleDrink(it.id)}>
          <Text style={styles.actionLabel}>
            {isDrink ? '🍹 Marked as drink  ·  tap to remove' : 'Mark as drink'}
          </Text>
        </TouchableOpacity>
        {isDrink && (
          <TouchableOpacity style={styles.actionRow} onPress={() => { onSplitDrinksEvenly(); onClose(); }}>
            <View>
              <Text style={styles.actionLabel}>Split all drinks evenly</Text>
              <Text style={styles.actionHint}>Splits every drink item across all people</Text>
            </View>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>
        )}

      </SheetScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SwipeSheet>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 24 },
  itemHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  itemName: { fontSize: 17, fontWeight: '700', color: colors.textDim, flex: 1 },
  itemPrice: { fontSize: 17, fontWeight: '700', color: colors.textDim },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.60)',
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 16, marginBottom: 8,
  },
  peopleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  personToggleActive: {
    backgroundColor: 'rgba(220,220,220,0.95)',
    borderColor: 'rgba(255,255,255,0.80)',
  },
  personToggleText: { fontSize: 14, fontWeight: '500', color: '#C0C0C0' },
  personToggleTextActive: { color: '#000000' },
  personToggleCheck: { fontSize: 12, color: '#000000' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  actionLabel: { fontSize: 15, color: colors.textDim, fontWeight: '500' },
  actionHint: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  actionArrow: { fontSize: 16, color: 'rgba(255,255,255,0.55)' },
  footer: { paddingHorizontal: 24, paddingTop: 16 },
  closeBtn: {
    height: 52,
    backgroundColor: 'rgba(220,220,220,0.95)',
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.40)',
  },
  closeBtnText: { color: '#000', fontSize: 16, fontWeight: '600' },
});
