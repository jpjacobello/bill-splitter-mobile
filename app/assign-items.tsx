import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  ScrollView, FlatList, TextInput, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import ItemActionSheet from '../components/ItemActionSheet';
import { useBillStore } from '../store/useBillStore';
import { getUnassignedTotal } from '../utils/calcSplit';
import { getEmoji } from '../utils/buildReceiptHtml';
import { ReceiptItem, Person } from '../types';

// ─── Person color palette ─────────────────────────────────────────────────────

const PERSON_COLORS = [
  '#4F8EF7', // blue
  '#F7874F', // orange
  '#A855F7', // purple
  '#22C55E', // green
  '#F43F5E', // rose
  '#14B8A6', // teal
  '#EAB308', // yellow
  '#EC4899', // pink
];

function getPersonColor(index: number) {
  return PERSON_COLORS[index % PERSON_COLORS.length];
}

// ─── Item row ─────────────────────────────────────────────────────────────────

type ItemRowProps = {
  item: ReceiptItem;
  people: Person[];
  selectedPersonId: string;
  onLongPress: () => void;
  onRowPress: () => void;
  onAvatarPress: (personId: string, currentlyAssigned: boolean) => void;
};

function ItemRow({ item, people, onLongPress, onRowPress }: ItemRowProps) {
  const isUnassigned = item.assignedTo.length === 0;
  const assignedPeople = people.filter((p) => item.assignedTo.includes(p.id));

  return (
    <TouchableOpacity
      style={[
        styles.itemChip,
        isUnassigned ? styles.itemChipUnassigned : styles.itemChipAssigned,
      ]}
      onPress={onRowPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.7}
    >
      <Text style={styles.itemEmoji}>{getEmoji(item.name)}</Text>
      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
      {assignedPeople.length > 0 && (
        <View style={styles.itemAvatarRow}>
          {assignedPeople.map((p) => {
            const index = people.indexOf(p);
            const color = getPersonColor(index);
            const initials = p.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <View key={p.id} style={[styles.itemAvatar, { backgroundColor: color + '33', borderColor: color + '88' }]}>
                <Text style={[styles.itemAvatarText, { color }]}>{initials}</Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

type UndoEntry = {
  itemId: string;
  previousAssignedTo: string[];
};

export default function AssignItemsScreen() {
  const router = useRouter();
  const { receipt, people, assignItem, splitItemEvenly, splitIntoIndividualUnits, updateItem, addPerson, removePerson } = useBillStore();
  const [selectedPersonId, setSelectedPersonId] = useState<string>(people[0]?.id ?? '');
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [activeItem, setActiveItem] = useState<ReceiptItem | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [personInput, setPersonInput] = useState('');
  const personInputRef = useRef<TextInput>(null);

  // Computed before early return so hooks are unconditional
  const allAssigned = !!receipt && receipt.items.length > 0 &&
    receipt.items.every((i) => i.assignedTo.length > 0);
  const prevAllAssigned = useRef(false);

  useEffect(() => {
    if (allAssigned && !prevAllAssigned.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevAllAssigned.current = allAssigned;
  }, [allAssigned]);

  if (!receipt) return null;

  const totalItems = receipt.items.length;
  const assignedItems = receipt.items.filter((i) => i.assignedTo.length > 0);
  const unassignedItems = receipt.items.filter((i) => i.assignedTo.length === 0);
  const unassignedTotal = getUnassignedTotal(receipt);
  const progress = totalItems > 0 ? assignedItems.length / totalItems : 0;

  const pushUndo = (item: ReceiptItem) => {
    setUndoStack((prev) => [
      ...prev.slice(-9),
      { itemId: item.id, previousAssignedTo: item.assignedTo },
    ]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    assignItem(last.itemId, last.previousAssignedTo);
    setUndoStack((prev) => prev.slice(0, -1));
  };

  const handleLongPressItem = (item: ReceiptItem) => {
    setActiveItem(item);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handleSplitAll = () => {
    receipt.items.forEach((item) => {
      pushUndo(item);
      splitItemEvenly(item.id);
    });
  };

  const handleAssignAllToSelected = () => {
    receipt.items.forEach((item) => {
      if (item.assignedTo.includes(selectedPersonId)) return;
      pushUndo(item);
      assignItem(item.id, [...item.assignedTo, selectedPersonId]);
    });
  };

  const handleRemoveAllFromSelected = () => {
    receipt.items.forEach((item) => {
      if (!item.assignedTo.includes(selectedPersonId)) return;
      pushUndo(item);
      assignItem(item.id, item.assignedTo.filter((id) => id !== selectedPersonId));
    });
  };

  const handleClearAll = () => {
    receipt.items.forEach((item) => {
      if (item.assignedTo.length === 0) return;
      pushUndo(item);
      assignItem(item.id, []);
    });
  };

  const handleSplitRemaining = () => {
    unassignedItems.forEach((item) => {
      pushUndo(item);
      splitItemEvenly(item.id);
    });
  };

  const handleSelectPerson = (id: string) => {
    setSelectedPersonId(id);
  };

  const handleAddPerson = () => {
    if (!personInput.trim()) return;
    addPerson(personInput.trim());
    setPersonInput('');
    setTimeout(() => personInputRef.current?.focus(), 50);
  };

  const handlePickContact = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return;
    const contact = await Contacts.presentContactPickerAsync();
    if (contact) {
      const resolved = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ');
      if (resolved) {
        addPerson(resolved);
        setTimeout(() => personInputRef.current?.focus(), 50);
      }
    }
  };

  const handleRemovePerson = (person: Person) => {
    if (person.isHost) return;
    removePerson(person.id);
    if (selectedPersonId === person.id) {
      setSelectedPersonId(people.find((p) => p.id !== person.id)?.id ?? '');
    }
  };

  // Action sheet callbacks
  const handleSheetSplitAmong = (itemId: string, personIds: string[]) => {
    const item = receipt.items.find((i) => i.id === itemId);
    if (item) pushUndo(item);
    assignItem(itemId, personIds);
  };

  const handleSheetSplitIntoUnits = (itemId: string) => {
    const item = receipt.items.find((i) => i.id === itemId);
    if (item) pushUndo(item);
    splitIntoIndividualUnits(itemId);
  };

  const handleToggleDrink = (itemId: string) => {
    const item = receipt.items.find((i) => i.id === itemId);
    if (!item) return;
    const isDrink = item.tags?.includes('drink');
    const tags = isDrink
      ? (item.tags ?? []).filter((t) => t !== 'drink')
      : [...(item.tags ?? []), 'drink' as const];
    updateItem(itemId, { tags });
    setActiveItem({ ...item, tags });
  };

  const handleSplitDrinksEvenly = () => {
    const drinkItems = receipt.items.filter((i) => i.tags?.includes('drink'));
    drinkItems.forEach((item) => {
      pushUndo(item);
      splitItemEvenly(item.id);
    });
  };

  const liveActiveItem = activeItem
    ? receipt.items.find((i) => i.id === activeItem.id) ?? null
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Assign Items</Text>
        </View>

        {/* Top actions */}
        <View style={styles.topActionsRow}>
          <TouchableOpacity style={styles.topActionBtnSecondary} onPress={handleSplitAll}>
            <Text style={styles.topActionBtnTextSecondary}>Split evenly</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topActionBtnGhost} onPress={handleClearAll}>
            <Text style={styles.topActionBtnTextGhost}>Clear all</Text>
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, allAssigned && styles.progressLabelDone]}>
            {allAssigned ? 'All items assigned ✓' : `${assignedItems.length} / ${totalItems} items assigned`}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }, allAssigned && styles.progressFillDone]} />
        </View>

        {/* Person chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.peopleScroll}
          contentContainerStyle={styles.peopleRow}
        >
          {people.map((person, personIndex) => {
            const isSelected = person.id === selectedPersonId;
            const assignedCount = receipt.items.filter((i) =>
              i.assignedTo.includes(person.id)
            ).length;
            const initials = person.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
            const personColor = getPersonColor(personIndex);
            return (
              <TouchableOpacity
                key={person.id}
                style={[styles.personChip, isSelected && { backgroundColor: personColor + '22', borderColor: personColor + '66' }]}
                onPress={() => handleSelectPerson(person.id)}
                onLongPress={() => !person.isHost && handleRemovePerson(person)}
                delayLongPress={500}
                activeOpacity={0.75}
              >
                <View style={[styles.avatar, { backgroundColor: personColor + '33', borderColor: personColor + '88' }]}>
                  <Text style={[styles.avatarText, { color: personColor }]}>{initials}</Text>
                </View>
                <View>
                  <Text style={[styles.personChipText, isSelected && { color: '#E0E0E0' }]}>
                    {person.name}
                  </Text>
                  {isSelected && (
                    <Text style={[styles.personChipCount, { color: personColor }]}>
                      {assignedCount}/{totalItems} items
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.addPersonChip}
            onPress={() => {
              setShowAddPerson((v) => !v);
              if (!showAddPerson) setTimeout(() => personInputRef.current?.focus(), 50);
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.addPersonChipText}>{showAddPerson ? '✕' : '+'}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Per-person quick actions */}
        {(() => {
          const sel = people.find((p) => p.id === selectedPersonId);
          if (!sel) return null;
          const firstName = sel.name.split(' ')[0];
          return (
            <View style={styles.personActionsRow}>
              <TouchableOpacity style={styles.personActionBtn} onPress={handleAssignAllToSelected}>
                <Text style={styles.personActionBtnText} numberOfLines={1} ellipsizeMode="tail">Assign all to {firstName}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.personActionBtn, styles.personActionBtnDestructive]} onPress={handleRemoveAllFromSelected}>
                <Text style={[styles.personActionBtnText, styles.personActionBtnTextDestructive]} numberOfLines={1}>Remove all</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {showAddPerson && (
          <View style={styles.addPersonRow}>
            <TextInput
              ref={personInputRef}
              style={styles.addPersonInput}
              placeholder="Name"
              placeholderTextColor="#555"
              value={personInput}
              onChangeText={setPersonInput}
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                if (personInput.trim()) {
                  handleAddPerson();
                } else {
                  setShowAddPerson(false);
                  Keyboard.dismiss();
                }
              }}
              autoCapitalize="words"
            />
            <TouchableOpacity style={styles.addPersonConfirmBtn} onPress={handleAddPerson}>
              <Text style={styles.addPersonConfirmText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactBtn} onPress={handlePickContact}>
              <Ionicons name="person-circle-outline" size={26} color="#AAA" />
            </TouchableOpacity>
          </View>
        )}

      </View>

      {/* Items list */}
      <FlatList
        data={receipt.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            people={people}
            selectedPersonId={selectedPersonId}
            onLongPress={() => handleLongPressItem(item)}
            onRowPress={() => {
              pushUndo(item);
              const assigned = item.assignedTo.includes(selectedPersonId);
              const updated = assigned
                ? item.assignedTo.filter((id) => id !== selectedPersonId)
                : [...item.assignedTo, selectedPersonId];
              assignItem(item.id, updated);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            onAvatarPress={() => {}}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        ListFooterComponent={
          unassignedItems.length > 0 ? (
            <View style={styles.footer}>
              <View style={styles.unassignedSummary}>
                <Text style={styles.unassignedSummaryTitle}>
                  {unassignedItems.length} item{unassignedItems.length !== 1 ? 's' : ''} unassigned
                  · ${unassignedTotal.toFixed(2)}
                </Text>
                <TouchableOpacity style={styles.splitRemainingBtn} onPress={handleSplitRemaining}>
                  <Text style={styles.splitRemainingText}>Split remaining evenly</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
      />

      {/* Fixed bottom button */}
      <View style={[styles.stickyFooter, allAssigned && styles.summaryBtnDoneWrapper]}>
        <Button
          label={allAssigned ? 'See Summary →' : 'See Summary'}
          onPress={() => router.push('/summary')}
          height={60}
        />
      </View>

      {/* Action sheet */}
      <ItemActionSheet
        item={liveActiveItem}
        people={people}
        onClose={() => setActiveItem(null)}
        onSplitAmong={handleSheetSplitAmong}
        onSplitIntoUnits={handleSheetSplitIntoUnits}
        onToggleDrink={handleToggleDrink}
        onSplitDrinksEvenly={handleSplitDrinksEvenly}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#151515' },
  header: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#3C3C3C',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#D0D0D0' },
  topActionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  undoBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#252525', borderRadius: 10,
  },
  undoBtnText: { fontSize: 13, fontWeight: '600', color: '#D0D0D0' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: '600', color: '#777' },
  progressLabelDone: { color: '#16A34A' },
  progressTrack: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, marginBottom: 14, overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: 'rgba(220,220,220,0.60)', borderRadius: 2 },
  progressFillDone: { backgroundColor: '#16A34A' },
  summaryBtnDoneWrapper: {
    shadowColor: '#16A34A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  topActionBtnSecondary: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(220,220,220,0.13)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  topActionBtnTextSecondary: { fontSize: 13, fontWeight: '600', color: '#D0D0D0' },
  topActionBtnGhost: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(220,38,38,0.45)',
    backgroundColor: 'rgba(220,38,38,0.12)',
  },
  topActionBtnTextGhost: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  itemAvatarRow: { flexDirection: 'row', gap: 2 },
  itemAvatar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  itemAvatarText: { fontSize: 8, fontWeight: '700', color: '#D0D0D0' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1, paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#D0D0D0' },
  peopleScroll: { marginHorizontal: -24 },
  peopleRow: { paddingHorizontal: 24, gap: 10, paddingBottom: 4, alignItems: 'center' },
  addPersonChip: {
    height: 38, width: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  addPersonChipText: { fontSize: 18, color: '#AAA', lineHeight: 22 },
  addPersonRow: {
    flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center',
  },
  addPersonInput: {
    flex: 1, height: 40,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 12, paddingHorizontal: 12,
    fontSize: 15, color: '#D0D0D0',
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  addPersonConfirmBtn: {
    height: 40, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  addPersonConfirmText: { fontSize: 14, fontWeight: '600', color: '#D0D0D0' },
  contactBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.11)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  personChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)', gap: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  personChipActive: { backgroundColor: 'rgba(220,220,220,0.95)', borderColor: 'rgba(255,255,255,0.40)' },
  avatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarActive: { backgroundColor: 'rgba(0,0,0,0.15)', borderColor: 'transparent' },
  avatarText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  avatarTextActive: { color: '#000' },
  personChipText: { fontSize: 13, fontWeight: '600', color: '#B8B8B8' },
  personChipTextActive: { color: '#000000' },
  personChipCount: { fontSize: 10, color: '#888', marginTop: 1 },
  personChipCountActive: { color: 'rgba(0,0,0,0.5)' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  stickyFooter: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8, backgroundColor: '#151515' },

  // Item chip
  itemChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  itemChipAssigned: { borderColor: 'rgba(22,163,74,0.40)', backgroundColor: 'rgba(22,163,74,0.08)' },
  itemChipUnassigned: { borderColor: 'rgba(245,158,11,0.40)', backgroundColor: 'rgba(245,158,11,0.07)' },
  itemEmoji: { fontSize: 18 },
  itemName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#D0D0D0' },
  itemRight: { alignItems: 'flex-end', gap: 2 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: '#D0D0D0' },
  itemAssignedCount: { fontSize: 11, color: '#16A34A', fontWeight: '600' },
  footer: { paddingTop: 8, gap: 12 },
  footerRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  receiptBtn: {
    width: 52, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  summaryBtnFlex: { flex: 1 },
  unassignedSummary: {
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: 'rgba(245,158,11,0.30)', gap: 10,
  },
  unassignedSummaryTitle: { fontSize: 14, fontWeight: '600', color: '#F59E0B' },
  splitRemainingBtn: {
    backgroundColor: '#D8D8D8', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  splitRemainingText: { fontSize: 14, fontWeight: '600', color: '#000' },
  personActionsRow: {
    flexDirection: 'row', gap: 8, marginTop: 10,
  },
  personActionBtn: {
    flex: 1, height: 34,
    backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  personActionBtnDestructive: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    borderColor: 'rgba(220,38,38,0.45)',
  },
  personActionBtnText: { fontSize: 13, fontWeight: '600', color: '#D0D0D0' },
  personActionBtnTextDestructive: { color: '#DC2626' },
});
