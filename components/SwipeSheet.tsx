import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Keyboard, Modal, Pressable, StyleSheet, TextInput, View, useWindowDimensions,
} from 'react-native';
import type { ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing, interpolate, runOnJS, scrollTo, useAnimatedRef, useAnimatedScrollHandler,
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { colors } from '../theme';

// NOTE: NOT @gorhom/bottom-sheet — its modal never presents on this setup (see
// memory/git history). This is a plain RN Modal, but ALL motion runs on the UI
// thread via reanimated worklets + Gesture.Pan, so the drag is 60fps and the
// sheet follows the finger both directions (1:1 down, rubber-banded up).

const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 800;
const SPRING = { damping: 22, stiffness: 240, mass: 0.9 };

type SheetCtxT = {
  nativeScroll: any;
  scrollRef: any;
  scrollHandler: any;
  registerScroll: (has: boolean) => void;
};
const SheetCtx = createContext<SheetCtxT | null>(null);

/**
 * Scrollable body for a SwipeSheet. Scrolls normally; when scrolled to the top,
 * a downward drag hands the gesture to the sheet so it follows your finger.
 */
export function SheetScrollView({ style, ...rest }: ScrollViewProps & { children?: React.ReactNode }) {
  const ctx = useContext(SheetCtx);
  useEffect(() => {
    ctx?.registerScroll(true);
    return () => ctx?.registerScroll(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ctx) return null;
  return (
    <GestureDetector gesture={ctx.nativeScroll}>
      <Animated.ScrollView
        ref={ctx.scrollRef}
        bounces={false}
        {...rest}
        style={[{ flexShrink: 1 }, style]}
        onScroll={ctx.scrollHandler}
        scrollEventThrottle={16}
      />
    </GestureDetector>
  );
}

// Plain TextInput; alias kept so consumers don't churn if the sheet impl changes.
export const SheetTextInput = TextInput;

/**
 * The one bottom sheet for the whole app. Springs up; the drag follows your
 * finger — 1:1 downward, rubber-banded above rest — from the handle/header
 * always, and from the body when its scroll is at the top. Release past ~120px
 * or a flick dismisses; otherwise it springs back. Backdrop opacity is tied to
 * the sheet position, so it fades as you drag.
 */
export default function SwipeSheet({
  visible, onClose, header, headerStyle, children, tall, blur, snap, background, onClosed,
}: {
  visible: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  headerStyle?: any;
  children?: React.ReactNode;
  tall?: boolean;
  blur?: boolean;
  snap?: (string | number)[];
  background?: string;
  onClosed?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);

  const first = snap?.[0];
  const fixedH = typeof first === 'number'
    ? first
    : typeof first === 'string' && first.endsWith('%')
      ? (parseFloat(first) / 100) * winH
      : tall ? winH * 0.92 : undefined;

  const transY = useSharedValue(winH);
  const kbY = useSharedValue(0);
  const sheetH = useSharedValue(fixedH ?? winH);
  const scrollY = useSharedValue(0);
  const hasScroll = useSharedValue(false);
  const dragging = useSharedValue(false);
  const dragBase = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const requestClose = () => onCloseRef.current();
  const finishClose = () => { setMounted(false); onClosed?.(); };

  useEffect(() => {
    if (visible) {
      setMounted(true);
    } else if (mounted) {
      transY.value = withTiming(sheetH.value, { duration: 220, easing: Easing.in(Easing.cubic) }, (fin) => {
        if (fin) runOnJS(finishClose)();
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mounted) {
      scrollY.value = 0;
      kbY.value = 0;
      dragging.value = false;
      transY.value = sheetH.value;
      transY.value = withSpring(0, SPRING);
    }
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track the keyboard on its own curve so sheets with inputs lift above it.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (ev) => {
      kbY.value = withTiming(-Math.max(0, ev.endCoordinates.height - insets.bottom), { duration: ev.duration || 250 });
    });
    const hide = Keyboard.addListener('keyboardWillHide', (ev) => {
      kbY.value = withTiming(0, { duration: ev.duration || 250 });
    });
    return () => { show.remove(); hide.remove(); };
  }, [insets.bottom]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  const nativeScroll = Gesture.Native();

  // Body drag — runs simultaneously with the scroll. Takes over (and pins the
  // scroll) once the list is at the top and the finger moves down; hands back
  // seamlessly because the takeover point re-bases the translation.
  const bodyPan = Gesture.Pan()
    .simultaneousWithExternalGesture(nativeScroll)
    .activeOffsetY([-6, 6])
    .onUpdate((e) => {
      'worklet';
      if (dragging.value) {
        const y = e.translationY - dragBase.value;
        transY.value = y >= 0 ? y : y / 4; // 1:1 down, resistance above rest
        if (hasScroll.value) scrollTo(scrollRef, 0, 0, false);
      } else if ((scrollY.value <= 1 && e.translationY > 0) || !hasScroll.value) {
        dragging.value = true;
        dragBase.value = e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (!dragging.value) return;
      dragging.value = false;
      if (transY.value > CLOSE_DISTANCE || (e.velocityY > CLOSE_VELOCITY && transY.value > 0)) {
        runOnJS(requestClose)();
      } else {
        transY.value = withSpring(0, SPRING);
      }
    })
    .onFinalize(() => {
      'worklet';
      if (dragging.value) { dragging.value = false; transY.value = withSpring(0, SPRING); }
    });

  // Handle/header drag — always follows the finger, no scroll involved.
  const headerPan = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .onUpdate((e) => {
      'worklet';
      transY.value = e.translationY >= 0 ? e.translationY : e.translationY / 4;
    })
    .onEnd((e) => {
      'worklet';
      if (transY.value > CLOSE_DISTANCE || (e.velocityY > CLOSE_VELOCITY && transY.value > 0)) {
        runOnJS(requestClose)();
      } else {
        transY.value = withSpring(0, SPRING);
      }
    })
    .onFinalize(() => {
      'worklet';
      if (transY.value > 0 && transY.value <= CLOSE_DISTANCE) transY.value = withSpring(0, SPRING);
    });

  const sheetAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: transY.value + kbY.value }],
  }));
  const backdropAnim = useAnimatedStyle(() => ({
    opacity: interpolate(transY.value, [0, sheetH.value], [1, 0], 'clamp'),
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* Gesture handlers inside an RN Modal need their own root view. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropAnim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            blur && styles.glass,
            background ? { backgroundColor: background } : null,
            fixedH ? { height: fixedH } : { maxHeight: winH * 0.9 },
            { paddingBottom: insets.bottom + 12 },
            sheetAnim,
          ]}
          onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h) sheetH.value = h; }}
        >
          {blur && (
            <>
              <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={85} />
              <View style={[StyleSheet.absoluteFill, styles.sheen]} />
            </>
          )}
          <GestureDetector gesture={headerPan}>
            <View>
              <View style={styles.handle} />
              {header != null && <View style={[styles.headerWrap, headerStyle]}>{header}</View>}
            </View>
          </GestureDetector>
          {children != null && (
            <GestureDetector gesture={bodyPan}>
              <View style={[styles.body, fixedH ? { flexGrow: 1 } : null]}>
                <SheetCtx.Provider
                  value={{ nativeScroll, scrollRef, scrollHandler, registerScroll: (has) => { hasScroll.value = has; } }}
                >
                  {children}
                </SheetCtx.Provider>
              </View>
            </GestureDetector>
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  glass: { backgroundColor: 'transparent', borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.14)' },
  sheen: { backgroundColor: 'rgba(255,255,255,0.03)' },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.26)', marginTop: 12, marginBottom: 12 },
  headerWrap: { paddingHorizontal: 20 },
  body: { flexShrink: 1, minHeight: 0 },
});
