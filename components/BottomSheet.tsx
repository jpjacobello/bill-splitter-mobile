import { useEffect, useRef, useState } from 'react';
import {
  Animated, Keyboard, Modal, PanResponder, Pressable, StyleSheet, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

const CLOSE_DISTANCE = 100;
const CLOSE_VELOCITY = 0.7;
const FALLBACK_H = 700;

// Plain RN-Modal bottom sheet (gorhom + reanimated 4 wouldn't present on this
// setup). Reliable: slides open, tap-backdrop or drag-handle-down to close,
// and tracks the keyboard on its own curve (no KeyboardAvoidingView lurch).
export default function BottomSheet({
  visible, onClose, children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(FALLBACK_H)).current;
  const kb = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheetH = useRef(FALLBACK_H);

  const animateIn = () => {
    slide.setValue(sheetH.current);
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 12, tension: 90 }),
      Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const animateOut = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slide, { toValue: sheetH.current, duration: 220, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setMounted(false); });
  };

  useEffect(() => {
    if (visible) setMounted(true);
    else if (mounted) animateOut();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mounted) animateIn();
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(kb, {
        toValue: -Math.max(0, e.endCoordinates.height - insets.bottom),
        duration: e.duration || 250, useNativeDriver: true,
      }).start();
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(kb, { toValue: 0, duration: e.duration || 250, useNativeDriver: true }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [insets.bottom]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) slide.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_DISTANCE || g.vy > CLOSE_VELOCITY) onClose();
        else Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 12, tension: 90 }).start();
      },
    })
  ).current;

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.flex}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + 12, transform: [{ translateY: slide }, { translateY: kb }] }]}
          onLayout={(e) => { if (e.nativeEvent.layout.height) sheetH.current = e.nativeEvent.layout.height; }}
        >
          <View {...pan.panHandlers} style={styles.grip}>
            <View style={styles.handle} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  grip: { alignItems: 'center', paddingTop: 12, paddingBottom: 14 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
});
