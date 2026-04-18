import { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, ActivityIndicator, Easing } from 'react-native';

type Props = { height: number };

export default function RainbowScanOverlay({ height }: Props) {
  const scanY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanY, {
          toValue: 0,
          duration: 2400,
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
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden', borderRadius: 20 }}>
      <View style={[StyleSheet.absoluteFill, styles.base]} />

      <Animated.View style={[styles.scanWrapper, { transform: [{ translateY }] }]}>
        <View style={styles.scanLine} />
      </Animated.View>

      <View style={styles.content}>
        <ActivityIndicator color="rgba(255,255,255,0.85)" size="large" />
        <Text style={styles.text}>Scanning receipt…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  scanWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  scanLine: {
    height: 2,
    backgroundColor: '#FF2222',
    width: '100%',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  text: {
    color: 'rgba(255,255,255,0.90)',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
