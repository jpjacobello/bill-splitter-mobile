import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import ActionSheet from '../../components/ActionSheet';
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
  if (p.cashtag) return `$${p.cashtag}`;
  if (p.phone) return p.phone;
  return 'No payment handle';
}

type GroupDraft = { id?: string; name: string; memberIds: Set<string> };

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const { isPro } = usePro();

  const [people, setPeople] = useState<TrackedPerson[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [deniedOpen, setDeniedOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);

  const [editPerson, setEditPerson] = useState<TrackedPerson | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);

  const load = useCallback(async () => {
    const [ppl, grps] = await Promise.all([getPeople(), getGroupsWithMembers()]);
    setPeople(ppl);
    setGroups(grps);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const importFromContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') { setDeniedOpen(true); return; }
    const contact = await Contacts.presentContactPickerAsync();
    if (!contact) return;
    const phone = contact.phoneNumbers?.[0]?.number;
    const resolved =
      contact.name?.trim() ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() ||
      contact.nickname?.trim() ||
      contact.company?.trim() ||
      phone ||
      'Unknown';
    setPeople(await addPerson({ name: resolved, phone, contactId: contact.id }));
  };

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
          <TouchableOpacity style={[styles.addBtn, styles.addBtnSecondary]} activeOpacity={0.85} onPress={() => setAddOpen(true)}>
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
            <TouchableOpacity key={p.id} style={styles.personRow} activeOpacity={0.7} onPress={() => setEditPerson(p)}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials(p.name)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{p.name}</Text>
                <Text style={styles.personSub} numberOfLines={1}>{personSubtitle(p)}</Text>
              </View>
              {(p.venmoHandle || p.cashtag) && (
                <Ionicons name="card-outline" size={18} color={colors.green} style={{ marginRight: 6 }} />
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
            </TouchableOpacity>
          ))
        )}

        {people.length > 0 && <Text style={styles.hint}>Tap a person to edit or link a payment handle.</Text>}
      </ScrollView>

      {/* Quick add-name sheet */}
      <ActionSheet
        visible={addOpen}
        title="Add a person"
        message="Enter their name. You can link a payment handle after."
        input={{
          placeholder: 'Name',
          submitLabel: 'Add',
          autoCapitalize: 'words',
          onSubmit: async (v) => setPeople(await addPerson({ name: v })),
        }}
        onClose={() => setAddOpen(false)}
      />
      <ActionSheet
        visible={deniedOpen}
        title="Contacts access needed"
        message="Enable Contacts in Settings to add people from your address book. You can still add people manually."
        options={[{ label: 'Add Manually Instead', icon: 'create-outline', onPress: () => setAddOpen(true) }]}
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
        person={editPerson}
        insetsBottom={insets.bottom}
        onClose={() => setEditPerson(null)}
        onSaved={async (id, patch) => { setPeople(await updatePerson(id, patch)); await load(); }}
        onRemoved={async (id) => { setPeople(await removePerson(id)); await load(); }}
      />

      <GroupEditor
        draft={groupDraft}
        people={people}
        insetsBottom={insets.bottom}
        onClose={() => setGroupDraft(null)}
        onCreatePerson={async (name) => {
          const person = await findOrCreatePerson(name);
          setPeople(await getPeople());
          return person;
        }}
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

// ── Person editor modal ─────────────────────────────────────────────────────
function PersonEditor({
  person, insetsBottom, onClose, onSaved, onRemoved,
}: {
  person: TrackedPerson | null;
  insetsBottom: number;
  onClose: () => void;
  onSaved: (id: string, patch: Partial<Omit<TrackedPerson, 'id'>>) => Promise<void>;
  onRemoved: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [venmo, setVenmo] = useState('');
  const [cash, setCash] = useState('');

  // Sync fields when a person is opened.
  const openedId = person?.id;
  const [syncedId, setSyncedId] = useState<string | undefined>(undefined);
  if (openedId !== syncedId) {
    setSyncedId(openedId);
    setName(person?.name ?? '');
    setVenmo(person?.venmoHandle ?? '');
    setCash(person?.cashtag ?? '');
  }

  const save = () => {
    if (!person || !name.trim()) return;
    onSaved(person.id, {
      name: name.trim(),
      venmoHandle: venmo.trim().replace(/^@/, '') || undefined,
      cashtag: cash.trim().replace(/^\$/, '') || undefined,
    });
    onClose();
  };

  return (
    <Modal visible={person !== null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.sheet, { paddingBottom: insetsBottom + 16 }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Edit Person</Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name"
              placeholderTextColor={colors.textMuted} autoCapitalize="words" />

            <Text style={styles.fieldLabel}>Venmo</Text>
            <View style={styles.prefixWrap}>
              <Text style={styles.prefix}>@</Text>
              <TextInput style={styles.prefixInput} value={venmo} onChangeText={setVenmo} placeholder="venmo-username"
                placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
            </View>

            <Text style={styles.fieldLabel}>Cash App</Text>
            <View style={styles.prefixWrap}>
              <Text style={styles.prefix}>$</Text>
              <TextInput style={styles.prefixInput} value={cash} onChangeText={setCash} placeholder="cashtag"
                placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
            </View>

            <TouchableOpacity style={[styles.primaryBtn, !name.trim() && { opacity: 0.4 }]} onPress={save} disabled={!name.trim()} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeBtn} onPress={() => { if (person) { onRemoved(person.id); onClose(); } }} activeOpacity={0.7}>
              <Ionicons name="person-remove-outline" size={17} color={colors.red} />
              <Text style={styles.removeText}>Remove Person</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Group editor modal ──────────────────────────────────────────────────────
function GroupEditor({
  draft, people, insetsBottom, onClose, onCreatePerson, onSave, onDelete,
}: {
  draft: GroupDraft | null;
  people: TrackedPerson[];
  insetsBottom: number;
  onClose: () => void;
  onCreatePerson: (name: string) => Promise<TrackedPerson>;
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

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addNew = async () => {
    const n = newName.trim();
    if (!n) return;
    const person = await onCreatePerson(n);
    setSelected((prev) => new Set(prev).add(person.id));
    setNewName('');
  };

  const canSave = name.trim().length > 0 && selected.size > 0;

  return (
    <Modal visible={draft !== null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.sheet, { paddingBottom: insetsBottom + 16, maxHeight: '86%' }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{draft?.id ? 'Edit Group' : 'New Group'}</Text>

            <Text style={styles.fieldLabel}>Group name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Roommates"
              placeholderTextColor={colors.textMuted} autoCapitalize="words" />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Members</Text>
            <ScrollView style={styles.memberList} keyboardShouldPersistTaps="handled">
              {people.length === 0 && <Text style={styles.sectionEmpty}>Add a person below to start.</Text>}
              {people.map((p) => {
                const on = selected.has(p.id);
                return (
                  <TouchableOpacity key={p.id} style={styles.memberRow} activeOpacity={0.7} onPress={() => toggle(p.id)}>
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on && <Ionicons name="checkmark" size={14} color="#000" />}
                    </View>
                    <Text style={styles.memberName}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.addMemberRow}>
              <TextInput style={styles.addMemberInput} value={newName} onChangeText={setNewName}
                placeholder="Add a new person" placeholderTextColor={colors.textMuted}
                autoCapitalize="words" returnKeyType="done" onSubmitEditing={addNew} />
              <TouchableOpacity style={[styles.addMemberBtn, !newName.trim() && { opacity: 0.4 }]} onPress={addNew} disabled={!newName.trim()} activeOpacity={0.8}>
                <Ionicons name="add" size={20} color="#000" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.primaryBtn, !canSave && { opacity: 0.4 }]} onPress={() => draft && onSave({ ...draft, name, memberIds: selected })} disabled={!canSave} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{draft?.id ? 'Save Group' : `Create Group${selected.size > 0 ? ` (${selected.size})` : ''}`}</Text>
            </TouchableOpacity>
            {draft?.id && (
              <TouchableOpacity style={styles.removeBtn} onPress={() => draft.id && onDelete(draft.id)} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={17} color={colors.red} />
                <Text style={styles.removeText}>Delete Group</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
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

  // Modals
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.sheet, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 10,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 14 },
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

  memberList: { maxHeight: 240, marginTop: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  check: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.btnPrimary, borderColor: colors.btnPrimary },
  memberName: { fontSize: 15, color: colors.text, fontWeight: '500' },

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
