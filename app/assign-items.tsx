import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Animated,
  ScrollView, FlatList, TextInput, Keyboard, Modal, Pressable,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { presentMultiContactPickerAsync } from '../modules/contact-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, ui as C } from '../theme';
import ItemActionSheet from '../components/ItemActionSheet';
import ActionSheet, { SheetOption } from '../components/ActionSheet';
import { useBillStore } from '../store/useBillStore';
import { getUnassignedTotal } from '../utils/calcSplit';
import { getEmoji } from '../utils/buildReceiptHtml';
import { ReceiptItem, Person } from '../types';
import { usePro } from '../hooks/usePro';
import { getGroupsWithMembers, deleteSavedGroup, saveGroup, updateGroup, GroupWithMembers } from '../utils/proStorage';
import { getPeople, addPerson as addTrackedPerson, findOrCreatePerson, TrackedPerson } from '../utils/peopleStorage';
import GroupEditor, { GroupDraft } from '../components/GroupEditor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIP_REMINDER_KEY, TipReminderMode } from '../utils/tipPrefs';
import { formatCurrency, currencySymbol } from '../utils/currency';

const PERSON_COLORS = colors.person;

function getPersonColor(index: number) {
  return PERSON_COLORS[index % PERSON_COLORS.length];
}

// ─── Person chip ─────────────────────────────────────────────────────────────

type PersonChipProps = {
  person: Person;
  personIndex: number;
  isSelected: boolean;
  count: number;
  totalItems: number;
  onPress: () => void;
  onLongPress: () => void;
};

function PersonChip({ person, personIndex, isSelected, count, totalItems, onPress, onLongPress }: PersonChipProps) {
  const color = getPersonColor(personIndex);
  const fillAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const initials = person.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: isSelected ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isSelected]);

  return (
    <TouchableOpacity
      style={[styles.personChip, { borderColor: isSelected ? color : 'rgba(255,255,255,0.18)' }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.85}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { borderRadius: 14, backgroundColor: color + '22', opacity: fillAnim }]}
        pointerEvents="none"
      />
      <View style={[styles.avatar, { backgroundColor: color + '33', borderColor: color + '88' }]}>
        <Text style={[styles.avatarText, { color }]}>{initials}</Text>
      </View>
      <View>
        <Text style={[styles.personChipText, isSelected && { color: C.text }]}>{person.name}</Text>
        <Animated.Text style={[styles.personChipCount, { color, opacity: fillAnim }]}>
          {count}/{totalItems} items
        </Animated.Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Item row ────────────────────────────────────────────────────────────────

type ItemRowProps = {
  item: ReceiptItem;
  people: Person[];
  selectedPersonId: string;
  isAddon?: boolean;
  onLongPress: () => void;
  onRowPress: () => void;
  onAvatarPress: (personId: string, currentlyAssigned: boolean) => void;
};

function ItemRow({ item, people, isAddon, onLongPress, onRowPress }: ItemRowProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const isUnassigned = item.assignedTo.length === 0;
  const assignedPeople = people.filter((p) => item.assignedTo.includes(p.id));

  const handlePress = () => {
    scale.setValue(0.96);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 10 }).start();
    onRowPress();
  };

  const avatars = assignedPeople.length > 0 ? (
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
  ) : null;

  if (isAddon) {
    return (
      <Animated.View style={[styles.addonWrapper, { transform: [{ scale }] }]}>
        <View style={styles.addonConnector} />
        <TouchableOpacity
          style={[styles.addonChip, isUnassigned ? styles.itemChipUnassigned : styles.itemChipAssigned]}
          onPress={handlePress}
          onLongPress={onLongPress}
          delayLongPress={400}
          activeOpacity={0.85}
        >
          <Text style={styles.addonEmoji}>{getEmoji(item.name)}</Text>
          <Text style={styles.addonName} numberOfLines={1}>{item.name}</Text>
          {item.quantity > 1 && (
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>×{item.quantity}</Text>
            </View>
          )}
          {avatars}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.itemChip, isUnassigned ? styles.itemChipUnassigned : styles.itemChipAssigned]}
        onPress={handlePress}
        onLongPress={onLongPress}
        delayLongPress={400}
        activeOpacity={0.85}
      >
        <Text style={styles.itemEmoji}>{getEmoji(item.name)}</Text>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        {item.quantity > 1 && (
          <View style={styles.qtyBadge}>
            <Text style={styles.qtyBadgeText}>×{item.quantity}</Text>
          </View>
        )}
        {avatars}
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
  const insets = useSafeAreaInsets();
  const { receipt, people, assignItem, splitItemEvenly, splitIntoIndividualUnits, consolidateLikeItems, updateItem, addPerson, removePerson, updateTip, updateReceiptField } = useBillStore();
  const { isPro } = usePro();
  const [selectedPersonId, setSelectedPersonId] = useState<string>(people[0]?.id ?? '');
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [activeItem, setActiveItem] = useState<ReceiptItem | null>(null);
  const [sheet, setSheet] = useState<{ title?: string; message?: string; options: SheetOption[] } | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [personInput, setPersonInput] = useState('');
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [savedGroups, setSavedGroups] = useState<GroupWithMembers[]>([]);
  const [rosterPeople, setRosterPeople] = useState<TrackedPerson[]>([]);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);
  const personInputRef = useRef<TextInput>(null);
  const peopleScrollRef = useRef<ScrollView>(null);
  const [tipReminderMode, setTipReminderMode] = useState<TipReminderMode>('always');
  const [tipSheetOpen, setTipSheetOpen] = useState(false);
  const [tipInput, setTipInput] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(TIP_REMINDER_KEY).then((val) => {
      if (val) setTipReminderMode(val as TipReminderMode);
    });
  }, []);

  const allAssigned = !!receipt && receipt.items.filter((i) => i.price >= 0).length > 0 &&
    receipt.items.filter((i) => i.price >= 0).every((i) => i.assignedTo.length > 0);

  const calculatedTotal = receipt
    ? receipt.subtotal + receipt.tax + (receipt.fees ?? 0) + receipt.tip
    : 0;
  const hasReceiptIssue = tipReminderMode === 'always' && !!receipt && (
    receipt.tip === 0 ||
    Math.abs(calculatedTotal - receipt.total) >= 0.05
  );
  const prevAllAssigned = useRef(false);

  const handleSeeSummary = () => {
    if (hasReceiptIssue && receipt) {
      // Missing tip → let the user enter one inline instead of bouncing to Edit.
      if (receipt.tip === 0) {
        setTipInput('');
        setTipSheetOpen(true);
        return;
      }
      // Totals mismatch → still punt to Edit Receipt.
      setSheet({
        title: "Receipt doesn't add up",
        message: "The item total doesn't match the receipt total. Fix it with Edit Receipt, or continue anyway.",
        options: [
          { label: 'Edit Receipt', icon: 'create-outline', onPress: () => router.push('/receipt-review?from=assign-items') },
          { label: 'Continue Anyway', icon: 'arrow-forward-outline', destructive: true, onPress: () => router.push('/summary') },
        ],
      });
      return;
    }
    router.push('/summary');
  };

  const applyTipAndContinue = (tip: number) => {
    if (receipt) {
      updateTip(tip);
      updateReceiptField('total', receipt.subtotal + receipt.tax + (receipt.fees ?? 0) + tip);
    }
    setTipSheetOpen(false);
    router.push('/summary');
  };

  useEffect(() => {
    if (allAssigned && !prevAllAssigned.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevAllAssigned.current = allAssigned;
  }, [allAssigned]);

  if (!receipt) return null;

  const assignableItems = receipt.items.filter((i) => i.price >= 0);

  // Build parent→addons map and sort top-level items alphabetically
  const addonsByParent: Record<string, ReceiptItem[]> = {};
  const assignableItemIds = new Set(assignableItems.map((i) => i.id));
  assignableItems.forEach((i) => {
    if (i.parentId && assignableItemIds.has(i.parentId)) {
      if (!addonsByParent[i.parentId]) addonsByParent[i.parentId] = [];
      addonsByParent[i.parentId].push(i);
    }
  });
  const topLevelItems = assignableItems.filter(
    (i) => !i.parentId || !assignableItemIds.has(i.parentId)
  );
  const sortedTopLevel = [...topLevelItems].sort((a, b) => a.name.localeCompare(b.name));

  type RenderRow = { item: ReceiptItem; isAddon: boolean };
  const allRows: RenderRow[] = [];
  sortedTopLevel.forEach((item) => {
    allRows.push({ item, isAddon: false });
    (addonsByParent[item.id] ?? []).forEach((addon) => {
      allRows.push({ item: addon, isAddon: true });
    });
  });
  // Progress counts use top-level items only (add-ons auto-follow their parent)
  const totalItems = topLevelItems.length;
  const assignedCount = topLevelItems.filter((i) => i.assignedTo.length > 0).length;
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
    const options: SheetOption[] = [
      {
        label: `Assign all to ${firstName}`,
        icon: 'checkmark-done-outline',
        onPress: () => {
          assignableItems.forEach((item) => {
            if (item.assignedTo.includes(person.id)) return;
            pushUndo(item);
            assignItem(item.id, [...item.assignedTo, person.id]);
          });
        },
      },
      {
        label: `Remove all from ${firstName}`,
        icon: 'close-outline',
        destructive: true,
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
        label: 'Remove from split',
        icon: 'person-remove-outline',
        destructive: true,
        onPress: () => {
          removePerson(person.id);
          if (selectedPersonId === person.id) {
            setSelectedPersonId(people.find((p) => p.id !== person.id)?.id ?? '');
          }
        },
      });
    }
    setSheet({ title: person.name, options });
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
    const picked = await presentMultiContactPickerAsync();
    picked.forEach((c) => addPerson(c.name));
  };

  const handleSheetSplitAmong = (itemId: string, personIds: string[]) => {
    const item = receipt.items.find((i) => i.id === itemId);
    if (item) pushUndo(item);
    assignItem(itemId, personIds);
    (addonsByParent[itemId] ?? []).forEach((addon) => {
      pushUndo(addon);
      assignItem(addon.id, personIds);
    });
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
      router.push('/paywall');
      return;
    }
    const [groups, ppl] = await Promise.all([getGroupsWithMembers(), getPeople()]);
    setSavedGroups(groups);
    setRosterPeople(ppl);
    setShowGroupsModal(true);
  };

  const reloadGroups = async () => {
    const [groups, ppl] = await Promise.all([getGroupsWithMembers(), getPeople()]);
    setSavedGroups(groups);
    setRosterPeople(ppl);
  };

  // Pull picked contacts into the peopleStorage roster; return the created rows.
  const importContactsToRoster = async (): Promise<TrackedPerson[]> => {
    const picked = await presentMultiContactPickerAsync();
    if (picked.length === 0) return [];
    let list = rosterPeople;
    const result: TrackedPerson[] = [];
    for (const c of picked) {
      list = await addTrackedPerson({ name: c.name, phone: c.phone, contactId: c.id });
      const person = list.find((p) => p.contactId === c.id) ?? list.find((p) => p.name === c.name);
      if (person) result.push(person);
    }
    setRosterPeople(list);
    return result;
  };

  const handleLoadGroup = (group: GroupWithMembers) => {
    people.filter((p) => !p.isHost).forEach((p) => removePerson(p.id));
    group.members.forEach((m) => addPerson(m.name));
    setShowGroupsModal(false);
    setTimeout(() => peopleScrollRef.current?.scrollToEnd({ animated: true }), 100);
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
              <Ionicons name="people-outline" size={20} color={C.dim} />
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
            return (
              <PersonChip
                key={person.id}
                person={person}
                personIndex={personIndex}
                isSelected={isSelected}
                count={count}
                totalItems={totalItems}
                onPress={() => handleSelectPerson(person.id)}
                onLongPress={() => handlePersonLongPress(person)}
              />
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
              placeholderTextColor={C.faint}
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
              <Ionicons name="person-circle-outline" size={26} color={C.dim} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Items list */}
      <FlatList
        data={allRows}
        keyExtractor={(row) => row.item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: row }) => (
          <ItemRow
            item={row.item}
            people={people}
            selectedPersonId={selectedPersonId}
            isAddon={row.isAddon}
            onLongPress={() => handleLongPressItem(row.item)}
            onRowPress={() => {
              const item = row.item;
              pushUndo(item);
              const assigned = item.assignedTo.includes(selectedPersonId);
              const updated = assigned
                ? item.assignedTo.filter((id) => id !== selectedPersonId)
                : [...item.assignedTo, selectedPersonId];
              assignItem(item.id, updated);
              if (!row.isAddon) {
                (addonsByParent[item.id] ?? []).forEach((addon) => {
                  pushUndo(addon);
                  assignItem(addon.id, updated);
                });
              }
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
                  {unassignedItems.length} item{unassignedItems.length !== 1 ? 's' : ''} unassigned · {formatCurrency(unassignedTotal)}
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
        <TouchableOpacity style={styles.summaryBtn} onPress={handleSeeSummary} activeOpacity={0.85}>
          <Text style={styles.summaryBtnText}>See Summary</Text>
          {allAssigned && <Ionicons name="arrow-forward" size={18} color={C.bg} />}
        </TouchableOpacity>
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
            <View style={styles.groupsHeaderActions}>
              <TouchableOpacity
                onPress={() => setGroupDraft({ name: '', memberIds: new Set() })}
                style={styles.newGroupBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={16} color={C.bg} />
                <Text style={styles.newGroupBtnText}>New Group</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowGroupsModal(false)} style={styles.groupsCloseBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={C.dim} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.groupsScroll} keyboardShouldPersistTaps="handled">

            {/* ── Load or edit a saved group ── */}
            {savedGroups.length > 0 && (
              <>
                <Text style={styles.groupsSectionLabel}>Your Groups</Text>
                {savedGroups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={styles.groupCard}
                    activeOpacity={0.7}
                    onPress={() => setGroupDraft({ id: group.id, name: group.name, memberIds: new Set(group.memberIds) })}
                  >
                    <View style={styles.groupCardLeft}>
                      <Text style={styles.groupCardName}>{group.name}</Text>
                      <Text style={styles.groupCardMembers} numberOfLines={1}>
                        {group.members.map((m) => m.name).join(', ')}
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
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {savedGroups.length === 0 && (
              <View style={styles.groupsEmpty}>
                <Text style={styles.groupsEmptyText}>No saved groups yet.</Text>
                <Text style={styles.groupsEmptyHint}>Tap “New Group” to save a crew you split with often, then reload them into any bill.</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <GroupEditor
        draft={groupDraft}
        people={rosterPeople}
        onClose={() => setGroupDraft(null)}
        onCreatePerson={async (name) => { const person = await findOrCreatePerson(name); setRosterPeople(await getPeople()); return person; }}
        onAddContacts={importContactsToRoster}
        onSave={async (draft) => {
          const memberIds = Array.from(draft.memberIds);
          if (draft.id) await updateGroup(draft.id, { name: draft.name.trim(), memberIds });
          else await saveGroup({ name: draft.name.trim(), memberIds });
          await reloadGroups();
          setGroupDraft(null);
        }}
        onDelete={async (id) => { await deleteSavedGroup(id); await reloadGroups(); setGroupDraft(null); }}
      />

      <ActionSheet
        visible={sheet !== null}
        title={sheet?.title}
        message={sheet?.message}
        options={sheet?.options ?? []}
        onClose={() => setSheet(null)}
      />

      <Modal
        visible={tipSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTipSheetOpen(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView style={styles.tipFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.tipBackdrop} onPress={() => setTipSheetOpen(false)}>
            <Pressable style={[styles.tipSheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.tipHandle} />
              <Text style={styles.tipTitle}>Add a tip?</Text>
              <Text style={styles.tipSub}>This receipt has no tip. For the {formatCurrency(receipt.subtotal)} subtotal.</Text>

              <View style={styles.tipPills}>
                {[0.15, 0.20, 0.25].map((pct) => {
                  const amt = receipt.subtotal * pct;
                  const active = tipInput === amt.toFixed(2);
                  return (
                    <TouchableOpacity
                      key={pct}
                      style={[styles.tipPill, active && styles.tipPillActive]}
                      onPress={() => setTipInput(amt.toFixed(2))}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.tipPillPct, active && styles.tipPillTextActive]}>{Math.round(pct * 100)}%</Text>
                      <Text style={[styles.tipPillAmt, active && styles.tipPillTextActive]}>{formatCurrency(amt)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.tipInputWrap}>
                <Text style={styles.tipInputPrefix}>{currencySymbol()}</Text>
                <TextInput
                  style={styles.tipInputField}
                  value={tipInput}
                  onChangeText={setTipInput}
                  placeholder="Enter tip amount"
                  placeholderTextColor={C.dim}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>

              <TouchableOpacity
                style={styles.tipAddBtn}
                onPress={() => applyTipAndContinue(parseFloat(tipInput) || 0)}
                activeOpacity={0.85}
              >
                <Text style={styles.tipAddText}>Add Tip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tipSkipBtn} onPress={() => { setTipSheetOpen(false); router.push('/summary'); }} activeOpacity={0.7}>
                <Text style={styles.tipSkipText}>Skip, no tip</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Inline tip sheet
  tipFlex: { flex: 1 },
  tipBackdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  tipSheet: {
    backgroundColor: "#26262B",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 10,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  tipHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 14 },
  tipTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  tipSub: { fontSize: 13, color: C.dim, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  tipPills: { flexDirection: 'row', gap: 10 },
  tipPill: {
    flex: 1, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
  },
  tipPillActive: { backgroundColor: C.text, borderColor: C.text },
  tipPillPct: { fontSize: 15, fontWeight: '700', color: C.text },
  tipPillAmt: { fontSize: 12.5, color: C.dim },
  tipPillTextActive: { color: C.bg },
  tipInputWrap: {
    flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, paddingHorizontal: 16, marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  tipInputPrefix: { fontSize: 17, color: C.dim, marginRight: 6 },
  tipInputField: { flex: 1, fontSize: 17, color: C.text, height: '100%' },
  tipAddBtn: {
    height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.text, marginTop: 16,
  },
  tipAddText: { fontSize: 15.5, fontWeight: '700', color: C.bg },
  tipSkipBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 2 },
  tipSkipText: { fontSize: 14.5, fontWeight: '600', color: C.dim },

  header: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '700', color: C.text },
  undoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  undoBtnText: { fontSize: 13, fontWeight: '600', color: C.dim },
  progressRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  progressLabel: { fontSize: 13, fontWeight: '600', color: C.dim },
  progressLabelDone: { color: colors.green },
  topActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  splitEvenlyBtn: {
    flex: 1, paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  splitEvenlyBtnText: { fontSize: 14, fontWeight: '600', color: C.text },
  clearAllBtn: {
    flex: 1, paddingVertical: 9,
    backgroundColor: 'rgba(200,50,60,0.10)', borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(200,50,60,0.38)',
  },
  clearAllBtnText: { fontSize: 14, fontWeight: '600', color: colors.red },
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
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  avatar: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontSize: 10, fontWeight: '700' },
  personChipText: { fontSize: 13, fontWeight: '600', color: C.dim },
  personChipCount: { fontSize: 10, marginTop: 1 },
  addPersonChip: {
    height: 38, width: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.20)',
  },
  addPersonChipText: { fontSize: 20, color: C.dim, lineHeight: 24 },
  addPersonRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  addPersonInput: {
    flex: 1, height: 40,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12, paddingHorizontal: 12,
    fontSize: 15, color: C.text,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  addPersonConfirmBtn: {
    height: 40, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  addPersonConfirmText: { fontSize: 14, fontWeight: '600', color: C.text },
  contactBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  stickyFooter: {
    paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8, backgroundColor: C.bg,
  },
  stickyFooterDone: {
    shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12,
  },
  summaryBtn: { height: 56, borderRadius: 15, backgroundColor: C.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  summaryBtnText: { fontSize: 16.5, fontWeight: '700', color: C.bg },
  itemChip: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    gap: 10, borderWidth: 1.5,
  },
  itemChipAssigned: {
    borderColor: 'rgba(62,173,116,0.50)',
    backgroundColor: 'rgba(62,173,116,0.09)',
  },
  itemChipUnassigned: {
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  itemEmoji: { fontSize: 20 },
  itemName: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
  qtyBadge: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  qtyBadgeText: { fontSize: 11, fontWeight: '700', color: C.dim },
  addonWrapper: {
    flexDirection: 'row', alignItems: 'stretch', marginLeft: 14, gap: 8,
  },
  addonConnector: {
    width: 2, borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginVertical: 2,
  },
  addonChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    gap: 8, borderWidth: 1.5,
  },
  addonEmoji: { fontSize: 16 },
  addonName: { flex: 1, fontSize: 13, fontWeight: '500', color: C.dim },
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
  itemAvatarOverflowText: { fontSize: 9, fontWeight: '700', color: C.dim },
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
  receiptEditText: { fontSize: 13, fontWeight: '600', color: C.dim },
  receiptEditTextWarning: { color: colors.amber },
  groupsBtn: {
    width: 36, height: 36,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  groupsContainer: { flex: 1, backgroundColor: C.bg },
  groupsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  groupsTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  groupsHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newGroupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.text, borderRadius: 10,
    paddingLeft: 8, paddingRight: 12, paddingVertical: 7,
  },
  newGroupBtnText: { fontSize: 13, fontWeight: '700', color: C.bg },
  groupsCloseBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  groupsScroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 10 },
  groupsSectionLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  groupCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  groupCardLeft: { flex: 1, gap: 3 },
  groupCardName: { fontSize: 15, fontWeight: '700', color: C.text },
  groupCardMembers: { fontSize: 12, color: C.dim },
  groupCardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadGroupBtn: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  loadGroupBtnText: { fontSize: 13, fontWeight: '700', color: C.text },
  deleteGroupBtn: {
    width: 32, height: 32,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  groupsEmpty: { paddingTop: 24, alignItems: 'center' },
  groupsEmptyText: { fontSize: 14, color: C.faint },
  groupsEmptyHint: { fontSize: 13, color: C.faint, marginTop: 6, textAlign: 'center' },
  footer: { paddingTop: 8 },
  unassignedSummary: {
    backgroundColor: 'rgba(245,158,11,0.07)', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', gap: 10,
  },
  unassignedSummaryTitle: { fontSize: 14, fontWeight: '600', color: colors.amber },
  splitRemainingBtn: {
    backgroundColor: C.text, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  splitRemainingText: { fontSize: 14, fontWeight: '700', color: C.bg },
});
