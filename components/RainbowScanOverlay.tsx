import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Easing } from 'react-native';

type Props = { height: number };

export default function RainbowScanOverlay({ height }: Props) {
  const scanY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanY, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const translateY = scanY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, height - 20],
  });

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden', borderRadius: 16 }}>
      <Animated.View style={[styles.scanWrapper, { transform: [{ translateY }] }]}>
        <View style={styles.glow} />
        <View style={styles.scanLine} />
        <View style={[styles.glow, { transform: [{ scaleY: -1 }] }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scanWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  scanLine: {
    height: 2,
    backgroundColor: '#3B82F6',
    width: '100%',
  },
  glow: {
    height: 16,
    width: '100%',
    opacity: 0.25,
    backgroundColor: '#3B82F6',
  },
});
