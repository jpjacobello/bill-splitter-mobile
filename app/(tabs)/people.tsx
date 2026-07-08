import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { colors } from '../../theme';
import { getPeople, addPerson, removePerson, TrackedPerson } from '../../utils/peopleStorage';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export default function PeopleScreen() {
  const [people, setPeople] = useState<TrackedPerson[]>([]);

  const load = useCallback(async () => setPeople(await getPeople()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const importFromContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Contacts access needed', 'Enable Contacts in Settings to add people from your address book. You can still add people manually.');
      return;
    }
    const contact = await Contacts.presentContactPickerAsync();
    if (!contact) return;
    const phone = contact.phoneNumbers?.[0]?.number;
    setPeople(await addPerson({ name: contact.name || 'Unknown', phone, contactId: contact.id }));
  };

  const addManual = () => {
    Alert.prompt('Add a person', "Enter their name.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add', onPress: async (v?: string) => { if (v?.trim()) setPeople(await addPerson({ name: v.trim() })); } },
    ], 'plain-text');
  };

  const confirmRemove = (p: TrackedPerson) => {
    Alert.alert(`Remove ${p.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => setPeople(await removePerson(p.id)) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}><Text style={styles.title}>People</Text></View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.addRow}>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={importFromContacts}>
            <Ionicons name="person-add-outline" size={18} color="#000" />
            <Text style={styles.addBtnText}>From Contacts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, styles.addBtnSecondary]} activeOpacity={0.85} onPress={addManual}>
            <Ionicons name="create-outline" size={18} color={colors.text} />
            <Text style={[styles.addBtnText, styles.addBtnTextSecondary]}>Add Manually</Text>
          </TouchableOpacity>
        </View>

        {people.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={44} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>No people yet</Text>
            <Text style={styles.emptySub}>Add friends from your contacts or manually to track who you split with.</Text>
          </View>
        ) : (
          people.map((p) => (
            <TouchableOpacity key={p.id} style={styles.personRow} activeOpacity={0.7} onLongPress={() => confirmRemove(p)}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials(p.name)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{p.name}</Text>
                {p.phone ? <Text style={styles.personSub}>{p.phone}</Text> : <Text style={styles.personSub}>Added manually</Text>}
              </View>
              {p.contactId && <Ionicons name="person-circle-outline" size={20} color={colors.textDisabled} />}
            </TouchableOpacity>
          ))
        )}

        {people.length > 0 && <Text style={styles.hint}>Long-press a person to remove.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 12 },

  addRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
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

  empty: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textDim, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  hint: { fontSize: 12, color: colors.textDisabled, textAlign: 'center', marginTop: 8 },
});
