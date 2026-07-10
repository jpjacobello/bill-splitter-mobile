import { useRef, useState } from 'react';
import {
  Dimensions, Keyboard, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ui as C } from '../theme';

const HAS_LAUNCHED_KEY = 'hasLaunched';
const SAVED_NAME_KEY = 'savedHostName';

const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_W = SCREEN_W;      // full-width pages; only the middle band slides
const BAND_H = 400;

const PAPER = '#F6F1E7';
const INK = '#1A1712';
const RULE = '#CCC4B2';
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const SLIDES = [
  { n: 1, label: 'Scan any receipt' },
  { n: 2, label: 'Tap who had what' },
  { n: 3, label: 'Share a link' },
  { n: 4, label: "Track who's paid, live" },
];
const LAST_INFO = SLIDES.length - 1;
const NAME_PAGE = SLIDES.length;

// "John Smith" -> "JS", "John" -> "J"
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── illustrations ────────────────────────────────────────────────────────────
function ScanArt() {
  return (
    <View style={s.scanner}>
      <View style={[s.corner, s.c1]} /><View style={[s.corner, s.c2]} />
      <View style={[s.corner, s.c3]} /><View style={[s.corner, s.c4]} />
      <View style={s.rcpt}>
        <Text style={[s.rcptM, s.mono]}>CERVO'S</Text>
        {[['Branzino', '34.00'], ['Rigatoni', '26.00'], ['Spritz', '30.00']].map(([a, b]) => (
          <View key={a} style={s.rcptR}><Text style={s.mono}>{a}</Text><Text style={s.mono}>{b}</Text></View>
        ))}
        <View style={s.rcptT}><Text style={[s.mono, s.bold]}>TOTAL</Text><Text style={[s.mono, s.bold]}>98.00</Text></View>
      </View>
      <View style={s.shutter} />
    </View>
  );
}

function Avatar({ txt, tint }: { txt: string; tint: string }) {
  return <View style={[s.av, { backgroundColor: tint }]}><Text style={s.avTxt}>{txt}</Text></View>;
}

function AssignArt() {
  return (
    <View style={s.items}>
      <View style={[s.chip, s.chipSel]}>
        <Text style={s.emoji}>🐟</Text><Text style={s.iname}>Grilled Branzino</Text>
        <Avatar txt="JP" tint="rgba(91,157,240,0.5)" />
      </View>
      <View style={[s.chip, s.chipSel]}>
        <Text style={s.emoji}>🍝</Text><Text style={s.iname}>Spicy Rigatoni</Text>
        <View style={s.avRow}><Avatar txt="JA" tint="rgba(62,216,138,0.5)" /><Avatar txt="JP" tint="rgba(91,157,240,0.5)" /></View>
      </View>
      <View style={s.chip}>
        <Text style={s.emoji}>🍹</Text><Text style={s.iname}>Aperol Spritz</Text>
      </View>
    </View>
  );
}

function ShareArt() {
  return (
    <View style={s.shareWrap}>
      <View style={s.paper2}>
        <Text style={[s.rcptM, s.mono]}>CERVO'S</Text>
        {[['JP', 'JP', '$34.00', 'rgba(91,157,240,0.5)'], ['JA', 'John', '$28.00', 'rgba(62,216,138,0.5)'], ['JD', 'Jane', '$36.00', 'rgba(196,131,74,0.5)']].map(([i, name, amt, tint]) => (
          <View key={name} style={s.shareR}>
            <View style={s.shareName}>
              <View style={[s.miniAv, { backgroundColor: tint }]}><Text style={s.miniAvTxt}>{i}</Text></View>
              <Text style={s.mono}>{name}</Text>
            </View>
            <Text style={[s.mono, s.bold]}>{amt}</Text>
          </View>
        ))}
      </View>
      <View style={s.rail}>
        <View style={[s.pay, { backgroundColor: '#008CFF' }]}><Text style={s.payTxt}>V</Text></View>
        <View style={[s.pay, { backgroundColor: '#34C759' }]}><Text style={s.payTxt}>💬</Text></View>
      </View>
      <Text style={s.noApp}>✦ No app needed for them</Text>
    </View>
  );
}

function PaidArt() {
  return (
    <View style={s.hero}>
      <View style={s.hLbl}><View style={s.live} /><Text style={s.hLblTxt}>OWED TO YOU</Text></View>
      <Text style={s.hAmt}>$98.00</Text>
      <View style={s.hPerf} />
      <View style={s.hRow}><Text style={s.hRowDim}>2 open splits</Text><Text style={s.hRowGreen}>3 paid</Text></View>
    </View>
  );
}

const ART = [ScanArt, AssignArt, ShareArt, PaidArt];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [name, setName] = useState('');

  const goTo = (p: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollRef.current?.scrollTo({ x: p * PAGE_W, animated: true });
    setPage(p);
  };

  const finish = async () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.multiSet([[SAVED_NAME_KEY, name.trim()], [HAS_LAUNCHED_KEY, 'true']]);
    router.replace('/');
  };

  const onName = page === NAME_PAGE;
  const ctaLabel = onName ? 'Start splitting' : page === LAST_INFO ? 'Get started' : 'Continue';
  const onCta = onName ? finish : () => goTo(page + 1);

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* fixed title */}
        <Text style={s.hiw}>{onName ? 'Almost there' : 'How it works'}</Text>

        {/* only this band slides — illustration + step float on the bg, no card */}
        <View style={s.bandWrap}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            scrollEnabled={!onName}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ height: BAND_H }}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / PAGE_W))}
          >
            {SLIDES.map((slide, i) => {
              const Art = ART[i];
              return (
                <View key={slide.n} style={s.page}>
                  <View style={s.art}><Art /></View>
                  <View style={s.stepRow}>
                    <View style={s.num}><Text style={s.numTxt}>{slide.n}</Text></View>
                    <Text style={s.stepLbl}>{slide.label}</Text>
                  </View>
                </View>
              );
            })}

            {/* name page — final in the same band */}
            <View style={s.page}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={s.nameWrap}>
                  <View style={s.bigAv}><Text style={s.bigAvTxt}>{initials(name)}</Text></View>
                  <Text style={s.nq}>What's your name?</Text>
                  <Text style={s.nsub}>So friends know who's splitting.</Text>
                  <TextInput
                    style={s.ninput}
                    placeholder="Your name"
                    placeholderTextColor={C.faint}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={finish}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </ScrollView>
        </View>

        {/* fixed footer */}
        <View style={s.footer}>
          <View style={s.dots}>
            {!onName && SLIDES.map((_, d) => <View key={d} style={[s.dot, d === page && s.dotOn]} />)}
          </View>
          <TouchableOpacity
            style={[s.cta, onName && !name.trim() && s.ctaDisabled]}
            onPress={onCta}
            disabled={onName && !name.trim()}
            activeOpacity={0.85}
          >
            <Text style={s.ctaTxt}>{ctaLabel}</Text>
            {!onName && <Text style={s.ctaArrow}>→</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.skip} onPress={() => goTo(NAME_PAGE)} disabled={onName} activeOpacity={0.6}>
            <Text style={[s.skipTxt, onName && { opacity: 0 }]}>Skip</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  hiw: { fontSize: 38, fontWeight: '800', color: C.text, letterSpacing: -0.8, textAlign: 'center', marginTop: 44 },

  bandWrap: { flex: 1, justifyContent: 'center' },

  mono: { fontFamily: MONO, color: INK, fontSize: 9 },
  bold: { fontWeight: '700' },

  page: { width: PAGE_W, height: BAND_H, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, paddingBottom: 10 },
  num: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' },
  numTxt: { color: C.bg, fontSize: 14, fontWeight: '800' },
  stepLbl: { fontSize: 19, fontWeight: '700', color: C.text },

  footer: { paddingHorizontal: 24, paddingBottom: 8 },
  dots: { flexDirection: 'row', gap: 7, justifyContent: 'center', height: 7, marginBottom: 22 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.faint, opacity: 0.5 },
  dotOn: { backgroundColor: C.text, opacity: 1, width: 18 },

  cta: { height: 56, borderRadius: 28, backgroundColor: C.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  ctaDisabled: { opacity: 0.4 },
  ctaTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
  ctaArrow: { fontSize: 16, fontWeight: '700', color: '#fff' },
  skip: { alignItems: 'center', paddingVertical: 14 },
  skipTxt: { color: C.blue, fontSize: 14.5, fontWeight: '600' },

  // scan
  scanner: { width: 176, height: 210, backgroundColor: '#0E0E10', borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  rcpt: { width: 116, backgroundColor: PAPER, borderRadius: 6, padding: 11 },
  rcptM: { textAlign: 'center', fontWeight: '700', fontSize: 11, borderBottomWidth: 1, borderColor: RULE, paddingBottom: 4, marginBottom: 5 },
  rcptR: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
  rcptT: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: RULE, marginTop: 5, paddingTop: 4 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: C.blue, borderWidth: 3 },
  c1: { top: 40, left: 40, borderRightWidth: 0, borderBottomWidth: 0 },
  c2: { top: 40, right: 40, borderLeftWidth: 0, borderBottomWidth: 0 },
  c3: { bottom: 62, left: 40, borderRightWidth: 0, borderTopWidth: 0 },
  c4: { bottom: 62, right: 40, borderLeftWidth: 0, borderTopWidth: 0 },
  shutter: { position: 'absolute', bottom: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff' },

  // assign
  items: { width: '100%', gap: 10, paddingHorizontal: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.cardHi, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 },
  chipSel: { backgroundColor: 'rgba(91,157,240,0.14)', borderColor: 'rgba(91,157,240,0.5)' },
  emoji: { fontSize: 17 },
  iname: { flex: 1, fontSize: 14, color: C.text },
  avRow: { flexDirection: 'row' },
  av: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: C.card, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  avTxt: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // share
  shareWrap: { alignItems: 'center', gap: 14 },
  paper2: { width: 168, backgroundColor: PAPER, borderRadius: 10, padding: 13 },
  shareR: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  shareName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniAv: { width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  miniAvTxt: { fontSize: 7, fontWeight: '700', color: '#fff' },
  rail: { flexDirection: 'row', gap: 9 },
  pay: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  payTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  noApp: { fontSize: 12, color: C.accent, fontWeight: '700' },

  // paid hero
  hero: { width: 200, backgroundColor: C.cardHi, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 18 },
  hLbl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  live: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  hLblTxt: { fontSize: 10, letterSpacing: 1.4, color: C.faint, fontWeight: '700' },
  hAmt: { fontSize: 36, fontWeight: '800', color: C.text, letterSpacing: -1.2, marginVertical: 8 },
  hPerf: { borderTopWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', marginVertical: 8 },
  hRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hRowDim: { fontSize: 12, color: C.dim },
  hRowGreen: { fontSize: 12, color: C.accent, fontWeight: '700' },

  // name
  nameFlex: { flex: 1, width: '100%' },
  // top-aligned so the keyboard + footer CTA never rise over the input
  nameWrap: { flex: 1, justifyContent: 'flex-start', gap: 14, paddingHorizontal: 4, paddingTop: 8 },
  bigAv: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(91,157,240,0.2)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  bigAvTxt: { fontSize: 26, fontWeight: '800', color: C.blue },
  nq: { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -0.3 },
  nsub: { fontSize: 13.5, color: C.dim, textAlign: 'center', marginTop: -6 },
  ninput: { height: 54, backgroundColor: C.cardHi, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: C.text },
});
