import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../../components/Button';
import { colors, moneyText } from '../../theme';
import { BillSession, BillHistoryEntry } from '../../types';
import { subscribeToSession } from '../../services/billSession';
import { getSessions, StoredSession } from '../../utils/sessionStorage';
import { getBillHistory } from '../../utils/proStorage';
import { getEmoji } from '../../utils/buildReceiptHtml';
import { usePro } from '../../hooks/usePro';
import { formatCurrency } from '../../utils/currency';
import { startNewBill } from '../../utils/startBill';

const SAVED_NAME_KEY = 'savedHostName';
const FREE_RECENT_CAP = 10;

function claimedTotal(session: BillSession | null): number {
  if (!session) return 0;
  return Object.values(session.claims ?? {}).reduce((sum, c) => {
    const item = session.receipt.items.find((i) => i.id === c.itemId);
    if (item) return sum + item.price * c.fraction;
    if (c.itemId === 'equal-split' && session.peopleCount) return sum + session.receipt.total / session.peopleCount;
    return sum;
  }, 0);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

// One shared row for both Active and Recent items.
function Row({ emoji, icon, accent, title, status, amount, onPress }: {
  emoji?: string; icon?: keyof typeof Ionicons.glyphMap; accent?: boolean;
  title: string; status: React.ReactNode; amount: number; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.rowTile, accent && styles.rowTileAccent]}>
        {emoji ? <Text style={styles.rowEmoji}>{emoji}</Text> : <Ionicons name={icon ?? 'receipt-outline'} size={18} color={colors.textSecondary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.rowStatusLine}>{status}</View>
      </View>
      <View style={styles.rowTrailing}>
        <Text style={[styles.rowAmt, moneyText]}>{formatCurrency(amount)}</Text>
        <Ionicons name="chevron-forward" size={16} color="#5a5a5c" />
      </View>
    </TouchableOpacity>
  );
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
      const unsub = subscribeToSession(s.sessionId, (live) => setLiveData((prev) => new Map(prev).set(s.sessionId, live)));
      unsubsRef.current.set(s.sessionId, unsub);
    }
  }, []);

  useFocusEffect(useCallback(() => { if (ready) load(); }, [ready, load]));
  useEffect(() => () => { for (const u of unsubsRef.current.values()) u(); unsubsRef.current.clear(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!ready) return <View style={styles.container} />;

  const owed = stored.reduce((sum, s) => sum + claimedTotal(liveData.get(s.sessionId) ?? null), 0);
  // distinct claimants across all live sessions = people who owe you
  const claimants = new Set<string>();
  for (const s of stored) {
    const live = liveData.get(s.sessionId);
    for (const c of Object.values(live?.claims ?? {})) claimants.add(`${s.sessionId}:${c.claimerName}`);
  }
  const recent = isPro ? history : history.slice(0, FREE_RECENT_CAP);
  const capped = !isPro && history.length > FREE_RECENT_CAP;
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const startScan = async () => { await startNewBill(); router.push('/receipt-upload'); };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLine}>{dateLine}</Text>
            <Text style={styles.greeting}>Hi, {name}</Text>
          </View>
          <TouchableOpacity style={styles.avatar} activeOpacity={0.7} onPress={() => router.push('/settings')}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </TouchableOpacity>
        </View>

        {/* Owed hero */}
        <View style={styles.owedCard}>
          <LinearGradient
            colors={['rgba(62,173,116,0.16)', 'rgba(62,173,116,0.06)']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cardHighlight} pointerEvents="none" />
          <View style={styles.owedLabelRow}>
            <View style={styles.owedDot} />
            <Text style={styles.owedLabel}>OWED TO YOU</Text>
          </View>
          <Text style={[styles.owedValue, moneyText]}>{formatCurrency(owed)}</Text>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, moneyText]}>{stored.length}</Text>
              <Text style={styles.statLabel}>open {stored.length === 1 ? 'split' : 'splits'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statNum, moneyText]}>{claimants.size}</Text>
              <Text style={styles.statLabel}>{claimants.size === 1 ? 'person owes you' : 'people owe you'}</Text>
            </View>
          </View>
        </View>

        {/* Active */}
        {stored.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>ACTIVE · {stored.length}</Text>
            </View>
            {stored.map((s) => {
              const live = liveData.get(s.sessionId);
              const claims = Object.values(live?.claims ?? {});
              const isEqual = live?.splitType === 'equal';
              const totalItems = live?.receipt.items.filter((i) => i.price > 0 && !i.parentId).length ?? 0;
              const claimedCount = new Set(claims.map((c) => c.itemId)).size;
              const seatsTaken = claims.filter((c) => c.itemId === 'equal-split').length;
              const status = (
                <>
                  <View style={styles.livePill}><Text style={styles.livePillText}>● live</Text></View>
                  <Text style={styles.rowStatusText}>
                    {isEqual ? `${seatsTaken} of ${live?.peopleCount ?? 0} paid` : `${claimedCount} of ${totalItems} claimed`}
                  </Text>
                </>
              );
              return (
                <Row key={s.sessionId} emoji={getEmoji(s.merchantName || '')} accent title={s.merchantName || 'Bill'}
                  status={status} amount={claimedTotal(live ?? null)} onPress={() => router.push('/activity')} />
              );
            })}
          </View>
        )}

        {/* Recent */}
        {recent.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>RECENT · {recent.length}</Text>
              <TouchableOpacity onPress={() => router.push('/activity')}><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
            </View>
            {recent.slice(0, 4).map((e) => (
              <Row key={e.id} icon="receipt-outline" title={e.merchantName || 'Bill'}
                status={<Text style={styles.rowStatusText}>{new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · settled</Text>}
                amount={e.receipt.total} onPress={() => router.push('/activity')} />
            ))}
            {capped && (
              <TouchableOpacity style={styles.nudge} onPress={() => router.push('/settings')}>
                <Text style={styles.nudgeText}>See all your history with Divi Pro</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Empty state */}
        {stored.length === 0 && recent.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={34} color={colors.textSecondary} /></View>
            <Text style={styles.emptyTitle}>Start your first split</Text>
            <Text style={styles.emptySub}>Scan a receipt and split it by what each person ordered.</Text>
            <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
              <Button label="Scan your first receipt" icon="scan-outline" onPress={startScan} />
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <Button label="Scan a receipt" icon="scan-outline" variant="primary" onPress={startScan} />
            <Button label="Quick Split" icon="calculator-outline" variant="ghost" onPress={() => router.push('/quick-split')} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 120, gap: 20 },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 4 },
  dateLine: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, color: colors.textMuted, marginBottom: 3 },
  greeting: { fontSize: 27, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.person[0] + '38', borderWidth: 1, borderColor: colors.person[0] + '80',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: colors.person[0] },

  owedCard: {
    borderRadius: 22, padding: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(62,173,116,0.25)',
  },
  cardHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  owedLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  owedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4FC08A' },
  owedLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: '#4FC08A' },
  owedValue: { fontSize: 46, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginTop: 4 },
  statRow: { flexDirection: 'row', gap: 28, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(62,173,116,0.20)' },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  statNum: { fontSize: 17, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted },

  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: colors.textMuted },
  seeAll: { fontSize: 13, fontWeight: '600', color: '#8FB4E4' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 16, padding: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  rowTile: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  rowTileAccent: { backgroundColor: 'rgba(62,173,116,0.15)', borderWidth: 1, borderColor: 'rgba(62,173,116,0.35)' },
  rowEmoji: { fontSize: 18 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowStatusLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  rowStatusText: { fontSize: 12, color: colors.textMuted },
  livePill: { backgroundColor: 'rgba(62,173,116,0.14)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  livePillText: { fontSize: 11, fontWeight: '600', color: '#4FC08A' },
  rowTrailing: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowAmt: { fontSize: 16, fontWeight: '800', color: colors.text },

  nudge: { alignItems: 'center', paddingVertical: 10 },
  nudgeText: { fontSize: 13, color: colors.green, fontWeight: '600' },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 30 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  actions: { gap: 12, marginTop: 4 },
});
