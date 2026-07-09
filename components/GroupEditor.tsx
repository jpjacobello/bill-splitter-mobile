import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import BottomSheet from './BottomSheet';
import { colors, ui as C } from '../theme';
import { TrackedPerson } from '../utils/peopleStorage';

export type GroupDraft = { id?: string; name: string; memberIds: Set<string> };

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

// Create / edit a saved group. Members are backed by the peopleStorage roster,
// populated on the fly from contacts or typed names — no standalone people screen.
export default function GroupEditor({
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
  editorHead: { alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 20 },
  bigAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(91,157,240,0.22)', alignItems: 'center', justifyContent: 'center' },
  editorTitle: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3, textAlign: 'center' },

  formCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  formInput: { height: 52, paddingHorizontal: 16, fontSize: 16, color: C.text },

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
