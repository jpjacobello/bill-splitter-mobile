import { useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { MotiView } from 'moti';
import ActionSheet from '../components/ActionSheet';
import { ui as C } from '../theme';
import { useBillStore } from '../store/useBillStore';
import { getVenmoHandle, setVenmoHandle } from '../utils/proStorage';
import { createSession } from '../services/billSession';
import { addSession } from '../utils/sessionStorage';
import { formatCurrency, getActiveCurrency } from '../utils/currency';

import { WEB_BASE_URL } from '../utils/config';

export default function SplitMethodScreen() {
  const router = useRouter();
  const { receipt, people, setActiveSessionId } = useBillStore();
  const [sharing, setSharing] = useState(false);
  const [venmoOpen, setVenmoOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);

  const createAndShare = async (handle: string) => {
    if (sharing || !receipt) return;
    setSharing(true);
    try {
      const creatorName = people[0]?.name ?? 'Host';
      const sessionId = await createSession(receipt, creatorName, handle, { currency: getActiveCurrency() });
      setActiveSessionId(sessionId);
      await addSession({
        sessionId,
        merchantName: receipt.merchantName ?? '',
        createdAt: new Date().toISOString(),
        creatorVenmoHandle: handle,
      });
      const url = `${WEB_BASE_URL}/split/${sessionId}`;
      await Share.share({
        message: `${receipt.merchantName ? receipt.merchantName + ' — ' : ''}grab your share — tap what you ordered`,
        url,
      });
      if (router.canDismiss()) router.dismissAll();
      router.push('/activity?tab=live');
    } catch {
      setErrorOpen(true);
    } finally {
      setSharing(false);
    }
  };

  const handleShareLink = async () => {
    if (sharing || !receipt) return;
    const handle = await getVenmoHandle();
    if (!handle) { setVenmoOpen(true); return; }
    createAndShare(handle);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <SymbolView name="chevron.left" size={20} tintColor={C.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 400 }}>
            <Text style={styles.title}>How do you want{'\n'}to split?</Text>
            <Text style={styles.subtitle}>{receipt?.merchantName || 'Your bill'} · {formatCurrency(receipt?.total)}</Text>
          </MotiView>

          <View style={styles.options}>
            <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 420, delay: 80 }}>
              <TouchableOpacity style={[styles.optionCard, sharing && { opacity: 0.6 }]} onPress={handleShareLink} disabled={sharing} activeOpacity={0.85}>
                <View style={[styles.iconWrap, { backgroundColor: C.accentDim }]}>
                  <SymbolView name="link" size={26} tintColor={C.accent} type="hierarchical" />
                </View>
                <View style={styles.optionTitleRow}>
                  <Text style={styles.optionTitle}>{sharing ? 'Creating link…' : 'Share a Link'}</Text>
                  <Text style={styles.optionTag}>RECOMMENDED</Text>
                </View>
                <Text style={styles.optionDesc}>Friends open the link on their phone and tap the items they had. No app needed.</Text>
              </TouchableOpacity>
            </MotiView>

            <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 420, delay: 150 }}>
              <TouchableOpacity style={styles.optionCard} onPress={() => router.push('/assign-items')} activeOpacity={0.85}>
                <View style={[styles.iconWrap, { backgroundColor: C.blue + '22' }]}>
                  <SymbolView name="person.2.fill" size={24} tintColor={C.blue} type="hierarchical" />
                </View>
                <Text style={styles.optionTitle}>Assign Manually</Text>
                <Text style={styles.optionDesc}>You assign each item to the right person yourself, then request payment from each.</Text>
              </TouchableOpacity>
            </MotiView>
          </View>
        </View>
      </SafeAreaView>

      <ActionSheet
        visible={venmoOpen}
        title="Your Venmo @handle"
        message="Friends need this to pay you back. Enter without the @."
        input={{
          placeholder: 'venmo-handle',
          submitLabel: 'Save & Share',
          onSubmit: async (v) => { await setVenmoHandle(v); createAndShare(v.replace(/^@/, '')); },
        }}
        onClose={() => setVenmoOpen(false)}
      />
      <ActionSheet
        visible={errorOpen}
        title="Couldn't create link"
        message="Check your internet connection and try again."
        options={[{ label: 'Try Again', icon: 'refresh-outline', onPress: handleShareLink }]}
        onClose={() => setErrorOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  title: { fontSize: 32, fontWeight: '800', color: C.text, lineHeight: 40, letterSpacing: -0.6, marginBottom: 8 },
  subtitle: { fontSize: 15, color: C.dim, marginBottom: 32 },

  options: { gap: 14 },
  optionCard: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 22, gap: 10 },
  iconWrap: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionTitle: { fontSize: 20, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  optionTag: {
    fontSize: 10, fontWeight: '700', color: C.accent, backgroundColor: C.accentDim,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, letterSpacing: 0.6, overflow: 'hidden',
  },
  optionDesc: { fontSize: 14, color: C.dim, lineHeight: 20 },
});
