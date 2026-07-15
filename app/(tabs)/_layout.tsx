import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, GlassContainer, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, ui as C } from '../../theme';
import { startNewBill } from '../../utils/startBill';

type IconName = keyof typeof Ionicons.glyphMap;

// Inactive tab tint — bright enough to stay legible over light OR dark content
// behind the glass (Flighty keeps inactive icons near-white, not dim grey).
const TAB_INACTIVE = 'rgba(236,238,244,0.72)';

// SF Symbols on iOS (system-native look), Ionicons fallback elsewhere.
type TabMeta = { label: string; icon: IconName; activeIcon: IconName; sf: SFSymbol; sfActive: SFSymbol };
const TAB_META: Record<string, TabMeta> = {
  index: { label: 'Home', icon: 'home-outline', activeIcon: 'home', sf: 'house', sfActive: 'house.fill' },
  activity: { label: 'Activity', icon: 'pulse-outline', activeIcon: 'pulse', sf: 'waveform.path.ecg', sfActive: 'waveform.path.ecg' },
  settings: { label: 'Settings', icon: 'settings-outline', activeIcon: 'settings', sf: 'gearshape', sfActive: 'gearshape.fill' },
};

// Subtle: active icon + label highlight white; press dims briefly. No bounce.
function TabButton({ name, focused, onPress }: { name: string; focused: boolean; onPress: () => void }) {
  const meta = TAB_META[name];
  if (!meta) return <View style={styles.slot} />;
  const tint = focused ? C.text : TAB_INACTIVE;
  return (
    <Pressable style={({ pressed }) => [styles.slot, pressed && { opacity: 0.5 }]} onPress={onPress} hitSlop={6}>
      {/* Shadow gives the glyph separation so it pops over light OR dark content behind the glass. */}
      {Platform.OS === 'ios' ? (
        <SymbolView
          name={focused ? meta.sfActive : meta.sf}
          size={25}
          tintColor={tint}
          weight={focused ? 'semibold' : 'regular'}
          resizeMode="scaleAspectFit"
          style={[styles.symbol, styles.symShadow]}
        />
      ) : (
        <Ionicons name={focused ? meta.activeIcon : meta.icon} size={23} color={tint} style={styles.icoShadow} />
      )}
      <Text style={[styles.label, styles.icoShadow, focused && styles.labelActive]}>{meta.label}</Text>
    </Pressable>
  );
}

const BAR_PAD = 24; // must match styles.bar paddingHorizontal — bubble geometry depends on it

// iOS 26+ has Apple's real Liquid Glass (UIGlassEffect). Below that (and on the
// simulator / older phones) we fall back to the BlurView + fake-gloss treatment.
// Guarded: if the native module isn't in the running binary yet (e.g. JS reloaded
// over an old dev build before rebuilding), isLiquidGlassAvailable() throws — treat
// that as "no glass" so the bar still renders via BlurView instead of crashing.
let GLASS = false;
try { GLASS = isLiquidGlassAvailable(); } catch { GLASS = false; }

// Animatable GlassView so the active-tab pill can slide as a real glass element.
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

function FloatingTabBar({ state, navigation, open, onToggle }: BottomTabBarProps & { open: boolean; onToggle: () => void }) {
  const insets = useSafeAreaInsets();
  const [home, activity, settings] = state.routes;
  const activeKey = state.routes[state.index]?.name;

  // + morphs to × when the speed-dial is open
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rot, { toValue: open ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open]);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] });

  // Liquid-glass "lens" bubble that springs between the Home and Activity slots.
  // Geometry: bar is [pad][ Home ][ FAB ][ Activity ][pad] — 3 equal flex slots.
  const [barW, setBarW] = useState(0);
  const inner = Math.max(0, barW - BAR_PAD * 2);
  const slotW = inner / 3;
  const bubbleW = Math.max(0, slotW - 8);
  const homeLeft = BAR_PAD + slotW / 2 - bubbleW / 2;
  const activityLeft = BAR_PAD + slotW * 2.5 - bubbleW / 2;

  const onHome = activeKey === home.name;
  const onActivity = activeKey === activity.name;
  const showBubble = onHome || onActivity; // hidden if Settings is somehow active
  const activeIndex = onActivity ? 1 : 0;

  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // JS driver: works uniformly for Animated.View AND the custom AnimatedGlassView.
    Animated.spring(slide, { toValue: activeIndex, useNativeDriver: false, damping: 16, stiffness: 190, mass: 0.8 }).start();
  }, [activeIndex]);
  const bubbleX = slide.interpolate({ inputRange: [0, 1], outputRange: [homeLeft, activityLeft] });

  const go = (route: (typeof state.routes)[number]) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (activeKey !== route.name && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 10 }]} pointerEvents="box-none">
      <View style={styles.barShadow}>
        {GLASS ? (
          // Real Apple Liquid Glass. Bar background + active pill are sibling
          // GlassViews inside a GlassContainer, so the pill melds into the bar
          // (Apple's fluid "merge") as it slides between tabs.
          <GlassContainer spacing={40} style={styles.bar} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
            <GlassView glassEffectStyle="regular" colorScheme="dark" style={styles.glassBg} pointerEvents="none" />
            {showBubble && barW > 0 && (
              <AnimatedGlassView
                glassEffectStyle="clear"
                colorScheme="dark"
                tintColor="rgba(255,255,255,0.12)"
                style={[styles.bubbleGlass, { width: bubbleW, transform: [{ translateX: bubbleX }] }]}
                pointerEvents="none"
              />
            )}
            <TabButton name={home.name} focused={onHome} onPress={() => go(home)} />
            <View style={styles.slot} />
            <TabButton name={activity.name} focused={onActivity} onPress={() => go(activity)} />
          </GlassContainer>
        ) : (
          // Fallback: BlurView + hand-rolled gloss/rim + gradient pill.
          <BlurView intensity={60} tint="dark" style={[styles.bar, styles.barBlurBg]} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={styles.gloss} pointerEvents="none"
            />
            <View style={styles.barBorder} pointerEvents="none" />
            {showBubble && barW > 0 && (
              <Animated.View style={[styles.bubble, { width: bubbleW, transform: [{ translateX: bubbleX }] }]} pointerEvents="none">
                <LinearGradient
                  colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.14)']}
                  locations={[0, 0.6, 1]}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.bubbleGloss} pointerEvents="none" />
              </Animated.View>
            )}
            <TabButton name={home.name} focused={onHome} onPress={() => go(home)} />
            <View style={styles.slot} />
            <TabButton name={activity.name} focused={onActivity} onPress={() => go(activity)} />
          </BlurView>
        )}
      </View>

      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
      >
        <View style={styles.fabGloss} pointerEvents="none" />
        <Animated.View style={{ transform: [{ rotate }] }}>
          {Platform.OS === 'ios'
            ? <SymbolView name="plus" size={25} tintColor="#000" weight="semibold" resizeMode="scaleAspectFit" style={styles.fabSymbol} />
            : <Ionicons name="add" size={30} color="#000" />}
        </Animated.View>
      </Pressable>
    </View>
  );
}

type DialAction = { key: 'scan' | 'upload' | 'quick'; label: string; icon: IconName; color: string; pos: { x: number; y: number } };
// Fanned on a semicircle above the +: left, top, right (R≈96, angles 150°/90°/30°)
const DIAL_ACTIONS: DialAction[] = [
  { key: 'scan', label: 'Scan', icon: 'camera-outline', color: colors.green, pos: { x: -88, y: -52 } },
  { key: 'upload', label: 'Upload', icon: 'images-outline', color: '#D4834A', pos: { x: 0, y: -104 } },
  { key: 'quick', label: 'Quick Split', icon: 'calculator-outline', color: '#6497D4', pos: { x: 88, y: -52 } },
];

// Speed-dial: labeled icon buttons fan out on an arc around the + button.
// NOT a Modal — a plain absolute overlay so it never conflicts with the native
// camera/scanner presentation, and pointerEvents releases cleanly (a stuck Modal
// backdrop was eating taps and killing the + button).
function SpeedDial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  // single value → all items animate together, no stagger
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(v, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(v, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (key: DialAction['key']) => {
    onClose();
    if (key === 'quick') { router.push('/quick-split'); return; }
    // Fire the picker straight from receipt-upload — no dead intermediate screen.
    await startNewBill();
    router.push(`/receipt-upload?source=${key === 'scan' ? 'camera' : 'library'}`);
  };

  if (!mounted) return null;

  return (
    // pointerEvents follows `open` so a closing/closed dial never blocks the tab bar
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dialBackdrop, { opacity: v }]} />
      </Pressable>

      {DIAL_ACTIONS.map((a) => (
        <Animated.View
          key={a.key}
          pointerEvents="box-none"
          style={[
            styles.dialItem,
            { bottom: insets.bottom + 60 },
            {
              opacity: v,
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, a.pos.x] }) },
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, a.pos.y] }) },
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              ],
            },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.dialBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] }]}
            onPress={() => pick(a.key)}
          >
            <Ionicons name={a.icon} size={25} color={a.color} />
          </Pressable>
          <Text style={styles.dialLabel}>{a.label}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

export default function TabsLayout() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false, lazy: false }}
        tabBar={(props) => <FloatingTabBar {...props} open={open} onToggle={() => setOpen((o) => !o)} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="activity" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <SpeedDial open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const BAR_H = 62;
const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 18, right: 18, alignItems: 'center' },
  barShadow: {
    width: '100%', borderRadius: 30,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  bar: {
    height: BAR_H, borderRadius: 30, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: BAR_PAD, // pulls Home/Activity slightly toward center; FAB stays at 50%
    overflow: 'hidden',
  },
  // Only the BlurView backend needs a tint fill; GlassView provides its own material.
  // Kept fairly opaque so the bar stays a dark pill even over light content (icons pop).
  barBlurBg: { backgroundColor: 'rgba(26,28,34,0.72)' },
  // Real-glass backend: bar-fill glass + the sliding pill glass (no gradients).
  glassBg: { ...StyleSheet.absoluteFillObject, borderRadius: 30 },
  bubbleGlass: { position: 'absolute', top: 9, height: 44, borderRadius: 22 },
  // brighter top-left rim = glass edge light
  barBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '58%', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: BAR_H },
  label: { fontSize: 10, fontWeight: '600', color: TAB_INACTIVE },
  labelActive: { color: C.text },
  // vibrancy shadow so icons + labels pop on any background behind the glass
  icoShadow: { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  // SF Symbol is an image view: needs an explicit box, and a layer shadow (not textShadow) for the same pop.
  symbol: { width: 26, height: 26 },
  symShadow: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  fabSymbol: { width: 26, height: 26 },

  // active-tab lens
  bubble: {
    position: 'absolute', top: 9, height: 44, borderRadius: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  bubbleGloss: {
    position: 'absolute', top: 2, left: '12%', right: '12%', height: '40%',
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18, backgroundColor: 'rgba(255,255,255,0.30)',
  },

  fab: {
    position: 'absolute', top: -18, overflow: 'hidden',
    width: 58, height: 58, borderRadius: 29, backgroundColor: C.text,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: C.bg,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  fabGloss: {
    position: 'absolute', top: 3, left: '20%', right: '20%', height: '38%',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16, backgroundColor: 'rgba(255,255,255,0.55)',
  },

  // ── speed dial ──
  dialBackdrop: { backgroundColor: 'rgba(8,8,10,0.72)' },
  // each item anchored bottom-center on the +, then translated out along the arc
  dialItem: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 7 },
  dialBtn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#2C2C33', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },
  dialLabel: { fontSize: 12.5, fontWeight: '600', color: C.text, letterSpacing: 0.1 },
});
