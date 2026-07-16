import { useRef } from 'react';
import { Animated } from 'react-native';
import { State, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { motion } from '../theme';

/**
 * Finger-follows-sheet drag for bottom sheets. Wrap the sheet in a
 * <PanGestureHandler {...pan}> and set its transform to
 * translateY: Animated.add(<your slide-in translate>, dragTranslate).
 * Call reset() whenever the sheet becomes visible.
 *
 * Only downward travel counts (clamped); releasing past 120px or on a fast
 * flick dismisses, otherwise the sheet springs back to rest.
 */
export function useSwipeDismiss(onClose: () => void) {
  const dragY = useRef(new Animated.Value(0)).current;

  const reset = () => dragY.setValue(0);

  const onGestureEvent = Animated.event([{ nativeEvent: { translationY: dragY } }], { useNativeDriver: true });

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    const { state, translationY, velocityY } = e.nativeEvent;
    if (state === State.END) {
      if (translationY > 120 || velocityY > 900) onClose();
      else Animated.spring(dragY, { toValue: 0, useNativeDriver: true, ...motion.sheet }).start();
    } else if (state === State.CANCELLED || state === State.FAILED) {
      // System interruption mid-drag (call banner, control center, backgrounding)
      // — spring back to rest, else the sheet stays sunk at the frozen offset.
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true, ...motion.sheet }).start();
    }
  };

  const dragTranslate = dragY.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: 'clamp' });

  return { pan: { onGestureEvent, onHandlerStateChange }, dragTranslate, reset };
}
