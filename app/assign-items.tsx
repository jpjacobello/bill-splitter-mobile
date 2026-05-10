import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Animated,
  ScrollView, FlatList, TextInput, Keyboard, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '../components/Button';
import ItemActionSheet from '../components/ItemActionSheet';
import { useBillStore } from '../store/useBillStore';
import { getUnassignedTotal } from '../utils/calcSplit';
import { getEmoji } from '../utils/buildReceiptHtml';
import { ReceiptItem, Person, SavedGroup } from '../types';
import { usePro } from '../hooks/usePro';
import { getSavedGroups, saveGroup, deleteSavedGroup } from '../utils/proStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIP_REMINDER_KEY, TipReminderMode } from './settings';

const PERSON_COLORS = [
  '#4F8EF7',
  '#F7874F',
  '#A855F7',
  '#22C55E',
  '#F43F5E',
  '#14B8A6',
  '#EAB308',
  '#EC4899',
];

function getPersonColor(index: number) {
  return PERSON_COLORS[index % PERSON_COLORS.length];
}

// ─── Item row ────────────────────────────────────────────────────────────────

type ItemRowProps = {
  item: ReceiptItem;
  people: Person[];
  selectedPersonId: string;
  onLongPress: () => void;
  onRowPress: () => void;
  onAvatarPress: (personId: string, currentlyAssigned: boolean) => void;
};

function ItemRow({ item, people, onLongPress, onRowPress }: ItemRowProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const isUnassigned = item.assignedTo.length === 0;
  const assignedPeople = people.filter((p) => item.assignedTo.includes(p.id));

  const handlePress = () => {
    scale.setValue(0.96);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 10,
    }).start();
    onRowPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          styles.itemChip,
          isUnassigned ? styles.itemChipUnassigned : styles.itemChipAssigned,
        ]}
        onPress={handlePress}
        onLongPress={onLongPress}
        delayLongPress={400}
        activeOpacity={0.85}
      >
        <Text style={styles.itemEmoji}>{getEmoji(item.name)}</Text>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        {assignedPeople.length > 0 && (
          <View style={styles.itemAvatarRow}>
            {assignedPeople.slice(0, 5).map((p) => {
              const index = people.indexOf(p);
              const color = getPersonColor(index);
              const initials = p.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <View key={p.id} style={[styles.itemAvatar, { backgroundColor: color + '33', borderColor: color + '88' }]}>
                  <Text style={[styles.itemAvatarText, { color }]}>{initials}</Text>
                </View>
              );
            })}
            {assignedPeople.length > 5 && (
              <View style={styles.itemAvatarOverflow}>
                <Text style={styles.itemAvatarOverflowText}>+{assignedPeople.length - 5}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

type UndoEntry = {
  itemId: string;
  previousAssignedTo: string[];
};

export default function AssignItemsScreen() {
  const router = useRouter();
  const { receipt, people, assignItem, splitItemEvenly, splitIntoIndividualUnits, consolidateLikeItems, updateItem, addPerson, removePerson } = useBillStore();
  const { isPro } = usePro();
  const [selectedPersonId, setSelectedPersonId] = useState<string>(people[0]?.id ?? '');
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [activeItem, setActiveItem] = useState<ReceiptItem | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [personInput, setPersonInput] = useState('');
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [newMemberInput, setNewMemberInput] = useState('');
  const personInputRef = useRef<TextInput>(null);
  const peopleScrollRef = useRef<ScrollView>(null);
  const newMemberInputRef = useRef<TextInput>(null);
  const [tipReminderMode, setTipReminderMode] = useState<TipReminderMode>('always');

  useEffect(() => {
    AsyncStorage.getItem(TIP_REMINDER_KEY).then((val) => {
      if (val) setTipReminderMode(val as TipReminderMode);
    });
  }, []);

  const allAssigned = !!receipt && receipt.items.length > 0 &&
    receipt.items.every((i) => i.assignedTo.length > 0);

  const calculatedTotal = receipt
    ? receipt.subtotal + receipt.tax + (receipt.fees ?? 0) + receipt.tip
    : 0;
  const hasReceiptIssue = tipReminderMode === 'always' && !!receipt && (
    receipt.tip === 0 ||
    Math.abs(calculatedTotal - receipt.total) >= 0.05
  );
  const prevAllAssigned = useRef(false);

  useEffect(() => {
    if (allAssigned && !prevAllAssigned.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevAllAssigned.current = allAssigned;
  }, [allAssigned]);

  if (!receipt) return null;

  const assignableItems = receipt.items.filter((i) => i.price >= 0);
  const totalItems = assignableItems.length;
  const assignedCount = assignableItems.filter((i) => i.assignedTo.length > 0).length;
  const unassignedItems = assignableItems.filter((i) => i.assignedTo.length === 0);
  const unassignedTotal = getUnassignedTotal(receipt);
  const progress = totalItems > 0 ? assignedCount / totalItems : 0;

  const pushUndo = (item: ReceiptItem) => {
    setUndoStack((prev) => [...prev.slice(-9), { itemId: item.id, previousAssignedTo: item.assignedTo }]);
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
    assignableItems.forEach((item) => { pushUndo(item); splitItemEvenly(item.id); });
  };

  const handleClearAll = () => {
    assignableItems.forEach((item) => {
      if (item.assignedTo.length === 0) return;
      pushUndo(item);
      assignItem(item.id, []);
    });
  };

  const handleSplitRemaining = () => {
    unassignedItems.forEach((item) => { pushUndo(item); splitItemEvenly(item.id); });
  };

  const handleSelectPerson = (id: string) => setSelectedPersonId(id);

  const handlePersonLongPress = (person: Person) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPersonId(person.id);
    const firstName = person.name.split(' ')[0];
    const options: any[] = [
      {
        text: `Assign all to ${firstName}`,
        onPress: () => {
          assignableItems.forEach((item) => {
            if (item.assignedTo.includes(person.id)) return;
            pushUndo(item);
            assignItem(item.id, [...item.assignedTo, person.id]);
          });
        },
      },
      {
        text: `Remove all from ${firstName}`,
        style: 'destructive',
        onPress: () => {
          assignableItems.forEach((item) => {
            if (!item.assignedTo.includes(person.id)) return;
            pushUndo(item);
            assignItem(item.id, item.assignedTo.filter((id) => id !== person.id));
          });
        },
      },
    ];
    if (!person.isHost) {
      options.push({
        text: 'Remove from split',
        style: 'destructive',
        onPress: () => {
          removePerson(person.id);
          if (selectedPersonId === person.id) {
            setSelectedPersonId(people.find((p) => p.id !== person.id)?.id ?? '');
          }
        },
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(person.name, undefined, options);
  };

  const handleAddPerson = () => {
    if (!personInput.trim()) return;
    addPerson(personInput.trim());
    setPersonInput('');
    setTimeout(() => {
      personInputRef.current?.focus();
      peopleScrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
  };

  const handlePickContact = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return;
    const contact = await Contacts.presentContactPickerAsync();
    if (!contact) return;

    const resolved = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ');
    if (!resolved) return;

    addPerson(resolved);
    setTimeout(() => personInputRef.current?.focus(), 50);
  };

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

  const handleSheetConsolidate = (itemId: string) => {
    const item = receipt.items.find((i) => i.id === itemId);
    if (item) pushUndo(item);
    consolidateLikeItems(itemId);
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

  const handleOpenGroups = async () => {
    if (!isPro) {
      Alert.alert('Divi Pro', 'Saved groups are a Pro feature. Upgrade in Settings.', [{ text: 'OK' }]);
      return;
    }
    const groups = await getSavedGroups();
    setSavedGroups(groups);
    setNewGroupName('');
    setNewGroupMembers([]);
    setNewMemberInput('');
    setShowGroupsModal(true);
  };

  const handleLoadGroup = (group: SavedGroup) => {
    people.filter((p) => !p.isHost).forEach((p) => removePerson(p.id));
    group.members.forEach((name) => addPerson(name));
    setShowGroupsModal(false);
    setTimeout(() => peopleScrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleAddNewMember = () => {
    const name = newMemberInput.trim();
    if (!name) return;
    setNewGroupMembers((prev) => [...prev, name]);
    setNewMemberInput('');
    setTimeout(() => newMemberInputRef.current?.focus(), 50);
  };

  const handleRemoveNewMember = (index: number) => {
    setNewGroupMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveGroup = async () => {
    const name = newGroupName.trim();
    if (!name || newGroupMembers.length === 0) return;
    await saveGroup({ name, members: newGroupMembers });
    const updated = await getSavedGroups();
    setSavedGroups(updated);
    setNewGroupName('');
    setNewGroupMembers([]);
    setNewMemberInput('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeleteGroup = async (id: string) => {
    Alert.alert('Delete Group?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteSavedGroup(id);
          const updated = await getSavedGroups();
          setSavedGroups(updated);
        },
      },
    ]);
  };

  const handleSplitDrinksEvenly = () => {
    const drinkItems = receipt.items.filter((i) => i.tags?.includes('drink'));
    drinkItems.forEach((item) => { pushUndo(item); splitItemEvenly(item.id); });
  };

  const liveActiveItem = activeItem ? receipt.items.find((i) => i.id === activeItem.id) ?? null : null;

  const progressBarWidth = `${progress * 100}%` as any;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Assign Items</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.receiptEditBtn, hasReceiptIssue && styles.receiptEditBtnWarning]}
              onPress={() => router.push('/receipt-review?from=assign-items')}
              activeOpacity={0.75}
            >
              {hasReceiptIssue && <Ionicons name="warning-outline" size={14} color="#F59E0B" />}
              <Text style={[styles.receiptEditText, hasReceiptIssue && styles.receiptEditTextWarning]}>
                Edit Receipt
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.groupsBtn} onPress={handleOpenGroups} activeOpacity={0.75}>
              <Ionicons name="people-outline" size={20} color="#888" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress label */}
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, allAssigned && styles.progressLabelDone]}>
            {allAssigned ? 'All items assigned ✓' : `${assignedCount} / ${totalItems} assigned`}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.topActionsRow}>
          <TouchableOpacity style={styles.splitEvenlyBtn} onPress={handleSplitAll} activeOpacity={0.75}>
            <Text style={styles.splitEvenlyBtnText}>Split evenly</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAll} activeOpacity={0.75}>
            <Text style={styles.clearAllBtnText}>Clear all</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFillWrapper, { width: progressBarWidth }]}>
            {allAssigned ? (
              <LinearGradient colors={['#16A34A', '#22C55E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.progressFill} />
            ) : (
              <View style={[styles.progressFill, styles.progressFillActive]} />
            )}
          </Animated.View>
        </View>

        {/* Person chips */}
        <ScrollView
          ref={peopleScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.peopleScroll}
          contentContainerStyle={styles.peopleRow}
        >
          {people.map((person, personIndex) => {
            const isSelected = person.id === selectedPersonId;
            const count = receipt.items.filter((i) => i.assignedTo.includes(person.id)).length;
            const initials = person.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
            const personColor = getPersonColor(personIndex);
            return (
              <TouchableOpacity
                key={person.id}
                style={[styles.personChip, isSelected && { backgroundColor: personColor + '22', borderColor: personColor }]}
                onPress={() => handleSelectPerson(person.id)}
                onLongPress={() => handlePersonLongPress(person)}
                delayLongPress={400}
                activeOpacity={0.75}
              >
                <View style={[styles.avatar, { backgroundColor: personColor + '33', borderColor: personColor + '88' }]}>
                  <Text style={[styles.avatarText, { color: personColor }]}>{initials}</Text>
                </View>
                <View>
                  <Text style={[styles.personChipText, isSelected && { color: '#E8E8E8' }]}>
                    {person.name}
                  </Text>
                  {isSelected && (
                    <Text style={[styles.personChipCount, { color: personColor }]}>
                      {count}/{totalItems} items
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.addPersonChip}
            onPress={() => {
              const opening = !showAddPerson;
              setShowAddPerson(opening);
              if (opening) {
                setTimeout(() => {
                  peopleScrollRef.current?.scrollToEnd({ animated: true });
                  personInputRef.current?.focus();
                }, 50);
              }
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.addPersonChipText}>{showAddPerson ? '✕' : '+'}</Text>
          </TouchableOpacity>
        </ScrollView>

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
        data={assignableItems}
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
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListFooterComponent={
          unassignedItems.length > 0 ? (
            <View style={styles.footer}>
              <View style={styles.unassignedSummary}>
                <Text style={styles.unassignedSummaryTitle}>
                  {unassignedItems.length} item{unassignedItems.length !== 1 ? 's' : ''} unassigned · ${unassignedTotal.toFixed(2)}
                </Text>
                <TouchableOpacity style={styles.splitRemainingBtn} onPress={handleSplitRemaining} activeOpacity={0.8}>
                  <Text style={styles.splitRemainingText}>Split remaining evenly</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
      />

      {/* Fixed bottom button */}
      <View style={[styles.stickyFooter, allAssigned && styles.stickyFooterDone]}>
        <Button
          label={allAssigned ? 'See Summary →' : 'See Summary'}
          onPress={() => router.push('/summary')}
          height={60}
        />
      </View>

      <ItemActionSheet
        item={liveActiveItem}
        people={people}
        allItems={receipt.items}
        onClose={() => setActiveItem(null)}
        onSplitAmong={handleSheetSplitAmong}
        onSplitIntoUnits={handleSheetSplitIntoUnits}
        onConsolidateLikeItems={handleSheetConsolidate}
        onToggleDrink={handleToggleDrink}
        onSplitDrinksEvenly={handleSplitDrinksEvenly}
      />

      <Modal
        visible={showGroupsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGroupsModal(false)}
      >
        <SafeAreaView style={styles.groupsContainer} edges={['top', 'left', 'right']}>
          <View style={styles.groupsHeader}>
            <Text style={styles.groupsTitle}>Groups</Text>
            <TouchableOpacity onPress={() => setShowGroupsModal(false)} style={styles.groupsCloseBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.groupsScroll} keyboardShouldPersistTaps="handled">

            {/* ── Create new group ── */}
            <Text style={styles.groupsSectionLabel}>New Group</Text>
            <TextInput
              style={styles.groupNameInput}
              placeholder="Group name (e.g. Work Team)"
              placeholderTextColor="#555"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => {
                if (newGroupName.trim()) {
                  newMemberInputRef.current?.focus();
                }
              }}
            />

            {newGroupMembers.length > 0 && (
              <View style={styles.membersList}>
                {newGroupMembers.map((name, index) => (
                  <View key={index} style={styles.memberChip}>
                    <Text style={styles.memberChipText}>{name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveNewMember(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={14} color="#888" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.addMemberRow}>
              <TextInput
                ref={newMemberInputRef}
                style={styles.addMemberInput}
                placeholder="Add a name"
                placeholderTextColor="#555"
                value={newMemberInput}
                onChangeText={setNewMemberInput}
                autoCapitalize="words"
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  if (newMemberInput.trim()) {
                    handleAddNewMember();
                  } else {
                    newMemberInputRef.current?.blur();
                  }
                }}
              />
              <TouchableOpacity
                style={[styles.addMemberBtn, !newMemberInput.trim() && { opacity: 0.4 }]}
                onPress={handleAddNewMember}
                disabled={!newMemberInput.trim()}
                activeOpacity={0.75}
              >
                <Text style={styles.addMemberBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.saveGroupBtn, (!newGroupName.trim() || newGroupMembers.length === 0) && { opacity: 0.4 }]}
              onPress={handleSaveGroup}
              disabled={!newGroupName.trim() || newGroupMembers.length === 0}
              activeOpacity={0.75}
            >
              <Text style={styles.saveGroupBtnText}>
                Save Group{newGroupMembers.length > 0 ? ` (${newGroupMembers.length})` : ''}
              </Text>
            </TouchableOpacity>

            {/* ── Saved groups ── */}
            {savedGroups.length > 0 && (
              <>
                <Text style={[styles.groupsSectionLabel, { marginTop: 32 }]}>Your Groups</Text>
                {savedGroups.map((group) => (
                  <View key={group.id} style={styles.groupCard}>
                    <View style={styles.groupCardLeft}>
                      <Text style={styles.groupCardName}>{group.name}</Text>
                      <Text style={styles.groupCardMembers} numberOfLines={1}>
                        {group.members.join(', ')}
                      </Text>
                    </View>
                    <View style={styles.groupCardActions}>
                      <TouchableOpacity
                        style={styles.loadGroupBtn}
                        onPress={() => handleLoadGroup(group)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.loadGroupBtnText}>Load</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteGroupBtn}
                        onPress={() => handleDeleteGroup(group.id)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="trash-outline" size={16} color="#F87171" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {savedGroups.length === 0 && (
              <View style={styles.groupsEmpty}>
                <Text style={styles.groupsEmptyText}>No saved groups yet.</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#151515' },
  header: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#E8E8E8' },
  undoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  undoBtnText: { fontSize: 13, fontWeight: '600', color: '#AAA' },
  progressRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  progressLabel: { fontSize: 13, fontWeight: '600', color: '#666' },
  progressLabelDone: { color: '#22C55E' },
  topActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  splitEvenlyBtn: {
    flex: 1, paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  splitEvenlyBtnText: { fontSize: 14, fontWeight: '600', color: '#E0E0E0' },
  clearAllBtn: {
    flex: 1, paddingVertical: 9,
    backgroundColor: 'rgba(220,38,38,0.10)', borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(220,38,38,0.35)',
  },
  clearAllBtnText: { fontSize: 14, fontWeight: '600', color: '#F87171' },
  progressTrack: {
    height: 5, backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 3, marginBottom: 14, overflow: 'hidden',
  },
  progressFillWrapper: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { flex: 1, height: 5, borderRadius: 3 },
  progressFillActive: { backgroundColor: 'rgba(255,255,255,0.65)' },
  peopleScroll: { marginHorizontal: -24 },
  peopleRow: { paddingHorizontal: 24, gap: 8, paddingBottom: 4, alignItems: 'center' },
  personChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', gap: 7,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)',
  },
  avatar: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontSize: 10, fontWeight: '700' },
  personChipText: { fontSize: 13, fontWeight: '600', color: '#888' },
  personChipCount: { fontSize: 10, marginTop: 1 },
  addPersonChip: {
    height: 38, width: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.20)',
  },
  addPersonChipText: { fontSize: 20, color: '#888', lineHeight: 24 },
  addPersonRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  addPersonInput: {
    flex: 1, height: 40,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12, paddingHorizontal: 12,
    fontSize: 15, color: '#D0D0D0',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  addPersonConfirmBtn: {
    height: 40, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  addPersonConfirmText: { fontSize: 14, fontWeight: '600', color: '#D0D0D0' },
  contactBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  stickyFooter: {
    paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8, backgroundColor: '#151515',
  },
  stickyFooterDone: {
    shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12,
  },
  itemChip: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    gap: 10, borderWidth: 1.5,
  },
  itemChipAssigned: {
    borderColor: 'rgba(34,197,94,0.45)',
    backgroundColor: 'rgba(34,197,94,0.07)',
  },
  itemChipUnassigned: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  itemEmoji: { fontSize: 20 },
  itemName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#D8D8D8' },
  itemAvatarRow: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  itemAvatar: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  itemAvatarText: { fontSize: 8, fontWeight: '700' },
  itemAvatarOverflow: {
    height: 24, paddingHorizontal: 5, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  itemAvatarOverflowText: { fontSize: 9, fontWeight: '700', color: '#999' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  receiptEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  receiptEditBtnWarning: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.35)',
  },
  receiptEditText: { fontSize: 13, fontWeight: '600', color: '#888' },
  receiptEditTextWarning: { color: '#F59E0B' },
  groupsBtn: {
    width: 36, height: 36,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  groupsContainer: { flex: 1, backgroundColor: '#151515' },
  groupsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#2C2C2C',
  },
  groupsTitle: { fontSize: 20, fontWeight: '700', color: '#D0D0D0' },
  groupsCloseBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  groupsScroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 10 },
  groupsSectionLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  groupNameInput: {
    height: 44,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12, paddingHorizontal: 12,
    fontSize: 15, color: '#D0D0D0',
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 10,
  },
  membersList: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10,
  },
  memberChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  memberChipText: { fontSize: 13, fontWeight: '600', color: '#D0D0D0' },
  addMemberRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  addMemberInput: {
    flex: 1, height: 44,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12, paddingHorizontal: 12,
    fontSize: 15, color: '#D0D0D0',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  addMemberBtn: {
    height: 44, paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  addMemberBtnText: { fontSize: 14, fontWeight: '600', color: '#D0D0D0' },
  saveGroupBtn: {
    height: 48, paddingHorizontal: 18,
    backgroundColor: '#D8D8D8',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  saveGroupBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  groupCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  groupCardLeft: { flex: 1, gap: 3 },
  groupCardName: { fontSize: 15, fontWeight: '700', color: '#D0D0D0' },
  groupCardMembers: { fontSize: 12, color: '#666' },
  groupCardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadGroupBtn: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  loadGroupBtnText: { fontSize: 13, fontWeight: '700', color: '#D0D0D0' },
  deleteGroupBtn: {
    width: 32, height: 32,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  groupsEmpty: { paddingTop: 24, alignItems: 'center' },
  groupsEmptyText: { fontSize: 14, color: '#555' },
  footer: { paddingTop: 8 },
  unassignedSummary: {
    backgroundColor: 'rgba(245,158,11,0.07)', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', gap: 10,
  },
  unassignedSummaryTitle: { fontSize: 14, fontWeight: '600', color: '#F59E0B' },
  splitRemainingBtn: {
    backgroundColor: '#D8D8D8', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  splitRemainingText: { fontSize: 14, fontWeight: '700', color: '#000' },
});
