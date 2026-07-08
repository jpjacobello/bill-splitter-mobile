import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Pressable, Animated } from 'react-native';
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

// Floating, blurred ("liquid glass") tab bar with a raised center + action.
function FloatingTabBar({ state, navigation, onNew }: BottomTabBarProps & { onNew: () => void }) {
  const insets = useSafeAreaInsets();
  // routes in declaration order: index, activity, people, settings
  const [home, activity, people, settings] = state.routes;
  const activeKey = state.routes[state.index]?.name;

  const Tab = ({ route }: { route: (typeof state.routes)[number] }) => {
    const meta = TAB_META[route.name];
    if (!meta) return <View style={styles.slot} />;
    const focused = activeKey === route.name;
    return (
      <Pressable
        style={styles.slot}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        <Ionicons
          name={focused ? meta.activeIcon : meta.icon}
          size={23}
          color={focused ? colors.text : colors.textMuted}
        />
        <Text style={[styles.label, focused && styles.labelActive]}>{meta.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 10 }]} pointerEvents="box-none">
      <View style={styles.barShadow}>
        <BlurView intensity={40} tint="dark" style={styles.bar}>
          <View style={styles.barBorder} pointerEvents="none" />
          <Tab route={home} />
          <Tab route={activity} />
          <View style={styles.slot} />{/* spacer under the raised + */}
          <Tab route={people} />
          <Tab route={settings} />
        </BlurView>
      </View>

      <TouchableOpacity style={styles.fab} onPress={onNew} activeOpacity={0.85}>
        <Ionicons name="add" size={30} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
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

      {chooserOpen && (
        <Pressable style={styles.chooserOverlay} onPress={() => setChooserOpen(false)}>
          <View style={styles.chooserSheet}>
            <View style={styles.chooserHandle} />
            <TouchableOpacity
              style={styles.chooserRow}
              activeOpacity={0.8}
              onPress={async () => { setChooserOpen(false); await startNewBill(); router.push('/receipt-upload'); }}
            >
              <View style={styles.chooserIcon}><Ionicons name="scan-outline" size={22} color={colors.text} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chooserTitle}>Scan a Receipt</Text>
                <Text style={styles.chooserSub}>Itemize and split by what each person ordered</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chooserRow}
              activeOpacity={0.8}
              onPress={() => { setChooserOpen(false); router.push('/quick-split'); }}
            >
              <View style={styles.chooserIcon}><Ionicons name="calculator-outline" size={22} color={colors.text} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chooserTitle}>Quick Split</Text>
                <Text style={styles.chooserSub}>Split a total evenly — no receipt needed</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}
    </>
  );
}

const BAR_H = 62;
const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 18, right: 18, alignItems: 'center' },
  barShadow: {
    width: '100%',
    borderRadius: 30,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  bar: {
    height: BAR_H,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(30,30,32,0.55)',
  },
  barBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: BAR_H },
  label: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  labelActive: { color: colors.text },

  fab: {
    position: 'absolute',
    top: -18,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.btnPrimary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.bg,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },

  chooserOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  chooserSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40, gap: 10,
    borderTopWidth: 1, borderColor: colors.border,
  },
  chooserHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 12,
  },
  chooserRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chooserIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  chooserTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  chooserSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
