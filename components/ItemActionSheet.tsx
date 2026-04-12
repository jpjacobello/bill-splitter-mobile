import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { BlurView } from 'expo-blur';
import { ReceiptItem, Person } from '../types';

type Props = {
  item: ReceiptItem | null;
  people: Person[];
  onClose: () => void;
  onSplitAmong: (itemId: string, personIds: string[]) => void;
  onSplitIntoUnits: (itemId: string) => void;
  onToggleDrink: (itemId: string) => void;
  onSplitDrinksEvenly: () => void;
};

export default function ItemActionSheet({
  item, people, onClose,
  onSplitAmong, onSplitIntoUnits, onToggleDrink, onSplitDrinksEvenly,
}: Props) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (item) {
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [item]);

  if (!item) return null;

  const isDrink = item.tags?.includes('drink');
  const assignedIds = item.assignedTo;

  const handleSplitAmong = (count: number) => {
    const targets = people.slice(0, count).map((p) => p.id);
    onSplitAmong(item.id, targets);
    onClose();
  };

  const handleTogglePerson = (personId: string) => {
    const already = assignedIds.includes(personId);
    const updated = already
      ? assignedIds.filter((id) => id !== personId)
      : [...assignedIds, personId];
    onSplitAmong(item.id, updated);
  };

  const handleSplitIntoUnits = () => {
    onSplitIntoUnits(item.id);
    onClose();
  };

  const handleToggleDrink = () => {
    onToggleDrink(item.id);
  };

  const handleSplitDrinksEvenly = () => {
    onSplitDrinksEvenly();
    onClose();
  };

  return (
    <Modal transparent animationType="none" visible={!!item} onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Glass background */}
        <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={85} />
        <View style={[StyleSheet.absoluteFill, styles.glassSheen]} />

        {/* Handle */}
        <View style={styles.handle} />

        {/* Item header */}
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

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
                  {selected && <Text style={styles.personToggleCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quantity split */}
          {item.quantity > 1 && (
            <>
              <Text style={styles.sectionLabel}>Quantity</Text>
              <TouchableOpacity style={styles.actionRow} onPress={handleSplitIntoUnits}>
                <View>
                  <Text style={styles.actionLabel}>Split into {item.quantity} individual items</Text>
                  <Text style={styles.actionHint}>${(item.price / item.quantity).toFixed(2)} each</Text>
                </View>
                <Text style={styles.actionArrow}>→</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Drink actions */}
          <Text style={styles.sectionLabel}>Drinks</Text>
          <TouchableOpacity style={styles.actionRow} onPress={handleToggleDrink}>
            <Text style={styles.actionLabel}>
              {isDrink ? '🍹 Marked as drink  ·  tap to remove' : 'Mark as drink'}
            </Text>
          </TouchableOpacity>
          {isDrink && (
            <TouchableOpacity style={styles.actionRow} onPress={handleSplitDrinksEvenly}>
              <View>
                <Text style={styles.actionLabel}>Split all drinks evenly</Text>
                <Text style={styles.actionHint}>Splits every drink item across all people</Text>
              </View>
              <Text style={styles.actionArrow}>→</Text>
            </TouchableOpacity>
          )}

        </ScrollView>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '80%',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  glassSheen: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center', marginBottom: 16,
  },
  itemHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  itemName: { fontSize: 17, fontWeight: '700', color: '#D0D0D0', flex: 1 },
  itemPrice: { fontSize: 17, fontWeight: '700', color: '#D0D0D0' },
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
  actionLabel: { fontSize: 15, color: '#D0D0D0', fontWeight: '500' },
  actionHint: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  actionArrow: { fontSize: 16, color: 'rgba(255,255,255,0.55)' },
  closeBtn: {
    marginTop: 20, height: 52,
    backgroundColor: 'rgba(220,220,220,0.95)',
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.40)',
  },
  closeBtnText: { color: '#000', fontSize: 16, fontWeight: '600' },
});
