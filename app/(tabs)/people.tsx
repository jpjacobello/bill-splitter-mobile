import { useCallback, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import ActionSheet from '../../components/ActionSheet';
import BottomSheet from '../../components/BottomSheet';
import { colors, ui as C } from '../../theme';
import { usePro } from '../../hooks/usePro';
import { presentMultiContactPickerAsync } from '../../modules/contact-picker';
import {
  getPeople, addPerson, removePerson, updatePerson, findOrCreatePerson, TrackedPerson,
} from '../../utils/peopleStorage';
import {
  getGroupsWithMembers, saveGroup, updateGroup, deleteSavedGroup, GroupWithMembers,
} from '../../utils/proStorage';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

function personSubtitle(p: TrackedPerson): string {
  if (p.venmoHandle) return `@${p.venmoHandle}`;
  if (p.phone) return p.phone;
  return 'No payment handle';
}

type GroupDraft = { id?: string; name: string; memberIds: Set<string> };

function Enter({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 380, delay }}>
      {children}
    </MotiView>
  );
}

export default function PeopleScreen() {
  const { isPro } = usePro();

  const [people, setPeople] = useState<TrackedPerson[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [proOpen, setProOpen] = useState(false);
  const [personTarget, setPersonTarget] = useState<TrackedPerson | 'new' | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);

  const load = useCallback(async () => {
    const [ppl, grps] = await Promise.all([getPeople(), getGroupsWithMembers()]);
    setPeople(ppl);
    setGroups(grps);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const importContacts = async (): Promise<TrackedPerson[]> => {
    const picked = await presentMultiContactPickerAsync();
    if (picked.length === 0) return [];
    let list = await getPeople();
    const result: TrackedPerson[] = [];
    for (const c of picked) {
      list = await addPerson({ name: c.name, phone: c.phone, contactId: c.id });
      const person = list.find((p) => p.contactId === c.id) ?? list.find((p) => p.name === c.name);
      if (person) result.push(person);
    }
    setPeople(list);
    return result;
  };

  const importFromContacts = () => { importContacts(); };
  const openNewGroup = () => { if (!isPro) { setProOpen(true); return; } setGroupDraft({ name: '', memberIds: new Set() }); };
  const openEditGroup = (g: GroupWithMembers) => { if (!isPro) { setProOpen(true); return; } setGroupDraft({ id: g.id, name: g.name, memberIds: new Set(g.memberIds) }); };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}><Text style={styles.title}>People</Text></View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Groups ── */}
          <Enter>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.section}>GROUPS</Text>
              <TouchableOpacity onPress={openNewGroup} activeOpacity={0.7} style={styles.newGroupBtn}>
                <SymbolView name="plus" size={13} tintColor={C.text} />
                <Text style={styles.newGroupText}>New Group</Text>
              </TouchableOpacity>
            </View>

            {!isPro ? (
              <TouchableOpacity style={styles.upsell} activeOpacity={0.85} onPress={() => setProOpen(true)}>
                <SymbolView name="sparkles" size={20} tintColor={colors.amber} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.upsellTitle}>Saved groups are a Pro feature</Text>
                  <Text style={styles.upsellSub}>Save your regular crews and reload them into any split.</Text>
                </View>
              </TouchableOpacity>
            ) : groups.length === 0 ? (
              <Text style={styles.sectionEmpty}>No groups yet. Tap “New Group” to save a crew.</Text>
            ) : (
              <View style={styles.group}>
                {groups.map((g, i) => (
                  <View key={g.id}>
                    {i > 0 && <View style={styles.sep} />}
                    <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={() => openEditGroup(g)}>
                      <View style={[styles.rowIcon, { backgroundColor: C.blue + '22' }]}>
                        <SymbolView name="person.2.fill" size={17} tintColor={C.blue} type="hierarchical" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{g.name}</Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {g.members.length > 0 ? g.members.map((m) => m.name).join(', ') : 'No members'}
                        </Text>
                      </View>
                      <Text style={styles.count}>{g.members.length}</Text>
                      <SymbolView name="chevron.right" size={13} tintColor={C.faint} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </Enter>

          {/* ── People ── */}
          <Enter delay={80}>
            <Text style={[styles.section, { marginTop: 28, marginBottom: 12 }]}>PEOPLE</Text>
            <View style={styles.addRow}>
              <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={importFromContacts}>
                <SymbolView name="person.crop.circle.badge.plus" size={18} tintColor={C.bg} />
                <Text style={styles.addBtnText}>From Contacts</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addBtn, styles.addBtnSecondary]} activeOpacity={0.85} onPress={() => setPersonTarget('new')}>
                <SymbolView name="square.and.pencil" size={17} tintColor={C.text} />
                <Text style={[styles.addBtnText, styles.addBtnTextSecondary]}>Add Manually</Text>
              </TouchableOpacity>
            </View>

            {people.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><SymbolView name="person.2" size={30} tintColor={C.dim} type="hierarchical" /></View>
                <Text style={styles.emptyTitle}>No people yet</Text>
                <Text style={styles.emptySub}>Add friends from contacts or manually to build groups and link payment handles.</Text>
              </View>
            ) : (
              <View style={styles.group}>
                {people.map((p, i) => (
                  <View key={p.id}>
                    {i > 0 && <View style={styles.sep} />}
                    <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={() => setPersonTarget(p)}>
                      <View style={styles.avatar}><Text style={styles.avatarText}>{initials(p.name)}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.rowSub} numberOfLines={1}>{personSubtitle(p)}</Text>
                      </View>
                      {p.venmoHandle && <SymbolView name="creditcard.fill" size={15} tintColor={C.accent} style={{ marginRight: 8 }} />}
                      <SymbolView name="chevron.right" size={13} tintColor={C.faint} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {people.length > 0 && <Text style={styles.hint}>Tap a person to edit or link a payment handle.</Text>}
          </Enter>
        </ScrollView>
      </SafeAreaView>

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
        onCreatePerson={async (name) => { const person = await findOrCreatePerson(name); setPeople(await getPeople()); return person; }}
        onAddContacts={importContacts}
        onSave={async (draft) => {
          const memberIds = Array.from(draft.memberIds);
          if (draft.id) await updateGroup(draft.id, { name: draft.name.trim(), memberIds });
          else await saveGroup({ name: draft.name.trim(), memberIds });
          await load();
          setGroupDraft(null);
        }}
        onDelete={async (id) => { await deleteSavedGroup(id); await load(); setGroupDraft(null); }}
      />
    </View>
  );
}

// ── Person editor ────────────────────────────────────────────────────────────
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
      <View style={styles.editorHead}>
        <View style={styles.bigAvatar}><Text style={styles.bigAvatarText}>{name.trim() ? initials(name) : '?'}</Text></View>
        <Text style={styles.editorTitle}>{isNew ? 'Add Person' : name.trim() || 'Edit Person'}</Text>
      </View>

      <View style={styles.formCard}>
        <TextInput style={styles.formInput} value={name} onChangeText={setName} placeholder="Name"
          placeholderTextColor={C.faint} autoCapitalize="words" />
        <View style={styles.formSep} />
        <TextInput style={styles.formInput} value={phone} onChangeText={setPhone} placeholder="Phone"
          placeholderTextColor={C.faint} keyboardType="phone-pad" />
        <View style={styles.formSep} />
        <View style={styles.formPrefixRow}>
          <Text style={styles.formPrefix}>@</Text>
          <TextInput style={styles.formPrefixInput} value={venmo} onChangeText={setVenmo} placeholder="venmo-username"
            placeholderTextColor={C.faint} autoCapitalize="none" autoCorrect={false} />
        </View>
      </View>

      <TouchableOpacity style={[styles.primaryBtn, !name.trim() && { opacity: 0.4 }]} onPress={save} disabled={!name.trim()} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>{isNew ? 'Add Person' : 'Save'}</Text>
      </TouchableOpacity>
      {person && (
        <TouchableOpacity style={styles.removeBtn} onPress={() => { onRemoved(person.id); onClose(); }} activeOpacity={0.7}>
          <Text style={styles.removeText}>Remove Person</Text>
        </TouchableOpacity>
      )}
    </BottomSheet>
  );
}

// ── Group editor ─────────────────────────────────────────────────────────────
function GroupEditor({
  draft, people, onClose, onCreatePerson, onAddContacts, onSave, onDelete,
}: {
  draft: GroupDraft | null;
  people: TrackedPerson[];
  onClose: () => void;
  onCreatePerson: (name: string) => Promise<TrackedPerson>;
  onAddContacts: () => Promise<TrackedPerson[]>;
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

  const byId = new Map(people.map((p) => [p.id, p]));
  const members = Array.from(selected).map((id) => byId.get(id)).filter(Boolean) as TrackedPerson[];

  const addFromContacts = async () => {
    const persons = await onAddContacts();
    if (persons.length) setSelected((prev) => new Set([...prev, ...persons.map((p) => p.id)]));
  };
  const addNew = async () => {
    const n = newName.trim();
    if (!n) return;
    const person = await onCreatePerson(n);
    setSelected((prev) => new Set(prev).add(person.id));
    setNewName('');
  };
  const removeMember = (id: string) => setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });

  const canSave = name.trim().length > 0 && selected.size > 0;

  return (
    <BottomSheet visible={draft !== null} onClose={onClose}>
      <View style={styles.editorHead}>
        <View style={[styles.bigAvatar, { backgroundColor: C.blue + '22' }]}>
          <SymbolView name="person.2.fill" size={26} tintColor={C.blue} type="hierarchical" />
        </View>
        <Text style={styles.editorTitle}>{name.trim() || (draft?.id ? 'Edit Group' : 'New Group')}</Text>
      </View>

      <View style={styles.formCard}>
        <TextInput style={styles.formInput} value={name} onChangeText={setName} placeholder="Group name"
          placeholderTextColor={C.faint} autoCapitalize="words" />
      </View>

      <View style={styles.membersHead}>
        <Text style={styles.membersLabel}>MEMBERS</Text>
        {selected.size > 0 && <Text style={styles.membersCount}>{selected.size}</Text>}
      </View>
      <TouchableOpacity style={styles.contactsRowBtn} onPress={addFromContacts} activeOpacity={0.85}>
        <SymbolView name="person.crop.circle.badge.plus" size={18} tintColor={C.bg} />
        <Text style={styles.contactsRowText}>Add from Contacts</Text>
      </TouchableOpacity>

      <View style={styles.addMemberRow}>
        <TextInput style={styles.addMemberInput} value={newName} onChangeText={setNewName}
          placeholder="Or type a name" placeholderTextColor={C.faint}
          autoCapitalize="words" returnKeyType="done" onSubmitEditing={addNew} />
        <TouchableOpacity style={[styles.addMemberBtn, !newName.trim() && { opacity: 0.4 }]} onPress={addNew} disabled={!newName.trim()} activeOpacity={0.8}>
          <SymbolView name="plus" size={18} tintColor={C.bg} />
        </TouchableOpacity>
      </View>

      {members.length > 0 && (
        <View style={styles.memberChips}>
          {members.map((p) => (
            <View key={p.id} style={styles.memberChip}>
              <View style={styles.chipAvatar}><Text style={styles.chipAvatarText}>{initials(p.name)}</Text></View>
              <Text style={styles.memberChipText}>{p.name}</Text>
              <TouchableOpacity onPress={() => removeMember(p.id)} hitSlop={8}>
                <SymbolView name="xmark.circle.fill" size={16} tintColor={C.faint} />
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
          <Text style={styles.removeText}>Delete Group</Text>
        </TouchableOpacity>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },

  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  section: { fontSize: 12.5, fontWeight: '700', color: C.faint, letterSpacing: 1.2, marginLeft: 2 },
  sectionEmpty: { fontSize: 13.5, color: C.dim, paddingVertical: 8, marginLeft: 2 },
  newGroupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 11, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
  },
  newGroupText: { fontSize: 13, fontWeight: '600', color: C.text },

  upsell: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15,
    borderRadius: 16, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.22)',
  },
  upsellTitle: { fontSize: 14.5, fontWeight: '700', color: C.text },
  upsellSub: { fontSize: 12.5, color: C.dim, marginTop: 2, lineHeight: 17 },

  group: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 14 },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: C.text, letterSpacing: -0.2 },
  rowSub: { fontSize: 12.5, color: C.dim, marginTop: 2 },
  count: { fontSize: 14, fontWeight: '700', color: C.dim, marginRight: 2 },
  sep: { height: 1, backgroundColor: C.line, marginLeft: 65 },

  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(91,157,240,0.22)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: C.blue },

  addRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 48, borderRadius: 14, backgroundColor: C.text },
  addBtnSecondary: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  addBtnText: { fontSize: 14, fontWeight: '700', color: C.bg },
  addBtnTextSecondary: { color: C.text },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 30 },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 1, borderColor: C.line },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 14, color: C.dim, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  hint: { fontSize: 12.5, color: C.faint, textAlign: 'center', marginTop: 14 },

  // Editor sheets (shared) — iOS grouped inset form + live avatar header
  editorHead: { alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 20 },
  bigAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(91,157,240,0.22)', alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { fontSize: 24, fontWeight: '700', color: C.blue },
  editorTitle: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3, textAlign: 'center' },

  formCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  formInput: { height: 52, paddingHorizontal: 16, fontSize: 16, color: C.text },
  formSep: { height: 1, backgroundColor: C.line, marginLeft: 16 },
  formPrefixRow: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 16 },
  formPrefix: { fontSize: 16, color: C.dim, marginRight: 4 },
  formPrefixInput: { flex: 1, fontSize: 16, color: C.text, height: '100%' },

  membersHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10, marginLeft: 2 },
  membersLabel: { fontSize: 12, fontWeight: '700', color: C.faint, letterSpacing: 1 },
  membersCount: { fontSize: 12, fontWeight: '700', color: C.dim },
  chipAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(91,157,240,0.25)', alignItems: 'center', justifyContent: 'center' },
  chipAvatarText: { fontSize: 10, fontWeight: '700', color: C.blue },

  contactsRowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 48, borderRadius: 12, backgroundColor: C.text, marginTop: 2,
  },
  contactsRowText: { fontSize: 15, fontWeight: '700', color: C.bg },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  memberChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
  },
  memberChipText: { fontSize: 14, fontWeight: '600', color: C.text },

  addMemberRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  addMemberInput: {
    flex: 1, height: 46, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: C.text,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  addMemberBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.text },

  primaryBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.text, marginTop: 18 },
  primaryBtnText: { fontSize: 15.5, fontWeight: '700', color: C.bg },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: 4 },
  removeText: { fontSize: 14.5, fontWeight: '600', color: colors.red },
});
