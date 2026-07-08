import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import { startNewBill } from '../../utils/startBill';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_META: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  index: { label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  activity: { label: 'Activity', icon: 'pulse-outline', activeIcon: 'pulse' },
  people: { label: 'People', icon: 'people-outline', activeIcon: 'people' },
  settings: { label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
};

function TabButton({ name, focused, onPress }: { name: string; focused: boolean; onPress: () => void }) {
  const meta = TAB_META[name];
  const press = useRef(new Animated.Value(0)).current; // 0 rest → 1 pressed
  const active = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(active, { toValue: focused ? 1 : 0, useNativeDriver: true, friction: 6, tension: 140 }).start();
  }, [focused]);

  if (!meta) return <View style={styles.slot} />;

  const scale = Animated.multiply(
    press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }),
    active.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }),
  );
  const lift = active.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const dotScale = active.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Pressable
      style={styles.slot}
      onPressIn={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 7, tension: 300 }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 0, useNativeDriver: true, friction: 5, tension: 200 }).start()}
      onPress={onPress}
    >
      <Animated.View style={{ transform: [{ scale }, { translateY: lift }], alignItems: 'center', gap: 3 }}>
        <Ionicons name={focused ? meta.activeIcon : meta.icon} size={23} color={focused ? colors.text : colors.textMuted} />
        <Text style={[styles.label, focused && styles.labelActive]}>{meta.label}</Text>
      </Animated.View>
      <Animated.View style={[styles.activeDot, { opacity: active, transform: [{ scale: dotScale }] }]} />
    </Pressable>
  );
}

function FloatingTabBar({ state, navigation, onNew }: BottomTabBarProps & { onNew: () => void }) {
  const insets = useSafeAreaInsets();
  const [home, activity, people, settings] = state.routes;
  const activeKey = state.routes[state.index]?.name;
  const fabScale = useRef(new Animated.Value(0)).current;

  const go = (route: (typeof state.routes)[number]) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (activeKey !== route.name && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 10 }]} pointerEvents="box-none">
      <View style={styles.barShadow}>
        <BlurView intensity={40} tint="dark" style={styles.bar}>
          <View style={styles.barBorder} pointerEvents="none" />
          <TabButton name={home.name} focused={activeKey === home.name} onPress={() => go(home)} />
          <TabButton name={activity.name} focused={activeKey === activity.name} onPress={() => go(activity)} />
          <View style={styles.slot} />
          <TabButton name={people.name} focused={activeKey === people.name} onPress={() => go(people)} />
          <TabButton name={settings.name} focused={activeKey === settings.name} onPress={() => go(settings)} />
        </BlurView>
      </View>

      <Animated.View style={{ position: 'absolute', top: -18, transform: [{ scale: fabScale.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) }] }}>
        <Pressable
          onPressIn={() => Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 300 }).start()}
          onPressOut={() => Animated.spring(fabScale, { toValue: 0, useNativeDriver: true, friction: 5, tension: 200 }).start()}
          onPress={onNew}
          style={styles.fab}
        >
          <Ionicons name="add" size={30} color="#000" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function NewChooser({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slide, { toValue: visible ? 1 : 0, useNativeDriver: true, friction: 9, tension: 90 }).start();
  }, [visible]);

  const pick = async (which: 'scan' | 'quick') => {
    onClose();
    if (which === 'scan') { await startNewBill(); router.push('/receipt-upload'); }
    else router.push('/quick-split');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 20, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [340, 0] }) }] },
          ]}
        >
          <Pressable>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>New Bill</Text>
            <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={() => pick('scan')}>
              <View style={styles.rowIcon}><Ionicons name="scan-outline" size={22} color={colors.text} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Scan a Receipt</Text>
                <Text style={styles.rowSub}>Itemize and split by what each person ordered</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={() => pick('quick')}>
              <View style={styles.rowIcon}><Ionicons name="calculator-outline" size={22} color={colors.text} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Quick Split</Text>
                <Text style={styles.rowSub}>Split a total evenly — no receipt needed</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default function TabsLayout() {
  const [chooserOpen, setChooserOpen] = useState(false);
  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <FloatingTabBar {...props} onNew={() => setChooserOpen(true)} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="activity" />
        <Tabs.Screen name="people" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <NewChooser visible={chooserOpen} onClose={() => setChooserOpen(false)} />
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
    overflow: 'hidden', backgroundColor: 'rgba(28,28,30,0.72)',
  },
  barBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', height: BAR_H },
  label: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  labelActive: { color: colors.text },
  activeDot: { position: 'absolute', bottom: 7, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text },

  fab: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: colors.btnPrimary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.bg,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#202023', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, gap: 10,
    borderTopWidth: 1, borderColor: colors.border,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 10 },
  sheetTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 4, letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  rowIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
