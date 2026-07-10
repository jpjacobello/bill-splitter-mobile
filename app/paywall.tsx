import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { ui as C } from '../theme';
import { usePro } from '../hooks/usePro';
import { getProOffering } from '../services/purchases';

const PERKS = [
  { icon: 'time-outline', title: 'Unlimited history', sub: 'Revisit every past split, not just the last 3' },
  { icon: 'people-outline', title: 'Saved groups', sub: 'Reload your usual crew into any bill' },
  { icon: 'sparkles-outline', title: 'No watermark', sub: 'Drop “Split with Divi” from your requests' },
] as const;

const TERMS_URL = 'https://trydivi.app/terms';
const PRIVACY_URL = 'https://trydivi.app/privacy';

function orderPkgs(pkgs: PurchasesPackage[]): PurchasesPackage[] {
  const rank = (t: string) => (t === 'ANNUAL' ? 0 : t === 'MONTHLY' ? 1 : t === 'LIFETIME' ? 2 : 3);
  return [...pkgs].sort((a, b) => rank(a.packageType) - rank(b.packageType));
}

function label(pkg: PurchasesPackage): { title: string; note: string } {
  const price = pkg.product.priceString;
  switch (pkg.packageType) {
    case 'ANNUAL': return { title: 'Annual', note: `${price} / year · 7-day free trial` };
    case 'MONTHLY': return { title: 'Monthly', note: `${price} / month · 7-day free trial` };
    case 'LIFETIME': return { title: 'Lifetime', note: `${price} once · yours forever` };
    default: return { title: pkg.product.title, note: price };
  }
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

  const onBuy = async () => {
    const pkg = pkgs?.find((p) => p.identifier === selected);
    if (!pkg || busy) return;
    setBusy(true);
    try {
      const ok = await purchase(pkg);
      if (ok) router.back();
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
    <SafeAreaView style={s.container}>
      <TouchableOpacity style={s.close} onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="close" size={24} color={C.faint} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.badge}><Text style={s.badgeText}>DIVI PRO</Text></View>
        <Text style={s.title}>Split more,{'\n'}remember everything.</Text>

        <View style={s.perks}>
          {PERKS.map((p) => (
            <View key={p.title} style={s.perk}>
              <View style={s.perkIcon}><Ionicons name={p.icon as any} size={19} color={C.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.perkTitle}>{p.title}</Text>
                <Text style={s.perkSub}>{p.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {pkgs === null ? (
          <ActivityIndicator color={C.faint} style={{ marginTop: 24 }} />
        ) : pkgs.length === 0 ? (
          <Text style={s.unavailable}>
            Subscriptions load on a device with the App Store — not available here yet.
          </Text>
        ) : (
          <View style={s.pkgs}>
            {pkgs.map((pkg) => {
              const on = pkg.identifier === selected;
              const { title, note } = label(pkg);
              const best = pkg.packageType === 'ANNUAL';
              return (
                <TouchableOpacity key={pkg.identifier} style={[s.pkg, on && s.pkgOn]} activeOpacity={0.8} onPress={() => setSelected(pkg.identifier)}>
                  <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pkgTitle}>{title}</Text>
                    <Text style={s.pkgNote}>{note}</Text>
                  </View>
                  {best && <View style={s.bestTag}><Text style={s.bestTagText}>BEST VALUE</Text></View>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={[s.cta, (!selected || busy) && s.ctaDisabled]} onPress={onBuy} disabled={!selected || busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>{selectedIsSub ? 'Start 7-day free trial' : 'Unlock Divi Pro'}</Text>}
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
          <TouchableOpacity onPress={() => { devSetPro(true); router.back(); }}>
            <Text style={s.devLink}>[dev] simulate Pro</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  close: { position: 'absolute', top: 56, right: 20, zIndex: 2, padding: 4 },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  badge: { alignSelf: 'flex-start', backgroundColor: C.accentDim, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16 },
  badgeText: { color: C.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.6, lineHeight: 36, marginBottom: 26 },

  perks: { gap: 16, marginBottom: 28 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  perkIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontSize: 15.5, fontWeight: '700', color: C.text },
  perkSub: { fontSize: 13, color: C.dim, marginTop: 1 },

  unavailable: { fontSize: 14, color: C.dim, textAlign: 'center', marginTop: 24, lineHeight: 20, paddingHorizontal: 16 },
  pkgs: { gap: 10 },
  pkg: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderRadius: 16, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line },
  pkgOn: { borderColor: C.accent, backgroundColor: C.accentDim },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.accent },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.accent },
  pkgTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  pkgNote: { fontSize: 12.5, color: C.dim, marginTop: 2 },
  bestTag: { backgroundColor: C.accent, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  bestTagText: { fontSize: 9.5, fontWeight: '800', color: C.bg, letterSpacing: 0.5 },

  footer: { paddingHorizontal: 24, paddingBottom: 10, gap: 12 },
  cta: { height: 54, borderRadius: 27, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 16, fontWeight: '800', color: C.bg },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legalLink: { fontSize: 13, color: C.dim, fontWeight: '600' },
  legalDot: { color: C.faint },
  legalFine: { fontSize: 10.5, color: C.faint, textAlign: 'center', lineHeight: 15, paddingHorizontal: 8 },
  devLink: { fontSize: 12, color: C.blue, textAlign: 'center', marginTop: 4 },
});
