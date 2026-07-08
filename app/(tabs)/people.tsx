import { useCallback, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import ActionSheet from '../../components/ActionSheet';
import BottomSheet from '../../components/BottomSheet';
import { colors } from '../../theme';
import { usePro } from '../../hooks/usePro';
import {
  getPeople, addPerson, removePerson, updatePerson, findOrCreatePerson, TrackedPerson,
} from '../../utils/peopleStorage';
import {
  getGroupsWithMembers, saveGroup, updateGroup, deleteSavedGroup, GroupWithMembers,
} from '../../utils/proStorage';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

function personSubtitle(p: TrackedPerson): string {
  if (p.venmoHandle) return `@${p.venmoHandle}`;
  if (p.phone) return p.phone;
  return 'No payment handle';
}

// Best display name for a picked contact — the composed name can be empty on iOS
// even when first/last exist, so fall back through the other fields.
function resolveContactName(contact: Contacts.Contact, phone?: string): string {
  return (
    contact.name?.trim() ||
    [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() ||
    contact.nickname?.trim() ||
    contact.company?.trim() ||
    phone ||
    'Unknown'
  );
}

type GroupDraft = { id?: string; name: string; memberIds: Set<string> };

export default function PeopleScreen() {
  const { isPro } = usePro();

  const [people, setPeople] = useState<TrackedPerson[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);

  const [deniedOpen, setDeniedOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);

  // 'new' opens the editor for a fresh person; a TrackedPerson edits it.
  const [personTarget, setPersonTarget] = useState<TrackedPerson | 'new' | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);

  const load = useCallback(async () => {
    const [ppl, grps] = await Promise.all([getPeople(), getGroupsWithMembers()]);
    setPeople(ppl);
    setGroups(grps);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Import one contact into the roster and return the resulting person (for the
  // group editor to auto-select). Returns null on denial/cancel. `silentDenial`
  // skips the denied sheet when called from inside the group modal (avoids
  // stacking a modal over a modal).
  const importOneContact = async (silentDenial = false): Promise<TrackedPerson | null> => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') { if (!silentDenial) setDeniedOpen(true); return null; }
    const contact = await Contacts.presentContactPickerAsync();
    if (!contact) return null;
    const phone = contact.phoneNumbers?.[0]?.number;
    const resolved = resolveContactName(contact, phone);
    const list = await addPerson({ name: resolved, phone, contactId: contact.id });
    setPeople(list);
    return (
      list.find((p) => p.contactId === contact.id) ??
      list.find((p) => p.name === resolved) ??
      null
    );
  };

  const importFromContacts = () => { importOneContact(); };

  const openNewGroup = () => {
    if (!isPro) { setProOpen(true); return; }
    setGroupDraft({ name: '', memberIds: new Set() });
  };

  const openEditGroup = (g: GroupWithMembers) => {
    if (!isPro) { setProOpen(true); return; }
    setGroupDraft({ id: g.id, name: g.name, memberIds: new Set(g.memberIds) });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}><Text style={styles.title}>People</Text></View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Groups ── */}
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionHead}>Groups</Text>
          <TouchableOpacity onPress={openNewGroup} activeOpacity={0.7} style={styles.newGroupBtn}>
            <Ionicons name="add" size={16} color={colors.text} />
            <Text style={styles.newGroupText}>New Group</Text>
          </TouchableOpacity>
        </View>

        {!isPro ? (
          <TouchableOpacity style={styles.upsell} activeOpacity={0.85} onPress={() => setProOpen(true)}>
            <Ionicons name="sparkles-outline" size={20} color={colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.upsellTitle}>Saved groups are a Pro feature</Text>
              <Text style={styles.upsellSub}>Save your regular crews and reload them into any split.</Text>
            </View>
          </TouchableOpacity>
        ) : groups.length === 0 ? (
          <Text style={styles.sectionEmpty}>No groups yet. Tap “New Group” to save a crew.</Text>
        ) : (
          groups.map((g) => (
            <TouchableOpacity key={g.id} style={styles.groupRow} activeOpacity={0.7} onPress={() => openEditGroup(g)}>
              <View style={styles.groupIcon}><Ionicons name="people" size={18} color="#9EC1EE" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{g.name}</Text>
                <Text style={styles.personSub} numberOfLines={1}>
                  {g.members.length > 0 ? g.members.map((m) => m.name).join(', ') : 'No members'}
                </Text>
              </View>
              <Text style={styles.groupCount}>{g.members.length}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
            </TouchableOpacity>
          ))
        )}

        {/* ── People ── */}
        <Text style={[styles.sectionHead, { marginTop: 26 }]}>People</Text>
        <View style={styles.addRow}>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={importFromContacts}>
            <Ionicons name="person-add-outline" size={18} color="#000" />
            <Text style={styles.addBtnText}>From Contacts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, styles.addBtnSecondary]} activeOpacity={0.85} onPress={() => setPersonTarget('new')}>
            <Ionicons name="create-outline" size={18} color={colors.text} />
            <Text style={[styles.addBtnText, styles.addBtnTextSecondary]}>Add Manually</Text>
          </TouchableOpacity>
        </View>

        {people.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={44} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>No people yet</Text>
            <Text style={styles.emptySub}>Add friends from your contacts or manually to build groups and link payment handles.</Text>
          </View>
        ) : (
          people.map((p) => (
            <TouchableOpacity key={p.id} style={styles.personRow} activeOpacity={0.7} onPress={() => setPersonTarget(p)}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials(p.name)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{p.name}</Text>
                <Text style={styles.personSub} numberOfLines={1}>{personSubtitle(p)}</Text>
              </View>
              {p.venmoHandle && (
                <Ionicons name="card-outline" size={18} color={colors.green} style={{ marginRight: 6 }} />
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
            </TouchableOpacity>
          ))
        )}

        {people.length > 0 && <Text style={styles.hint}>Tap a person to edit or link a payment handle.</Text>}
      </ScrollView>

      <ActionSheet
        visible={deniedOpen}
        title="Contacts access needed"
        message="Enable Contacts in Settings to add people from your address book. You can still add people manually."
        options={[{ label: 'Add Manually Instead', icon: 'create-outline', onPress: () => setPersonTarget('new') }]}
        onClose={() => setDeniedOpen(false)}
      />
      <ActionSheet
        visible={proOpen}
        title="Divi Pro"
        message="Saved groups let you reload your regular crews into any split. Upgrade in Settings."
        options={[{ label: 'Got it', icon: 'sparkles-outline', onPress: () => {} }]}
        onClose={() => setProOpen(false)}
      />

      <PersonEditor
        target={personTarget}
        onClose={() => setPersonTarget(null)}
        onSubmit={async (id, patch) => {
          if (id) setPeople(await updatePerson(id, patch));
          else setPeople(await addPerson(patch));
          await load();
        }}
        onRemoved={async (id) => { setPeople(await removePerson(id)); await load(); }}
      />

      <GroupEditor
        draft={groupDraft}
        people={people}
        onClose={() => setGroupDraft(null)}
        onCreatePerson={async (name) => {
          const person = await findOrCreatePerson(name);
          setPeople(await getPeople());
          return person;
        }}
        onAddFromContacts={() => importOneContact(true)}
        onSave={async (draft) => {
          const memberIds = Array.from(draft.memberIds);
          if (draft.id) await updateGroup(draft.id, { name: draft.name.trim(), memberIds });
          else await saveGroup({ name: draft.name.trim(), memberIds });
          await load();
          setGroupDraft(null);
        }}
        onDelete={async (id) => { await deleteSavedGroup(id); await load(); setGroupDraft(null); }}
      />
    </SafeAreaView>
  );
}

// ── Person editor (pageSheet form) ──────────────────────────────────────────
// pageSheet gives native swipe-down dismiss; automaticallyAdjustKeyboardInsets
// makes the fields scroll above the keyboard smoothly (no lurching sheet).
function PersonEditor({
  target, onClose, onSubmit, onRemoved,
}: {
  target: TrackedPerson | 'new' | null;
  onClose: () => void;
  onSubmit: (id: string | null, patch: { name: string; phone?: string; venmoHandle?: string }) => Promise<void>;
  onRemoved: (id: string) => Promise<void>;
}) {
  const person = target && target !== 'new' ? target : null;
  const isNew = target === 'new';
  const visible = target !== null;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [venmo, setVenmo] = useState('');

  const openedKey = isNew ? 'new' : person?.id;
  const [syncedKey, setSyncedKey] = useState<string | undefined>(undefined);
  if (openedKey !== syncedKey) {
    setSyncedKey(openedKey);
    setName(person?.name ?? '');
    setPhone(person?.phone ?? '');
    setVenmo(person?.venmoHandle ?? '');
  }

  const save = () => {
    if (!name.trim()) return;
    onSubmit(person?.id ?? null, {
      name: name.trim(),
      phone: phone.trim() || undefined,
      venmoHandle: venmo.trim().replace(/^@/, '') || undefined,
    });
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle}>{isNew ? 'Add Person' : 'Edit Person'}</Text>

      <Text style={styles.fieldLabel}>Name</Text>
      <BottomSheetTextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name"
        placeholderTextColor={colors.textMuted} autoCapitalize="words" />

      <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Phone</Text>
      <BottomSheetTextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(555) 123-4567"
        placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />

      <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Venmo</Text>
      <View style={styles.prefixWrap}>
        <Text style={styles.prefix}>@</Text>
        <BottomSheetTextInput style={styles.prefixInput} value={venmo} onChangeText={setVenmo} placeholder="venmo-username"
          placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
      </View>

      <TouchableOpacity style={[styles.primaryBtn, !name.trim() && { opacity: 0.4 }]} onPress={save} disabled={!name.trim()} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>{isNew ? 'Add Person' : 'Save'}</Text>
      </TouchableOpacity>
      {person && (
        <TouchableOpacity style={styles.removeBtn} onPress={() => { onRemoved(person.id); onClose(); }} activeOpacity={0.7}>
          <Ionicons name="person-remove-outline" size={17} color={colors.red} />
          <Text style={styles.removeText}>Remove Person</Text>
        </TouchableOpacity>
      )}
    </BottomSheet>
  );
}

// ── Group editor (pageSheet form) ───────────────────────────────────────────
// Members are built by picking from contacts or typing a name — no roster
// toggle list. pageSheet gives swipe-down dismiss + smooth keyboard handling.
function GroupEditor({
  draft, people, onClose, onCreatePerson, onAddFromContacts, onSave, onDelete,
}: {
  draft: GroupDraft | null;
  people: TrackedPerson[];
  onClose: () => void;
  onCreatePerson: (name: string) => Promise<TrackedPerson>;
  onAddFromContacts: () => Promise<TrackedPerson | null>;
  onSave: (draft: GroupDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');

  const openedId = draft ? (draft.id ?? 'new') : undefined;
  const [syncedId, setSyncedId] = useState<string | undefined>(undefined);
  if (openedId !== syncedId) {
    setSyncedId(openedId);
    setName(draft?.name ?? '');
    setSelected(new Set(draft?.memberIds ?? []));
    setNewName('');
  }

  // Resolve selected ids → people for the members list.
  const byId = new Map(people.map((p) => [p.id, p]));
  const members = Array.from(selected).map((id) => byId.get(id)).filter(Boolean) as TrackedPerson[];

  const addFromContacts = async () => {
    const person = await onAddFromContacts();
    if (person) setSelected((prev) => new Set(prev).add(person.id));
  };

  const addNew = async () => {
    const n = newName.trim();
    if (!n) return;
    const person = await onCreatePerson(n);
    setSelected((prev) => new Set(prev).add(person.id));
    setNewName('');
  };

  const removeMember = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const canSave = name.trim().length > 0 && selected.size > 0;

  return (
    <BottomSheet visible={draft !== null} onClose={onClose}>
      <Text style={styles.sheetTitle}>{draft?.id ? 'Edit Group' : 'New Group'}</Text>

      <Text style={styles.fieldLabel}>Group name</Text>
      <BottomSheetTextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Roommates"
        placeholderTextColor={colors.textMuted} autoCapitalize="words" />

      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Members</Text>
      <TouchableOpacity style={styles.contactsRowBtn} onPress={addFromContacts} activeOpacity={0.85}>
        <Ionicons name="person-add-outline" size={18} color="#000" />
        <Text style={styles.contactsRowText}>Add from Contacts</Text>
      </TouchableOpacity>

      <View style={styles.addMemberRow}>
        <BottomSheetTextInput style={styles.addMemberInput} value={newName} onChangeText={setNewName}
          placeholder="Or type a name" placeholderTextColor={colors.textMuted}
          autoCapitalize="words" returnKeyType="done" onSubmitEditing={addNew} />
        <TouchableOpacity style={[styles.addMemberBtn, !newName.trim() && { opacity: 0.4 }]} onPress={addNew} disabled={!newName.trim()} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {members.length === 0 ? (
        <Text style={styles.sectionEmpty}>No members yet — add from contacts or type a name.</Text>
      ) : (
        <View style={styles.memberChips}>
          {members.map((p) => (
            <View key={p.id} style={styles.memberChip}>
              <Text style={styles.memberChipText}>{p.name}</Text>
              <TouchableOpacity onPress={() => removeMember(p.id)} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={[styles.primaryBtn, !canSave && { opacity: 0.4 }]} onPress={() => draft && onSave({ ...draft, name, memberIds: selected })} disabled={!canSave} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>{draft?.id ? 'Save Group' : `Create Group${selected.size > 0 ? ` (${selected.size})` : ''}`}</Text>
      </TouchableOpacity>
      {draft?.id && (
        <TouchableOpacity style={styles.removeBtn} onPress={() => draft.id && onDelete(draft.id)} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={17} color={colors.red} />
          <Text style={styles.removeText}>Delete Group</Text>
        </TouchableOpacity>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 10 },

  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionHead: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionEmpty: { fontSize: 13, color: colors.textMuted, paddingVertical: 6 },
  newGroupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  newGroupText: { fontSize: 13, fontWeight: '600', color: colors.text },

  upsell: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 14, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  upsellTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  upsellSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, lineHeight: 17 },

  groupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  groupIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(100,151,212,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  groupCount: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginRight: 2 },

  addRow: { flexDirection: 'row', gap: 10, marginTop: 2, marginBottom: 2 },
  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 48, borderRadius: 14, backgroundColor: colors.btnPrimary,
  },
  addBtnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
  addBtnTextSecondary: { color: colors.text },

  personRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(100,151,212,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#9EC1EE' },
  personName: { fontSize: 15, fontWeight: '700', color: colors.text },
  personSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  empty: { alignItems: 'center', gap: 10, paddingTop: 40, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textDim, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  hint: { fontSize: 12, color: colors.textDisabled, textAlign: 'center', marginTop: 8 },

  // Bottom-sheet forms (PersonEditor / GroupEditor)
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  prefixWrap: {
    flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  prefix: { fontSize: 16, color: colors.textMuted, marginRight: 4 },
  prefixInput: { flex: 1, fontSize: 16, color: colors.text, height: '100%' },

  contactsRowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 48, borderRadius: 12, backgroundColor: colors.btnPrimary, marginTop: 2,
  },
  contactsRowText: { fontSize: 15, fontWeight: '700', color: '#000' },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  memberChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMid,
  },
  memberChipText: { fontSize: 14, fontWeight: '600', color: colors.text },

  addMemberRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  addMemberInput: {
    flex: 1, height: 46, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  addMemberBtn: {
    width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.btnPrimary,
  },

  primaryBtn: {
    height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.btnPrimary, marginTop: 18,
  },
  primaryBtnText: { fontSize: 15.5, fontWeight: '700', color: '#000' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: 4 },
  removeText: { fontSize: 14.5, fontWeight: '600', color: colors.red },
});
