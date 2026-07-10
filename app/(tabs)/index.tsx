import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView, SFSymbol } from 'expo-symbols';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimatedMoney from '../../components/AnimatedMoney';
import Perforation from '../../components/Perforation';
import { moneyText, ui as C } from '../../theme';
import { BillSession, BillHistoryEntry } from '../../types';
import { outstandingOwed, claimersCount, claimerBreakdown } from '../../utils/sessionOwed';
import { subscribeToSession } from '../../services/billSession';
import { getSessions, StoredSession } from '../../utils/sessionStorage';
import { getBillHistory } from '../../utils/proStorage';
import { usePro } from '../../hooks/usePro';
import { formatCurrency } from '../../utils/currency';

const SAVED_NAME_KEY = 'savedHostName';
const FREE_RECENT_CAP = 3;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
}

function Enter({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400, delay }}>
      {children}
    </MotiView>
  );
}

function Row({ symbol, tint, title, sub, amount, live, onPress }: {
  symbol: SFSymbol; tint: string; title: string; sub: string; amount: number; live?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: tint + '22' }]}>
        <SymbolView name={symbol} size={17} tintColor={tint} type="hierarchical" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.rowSubLine}>
          {live && <View style={styles.liveDot} />}
          <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
        </View>
      </View>
      <Text style={[styles.rowAmt, moneyText]}>{formatCurrency(amount)}</Text>
      <SymbolView name="chevron.right" size={13} tintColor={C.faint} style={{ marginLeft: 6 }} />
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
      setName(n.trim().split(/\s+/)[0]); // first name only on home
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

  const owed = stored.reduce((sum, s) => sum + outstandingOwed(liveData.get(s.sessionId) ?? null), 0);
  const peopleOwe = stored.reduce((n, s) => n + claimersCount(liveData.get(s.sessionId) ?? null), 0);
  const recent = isPro ? history : history.slice(0, FREE_RECENT_CAP);
  const capped = !isPro && history.length > FREE_RECENT_CAP;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.dim} />}
        >
          {/* Top bar */}
          <Enter>
            <View style={styles.topbar}>
              <View>
                <Text style={styles.date}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
                <Text style={styles.hi}>{greeting()}, {name}</Text>
              </View>
              <TouchableOpacity style={styles.gear} activeOpacity={0.6} onPress={() => router.push('/settings')}>
                <SymbolView name="gearshape.fill" size={18} tintColor={C.dim} />
              </TouchableOpacity>
            </View>
          </Enter>

          {/* Owed hero — signature: count-up amount + receipt perforation */}
          <Enter delay={70}>
            <View style={styles.hero}>
              <View style={styles.heroLabelRow}>
                <View style={styles.liveDot} />
                <Text style={styles.heroLabel}>CLAIMED SO FAR</Text>
              </View>
              <AnimatedMoney value={owed} style={styles.heroAmt} />
              <Perforation />
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, moneyText]}>{stored.length}</Text>
                  <Text style={styles.statLabel}>open {stored.length === 1 ? 'split' : 'splits'}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, moneyText]}>{peopleOwe}</Text>
                  <Text style={styles.statLabel}>{peopleOwe === 1 ? 'person claimed' : 'people claimed'}</Text>
                </View>
              </View>
            </View>
          </Enter>

          {/* Live — permanent: live rows when active, else a share-link pitch */}
          <Enter delay={130}>
            <Text style={styles.section}>LIVE</Text>
            {stored.length > 0 ? (
              <View style={styles.group}>
                {stored.map((s, i) => {
                  const live = liveData.get(s.sessionId);
                  const claims = Object.values(live?.claims ?? {});
                  const isEqual = live?.splitType === 'equal';
                  const seatsTaken = claims.filter((c) => c.itemId === 'equal-split').length;
                  const owedAmt = outstandingOwed(live ?? null);
                  const cl = claimerBreakdown(live ?? null);
                  const sub = isEqual
                    ? `${seatsTaken} of ${live?.peopleCount ?? 0} paid`
                    : cl.length === 0 ? 'Waiting on claims' : `${cl.length} claimed`;
                  return (
                    <View key={s.sessionId}>
                      {i > 0 && <View style={styles.sep} />}
                      <Row symbol="dot.radiowaves.left.and.right" tint={C.accent} live
                        title={s.merchantName || 'Bill'} sub={sub}
                        amount={owedAmt}
                        onPress={() => router.push('/activity?tab=live')} />
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.liveEmpty}>
                <View style={styles.liveEmptyIcon}>
                  <SymbolView name="dot.radiowaves.left.and.right" size={22} tintColor={C.accent} type="hierarchical" />
                </View>
                <Text style={styles.liveEmptyText}>Share a bill and watch friends pay in real time — no app for them.</Text>
              </View>
            )}
          </Enter>

          {/* Recent */}
          {recent.length > 0 && (
            <Enter delay={190}>
              <View style={styles.sectionHead}>
                <Text style={styles.section}>RECENT</Text>
                <TouchableOpacity onPress={() => router.push('/activity?tab=past')} activeOpacity={0.6}>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.group}>
                {recent.slice(0, 4).map((e, i) => (
                  <View key={e.id}>
                    {i > 0 && <View style={styles.sep} />}
                    <Row symbol="checkmark.circle.fill" tint={C.blue}
                      title={e.merchantName || 'Bill'}
                      sub={`${new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · settled`}
                      amount={e.receipt.total}
                      onPress={() => router.push('/activity?tab=past')} />
                  </View>
                ))}
              </View>
              {capped && (
                <TouchableOpacity style={styles.nudge} activeOpacity={0.7} onPress={() => router.push('/paywall')}>
                  <Text style={styles.nudgeText}>See all your history with Divi Pro</Text>
                </TouchableOpacity>
              )}
            </Enter>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },

  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 18 },
  date: { fontSize: 13, color: C.faint, fontWeight: '500', letterSpacing: 0.2 },
  hi: { fontSize: 24, color: C.text, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
  gear: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },

  hero: { backgroundColor: C.card, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: C.line, marginBottom: 16 },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroLabel: { fontSize: 12, fontWeight: '700', color: C.faint, letterSpacing: 1.4 },
  heroAmt: { fontSize: 46, fontWeight: '800', color: C.text, letterSpacing: -1.6, marginTop: 6 },


  statRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  statNum: { fontSize: 17, fontWeight: '700', color: C.text },
  statLabel: { fontSize: 12, color: C.dim },
  statDivider: { width: 1, height: 22, backgroundColor: C.line },


  section: { fontSize: 12.5, fontWeight: '700', color: C.faint, letterSpacing: 1.2, marginBottom: 10, marginLeft: 2 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { fontSize: 13.5, fontWeight: '600', color: C.blue, marginBottom: 10 },

  group: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginBottom: 26, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 14 },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: C.text, letterSpacing: -0.2 },
  rowSubLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rowSub: { fontSize: 12.5, color: C.dim },
  rowAmt: { fontSize: 15.5, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  sep: { height: 1, backgroundColor: C.line, marginLeft: 65 },

  nudge: { alignItems: 'center', paddingVertical: 10, marginTop: -14, marginBottom: 12 },
  nudgeText: { fontSize: 13, color: C.accent, fontWeight: '600' },

  liveEmpty: {
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line,
    padding: 20, marginBottom: 26, alignItems: 'center', gap: 12,
  },
  liveEmptyIcon: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.accent + '22',
  },
  liveEmptyText: { fontSize: 13.5, color: C.dim, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },
});
