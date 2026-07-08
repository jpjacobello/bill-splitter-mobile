import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme';
import { BillSession, BillHistoryEntry } from '../../types';
import { subscribeToSession } from '../../services/billSession';
import { getSessions, StoredSession } from '../../utils/sessionStorage';
import { getBillHistory } from '../../utils/proStorage';
import { usePro } from '../../hooks/usePro';
import { formatCurrency } from '../../utils/currency';
import { startNewBill } from '../../utils/startBill';

const SAVED_NAME_KEY = 'savedHostName';
const FREE_RECENT_CAP = 10;

// Sum of what friends have claimed (committed to pay) on an open session.
function claimedTotal(session: BillSession | null): number {
  if (!session) return 0;
  return Object.values(session.claims ?? {}).reduce((sum, c) => {
    const item = session.receipt.items.find((i) => i.id === c.itemId);
    if (item) return sum + item.price * c.fraction;
    if (c.itemId === 'equal-split' && session.peopleCount) {
      return sum + (session.receipt.total / session.peopleCount);
    }
    return sum;
  }, 0);
}

export default function HomeScreen() {
  const router = useRouter();
  const { isPro } = usePro();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [stored, setStored] = useState<StoredSession[]>([]);
  const [liveData, setLiveData] = useState<Map<string, BillSession | null>>(new Map());
  const [history, setHistory] = useState<BillHistoryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const unsubsRef = useRef<Map<string, () => void>>(new Map());

  // Onboarding gate
  useEffect(() => {
    AsyncStorage.getItem(SAVED_NAME_KEY).then((n) => {
      if (!n?.trim()) { router.replace('/onboarding'); return; }
      setName(n.trim());
      setReady(true);
    });
  }, []);

  const load = useCallback(async () => {
    const [sessions, hist] = await Promise.all([getSessions(), getBillHistory()]);
    setStored(sessions);
    setHistory(hist);
    for (const s of sessions) {
      if (unsubsRef.current.has(s.sessionId)) continue;
      const unsub = subscribeToSession(s.sessionId, (live) => {
        setLiveData((prev) => new Map(prev).set(s.sessionId, live));
      });
      unsubsRef.current.set(s.sessionId, unsub);
    }
  }, []);

  useFocusEffect(useCallback(() => { if (ready) load(); }, [ready, load]));
  useEffect(() => () => { for (const u of unsubsRef.current.values()) u(); unsubsRef.current.clear(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!ready) return <View style={styles.container} />;

  const owed = stored.reduce((sum, s) => sum + claimedTotal(liveData.get(s.sessionId) ?? null), 0);
  const recent = isPro ? history : history.slice(0, FREE_RECENT_CAP);
  const capped = !isPro && history.length > FREE_RECENT_CAP;

  const startScan = async () => { await startNewBill(); router.push('/receipt-upload'); };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        <View style={styles.topRow}>
          <Text style={styles.greeting}>Hi, {name}</Text>
        </View>

        {/* Owed to you */}
        <View style={styles.owedCard}>
          <Text style={styles.owedLabel}>Owed to you</Text>
          <Text style={styles.owedValue}>{formatCurrency(owed)}</Text>
          <Text style={styles.owedSub}>
            {stored.length === 0
              ? 'No open splits'
              : `across ${stored.length} open split${stored.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        {/* Active sessions */}
        {stored.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active</Text>
            {stored.map((s) => {
              const live = liveData.get(s.sessionId);
              const claims = Object.values(live?.claims ?? {});
              const isEqual = live?.splitType === 'equal';
              const totalItems = live?.receipt.items.filter((i) => i.price > 0 && !i.parentId).length ?? 0;
              const claimedCount = new Set(claims.map((c) => c.itemId)).size;
              const seatsTaken = claims.filter((c) => c.itemId === 'equal-split').length;
              return (
                <TouchableOpacity key={s.sessionId} style={styles.rowCard} activeOpacity={0.7} onPress={() => router.push('/activity')}>
                  <View style={styles.liveDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{s.merchantName || 'Bill'}</Text>
                    <Text style={styles.rowSub}>
                      {isEqual ? `${seatsTaken} of ${live?.peopleCount ?? 0} paid` : `${claimedCount} of ${totalItems} claimed`}
                    </Text>
                  </View>
                  <Text style={styles.rowAmt}>{formatCurrency(claimedTotal(live ?? null))}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Recent bills */}
        {recent.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Recent</Text>
              <TouchableOpacity onPress={() => router.push('/activity')}><Text style={styles.seeAll}>See all →</Text></TouchableOpacity>
            </View>
            {recent.slice(0, 4).map((e) => (
              <TouchableOpacity key={e.id} style={styles.rowCard} activeOpacity={0.7} onPress={() => router.push('/activity')}>
                <View style={styles.recIcon}><Ionicons name="receipt-outline" size={18} color={colors.textSecondary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{e.merchantName || 'Bill'}</Text>
                  <Text style={styles.rowSub}>{new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                </View>
                <Text style={styles.rowAmt}>{formatCurrency(e.receipt.total)}</Text>
              </TouchableOpacity>
            ))}
            {capped && (
              <TouchableOpacity style={styles.nudge} onPress={() => router.push('/settings')}>
                <Text style={styles.nudgeText}>See all your history with Divi Pro →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Empty state */}
        {stored.length === 0 && recent.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={40} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>Start your first split</Text>
            <Text style={styles.emptySub}>Scan a receipt or split a total evenly.</Text>
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionPrimary} activeOpacity={0.85} onPress={startScan}>
            <Ionicons name="scan-outline" size={20} color="#000" />
            <Text style={styles.actionPrimaryText}>Scan a receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionSecondary} activeOpacity={0.85} onPress={() => router.push('/quick-split')}>
            <Ionicons name="calculator-outline" size={20} color={colors.text} />
            <Text style={styles.actionSecondaryText}>Quick Split</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 120, gap: 20 },
  topRow: { paddingTop: 4 },
  greeting: { fontSize: 26, fontWeight: '800', color: colors.text },

  owedCard: {
    backgroundColor: 'rgba(62,173,116,0.10)', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: 'rgba(62,173,116,0.25)',
  },
  owedLabel: { fontSize: 13, fontWeight: '600', color: colors.green },
  owedValue: { fontSize: 40, fontWeight: '800', color: colors.text, marginTop: 4 },
  owedSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  seeAll: { fontSize: 13, color: colors.textMuted },

  rowCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  recIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowAmt: { fontSize: 15, fontWeight: '700', color: colors.text },

  nudge: { alignItems: 'center', paddingVertical: 10 },
  nudgeText: { fontSize: 13, color: colors.green, fontWeight: '600' },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textDim },
  emptySub: { fontSize: 14, color: colors.textMuted },

  actions: { gap: 12, marginTop: 4 },
  actionPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 16, backgroundColor: colors.btnPrimary,
  },
  actionPrimaryText: { fontSize: 16, fontWeight: '700', color: '#000' },
  actionSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 16, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  actionSecondaryText: { fontSize: 16, fontWeight: '700', color: colors.text },
});
