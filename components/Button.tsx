import { useRef } from 'react';
import { StyleSheet, Text, Animated, Pressable, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  height?: number;
};

export default function Button({ label, onPress, variant = 'primary', disabled, loading, height }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.965, useNativeDriver: true, speed: 120, bounciness: 0 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  };

  const h = height ?? 56;

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled || loading}>
      <Animated.View style={[{ transform: [{ scale }] }, (disabled || loading) && styles.disabled, variant === 'primary' && styles.primaryShadow]}>
        {variant === 'primary' ? (
          <LinearGradient
            colors={['#FFFFFF', '#DCDCDC']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.base, { height: h, borderRadius: 16 }]}
          >
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.labelPrimary}>{label}</Text>}
          </LinearGradient>
        ) : variant === 'secondary' ? (
          <View style={[styles.base, styles.secondary, { height: h, borderRadius: 16 }]}>
            {loading ? <ActivityIndicator color="#D0D0D0" /> : <Text style={styles.labelSecondary}>{label}</Text>}
          </View>
        ) : (
          <View style={[styles.base, styles.ghost, { height: h, borderRadius: 16 }]}>
            {loading ? <ActivityIndicator color="#D0D0D0" /> : <Text style={styles.labelSecondary}>{label}</Text>}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  secondary: {
    backgroundColor: '#252525',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.38,
  },
  primaryShadow: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 14,
    elevation: 4,
  },
  labelPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.2,
  },
  labelSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D0D0D0',
  },
});
