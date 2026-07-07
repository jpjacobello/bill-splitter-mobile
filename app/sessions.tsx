import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { BillSession } from '../types';
import { subscribeToSession, closeSession } from '../services/billSession';
import { getSessions, removeSession, StoredSession } from '../utils/sessionStorage';
import { sessionToHistory, isSessionFullyClaimed } from '../utils/sessionArchive';
import { saveBillToHistory } from '../utils/proStorage';
import { usePro } from '../hooks/usePro';
import { formatCurrency } from '../utils/currency';

const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://trydivi.vercel.app';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SessionsScreen() {
  const router = useRouter();
  const { isPro } = usePro();
  const [stored, setStored] = useState<StoredSession[]>([]);
  const [liveData, setLiveData] = useState<Map<string, BillSession | null>>(new Map());
  const unsubsRef = useRef<Map<string, () => void>>(new Map());
  const archivedRef = useRef<Set<string>>(new Set());
  const isProRef = useRef(isPro);
  isProRef.current = isPro;

  const loadSessions = useCallback(async () => {
    const sessions = await getSessions();
    setStored(sessions);
    return sessions;
  }, []);

  // Move a finished session into Bill History (if Pro) and drop it from the live list.
  const archiveSession = useCallback(async (session: BillSession) => {
    if (archivedRef.current.has(session.id)) return;
    archivedRef.current.add(session.id);
    if (isProRef.current) {
      await saveBillToHistory(sessionToHistory(session));
    }
    await removeSession(session.id);
    unsubsRef.current.get(session.id)?.();
    unsubsRef.current.delete(session.id);
    setStored((prev) => prev.filter((s) => s.sessionId !== session.id));
    setLiveData((prev) => { const m = new Map(prev); m.delete(session.id); return m; });
  }, []);

  useEffect(() => {
    loadSessions().then((sessions) => {
      for (const s of sessions) {
        if (unsubsRef.current.has(s.sessionId)) continue;
        const unsub = subscribeToSession(s.sessionId, (live) => {
          setLiveData((prev) => new Map(prev).set(s.sessionId, live));
          // Auto-archive once every item is claimed.
          if (live && isSessionFullyClaimed(live) && !archivedRef.current.has(live.id)) {
            archiveSession(live);
          }
        });
        unsubsRef.current.set(s.sessionId, unsub);
      }
    });
    return () => {
      for (const unsub of unsubsRef.current.values()) unsub();
      unsubsRef.current.clear();
    };
  }, [loadSessions, archiveSession]);

  const handleShareAgain = async (s: StoredSession) => {
    const url = `${WEB_BASE_URL}/split/${s.sessionId}`;
    await Share.share({
      message: `${s.merchantName ? s.merchantName + ' — ' : ''}Pay your share`,
      url,
    });
  };

  const handleClose = (s: StoredSession) => {
    Alert.alert(
      'Close & Save?',
      'Ends claiming and saves this bill to your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close', style: 'destructive', onPress: async () => {
            await closeSession(s.sessionId);
            const live = liveData.get(s.sessionId);
            if (live) {
              await archiveSession({ ...live, status: 'closed' });
            } else {
              await handleRemove(s.sessionId);
            }
          },
        },
      ]
    );
  };

  const handleRemove = async (id: string) => {
    await removeSession(id);
    unsubsRef.current.get(id)?.();
    unsubsRef.current.delete(id);
    setStored((prev) => prev.filter((s) => s.sessionId !== id));
    setLiveData((prev) => { const m = new Map(prev); m.delete(id); return m; });
  };

  const renderCard = ({ item: s }: { item: StoredSession }) => {
    const live = liveData.get(s.sessionId);
    const isClosed = live?.status === 'closed';
    const isEqual = live?.splitType === 'equal';
    const claims = Object.values(live?.claims ?? {});
    const totalItems = live?.receipt.items.filter((i) => i.price > 0 && !i.parentId).length ?? 0;
    const claimedCount = new Set(claims.map((c) => c.itemId)).size;
    const peopleCount = live?.peopleCount ?? 0;
    const seatsTaken = claims.filter((c) => c.itemId === 'equal-split').length;

    const claimerMap = new Map<string, { count: number; total: number }>();
    for (const claim of claims) {
      const item = live?.receipt.items.find((i) => i.id === claim.itemId);
      if (!item) continue;
      const existing = claimerMap.get(claim.claimerName) ?? { count: 0, total: 0 };
      claimerMap.set(claim.claimerName, {
        count: existing.count + 1,
        total: existing.total + item.price * claim.fraction,
      });
    }

    return (
      <View style={[styles.card, isClosed && styles.cardClosed]}>
        <View style={[styles.cardAccent, isClosed && styles.cardAccentClosed]} />

        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.merchantName}>
              {s.merchantName || 'Bill'}
            </Text>
            <Text style={styles.timeAgo}>{timeAgo(s.createdAt)}</Text>
          </View>
          {isClosed ? (
            <View style={styles.closedBadge}>
              <Text style={styles.closedBadgeText}>Closed</Text>
            </View>
          ) : (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>Live</Text>
            </View>
          )}
        </View>

        {live && (
          <>
            <Text style={styles.progress}>
              {isEqual
                ? `${seatsTaken} of ${peopleCount} paid`
                : `${claimedCount} of ${totalItems} item${totalItems !== 1 ? 's' : ''} claimed`}
            </Text>
            {claimerMap.size > 0 ? (
              [...claimerMap.entries()].map(([name, { count, total }]) => (
                <View key={name} style={styles.claimerRow}>
                  <Text style={styles.claimerName}>{name}</Text>
                  <Text style={styles.claimerDetail}>
                    {count} item{count !== 1 ? 's' : ''} · {formatCurrency(total)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.waiting}>Waiting for friends to claim…</Text>
            )}
          </>
        )}

        {!live && (
          <Text style={styles.waiting}>Loading…</Text>
        )}

        <View style={styles.cardActions}>
          {!isClosed && (
            <>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleShareAgain(s)}
                activeOpacity={0.75}
              >
                <Ionicons name="share-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.actionBtnText}>Share Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDestructive]}
                onPress={() => handleClose(s)}
                activeOpacity={0.75}
              >
                <Text style={[styles.actionBtnText, styles.actionBtnTextDestructive]}>Close Session</Text>
              </TouchableOpacity>
            </>
          )}
          {isClosed && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDestructive]}
              onPress={() => handleRemove(s.sessionId)}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" size={14} color={colors.red} />
              <Text style={[styles.actionBtnText, styles.actionBtnTextDestructive]}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#D0D0D0" />
        </TouchableOpacity>
        <Text style={styles.title}>Live Sessions</Text>
      </View>

      <FlatList
        data={stored}
        keyExtractor={(s) => s.sessionId}
        contentContainerStyle={styles.scroll}
        renderItem={renderCard}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="radio-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>No active sessions</Text>
            <Text style={styles.emptySubtitle}>Share a bill link from the summary screen to start tracking.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    gap: 4, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  title: { fontSize: 22, fontWeight: '700', color: colors.textDim },
  scroll: { padding: 20, gap: 14 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18,
    padding: 16, paddingLeft: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden', gap: 8,
  },
  cardClosed: { opacity: 0.65 },
  cardAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
    borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
    backgroundColor: colors.green,
  },
  cardAccentClosed: { backgroundColor: colors.textDisabled },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  merchantName: { fontSize: 17, fontWeight: '700', color: colors.text },
  timeAgo: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(62,173,116,0.15)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(62,173,116,0.25)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  liveBadgeText: { fontSize: 11, fontWeight: '700', color: colors.green },

  closedBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  closedBadgeText: { fontSize: 11, fontWeight: '700', color: colors.textDisabled },

  progress: { fontSize: 13, color: colors.textSecondary },
  claimerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 2,
  },
  claimerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  claimerDetail: { fontSize: 13, color: colors.textMuted },
  waiting: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },

  cardActions: {
    flexDirection: 'row', gap: 8, marginTop: 4,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 10,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  actionBtnDestructive: {
    backgroundColor: 'rgba(224,90,106,0.10)',
    borderColor: 'rgba(224,90,106,0.25)',
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  actionBtnTextDestructive: { color: colors.red },

  empty: {
    alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textDim, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
