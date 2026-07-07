import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { BillSession, Claim, ReceiptItem } from '../../types';
import { getSession, subscribeToSession, claimItems } from '../../services/billSession';
import { calcShare, ClaimInput } from '../../utils/calcShare';
import { colors } from '../../theme';
import { formatCurrency, setActiveCurrency } from '../../utils/currency';

type Screen = 'loading' | 'error' | 'name' | 'select' | 'done';

function getClaimedFraction(claims: Record<string, Claim>, itemId: string): number {
  return Object.values(claims)
    .filter((c) => c.itemId === itemId)
    .reduce((sum, c) => sum + c.fraction, 0);
}

function getClaimerNames(claims: Record<string, Claim>, itemId: string): string[] {
  return [...new Set(
    Object.values(claims)
      .filter((c) => c.itemId === itemId)
      .map((c) => c.claimerName)
  )];
}

export default function PayYourShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [screen, setScreen] = useState<Screen>('loading');
  const [session, setSession] = useState<BillSession | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Map<string, number>>(new Map()); // itemId → units (0.5 increments)
  const [submitting, setSubmitting] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!id) {
      setErrorMsg('Invalid link.');
      setScreen('error');
      return;
    }

    getSession(id).then((s) => {
      if (!s) {
        setErrorMsg('This bill link has expired or does not exist.');
        setScreen('error');
        return;
      }
      if (s.status === 'closed') {
        setErrorMsg('This bill has been closed by the organizer.');
        setScreen('error');
        return;
      }
      // Format amounts in the host's currency, not the recipient's device default
      setActiveCurrency(s.currency);
      setSession(s);
      setScreen('name');

      unsubRef.current = subscribeToSession(id, (updated) => {
        if (!updated) return;
        setSession(updated);
      });
    });

    return () => {
      unsubRef.current?.();
    };
  }, [id]);

  // units available to claim on this item (in unit terms, 0.5-stepped)
  const remainingUnits = (item: ReceiptItem, alreadyClaimed: number) =>
    Math.round(item.quantity * Math.max(0, 1 - alreadyClaimed) * 2) / 2;

  const toggleItem = (item: ReceiptItem, alreadyClaimed: number) => {
    const remain = remainingUnits(item, alreadyClaimed);
    if (remain <= 0) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, Math.min(1, remain)); // default: 1 unit (or half if that's all that's left)
      }
      return next;
    });
  };

  const adjustUnits = (item: ReceiptItem, alreadyClaimed: number, delta: number) => {
    const remain = remainingUnits(item, alreadyClaimed);
    setSelected((prev) => {
      const next = new Map(prev);
      const current = next.get(item.id) ?? 0;
      const updated = Math.max(0, Math.min(remain, Math.round((current + delta) * 2) / 2));
      if (updated < 0.5) {
        next.delete(item.id);
      } else {
        next.set(item.id, updated);
      }
      return next;
    });
  };

  const unitsToFraction = (itemId: string, units: number) => {
    const item = session?.receipt.items.find((i) => i.id === itemId);
    return item && item.quantity > 0 ? units / item.quantity : units;
  };

  const fmtUnits = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

  const isEqual = session?.splitType === 'equal';
  const equalFraction = session?.peopleCount ? 1 / session.peopleCount : 1;

  const handleClaim = async () => {
    if (!session || submitting) return;
    if (!isEqual && selected.size === 0) return;

    setSubmitting(true);
    const newClaims: ClaimInput[] = isEqual
      ? [{ itemId: 'equal-split', fraction: equalFraction }]
      : [...selected].map(([itemId, units]) => ({
          itemId,
          fraction: unitsToFraction(itemId, units),
        }));

    try {
      await claimItems(session.id, name.trim(), newClaims);

      const breakdown = calcShare(session.receipt, newClaims);
      const venmoHandle = session.creatorVenmoHandle;
      const amount = breakdown.totalOwed.toFixed(2);
      const note = encodeURIComponent(
        `${session.merchantName} — your share via Divi`
      );
      const venmoUrl = `venmo://paycharge?txn=pay&recipients=${venmoHandle}&amount=${amount}&note=${note}`;

      setScreen('done');

      setTimeout(async () => {
        try {
          if (Platform.OS === 'web') {
            window.location.href = venmoUrl;
          } else {
            await Linking.openURL(venmoUrl);
          }
        } catch {
          // Venmo not installed — show web fallback
          if (Platform.OS === 'web') {
            window.open(`https://venmo.com/${venmoHandle}`, '_blank');
          }
        }
      }, 600);
    } catch (e: any) {
      setSubmitting(false);
      const msg = e?.message ?? 'Something went wrong.';
      if (Platform.OS === 'web') {
        alert(msg.includes('already') ? 'Someone just claimed one of those items. Refresh and try again.' : msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  if (screen === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.text} size="large" />
        <Text style={styles.loadingText}>Loading bill...</Text>
      </View>
    );
  }

  if (screen === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>Can't load bill</Text>
        <Text style={styles.errorMsg}>{errorMsg}</Text>
      </View>
    );
  }

  if (screen === 'name') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.nameScreen}>
          <View style={styles.nameHeader}>
            <Text style={styles.diviLogo}>Divi</Text>
            <Text style={styles.merchantTitle}>{session?.merchantName}</Text>
            <Text style={styles.nameSubtitle}>
              {session?.creatorName} is splitting the bill
            </Text>
          </View>
          <View style={styles.nameInputBlock}>
            <Text style={styles.nameLabel}>What's your name?</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textDisabled}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => name.trim() && setScreen('select')}
            />
          </View>
          <TouchableOpacity
            style={[styles.ctaBtn, !name.trim() && styles.ctaBtnDisabled]}
            onPress={() => name.trim() && setScreen('select')}
            disabled={!name.trim()}
          >
            <Text style={styles.ctaBtnText}>{isEqual ? 'See My Share →' : 'Choose My Items →'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'done') {
    const breakdown = calcShare(
      session!.receipt,
      isEqual
        ? [{ itemId: 'equal-split', fraction: equalFraction }]
        : [...selected].map(([itemId, units]) => ({ itemId, fraction: unitsToFraction(itemId, units) }))
    );
    return (
      <View style={styles.centered}>
        <Text style={styles.doneIcon}>✓</Text>
        <Text style={styles.doneTitle}>Items claimed!</Text>
        <Text style={styles.doneAmount}>{formatCurrency(breakdown.totalOwed)}</Text>
        <Text style={styles.doneMsg}>
          Opening Venmo to pay {session!.creatorName}…
        </Text>
      </View>
    );
  }

  // select screen
  const receipt = session!.receipt;
  const claims = session!.claims ?? {};
  const topLevelItems = receipt.items.filter((i) => !i.parentId && i.price > 0);

  // ── Equal (Quick Split) flat-share screen ──
  if (isEqual) {
    const peopleCount = session!.peopleCount ?? 1;
    const seatsTaken = Object.values(claims).filter((c) => c.itemId === 'equal-split').length;
    const seatsLeft = Math.max(0, peopleCount - seatsTaken);
    const alreadyPaid = Object.values(claims).some((c) => c.claimerName === name.trim());
    const perHead = calcShare(receipt, [{ itemId: 'equal-split', fraction: equalFraction }]).totalOwed;

    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.selectHeader}>
          <Text style={styles.diviLogoSmall}>Divi</Text>
          <View style={styles.selectHeaderCenter}>
            <Text style={styles.selectMerchant}>{receipt.merchantName}</Text>
            <Text style={styles.selectSubtitle}>{session!.creatorName} split this evenly</Text>
          </View>
          <Text style={styles.selectTotal}>{formatCurrency(receipt.total)}</Text>
        </View>

        <View style={styles.equalBody}>
          <Text style={styles.equalLabel}>Your share</Text>
          <Text style={styles.equalAmount}>{formatCurrency(perHead)}</Text>
          <Text style={styles.equalSub}>
            {formatCurrency(receipt.total)} split {peopleCount} ways
          </Text>
          <View style={styles.equalProgress}>
            <Text style={styles.equalProgressText}>
              {seatsTaken} of {peopleCount} paid
              {seatsLeft > 0 ? ` · ${seatsLeft} left` : ' · all in!'}
            </Text>
          </View>
        </View>

        <View style={styles.stickyFooter}>
          <TouchableOpacity
            style={[styles.ctaBtn, styles.ctaBtnFull, (submitting || alreadyPaid || (seatsLeft <= 0 && !alreadyPaid)) && styles.ctaBtnDisabled]}
            onPress={handleClaim}
            disabled={submitting || alreadyPaid || (seatsLeft <= 0 && !alreadyPaid)}
          >
            {submitting ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.ctaBtnText}>
                {alreadyPaid
                  ? 'You already paid ✓'
                  : seatsLeft <= 0
                    ? 'This split is full'
                    : `Pay ${session!.creatorName} ${formatCurrency(perHead)}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pendingClaims: ClaimInput[] = [...selected].map(([itemId, units]) => ({
    itemId,
    fraction: unitsToFraction(itemId, units),
  }));
  const breakdown = calcShare(receipt, pendingClaims);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.selectHeader}>
        <Text style={styles.diviLogoSmall}>Divi</Text>
        <View style={styles.selectHeaderCenter}>
          <Text style={styles.selectMerchant}>{receipt.merchantName}</Text>
          <Text style={styles.selectSubtitle}>Choose your items, {name}</Text>
        </View>
        <Text style={styles.selectTotal}>{formatCurrency(receipt.total)}</Text>
      </View>

      <ScrollView
        style={styles.itemList}
        contentContainerStyle={styles.itemListContent}
        showsVerticalScrollIndicator={false}
      >
        {topLevelItems.map((item) => {
          const alreadyClaimed = getClaimedFraction(claims, item.id);
          const claimerNames = getClaimerNames(claims, item.id);
          const remain = remainingUnits(item, alreadyClaimed);
          const isFullyClaimed = alreadyClaimed >= 1.0 || remain <= 0;
          const isSelected = selected.has(item.id);
          const units = selected.get(item.id) ?? 0;
          const unitPrice = item.quantity > 0 ? item.price / item.quantity : item.price;
          const myShare = unitPrice * units;

          return (
            <View
              key={item.id}
              style={[
                styles.itemRow,
                isSelected && styles.itemRowSelected,
                isFullyClaimed && styles.itemRowClaimed,
              ]}
            >
              <TouchableOpacity
                style={styles.itemRowTop}
                onPress={() => toggleItem(item, alreadyClaimed)}
                activeOpacity={isFullyClaimed ? 1 : 0.7}
                disabled={isFullyClaimed}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.itemInfo}>
                  <Text
                    style={[styles.itemName, isFullyClaimed && styles.itemNameClaimed]}
                    numberOfLines={1}
                  >
                    {item.name.replace(/\s*\(\d+\)\s*$/, '')}
                  </Text>
                  {isFullyClaimed && claimerNames.length > 0 && (
                    <Text style={styles.claimedBy}>Claimed by {claimerNames.join(', ')}</Text>
                  )}
                  {!isFullyClaimed && alreadyClaimed > 0 && (
                    <Text style={styles.partialLabel}>{fmtUnits(remain)} of {item.quantity} left</Text>
                  )}
                </View>
                {item.quantity > 1 && <Text style={styles.itemQty}>×{item.quantity}</Text>}
                <Text style={[styles.itemPrice, isFullyClaimed && styles.itemPriceClaimed]}>
                  {formatCurrency(item.price)}
                </Text>
              </TouchableOpacity>

              {isSelected && (
                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>How much did you have?</Text>
                  <View style={styles.stepperControls}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => adjustUnits(item, alreadyClaimed, -0.5)}
                    >
                      <Text style={styles.stepperBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{fmtUnits(units)}</Text>
                    <TouchableOpacity
                      style={[styles.stepperBtn, units >= remain && styles.stepperBtnDisabled]}
                      onPress={() => adjustUnits(item, alreadyClaimed, 0.5)}
                      disabled={units >= remain}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.stepperShare}>{formatCurrency(myShare)}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.stickyFooter}>
        {selected.size > 0 && (
          <View style={styles.breakdownRows}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Subtotal</Text>
              <Text style={styles.breakdownValue}>{formatCurrency(breakdown.subtotal)}</Text>
            </View>
            {breakdown.taxShare > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Tax</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(breakdown.taxShare)}</Text>
              </View>
            )}
            {breakdown.feesShare > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Fees</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(breakdown.feesShare)}</Text>
              </View>
            )}
            {breakdown.tipShare > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Tip</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(breakdown.tipShare)}</Text>
              </View>
            )}
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.ctaBtn,
            styles.ctaBtnFull,
            (selected.size === 0 || submitting) && styles.ctaBtnDisabled,
          ]}
          onPress={handleClaim}
          disabled={selected.size === 0 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.ctaBtnText}>
              {selected.size === 0
                ? 'Select items to continue'
                : `Pay ${session!.creatorName} ${formatCurrency(breakdown.totalOwed)} via Venmo`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },

  loadingText: { color: colors.textMuted, marginTop: 14, fontSize: 15 },

  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
  errorMsg: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },

  // name screen
  nameScreen: {
    flex: 1, padding: 28, justifyContent: 'center', gap: 32,
  },
  nameHeader: { alignItems: 'center', gap: 8 },
  diviLogo: {
    fontSize: 13, fontWeight: '800', color: colors.textMuted,
    letterSpacing: 3, textTransform: 'uppercase',
  },
  merchantTitle: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center' },
  nameSubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  nameInputBlock: { gap: 10 },
  nameLabel: { fontSize: 17, fontWeight: '600', color: colors.text },
  nameInput: {
    height: 54, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, paddingHorizontal: 16, fontSize: 17,
    color: colors.text, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },

  // select screen header
  selectHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  diviLogoSmall: {
    fontSize: 11, fontWeight: '800', color: colors.textDisabled,
    letterSpacing: 2, textTransform: 'uppercase',
  },
  selectHeaderCenter: { alignItems: 'center', flex: 1 },
  selectMerchant: { fontSize: 15, fontWeight: '700', color: colors.text },
  selectSubtitle: { fontSize: 12, color: colors.textMuted },
  selectTotal: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },

  // item list
  itemList: { flex: 1 },
  itemListContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  itemRow: {
    borderRadius: 14, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  itemRowTop: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 12,
  },
  itemRowSelected: {
    backgroundColor: 'rgba(100,151,212,0.14)',
    borderColor: 'rgba(100,151,212,0.40)',
  },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2, gap: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 2,
  },
  stepperLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepperBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  stepperBtnDisabled: { opacity: 0.3 },
  stepperBtnText: { fontSize: 20, fontWeight: '700', color: colors.text, lineHeight: 22 },
  stepperValue: { fontSize: 16, fontWeight: '700', color: colors.text, minWidth: 24, textAlign: 'center' },
  stepperShare: { fontSize: 14, fontWeight: '700', color: '#6497D4', minWidth: 52, textAlign: 'right' },
  itemRowClaimed: {
    opacity: 0.45,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: '#6497D4', borderColor: '#6497D4',
  },
  checkmark: { fontSize: 13, fontWeight: '800', color: '#fff' },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 15, fontWeight: '500', color: colors.text },
  itemNameClaimed: { color: colors.textDisabled },
  claimedBy: { fontSize: 12, color: colors.textMuted },
  partialLabel: { fontSize: 12, color: colors.amber },
  itemQty: { fontSize: 13, color: colors.textMuted },
  itemPrice: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, minWidth: 52, textAlign: 'right' },
  itemPriceClaimed: { color: colors.textDisabled },

  // equal (quick split) screen
  equalBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  equalLabel: {
    fontSize: 14, fontWeight: '600', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  },
  equalAmount: { fontSize: 64, fontWeight: '800', color: colors.text },
  equalSub: { fontSize: 15, color: colors.textMuted },
  equalProgress: {
    marginTop: 24, backgroundColor: 'rgba(62,173,116,0.10)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(62,173,116,0.25)',
  },
  equalProgressText: { fontSize: 14, fontWeight: '600', color: colors.green },

  // footer
  stickyFooter: {
    padding: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  breakdownRows: { gap: 4 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 13, color: colors.textMuted },
  breakdownValue: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  ctaBtn: {
    height: 56, backgroundColor: colors.btnPrimary,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ctaBtnFull: { width: '100%' },
  ctaBtnDisabled: { opacity: 0.35 },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },

  // done screen
  doneIcon: { fontSize: 52, marginBottom: 12 },
  doneTitle: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 6 },
  doneAmount: { fontSize: 40, fontWeight: '800', color: colors.green, marginBottom: 8 },
  doneMsg: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
});
