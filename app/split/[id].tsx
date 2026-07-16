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
import { formatCurrency, setActiveCurrency } from '../../utils/currency';

type Screen = 'loading' | 'error' | 'name' | 'select' | 'done';

// ── "Receipt Stub" visual world — a warm thermal-paper receipt on a dark
//    night-table. A committed single theme (not the app's dark tokens). ──────
const PAL = {
  frame: '#14130F',
  paper: '#F6F1E7',
  paper2: '#EFE8D8',
  ink: '#1A1712',
  inkDim: '#6B6455',
  inkFaint: '#95907F',
  rule: '#DDD4C1',
  red: '#C1352B',
  green: '#2F7D57',
  blue: '#2E6BB0',
  blueWash: '#E4EDF7',
};

const MONO = Platform.select({
  web: 'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, "Roboto Mono", monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});
const SERIF = Platform.select({
  web: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  ios: 'Palatino',
  android: 'serif',
  default: 'serif',
});

// Scalloped perforation notched into the paper edge (frame-colored punches).
function Perf({ pos }: { pos: 'top' | 'bottom' }) {
  return (
    <View style={[styles.perfRow, pos === 'top' ? { top: -6 } : { bottom: -6 }]} pointerEvents="none">
      {Array.from({ length: 15 }).map((_, i) => (
        <View key={i} style={styles.perfDot} />
      ))}
    </View>
  );
}

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
  // itemId → { units: how many of the item you had (0.5 steps), ways: split those N ways }
  const [selected, setSelected] = useState<Map<string, { units: number; ways: number }>>(new Map());
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

  // true fraction (0–1) of the item still unclaimed — source of truth for guards
  const remainingFraction = (alreadyClaimed: number) => Math.max(0, 1 - alreadyClaimed);

  // units still claimable on a multi-qty item, floored to the 0.5 grid so the
  // stepper can never exceed the real remaining (floor, not round — round could overstate)
  const remainingUnits = (item: ReceiptItem, alreadyClaimed: number) =>
    Math.floor(item.quantity * remainingFraction(alreadyClaimed) / 0.5) * 0.5;

  const toggleItem = (item: ReceiptItem, alreadyClaimed: number) => {
    if (remainingFraction(alreadyClaimed) <= 0) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        // default: 1 unit (or the half-unit remainder on a multi-qty item), split just for me
        const startUnits = item.quantity > 1 ? Math.min(1, remainingUnits(item, alreadyClaimed)) : 1;
        // ...but if the whole unit no longer fits what's unclaimed (e.g. a qty-1 item
        // that's already partially claimed), split it enough ways that the default
        // share fits the remainder, so Pay can't be rejected out of the gate.
        const share = unitsToFraction(item.id, startUnits);
        const remain = remainingFraction(alreadyClaimed);
        const startWays = Math.max(1, Math.ceil(share / remain - 1e-9));
        next.set(item.id, { units: startUnits, ways: startWays });
      }
      return next;
    });
  };

  const adjustUnits = (item: ReceiptItem, alreadyClaimed: number, delta: number) => {
    const remain = remainingUnits(item, alreadyClaimed);
    setSelected((prev) => {
      const next = new Map(prev);
      const cur = next.get(item.id);
      if (!cur) return next;
      const updated = Math.max(0, Math.min(remain, Math.round((cur.units + delta) * 2) / 2));
      if (updated < 0.5) {
        next.delete(item.id);
      } else {
        next.set(item.id, { ...cur, units: updated });
      }
      return next;
    });
  };

  // step the "split N ways" divisor. Lower bound is the fewest ways whose share
  // still fits what's unclaimed (so you can't over-claim); no upper bound.
  const adjustWays = (item: ReceiptItem, alreadyClaimed: number, delta: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const cur = next.get(item.id);
      if (!cur) return next;
      const share = unitsToFraction(item.id, cur.units);
      const remain = remainingFraction(alreadyClaimed);
      const minWays = Math.max(1, Math.ceil(share / remain - 1e-9));
      next.set(item.id, { ...cur, ways: Math.max(minWays, cur.ways + delta) });
      return next;
    });
  };

  const unitsToFraction = (itemId: string, units: number) => {
    const item = session?.receipt.items.find((i) => i.id === itemId);
    return item && item.quantity > 0 ? units / item.quantity : units;
  };

  // final claimed fraction for a selection = (your share of the item) ÷ ways split
  const selToFraction = (itemId: string, sel: { units: number; ways: number }) =>
    unitsToFraction(itemId, sel.units) / (sel.ways || 1);

  const fmtUnits = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

  // qty-1 "split N ways" → show the resulting fraction, e.g. "⅓ (3 ways)"
  const FRACTION_GLYPH: Record<number, string> = {
    2: '½', 3: '⅓', 4: '¼', 5: '⅕', 6: '⅙', 7: '⅐', 8: '⅛', 9: '⅑', 10: '⅒',
  };
  const fracLabel = (ways: number) =>
    ways === 1 ? 'Just me' : `${FRACTION_GLYPH[ways] ?? `1/${ways}`} (${ways} ways)`;

  const isEqual = session?.splitType === 'equal';
  const equalFraction = session?.peopleCount ? 1 / session.peopleCount : 1;

  const handleClaim = async () => {
    if (!session || submitting) return;
    if (!isEqual && selected.size === 0) return;

    setSubmitting(true);
    const newClaims: ClaimInput[] = isEqual
      ? [{ itemId: 'equal-split', fraction: equalFraction }]
      : [...selected].map(([itemId, sel]) => ({
          itemId,
          fraction: selToFraction(itemId, sel),
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
        <ActivityIndicator color={PAL.paper} size="large" />
        <Text style={styles.loadingText}>Loading bill…</Text>
      </View>
    );
  }

  if (screen === 'error') {
    return (
      <View style={styles.centered}>
        <View style={styles.miniReceipt}>
          <Perf pos="top" />
          <Text style={styles.brand}>✦ DIVI</Text>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorTitle}>Can't load bill</Text>
          <Text style={styles.errorMsg}>{errorMsg}</Text>
          <Perf pos="bottom" />
        </View>
      </View>
    );
  }

  if (screen === 'name') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.frameScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.receipt}>
            <Perf pos="top" />
            <Text style={styles.brand}>✦ DIVI</Text>
            <Text style={styles.merchant}>{session?.merchantName}</Text>
            <Text style={styles.who}>
              <Text style={styles.whoName}>{session?.creatorName}</Text> is splitting the bill
            </Text>

            <View style={styles.rule} />

            <Text style={styles.nameLabel}>WHAT'S YOUR NAME?</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={PAL.inkFaint}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => name.trim() && setScreen('select')}
            />

            <TouchableOpacity
              style={[styles.cta, !name.trim() && styles.ctaDisabled]}
              onPress={() => name.trim() && setScreen('select')}
              disabled={!name.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>{isEqual ? 'See my share' : 'Choose my items'}</Text>
            </TouchableOpacity>
            <Text style={styles.foot}>POWERED BY <Text style={styles.footBrand}>DIVI</Text> · NO APP NEEDED</Text>
            <Perf pos="bottom" />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'done') {
    const breakdown = calcShare(
      session!.receipt,
      isEqual
        ? [{ itemId: 'equal-split', fraction: equalFraction }]
        : [...selected].map(([itemId, sel]) => ({ itemId, fraction: selToFraction(itemId, sel) }))
    );
    return (
      <View style={styles.centered}>
        <View style={styles.miniReceipt}>
          <Perf pos="top" />
          <Text style={styles.brand}>✦ DIVI</Text>
          <Text style={styles.doneIcon}>✓</Text>
          <Text style={styles.doneTitle}>Items claimed</Text>
          <View style={[styles.stamp, styles.stampGreen]}>
            <Text style={[styles.stampLbl, { color: PAL.green }]}>PAID</Text>
            <Text style={[styles.stampAmt, { color: PAL.green }]}>{formatCurrency(breakdown.totalOwed)}</Text>
          </View>
          <Text style={styles.doneMsg}>Opening Venmo to pay {session!.creatorName}…</Text>
          <Perf pos="bottom" />
        </View>
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
    // The host occupies one of the `peopleCount` seats (they fronted the bill),
    // so only peopleCount-1 guests owe. Offering `peopleCount` seats over-collects
    // a full share and the split would never read as complete.
    const seatsLeft = Math.max(0, peopleCount - 1 - seatsTaken);
    const alreadyPaid = Object.values(claims).some((c) => c.claimerName === name.trim());
    const perHead = calcShare(receipt, [{ itemId: 'equal-split', fraction: equalFraction }]).totalOwed;

    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.frameScroll}>
          <View style={styles.receipt}>
            <Perf pos="top" />
            <Text style={styles.brand}>✦ DIVI</Text>
            <Text style={styles.merchant}>{receipt.merchantName}</Text>
            <Text style={styles.who}>
              <Text style={styles.whoName}>{session!.creatorName}</Text> split this evenly
            </Text>

            <View style={styles.rule} />

            <View style={styles.equalBody}>
              <Text style={styles.equalLead}>YOUR SHARE</Text>
              <Text style={styles.equalAmount}>{formatCurrency(perHead)}</Text>
              <Text style={styles.equalSub}>{formatCurrency(receipt.total)} split {peopleCount} ways</Text>

              <View style={styles.seats}>
                {Array.from({ length: peopleCount }).map((_, i) => (
                  <View key={i} style={[styles.seat, i < seatsTaken && styles.seatOn]} />
                ))}
              </View>
              <Text style={styles.seatsCap}>
                {seatsTaken} OF {peopleCount} PAID{seatsLeft > 0 ? ` · ${seatsLeft} LEFT` : ' · ALL IN'}
              </Text>
            </View>

            <View style={styles.ruleSolid} />

            <TouchableOpacity
              style={[styles.cta, (submitting || alreadyPaid || (seatsLeft <= 0 && !alreadyPaid)) && styles.ctaDisabled]}
              onPress={handleClaim}
              disabled={submitting || alreadyPaid || (seatsLeft <= 0 && !alreadyPaid)}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={PAL.paper} size="small" />
              ) : (
                <>
                  <Text style={styles.ctaText}>
                    {alreadyPaid
                      ? 'You already paid ✓'
                      : seatsLeft <= 0
                        ? 'This split is full'
                        : `Pay ${session!.creatorName} ${formatCurrency(perHead)}`}
                  </Text>
                  {!alreadyPaid && seatsLeft > 0 && <Text style={styles.venmoBadge}>venmo</Text>}
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.foot}>POWERED BY <Text style={styles.footBrand}>DIVI</Text> · NO APP NEEDED</Text>
            <Perf pos="bottom" />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const pendingClaims: ClaimInput[] = [...selected].map(([itemId, sel]) => ({
    itemId,
    fraction: selToFraction(itemId, sel),
  }));
  const breakdown = calcShare(receipt, pendingClaims);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.frameScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.receipt}>
          <Perf pos="top" />
          <Text style={styles.brand}>✦ DIVI</Text>
          <Text style={styles.merchant}>{receipt.merchantName}</Text>
          <Text style={styles.who}>
            <Text style={styles.whoName}>{session!.creatorName}</Text> is splitting · tap what you had
          </Text>

          <View style={styles.rule} />
          <View style={styles.colHead}>
            <Text style={styles.colHeadText}>ITEM</Text>
            <Text style={styles.colHeadText}>PRICE</Text>
          </View>

          <View style={styles.items}>
            {topLevelItems.map((item) => {
              const alreadyClaimed = getClaimedFraction(claims, item.id);
              const claimerNames = getClaimerNames(claims, item.id);
              const remain = remainingUnits(item, alreadyClaimed);
              const remainFrac = remainingFraction(alreadyClaimed);
              const isFullyClaimed = alreadyClaimed >= 0.999;
              const isSelected = selected.has(item.id);
              const sel = selected.get(item.id);
              const units = sel?.units ?? 0;
              const ways = sel?.ways ?? 1;
              const unitPrice = item.quantity > 0 ? item.price / item.quantity : item.price;
              const myShare = (unitPrice * units) / ways;
              // can't reduce ways below the point where your share exceeds what's left
              const waysAtMin = unitsToFraction(item.id, units) / (ways - 1) > remainFrac + 0.001;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.item,
                    isSelected && styles.itemSelected,
                    isFullyClaimed && styles.itemClaimed,
                  ]}
                >
                  {isSelected && <View style={styles.inkBar} />}
                  <TouchableOpacity
                    style={styles.itemLine}
                    onPress={() => toggleItem(item, alreadyClaimed)}
                    activeOpacity={isFullyClaimed ? 1 : 0.7}
                    disabled={isFullyClaimed}
                  >
                    <View style={[styles.tick, isSelected && styles.tickOn]}>
                      {isSelected && <Text style={styles.tickMark}>✓</Text>}
                    </View>
                    <View style={styles.itemInfo}>
                      <Text
                        style={[styles.itemName, isFullyClaimed && styles.itemNameClaimed]}
                        numberOfLines={1}
                      >
                        {item.name.replace(/\s*\(\d+\)\s*$/, '')}
                        {item.quantity > 1 && <Text style={styles.itemQty}>  ×{item.quantity}</Text>}
                      </Text>
                      {isFullyClaimed && claimerNames.length > 0 && (
                        <Text style={styles.claimedBy}>Claimed by {claimerNames.join(', ')}</Text>
                      )}
                      {!isFullyClaimed && alreadyClaimed > 0 && (
                        <Text style={styles.partialLabel}>{Math.round(remainFrac * 100)}% left</Text>
                      )}
                    </View>
                    <Text style={[styles.itemPrice, isFullyClaimed && styles.itemPriceClaimed]}>
                      {formatCurrency(item.price)}
                    </Text>
                  </TouchableOpacity>

                  {isSelected && (
                    <View style={styles.selectDetail}>
                      {item.quantity > 1 ? (
                        <View style={styles.stepperRow}>
                          <Text style={styles.stepperLabel}>How many did you have?</Text>
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
                        </View>
                      ) : (
                        <View style={styles.stepperRow}>
                          <Text style={styles.stepperLabel}>Split how many ways?</Text>
                          <View style={styles.stepperControls}>
                            <TouchableOpacity
                              style={[styles.stepperBtn, waysAtMin && styles.stepperBtnDisabled]}
                              onPress={() => adjustWays(item, alreadyClaimed, -1)}
                              disabled={waysAtMin}
                            >
                              <Text style={styles.stepperBtnText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.stepperValue}>{fracLabel(ways)}</Text>
                            <TouchableOpacity
                              style={styles.stepperBtn}
                              onPress={() => adjustWays(item, alreadyClaimed, 1)}
                            >
                              <Text style={styles.stepperBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      <Text style={styles.stepperShare}>you pay {formatCurrency(myShare)}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.ruleSolid} />

          {selected.size > 0 && (
            <View style={styles.totals}>
              <View style={styles.trow}>
                <Text style={styles.trowLabel}>Subtotal</Text>
                <Text style={styles.trowValue}>{formatCurrency(breakdown.subtotal)}</Text>
              </View>
              {breakdown.taxShare > 0 && (
                <View style={styles.trow}>
                  <Text style={styles.trowLabel}>Tax</Text>
                  <Text style={styles.trowValue}>{formatCurrency(breakdown.taxShare)}</Text>
                </View>
              )}
              {breakdown.feesShare > 0 && (
                <View style={styles.trow}>
                  <Text style={styles.trowLabel}>Fees</Text>
                  <Text style={styles.trowValue}>{formatCurrency(breakdown.feesShare)}</Text>
                </View>
              )}
              {breakdown.tipShare > 0 && (
                <View style={styles.trow}>
                  <Text style={styles.trowLabel}>Tip</Text>
                  <Text style={styles.trowValue}>{formatCurrency(breakdown.tipShare)}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.stamp}>
            <View>
              <Text style={styles.stampLbl}>YOUR SHARE</Text>
              <Text style={styles.stampSub}>
                {selected.size === 0 ? 'NOTHING YET' : selected.size === 1 ? '1 ITEM' : `${selected.size} ITEMS`}
              </Text>
            </View>
            <Text style={styles.stampAmt}>{formatCurrency(breakdown.totalOwed)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.cta, (selected.size === 0 || submitting) && styles.ctaDisabled]}
            onPress={handleClaim}
            disabled={selected.size === 0 || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={PAL.paper} size="small" />
            ) : selected.size === 0 ? (
              <Text style={styles.ctaText}>Tap your items to continue</Text>
            ) : (
              <>
                <Text style={styles.ctaText}>Pay {session!.creatorName} {formatCurrency(breakdown.totalOwed)}</Text>
                <Text style={styles.venmoBadge}>venmo</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.foot}>POWERED BY <Text style={styles.footBrand}>DIVI</Text> · NO APP NEEDED</Text>
          <Perf pos="bottom" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAL.frame },
  frameScroll: {
    flexGrow: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 30,
  },
  centered: {
    flex: 1, backgroundColor: PAL.frame,
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  loadingText: { color: PAL.inkFaint, marginTop: 14, fontSize: 13, fontFamily: MONO, letterSpacing: 1 },

  // ── receipt object ──
  receipt: {
    width: '100%', maxWidth: 384,
    backgroundColor: PAL.paper,
    paddingHorizontal: 26, paddingTop: 30, paddingBottom: 26,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 34, shadowOffset: { width: 0, height: 24 },
    elevation: 12,
  },
  miniReceipt: {
    width: '100%', maxWidth: 340, alignItems: 'center',
    backgroundColor: PAL.paper, paddingHorizontal: 26, paddingVertical: 34,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 34, shadowOffset: { width: 0, height: 24 },
    elevation: 12,
  },
  perfRow: {
    position: 'absolute', left: 8, right: 8, height: 12,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  perfDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: PAL.frame },

  brand: {
    fontFamily: MONO, fontSize: 11, fontWeight: '700', color: PAL.red,
    letterSpacing: 4, textAlign: 'center',
  },
  merchant: {
    fontFamily: SERIF, fontSize: 32, fontWeight: '600', color: PAL.ink,
    textAlign: 'center', marginTop: 10, marginBottom: 6, letterSpacing: -0.3,
  },
  who: { fontFamily: MONO, fontSize: 12.5, color: PAL.inkDim, textAlign: 'center' },
  whoName: { color: PAL.ink, fontWeight: '700' },

  rule: { borderTopWidth: 1.5, borderColor: PAL.rule, borderStyle: 'dashed', marginVertical: 18 },
  ruleSolid: { borderTopWidth: 1.5, borderColor: PAL.ink, opacity: 0.85, marginVertical: 18 },

  colHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2, marginBottom: 4 },
  colHeadText: { fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: PAL.inkFaint },

  // ── items ──
  items: { },
  item: {
    position: 'relative', paddingVertical: 12, paddingLeft: 16, paddingRight: 4,
    borderBottomWidth: 1, borderColor: PAL.rule, borderStyle: 'dotted',
  },
  itemSelected: { backgroundColor: PAL.blueWash },
  itemClaimed: { opacity: 0.5 },
  inkBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: PAL.blue },
  itemLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tick: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: PAL.inkFaint,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tickOn: { backgroundColor: PAL.blue, borderColor: PAL.blue },
  tickMark: { fontSize: 11, fontWeight: '800', color: '#fff', lineHeight: 14 },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontFamily: MONO, fontSize: 14, color: PAL.ink },
  itemNameClaimed: { color: PAL.inkFaint },
  itemQty: { fontSize: 11, color: PAL.inkFaint },
  claimedBy: { fontFamily: MONO, fontSize: 11, color: PAL.green },
  partialLabel: { fontFamily: MONO, fontSize: 11, color: PAL.red },
  itemPrice: {
    fontFamily: MONO, fontSize: 14, fontWeight: '600', color: PAL.ink,
    minWidth: 56, textAlign: 'right', fontVariant: ['tabular-nums'],
  },
  itemPriceClaimed: { color: PAL.inkFaint },

  selectDetail: { paddingTop: 12, paddingLeft: 29 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stepperLabel: { fontFamily: MONO, fontSize: 12, color: PAL.inkDim, flex: 1 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: {
    width: 27, height: 27, borderRadius: 14, borderWidth: 1.5, borderColor: PAL.rule,
    backgroundColor: PAL.paper, alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.3 },
  stepperBtnText: { fontFamily: MONO, fontSize: 17, fontWeight: '700', color: PAL.ink, lineHeight: 20 },
  stepperValue: { fontFamily: MONO, fontSize: 13, fontWeight: '700', color: PAL.ink, minWidth: 92, textAlign: 'center' },
  stepperShare: {
    fontFamily: MONO, fontSize: 12, fontWeight: '700', color: PAL.blue,
    textAlign: 'right', paddingTop: 8, fontVariant: ['tabular-nums'],
  },

  // ── totals ──
  totals: { gap: 7, marginBottom: 4 },
  trow: { flexDirection: 'row', justifyContent: 'space-between' },
  trowLabel: { fontFamily: MONO, fontSize: 12.5, color: PAL.inkDim },
  trowValue: { fontFamily: MONO, fontSize: 12.5, color: PAL.ink, fontVariant: ['tabular-nums'] },

  // ── stamp ──
  stamp: {
    marginTop: 18, marginBottom: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14,
    paddingVertical: 15, paddingHorizontal: 18,
    borderWidth: 2.5, borderColor: PAL.red, borderRadius: 8,
    transform: [{ rotate: '-1.4deg' }],
  },
  stampGreen: { borderColor: PAL.green, marginTop: 20, alignSelf: 'stretch' },
  stampLbl: { fontFamily: MONO, fontSize: 11, letterSpacing: 3, fontWeight: '700', color: PAL.red },
  stampSub: { fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: PAL.red, opacity: 0.75, marginTop: 2 },
  stampAmt: {
    fontFamily: MONO, fontSize: 32, fontWeight: '700', color: PAL.red,
    letterSpacing: -1, fontVariant: ['tabular-nums'],
  },

  // ── cta ──
  cta: {
    marginTop: 20, height: 54, borderRadius: 12, backgroundColor: PAL.ink,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  ctaDisabled: { opacity: 0.32 },
  ctaText: { fontFamily: MONO, fontSize: 14, fontWeight: '700', color: PAL.paper, letterSpacing: 0.2 },
  venmoBadge: {
    fontFamily: MONO, backgroundColor: '#008CFF', color: '#fff', fontWeight: '800',
    fontSize: 10.5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, letterSpacing: 0.2,
    overflow: 'hidden',
  },
  foot: {
    fontFamily: MONO, marginTop: 16, textAlign: 'center', fontSize: 10,
    letterSpacing: 1.5, color: PAL.inkFaint,
  },
  footBrand: { color: PAL.red, fontWeight: '700' },

  // ── name screen ──
  nameLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: PAL.inkFaint, marginBottom: 10 },
  nameInput: {
    height: 52, backgroundColor: PAL.paper2, borderRadius: 10, paddingHorizontal: 14,
    fontFamily: MONO, fontSize: 16, color: PAL.ink,
    borderWidth: 1.5, borderColor: PAL.rule,
  },

  // ── equal screen ──
  equalBody: { alignItems: 'center', paddingVertical: 6 },
  equalLead: { fontFamily: MONO, fontSize: 11, letterSpacing: 3, color: PAL.inkFaint },
  equalAmount: {
    fontFamily: SERIF, fontSize: 64, fontWeight: '600', color: PAL.ink,
    marginVertical: 4, letterSpacing: -1, fontVariant: ['tabular-nums'],
  },
  equalSub: { fontFamily: MONO, fontSize: 12.5, color: PAL.inkDim },
  seats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 22, maxWidth: 240 },
  seat: { width: 11, height: 11, borderRadius: 6, borderWidth: 1.5, borderColor: PAL.green },
  seatOn: { backgroundColor: PAL.green },
  seatsCap: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: PAL.green, marginTop: 12 },

  // ── error / done ──
  errorIcon: { fontSize: 34, marginTop: 14, marginBottom: 8 },
  errorTitle: { fontFamily: SERIF, fontSize: 22, fontWeight: '600', color: PAL.ink, marginBottom: 8 },
  errorMsg: { fontFamily: MONO, fontSize: 13, color: PAL.inkDim, textAlign: 'center', lineHeight: 20 },
  doneIcon: { fontSize: 44, color: PAL.green, marginTop: 14, marginBottom: 6 },
  doneTitle: { fontFamily: SERIF, fontSize: 24, fontWeight: '600', color: PAL.ink, marginBottom: 14 },
  doneMsg: { fontFamily: MONO, fontSize: 12.5, color: PAL.inkDim, textAlign: 'center', marginTop: 14 },
});
