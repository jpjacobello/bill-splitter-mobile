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

// Subtle: active icon + label highlight white; press dims briefly. No bounce.
function TabButton({ name, focused, onPress }: { name: string; focused: boolean; onPress: () => void }) {
  const meta = TAB_META[name];
  if (!meta) return <View style={styles.slot} />;
  return (
    <Pressable style={({ pressed }) => [styles.slot, pressed && { opacity: 0.5 }]} onPress={onPress} hitSlop={6}>
      <Ionicons name={focused ? meta.activeIcon : meta.icon} size={23} color={focused ? colors.text : colors.textMuted} />
      <Text style={[styles.label, focused && styles.labelActive]}>{meta.label}</Text>
    </Pressable>
  );
}

function FloatingTabBar({ state, navigation, onNew }: BottomTabBarProps & { onNew: () => void }) {
  const insets = useSafeAreaInsets();
  const [home, activity, people, settings] = state.routes;
  const activeKey = state.routes[state.index]?.name;

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

      <Pressable
        onPress={onNew}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
      >
        <Ionicons name="add" size={30} color="#000" />
      </Pressable>
    </View>
  );
}

function NewChooser({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slide, { toValue: visible ? 1 : 0, useNativeDriver: true, friction: 11, tension: 90 }).start();
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
            { paddingBottom: insets.bottom + 18, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] },
          ]}
        >
          <Pressable style={styles.tiles}>
            <TouchableOpacity style={styles.tile} activeOpacity={0.85} onPress={() => pick('scan')}>
              <View style={[styles.tileIcon, { backgroundColor: 'rgba(62,173,116,0.18)' }]}>
                <Ionicons name="scan-outline" size={26} color={colors.green} />
              </View>
              <Text style={styles.tileTitle}>Scan</Text>
              <Text style={styles.tileSub}>Itemize a receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tile} activeOpacity={0.85} onPress={() => pick('quick')}>
              <View style={[styles.tileIcon, { backgroundColor: 'rgba(100,151,212,0.18)' }]}>
                <Ionicons name="calculator-outline" size={26} color="#6497D4" />
              </View>
              <Text style={styles.tileTitle}>Quick Split</Text>
              <Text style={styles.tileSub}>Divide a total</Text>
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
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: BAR_H },
  label: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  labelActive: { color: colors.text },

  fab: {
    position: 'absolute', top: -18,
    width: 58, height: 58, borderRadius: 29, backgroundColor: colors.btnPrimary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.bg,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#202023', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 16, paddingTop: 14,
  },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1, alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 16,
  },
  tileIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  tileSub: { fontSize: 12.5, color: colors.textMuted },
});
