import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView, SFSymbol } from 'expo-symbols';
import { MotiView } from 'moti';

// ─────────────────────────────────────────────────────────────────────────────
// ISOLATED DESIGN PREVIEW — not wired to real data. Real Home is untouched.
// Craft target: refined native (Billy-level) — SF Symbols, tight Apple spacing,
// restrained depth, one accent, subtle entrance motion.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: '#0B0B0D',
  card: '#151518',
  card2: '#1B1B1F',
  line: 'rgba(255,255,255,0.07)',
  text: '#F5F5F7',
  dim: '#9A9AA2',
  faint: '#65656E',
  accent: '#37C97F',        // Divi green, used sparingly
  accentDim: 'rgba(55,201,127,0.14)',
  onDark: '#0B0B0D',
};

const money: { fontVariant: ['tabular-nums'] } = { fontVariant: ['tabular-nums'] };

function Enter({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 420, delay }}
    >
      {children}
    </MotiView>
  );
}

function Row({
  symbol, tint, title, sub, amount, live,
}: {
  symbol: SFSymbol; tint: string; title: string; sub: string; amount: string; live?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.6}>
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
      <Text style={[styles.rowAmt, money]}>{amount}</Text>
      <SymbolView name="chevron.right" size={13} tintColor={C.faint} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

export default function HomePreview() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Top bar */}
          <Enter>
            <View style={styles.topbar}>
              <View>
                <Text style={styles.date}>Saturday, July 8</Text>
                <Text style={styles.hi}>Evening, JP</Text>
              </View>
              <TouchableOpacity style={styles.gear} activeOpacity={0.6} onPress={() => router.back()}>
                <SymbolView name="gearshape.fill" size={18} tintColor={C.dim} />
              </TouchableOpacity>
            </View>
          </Enter>

          {/* Owed hero */}
          <Enter delay={70}>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>OWED TO YOU</Text>
              <Text style={[styles.heroAmt, money]}>$120.00</Text>
              <View style={styles.heroMetaRow}>
                <View style={styles.heroChip}>
                  <SymbolView name="person.2.fill" size={12} tintColor={C.accent} />
                  <Text style={styles.heroChipText}>2 people owe you</Text>
                </View>
                <View style={styles.heroChip}>
                  <SymbolView name="checkmark.seal.fill" size={12} tintColor={C.accent} />
                  <Text style={styles.heroChipText}>2 of 3 paid</Text>
                </View>
              </View>
            </View>
          </Enter>

          {/* Primary actions */}
          <Enter delay={130}>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85}>
                <SymbolView name="viewfinder" size={18} tintColor={C.onDark} />
                <Text style={styles.primaryText}>Scan a receipt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85}>
                <SymbolView name="divide" size={18} tintColor={C.text} />
                <Text style={styles.secondaryText}>Quick split</Text>
              </TouchableOpacity>
            </View>
          </Enter>

          {/* Active */}
          <Enter delay={190}>
            <Text style={styles.section}>ACTIVE</Text>
            <View style={styles.group}>
              <Row symbol="dot.radiowaves.left.and.right" tint={C.accent} live
                title="The Tack Room" sub="2 of 3 paid" amount="$120.00" />
              <View style={styles.sep} />
              <Row symbol="dot.radiowaves.left.and.right" tint="#5B9DF0" live
                title="Rooftop drinks" sub="0 of 4 paid" amount="$96.00" />
            </View>
          </Enter>

          {/* Recent */}
          <Enter delay={250}>
            <Text style={styles.section}>RECENT</Text>
            <View style={styles.group}>
              <Row symbol="fork.knife" tint="#C79A3A" title="Sushi Nakamura" sub="Jul 5 · settled" amount="$212.40" />
              <View style={styles.sep} />
              <Row symbol="cart.fill" tint="#9B72CF" title="Trader Joe's" sub="Jul 2 · settled" amount="$63.10" />
              <View style={styles.sep} />
              <Row symbol="cup.and.saucer.fill" tint="#C77" title="Blue Bottle" sub="Jun 29 · settled" amount="$18.00" />
            </View>
          </Enter>

          <Text style={styles.footNote}>Design preview · sample data · not wired to the app</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },

  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 18 },
  date: { fontSize: 13, color: C.faint, fontWeight: '500', letterSpacing: 0.2 },
  hi: { fontSize: 24, color: C.text, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
  gear: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },

  hero: {
    backgroundColor: C.card, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: C.line,
    marginBottom: 16,
  },
  heroLabel: { fontSize: 12, fontWeight: '700', color: C.faint, letterSpacing: 1.4 },
  heroAmt: { fontSize: 46, fontWeight: '800', color: C.text, letterSpacing: -1.6, marginTop: 6 },
  heroMetaRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.accentDim, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11,
  },
  heroChipText: { fontSize: 12.5, fontWeight: '600', color: C.accent },

  actions: { flexDirection: 'row', gap: 10, marginBottom: 30 },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 15, backgroundColor: C.text,
  },
  primaryText: { fontSize: 15.5, fontWeight: '700', color: C.onDark },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
  },
  secondaryText: { fontSize: 15.5, fontWeight: '700', color: C.text },

  section: { fontSize: 12.5, fontWeight: '700', color: C.faint, letterSpacing: 1.2, marginBottom: 10, marginLeft: 2 },
  group: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginBottom: 26, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 14 },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: C.text, letterSpacing: -0.2 },
  rowSubLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rowSub: { fontSize: 12.5, color: C.dim },
  rowAmt: { fontSize: 15.5, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  sep: { height: 1, backgroundColor: C.line, marginLeft: 65 },

  footNote: { fontSize: 12, color: C.faint, textAlign: 'center', marginTop: 8 },
});
