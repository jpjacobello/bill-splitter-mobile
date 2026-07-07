import { useState } from 'react';
import { Alert, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useBillStore } from '../store/useBillStore';
import { getVenmoHandle, setVenmoHandle } from '../utils/proStorage';
import { createSession } from '../services/billSession';
import { addSession } from '../utils/sessionStorage';
import { formatCurrency, getActiveCurrency } from '../utils/currency';

const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://trydivi.vercel.app';

export default function SplitMethodScreen() {
  const router = useRouter();
  const { receipt, people, setActiveSessionId } = useBillStore();
  const [sharing, setSharing] = useState(false);

  const handleShareLink = async () => {
    if (sharing || !receipt) return;
    setSharing(true);
    try {
      let handle = await getVenmoHandle();
      if (!handle) {
        await new Promise<void>((resolve, reject) => {
          Alert.prompt(
            'Your Venmo @handle',
            'Friends need this to pay you back. Enter without the @.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => reject(new Error('cancelled')) },
              {
                text: 'Save',
                onPress: async (value?: string) => {
                  if (!value?.trim()) { reject(new Error('empty')); return; }
                  await setVenmoHandle(value.trim());
                  handle = value.trim().replace(/^@/, '');
                  resolve();
                },
              },
            ],
            'plain-text'
          );
        });
      }
      const creatorName = people[0]?.name ?? 'Host';
      const sessionId = await createSession(receipt, creatorName, handle, {
        currency: getActiveCurrency(),
      });
      setActiveSessionId(sessionId);
      await addSession({
        sessionId,
        merchantName: receipt.merchantName ?? '',
        createdAt: new Date().toISOString(),
        creatorVenmoHandle: handle ?? '',
      });
      const url = `${WEB_BASE_URL}/split/${sessionId}`;
      await Share.share({
        message: `${receipt.merchantName ? receipt.merchantName + ' — ' : ''}Pay your share`,
        url,
      });
      // Reset the stack: pop the scan/fork screens so Back goes Home, then open the live session
      if (router.canDismiss()) router.dismissAll();
      router.push('/sessions');
    } catch (e: any) {
      if (e?.message !== 'cancelled' && e?.message !== 'empty') {
        Alert.alert('Error', 'Could not create share link. Check your internet connection.');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>How do you want{'\n'}to split?</Text>
        <Text style={styles.subtitle}>
          {receipt?.merchantName || 'Your bill'} · {formatCurrency(receipt?.total)}
        </Text>

        <View style={styles.options}>
          {/* Share Link */}
          <TouchableOpacity
            style={[styles.optionCard, sharing && { opacity: 0.6 }]}
            onPress={handleShareLink}
            disabled={sharing}
            activeOpacity={0.82}
          >
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(62,173,116,0.15)' }]}>
              <Ionicons name="link-outline" size={28} color={colors.green} />
            </View>
            <Text style={styles.optionTitle}>
              {sharing ? 'Creating link…' : 'Share a Link'}
            </Text>
            <Text style={styles.optionDesc}>
              Friends open the link on their phone and tap the items they had. No app needed.
            </Text>
            <View style={styles.optionFooter}>
              <Text style={styles.optionTag}>Recommended</Text>
            </View>
          </TouchableOpacity>

          {/* Assign Manually */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => router.push('/assign-items')}
            activeOpacity={0.82}
          >
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
              <Ionicons name="people-outline" size={28} color={colors.textSecondary} />
            </View>
            <Text style={styles.optionTitle}>Assign Manually</Text>
            <Text style={styles.optionDesc}>
              You assign each item to the right person yourself, then request payment from each.
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 8, paddingVertical: 12 },
  backBtn: { padding: 8, alignSelf: 'flex-start' },

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  title: { fontSize: 34, fontWeight: '800', color: colors.text, lineHeight: 42, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: 36 },

  options: { gap: 14 },
  optionCard: {
    backgroundColor: colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
    padding: 22, gap: 10,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  optionTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  optionDesc: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  optionFooter: { marginTop: 2 },
  optionTag: {
    alignSelf: 'flex-start',
    fontSize: 11, fontWeight: '700', color: colors.green,
    backgroundColor: 'rgba(62,173,116,0.12)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    textTransform: 'uppercase', letterSpacing: 0.5,
    overflow: 'hidden',
  },
});
