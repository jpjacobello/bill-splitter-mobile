import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView, SFSymbol } from 'expo-symbols';
import { MotiView } from 'moti';
import ActionSheet from '../../components/ActionSheet';
import Perforation from '../../components/Perforation';
import { moneyText, ui as C } from '../../theme';
import { outstandingOwed, claimerBreakdown } from '../../utils/sessionOwed';
import { BillSession, BillHistoryEntry } from '../../types';
import { subscribeToSession, closeSession, getSession } from '../../services/billSession';
import { getSessions, removeSession, StoredSession } from '../../utils/sessionStorage';
import { sessionToHistory, isSessionFullyClaimed } from '../../utils/sessionArchive';
import { getBillHistory, saveBillToHistory, deleteBillFromHistory } from '../../utils/proStorage';
import BillDetailSheet from '../../components/BillDetailSheet';
import { usePro } from '../../hooks/usePro';
import { formatCurrency } from '../../utils/currency';

import { WEB_BASE_URL } from '../../utils/config';
const FREE_CAP = 3;

function Enter({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 380, delay }}>
      {children}
    </MotiView>
  );
}

export default function ActivityScreen() {
  const { isPro } = usePro();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'live' | 'past'>('live');

  // Home-screen entry points force a specific tab (receipt → past, live → live).
  useEffect(() => {
    if (params.tab === 'live' || params.tab === 'past') {
      setTab(params.tab);
      router.setParams({ tab: '' });
    }
  }, [params.tab]);

  const [closeTarget, setCloseTarget] = useState<StoredSession | null>(null);
  const [detailEntry, setDetailEntry] = useState<BillHistoryEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<BillHistoryEntry | null>(null);
  // Delete requested from INSIDE the detail sheet: stash it, close the detail
  // sheet, and only present the confirm once the detail has fully unmounted.
  // Two native Modals transitioning at once (present-over-dismissing or
  // dismiss-with-dismissing) wedges iOS — strictly one sheet at a time.
  const pendingDeleteRef = useRef<BillHistoryEntry | null>(null);
  const [stored, setStored] = useState<StoredSession[]>([]);
  const [liveData, setLiveData] = useState<Map<string, BillSession | null>>(new Map());
  const [history, setHistory] = useState<BillHistoryEntry[]>([]);
  const unsubsRef = useRef<Map<string, () => void>>(new Map());
  const archivedRef = useRef<Set<string>>(new Set());
  // Serializes archive writes: saveBillToHistory + removeSession are non-atomic
  // read-modify-writes on shared AsyncStorage keys, so two sessions archiving
  // concurrently could clobber each other's history entry. Chain them.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const isProRef = useRef(isPro);
  isProRef.current = isPro;

  const archiveSession = useCallback((session: BillSession): Promise<void> => {
    if (archivedRef.current.has(session.id)) return queueRef.current;
    archivedRef.current.add(session.id);
    queueRef.current = queueRef.current.catch(() => {}).then(async () => {
      // carry the host's local receipt photo (saved at share time) into history
      const meta = (await getSessions()).find((x) => x.sessionId === session.id);
      await saveBillToHistory({ ...sessionToHistory(session), receiptImageUri: meta?.receiptImageUri });
      await removeSession(session.id);
      unsubsRef.current.get(session.id)?.();
      unsubsRef.current.delete(session.id);
      setStored((prev) => prev.filter((s) => s.sessionId !== session.id));
      setHistory(await getBillHistory());
    });
    return queueRef.current;
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
  const confirmClose = async (s: StoredSession) => {
    // Swallow a rejected close (deleted doc / permission / network) so we still
    // fall through to local cleanup — otherwise the LIVE card sticks forever.
    try { await closeSession(s.sessionId); } catch {}
    // Re-fetch from the server instead of reading the stale render-time liveData
    // closure: a claim committed during the close round-trip would otherwise be
    // dropped from the archived record and mis-assigned to the host.
    let live: BillSession | null = null;
    try { live = await getSession(s.sessionId); } catch {}
    if (live) await archiveSession({ ...live, status: 'closed' });
    else { await removeSession(s.sessionId); setStored((p) => p.filter((x) => x.sessionId !== s.sessionId)); }
  };

  const pastList = isPro ? history : history.slice(0, FREE_CAP);
  const capped = !isPro && history.length > FREE_CAP;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}><Text style={styles.title}>Activity</Text></View>
        <View style={styles.segment}>
          {(['live', 'past'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.segBtn, tab === t && styles.segBtnActive]} onPress={() => setTab(t)} activeOpacity={0.7}>
              <Text style={[styles.segText, tab === t && styles.segTextActive]}>{t === 'live' ? 'Live' : 'Past'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {tab === 'live' ? (
            stored.length === 0 ? (
              <Empty symbol="dot.radiowaves.left.and.right" title="No active sessions" sub="Share a bill link to start tracking who's paid." />
            ) : stored.map((s, idx) => {
              const live = liveData.get(s.sessionId);
              const isEqual = live?.splitType === 'equal';
              const claims = Object.values(live?.claims ?? {});
              const seatsTaken = claims.filter((c) => c.itemId === 'equal-split').length;
              const owed = outstandingOwed(live ?? null);
              const claimers = claimerBreakdown(live ?? null);
              return (
                <Enter key={s.sessionId} delay={idx * 60}>
                  <View style={styles.card}>
                    <View style={styles.cardHead}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{s.merchantName || 'Bill'}</Text>
                      <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveBadgeText}>LIVE</Text></View>
                    </View>
                    <View style={styles.cardOwedRow}>
                      <Text style={[styles.cardOwed, moneyText]}>{formatCurrency(owed)}</Text>
                      <Text style={styles.cardOwedLabel}>claimed of {formatCurrency(live?.receipt.total ?? 0)}</Text>
                    </View>
                    {isEqual ? (
                      <Text style={styles.progress}>{seatsTaken} of {live?.peopleCount ?? 0} paid</Text>
                    ) : claimers.length === 0 ? (
                      <Text style={styles.progress}>Waiting on claims…</Text>
                    ) : null}

                    {!isEqual && claimers.length > 0 && (
                      <View style={styles.claimers}>
                        {claimers.map((cl) => (
                          <View key={cl.name} style={styles.claimerRow}>
                            <View style={styles.claimerDot} />
                            <Text style={styles.claimerName} numberOfLines={1}>{cl.name}</Text>
                            <Text style={[styles.claimerAmt, moneyText]}>{formatCurrency(cl.amount)}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <Perforation dots={30} />
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => shareAgain(s)} activeOpacity={0.75}>
                        <SymbolView name="square.and.arrow.up" size={15} tintColor={C.text} />
                        <Text style={styles.actionText}>Share again</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.actionDestructive]} onPress={() => setCloseTarget(s)} activeOpacity={0.75}>
                        <Text style={[styles.actionText, styles.actionTextDestructive]}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Enter>
              );
            })
          ) : (
            pastList.length === 0 ? (
              <Empty symbol="clock" title="No past bills" sub="Completed splits show up here." />
            ) : (
              <Enter>
                <View style={styles.group}>
                  {pastList.map((e, i) => (
                    <View key={e.id}>
                      {i > 0 && <View style={styles.sep} />}
                      <TouchableOpacity style={styles.row} activeOpacity={0.6}
                        onPress={() => setDetailEntry(e)} onLongPress={() => setDeleteEntry(e)} delayLongPress={500}>
                        <View style={styles.rowIcon}><SymbolView name="checkmark.circle.fill" size={17} tintColor={C.blue} type="hierarchical" /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{e.merchantName || 'Bill'}</Text>
                          <Text style={styles.rowSub}>{new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {e.people.length} people</Text>
                        </View>
                        <Text style={[styles.rowAmt, moneyText]}>{formatCurrency(e.receipt.total)}</Text>
                        <SymbolView name="chevron.right" size={13} tintColor={C.faint} style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                {capped && (
                  <TouchableOpacity style={styles.nudge} activeOpacity={0.7} onPress={() => router.push('/paywall')}><Text style={styles.nudgeText}>See all your history with Divi Pro</Text></TouchableOpacity>
                )}
              </Enter>
            )
          )}
        </ScrollView>

        <ActionSheet
          visible={closeTarget !== null}
          title="Close & save?"
          message="Ends claiming and saves this bill to your history."
          options={[{
            label: 'Close Session', icon: 'archive-outline', destructive: true,
            onPress: () => { if (closeTarget) confirmClose(closeTarget); },
          }]}
          onClose={() => setCloseTarget(null)}
        />

        <BillDetailSheet
          entry={detailEntry}
          onClose={() => setDetailEntry(null)}
          onRequestDelete={(e) => { pendingDeleteRef.current = e; setDetailEntry(null); }}
          onClosed={() => {
            const pending = pendingDeleteRef.current;
            if (!pending) return;
            pendingDeleteRef.current = null;
            // Small beat so the native dismissal fully settles before the next
            // Modal presents — present-during-dismiss is the freeze we're avoiding.
            setTimeout(() => setDeleteEntry(pending), 80);
          }}
        />
        <ActionSheet
          visible={deleteEntry !== null}
          title="Delete bill?"
          message="This removes it from your history and can't be undone."
          options={[{
            label: 'Delete', icon: 'trash-outline', destructive: true,
            onPress: async () => {
              if (!deleteEntry) return;
              const id = deleteEntry.id;
              // Serialize through the same queue as archiveSession: both are
              // non-atomic RMWs on the shared 'billHistory' key, so an in-flight
              // auto-archive and this delete could otherwise clobber each other.
              queueRef.current = queueRef.current.catch(() => {}).then(async () => {
                await deleteBillFromHistory(id);
                setHistory(await getBillHistory());
              });
              await queueRef.current;
            },
          }]}
          onClose={() => setDeleteEntry(null)}
        />
      </SafeAreaView>
    </View>
  );
}

function Empty({ symbol, title, sub }: { symbol: SFSymbol; title: string; sub: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><SymbolView name={symbol} size={30} tintColor={C.dim} type="hierarchical" /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  segment: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 14,
    backgroundColor: C.card, borderRadius: 12, padding: 4, gap: 4, borderWidth: 1, borderColor: C.line,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segBtnActive: { backgroundColor: 'rgba(255,255,255,0.10)' },
  segText: { fontSize: 14, fontWeight: '600', color: C.dim },
  segTextActive: { color: C.text },

  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 14 },

  card: { backgroundColor: C.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.line },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { fontSize: 16.5, fontWeight: '700', color: C.text, flex: 1, letterSpacing: -0.2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.accentDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  liveBadgeText: { fontSize: 10.5, fontWeight: '700', color: C.accent, letterSpacing: 0.6 },
  cardOwedRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 14 },
  cardOwed: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.6 },
  cardOwedLabel: { fontSize: 12.5, color: C.dim },
  progress: { fontSize: 13, color: C.dim, marginTop: 4 },
  claimers: { marginTop: 12, gap: 2 },
  claimerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  claimerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  claimerName: { flex: 1, fontSize: 14.5, color: C.text, fontWeight: '600' },
  claimerAmt: { fontSize: 14.5, color: C.text, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    borderWidth: 1, borderColor: C.line,
  },
  actionDestructive: { flex: 0, paddingHorizontal: 18, backgroundColor: 'rgba(224,90,106,0.10)', borderColor: 'rgba(224,90,106,0.22)' },
  actionText: { fontSize: 13.5, fontWeight: '600', color: C.text },
  actionTextDestructive: { color: '#E86A78' },

  group: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 14 },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.blue + '22' },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: C.text, letterSpacing: -0.2 },
  rowSub: { fontSize: 12.5, color: C.dim, marginTop: 2 },
  rowAmt: { fontSize: 15.5, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  sep: { height: 1, backgroundColor: C.line, marginLeft: 65 },

  nudge: { alignItems: 'center', paddingVertical: 14 },
  nudgeText: { fontSize: 13, color: C.accent, fontWeight: '600' },

  empty: { alignItems: 'center', gap: 8, paddingTop: 70, paddingHorizontal: 44 },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 1, borderColor: C.line },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center' },
  emptySub: { fontSize: 14, color: C.dim, textAlign: 'center', lineHeight: 20 },
});
