import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { BillSession, BillHistoryEntry } from '../../types';
import { subscribeToSession, closeSession } from '../../services/billSession';
import { getSessions, removeSession, StoredSession } from '../../utils/sessionStorage';
import { sessionToHistory, isSessionFullyClaimed } from '../../utils/sessionArchive';
import { getBillHistory, saveBillToHistory } from '../../utils/proStorage';
import { usePro } from '../../hooks/usePro';
import { formatCurrency } from '../../utils/currency';

const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://dist-omega-opal-62.vercel.app';
const FREE_CAP = 10;

export default function ActivityScreen() {
  const { isPro } = usePro();
  const [tab, setTab] = useState<'live' | 'past'>('live');
  const [stored, setStored] = useState<StoredSession[]>([]);
  const [liveData, setLiveData] = useState<Map<string, BillSession | null>>(new Map());
  const [history, setHistory] = useState<BillHistoryEntry[]>([]);
  const unsubsRef = useRef<Map<string, () => void>>(new Map());
  const archivedRef = useRef<Set<string>>(new Set());
  const isProRef = useRef(isPro);
  isProRef.current = isPro;

  const archiveSession = useCallback(async (session: BillSession) => {
    if (archivedRef.current.has(session.id)) return;
    archivedRef.current.add(session.id);
    await saveBillToHistory(sessionToHistory(session));
    await removeSession(session.id);
    unsubsRef.current.get(session.id)?.();
    unsubsRef.current.delete(session.id);
    setStored((prev) => prev.filter((s) => s.sessionId !== session.id));
    setHistory(await getBillHistory());
  }, []);

  const load = useCallback(async () => {
    const [sessions, hist] = await Promise.all([getSessions(), getBillHistory()]);
    setStored(sessions);
    setHistory(hist);
    for (const s of sessions) {
      if (unsubsRef.current.has(s.sessionId)) continue;
      const unsub = subscribeToSession(s.sessionId, (live) => {
        setLiveData((prev) => new Map(prev).set(s.sessionId, live));
        if (live && isSessionFullyClaimed(live) && !archivedRef.current.has(live.id)) archiveSession(live);
      });
      unsubsRef.current.set(s.sessionId, unsub);
    }
  }, [archiveSession]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => () => { for (const u of unsubsRef.current.values()) u(); unsubsRef.current.clear(); }, []);

  const shareAgain = async (s: StoredSession) => {
    await Share.share({ message: `${s.merchantName ? s.merchantName + ' — ' : ''}Pay your share`, url: `${WEB_BASE_URL}/split/${s.sessionId}` });
  };
  const close = (s: StoredSession) => {
    Alert.alert('Close & Save?', 'Ends claiming and saves this bill to your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: async () => {
        await closeSession(s.sessionId);
        const live = liveData.get(s.sessionId);
        if (live) await archiveSession({ ...live, status: 'closed' });
        else { await removeSession(s.sessionId); setStored((p) => p.filter((x) => x.sessionId !== s.sessionId)); }
      } },
    ]);
  };

  const pastList = isPro ? history : history.slice(0, FREE_CAP);
  const capped = !isPro && history.length > FREE_CAP;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}><Text style={styles.title}>Activity</Text></View>
      <View style={styles.segment}>
        {(['live', 'past'] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.segBtn, tab === t && styles.segBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.segText, tab === t && styles.segTextActive]}>{t === 'live' ? 'Live' : 'Past'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'live' ? (
          stored.length === 0 ? (
            <Empty icon="radio-outline" title="No active sessions" sub="Share a bill link to start tracking who's paid." />
          ) : stored.map((s) => {
            const live = liveData.get(s.sessionId);
            const isEqual = live?.splitType === 'equal';
            const claims = Object.values(live?.claims ?? {});
            const totalItems = live?.receipt.items.filter((i) => i.price > 0 && !i.parentId).length ?? 0;
            const claimedCount = new Set(claims.map((c) => c.itemId)).size;
            const seatsTaken = claims.filter((c) => c.itemId === 'equal-split').length;
            return (
              <View key={s.sessionId} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{s.merchantName || 'Bill'}</Text>
                  <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveBadgeText}>Live</Text></View>
                </View>
                <Text style={styles.progress}>
                  {isEqual ? `${seatsTaken} of ${live?.peopleCount ?? 0} paid` : `${claimedCount} of ${totalItems} item${totalItems !== 1 ? 's' : ''} claimed`}
                </Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => shareAgain(s)} activeOpacity={0.75}>
                    <Ionicons name="share-outline" size={14} color={colors.textSecondary} /><Text style={styles.actionText}>Share Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionDestructive]} onPress={() => close(s)} activeOpacity={0.75}>
                    <Text style={[styles.actionText, styles.actionTextDestructive]}>Close Session</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          pastList.length === 0 ? (
            <Empty icon="time-outline" title="No past bills" sub="Completed splits show up here." />
          ) : (
            <>
              {pastList.map((e) => (
                <View key={e.id} style={styles.rowCard}>
                  <View style={styles.recIcon}><Ionicons name="receipt-outline" size={18} color={colors.textSecondary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{e.merchantName || 'Bill'}</Text>
                    <Text style={styles.rowSub}>{new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {e.people.length} people</Text>
                  </View>
                  <Text style={styles.rowAmt}>{formatCurrency(e.receipt.total)}</Text>
                </View>
              ))}
              {capped && (
                <TouchableOpacity style={styles.nudge}><Text style={styles.nudgeText}>See all your history with Divi Pro →</Text></TouchableOpacity>
              )}
            </>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Empty({ icon, title, sub }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={colors.textDisabled} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  segment: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, gap: 4,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segBtnActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  segText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  segTextActive: { color: colors.text },

  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 14 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(62,173,116,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(62,173,116,0.25)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  liveBadgeText: { fontSize: 11, fontWeight: '700', color: colors.green },
  progress: { fontSize: 13, color: colors.textSecondary },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  actionDestructive: { backgroundColor: 'rgba(224,90,106,0.10)', borderColor: 'rgba(224,90,106,0.25)' },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  actionTextDestructive: { color: colors.red },

  rowCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  recIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowAmt: { fontSize: 15, fontWeight: '700', color: colors.text },

  nudge: { alignItems: 'center', paddingVertical: 12 },
  nudgeText: { fontSize: 13, color: colors.green, fontWeight: '600' },

  empty: { alignItems: 'center', gap: 10, paddingTop: 70, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textDim, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
