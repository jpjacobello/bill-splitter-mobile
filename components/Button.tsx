import { useRef } from 'react';
import { StyleSheet, Text, Animated, Pressable, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, motion } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  height?: number;
  icon?: keyof typeof Ionicons.glyphMap;
};

export default function Button({ label, onPress, variant = 'primary', disabled, loading, height, icon }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.965, useNativeDriver: true, ...motion.pressIn }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.settle }).start();
  };

  const h = height ?? 56;
  const iconColor = variant === 'primary' ? '#000000' : '#D0D0D0';

  const inner = loading
    ? <ActivityIndicator color={variant === 'primary' ? '#000' : '#D0D0D0'} />
    : (
      <View style={styles.content}>
        {icon && <Ionicons name={icon} size={19} color={iconColor} />}
        <Text style={variant === 'primary' ? styles.labelPrimary : styles.labelSecondary}>{label}</Text>
      </View>
    );

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
            {inner}
          </LinearGradient>
        ) : (
          <View style={[styles.base, variant === 'secondary' ? styles.secondary : styles.ghost, { height: h, borderRadius: 16 }]}>
            {inner}
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
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondary: {
    backgroundColor: colors.btnSecondary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
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
