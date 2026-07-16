import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';
import { MotiView } from 'moti';
import type { PurchasesPackage } from 'react-native-purchases';
import { ui as C, moneyText } from '../theme';
import { usePro } from '../hooks/usePro';
import { getProOffering } from '../services/purchases';

const PERKS = [
  { icon: 'infinite-outline', title: 'Unlimited history', sub: 'Every past split, not just the last 3' },
  { icon: 'people-outline', title: 'Saved groups', sub: 'Reload your usual crew into any bill' },
  { icon: 'sparkles-outline', title: 'No watermark', sub: 'Drop “Split with Divi” from requests' },
] as const;

const TERMS_URL = 'https://trydivi.app/terms';
const PRIVACY_URL = 'https://trydivi.app/privacy';

const HERO_W = Dimensions.get('window').width;
const HERO_H = 360;

function orderPkgs(pkgs: PurchasesPackage[]): PurchasesPackage[] {
  const rank = (t: string) => (t === 'ANNUAL' ? 0 : t === 'MONTHLY' ? 1 : t === 'LIFETIME' ? 2 : 3);
  return [...pkgs].sort((a, b) => rank(a.packageType) - rank(b.packageType));
}

function label(pkg: PurchasesPackage): { title: string; note: string } {
  const price = pkg.product.priceString;
  switch (pkg.packageType) {
    case 'ANNUAL': return { title: 'Annual', note: '7-day free trial · billed yearly' };
    case 'MONTHLY': return { title: 'Monthly', note: '7-day free trial · billed monthly' };
    case 'LIFETIME': return { title: 'Lifetime', note: `${price} once · yours forever` };
    default: return { title: pkg.product.title, note: price };
  }
}

// Radial emerald bloom behind the hero — Flighty's move, kept in Divi's brand hue.
function HeroGlow() {
  return (
    <Svg width={HERO_W} height={HERO_H} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgRadialGradient id="glow" cx="50%" cy="34%" rx="78%" ry="62%">
          <Stop offset="0%" stopColor="#3ED88A" stopOpacity="0.34" />
          <Stop offset="42%" stopColor="#1E7C55" stopOpacity="0.20" />
          <Stop offset="72%" stopColor={C.bg} stopOpacity="0" />
        </SvgRadialGradient>
      </Defs>
      <Rect x="0" y="0" width={HERO_W} height={HERO_H} fill="url(#glow)" />
    </Svg>
  );
}

export default function PaywallScreen() {
  const router = useRouter();
  const { isPro, purchase, restore, devSetPro } = usePro();
  const [pkgs, setPkgs] = useState<PurchasesPackage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getProOffering().then((o) => {
      const list = o ? orderPkgs(o.availablePackages) : [];
      setPkgs(list);
      const annual = list.find((p) => p.packageType === 'ANNUAL');
      setSelected((annual ?? list[0])?.identifier ?? null);
    });
  }, []);

  useEffect(() => { if (isPro) router.back(); }, [isPro]);

  // Annual savings vs. monthly, computed from the store's own numeric prices so
  // the badge is always truthful (no hard-coded %). Falls back to null if either
  // package or its numeric price is missing.
  const savePct = useMemo(() => {
    if (!pkgs) return null;
    const annual = pkgs.find((p) => p.packageType === 'ANNUAL');
    const monthly = pkgs.find((p) => p.packageType === 'MONTHLY');
    const a = annual?.product.price;
    const m = monthly?.product.price;
    if (!a || !m || m <= 0) return null;
    const pct = Math.round((1 - a / 12 / m) * 100);
    return pct > 0 ? pct : null;
  }, [pkgs]);

  const onBuy = async () => {
    const pkg = pkgs?.find((p) => p.identifier === selected);
    if (!pkg || busy) return;
    setBusy(true);
    try {
      // Don't call router.back() here: purchase() sets isPro, and the isPro
      // effect above already dismisses. Both firing pops the screen underneath too.
      await purchase(pkg);
    } catch { /* user cancelled or store error — stay on paywall */ }
    setBusy(false);
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy(true);
    await restore();
    setBusy(false);
  };

  const selectedIsSub = pkgs?.find((p) => p.identifier === selected)?.packageType !== 'LIFETIME';

  return (
    <View style={s.container}>
      {/* Hero glow sits behind everything, bleeding under the status bar. */}
      <View style={s.heroGlowWrap} pointerEvents="none"><HeroGlow /></View>

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <TouchableOpacity style={s.close} onPress={() => router.back()} hitSlop={10}>
          <View style={s.closeCircle}><Ionicons name="close" size={20} color={C.text} /></View>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* ---------- HERO ---------- */}
          <View style={s.seg}>
            <View style={s.segA}><Text style={s.segAText}>Divi</Text></View>
            <View style={s.segB}><Text style={s.segBText}>PRO</Text></View>
          </View>

          <Text style={s.title}>Split more,{'\n'}remember everything.</Text>
          <Text style={s.subtitle}>Scan. Tap. Settle.</Text>

          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 420, delay: 120 }}
            style={s.heroCard}
          >
            <View style={s.heroCardTop}>
              <Text style={s.heroCardName} numberOfLines={1}>🍜  Momofuku · 4 people</Text>
              <View style={s.settledTag}>
                <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                <Text style={s.settledText}>SETTLED</Text>
              </View>
            </View>
            <View style={s.heroCardMoney}>
              <Text style={[s.heroAmount, moneyText]}>$142.80</Text>
              <Text style={[s.heroEach, moneyText]}>$35.70 each</Text>
            </View>
          </MotiView>

          {/* ---------- PLANS ---------- */}
          {pkgs === null ? (
            <ActivityIndicator color={C.faint} style={{ marginTop: 28 }} />
          ) : pkgs.length === 0 ? (
            <Text style={s.unavailable}>
              Subscriptions load on a device with the App Store — not available here yet.
            </Text>
          ) : (
            <View style={s.pkgs}>
              {pkgs.map((pkg) => {
                const on = pkg.identifier === selected;
                const { title, note } = label(pkg);
                const isAnnual = pkg.packageType === 'ANNUAL';
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[s.pkg, on && s.pkgOn]}
                    activeOpacity={0.85}
                    onPress={() => setSelected(pkg.identifier)}
                  >
                    <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                    <View style={{ flex: 1 }}>
                      <View style={s.pkgTitleRow}>
                        <Text style={s.pkgTitle}>{title}</Text>
                        {isAnnual && savePct != null && (
                          <View style={s.saveTag}><Text style={s.saveText}>SAVE {savePct}%</Text></View>
                        )}
                      </View>
                      <Text style={s.pkgNote}>{note}</Text>
                    </View>
                    <Text style={[s.pkgPrice, moneyText]}>{pkg.product.priceString}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ---------- PERKS ---------- */}
          <View style={s.perks}>
            {PERKS.map((p) => (
              <View key={p.title} style={s.perk}>
                <View style={s.perkIcon}><Ionicons name={p.icon as any} size={17} color={C.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.perkTitle}>{p.title}</Text>
                  <Text style={s.perkSub}>{p.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* ---------- FOOTER ---------- */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.cta, (!selected || busy) && s.ctaDisabled]}
            onPress={onBuy}
            disabled={!selected || busy}
            activeOpacity={0.9}
          >
            {busy ? <ActivityIndicator color={C.bg} /> : (
              <Text style={s.ctaText}>{selectedIsSub ? 'Start 7-day free trial' : 'Unlock Divi Pro'}</Text>
            )}
          </TouchableOpacity>
          <View style={s.legalRow}>
            <TouchableOpacity onPress={onRestore}><Text style={s.legalLink}>Restore</Text></TouchableOpacity>
            <Text style={s.legalDot}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}><Text style={s.legalLink}>Terms</Text></TouchableOpacity>
            <Text style={s.legalDot}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}><Text style={s.legalLink}>Privacy</Text></TouchableOpacity>
          </View>
          <Text style={s.legalFine}>
            Subscriptions auto-renew until cancelled. Cancel anytime in the App Store. Payment is charged to your Apple ID.
          </Text>
          {__DEV__ && (
            <TouchableOpacity onPress={() => devSetPro(true)}>
              <Text style={s.devLink}>[dev] simulate Pro</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  heroGlowWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: HERO_H },

  close: { position: 'absolute', top: 56, right: 20, zIndex: 5 },
  closeCircle: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingHorizontal: 24, paddingTop: 52, paddingBottom: 16 },

  seg: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: 20, overflow: 'hidden', marginBottom: 22 },
  segA: { backgroundColor: '#0C0C0E', paddingHorizontal: 13, paddingVertical: 7 },
  segAText: { color: C.text, fontSize: 14, fontWeight: '800' },
  segB: { backgroundColor: C.accent, paddingHorizontal: 13, paddingVertical: 7 },
  segBText: { color: C.bg, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

  title: { fontSize: 31, fontWeight: '800', color: C.text, letterSpacing: -0.6, lineHeight: 37 },
  subtitle: { fontSize: 17, color: C.dim, marginTop: 8, fontWeight: '500' },

  heroCard: {
    marginTop: 22,
    backgroundColor: C.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  heroCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroCardName: { color: C.dim, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  heroCardMoney: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 12 },
  heroAmount: { color: C.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  heroEach: { color: C.accent, fontSize: 15, fontWeight: '700' },
  settledTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.accentDim, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  settledText: { color: C.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  unavailable: { fontSize: 14, color: C.dim, textAlign: 'center', marginTop: 28, lineHeight: 20, paddingHorizontal: 16 },

  pkgs: { gap: 10, marginTop: 26 },
  pkg: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    borderRadius: 18, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
  },
  pkgOn: { borderColor: C.accent, backgroundColor: C.accentDim },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.accent },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.accent },
  pkgTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pkgTitle: { fontSize: 16.5, fontWeight: '700', color: C.text },
  pkgNote: { fontSize: 12.5, color: C.dim, marginTop: 3 },
  pkgPrice: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  saveTag: { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  saveText: { fontSize: 10, fontWeight: '800', color: C.bg, letterSpacing: 0.3 },

  perks: { gap: 15, marginTop: 28 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  perkIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  perkSub: { fontSize: 12.5, color: C.dim, marginTop: 1 },

  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 6, gap: 12 },
  cta: { height: 56, borderRadius: 28, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 17, fontWeight: '800', color: C.bg },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legalLink: { fontSize: 13, color: C.dim, fontWeight: '600' },
  legalDot: { color: C.faint },
  legalFine: { fontSize: 10.5, color: C.faint, textAlign: 'center', lineHeight: 15, paddingHorizontal: 8 },
  devLink: { fontSize: 12, color: C.blue, textAlign: 'center', marginTop: 2 },
});
