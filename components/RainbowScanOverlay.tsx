import { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, ActivityIndicator, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function RainbowScanOverlay() {
  const sweep1 = useRef(new Animated.Value(0)).current;
  const sweep2 = useRef(new Animated.Value(0)).current;
  const sweep3 = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeSweep = (val: Animated.Value, delay: number, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    makeSweep(sweep1, 0, 2200).start();
    makeSweep(sweep2, 800, 2000).start();
    makeSweep(sweep3, 1500, 2400).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const tx1 = sweep1.interpolate({ inputRange: [0, 1], outputRange: [-700, 700] });
  const tx2 = sweep2.interpolate({ inputRange: [0, 1], outputRange: [-700, 700] });
  const tx3 = sweep3.interpolate({ inputRange: [0, 1], outputRange: [-700, 700] });

  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] });
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Dark base */}
      <View style={[StyleSheet.absoluteFill, styles.base]} />

      {/* Breathing glow layer */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glowOpacity, transform: [{ scale }] }]}>
        <LinearGradient
          colors={['rgba(120,0,255,0.5)', 'rgba(0,180,255,0.4)', 'rgba(255,0,160,0.5)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Sweep 1 — violet → cyan */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: tx1 }] }]}>
        <LinearGradient
          colors={[
            'transparent',
            'rgba(180,0,255,0.0)',
            'rgba(100,0,255,0.55)',
            'rgba(0,150,255,0.6)',
            'rgba(0,255,220,0.45)',
            'rgba(0,255,100,0.2)',
            'transparent',
          ]}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 1, y: 0.7 }}
          style={[StyleSheet.absoluteFill, styles.sweepWide]}
        />
      </Animated.View>

      {/* Sweep 2 — pink → gold */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: tx2 }] }]}>
        <LinearGradient
          colors={[
            'transparent',
            'rgba(255,0,100,0.0)',
            'rgba(255,0,180,0.5)',
            'rgba(255,100,0,0.45)',
            'rgba(255,220,0,0.4)',
            'rgba(255,255,150,0.2)',
            'transparent',
          ]}
          start={{ x: 0, y: 0.7 }}
          end={{ x: 1, y: 0.2 }}
          style={[StyleSheet.absoluteFill, styles.sweepWide]}
        />
      </Animated.View>

      {/* Sweep 3 — green → purple */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: tx3 }] }]}>
        <LinearGradient
          colors={[
            'transparent',
            'rgba(0,255,150,0.0)',
            'rgba(0,200,100,0.35)',
            'rgba(80,0,200,0.4)',
            'rgba(200,0,255,0.35)',
            'transparent',
          ]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.sweepWide]}
        />
      </Animated.View>

      {/* Text content */}
      <View style={styles.content}>
        <ActivityIndicator color="rgba(255,255,255,0.9)" size="large" />
        <Text style={styles.text}>Scanning receipt…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sweepWide: {
    width: '300%',
    left: '-100%',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  text: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
