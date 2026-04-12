import { StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  height?: number;
};

export default function Button({ label, onPress, variant = 'primary', disabled, loading, height }: Props) {
  const handlePress = () => {
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled, height ? { height } : undefined]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#000' : '#D0D0D0'} />
      ) : (
        <Text style={[styles.label, variant !== 'primary' && styles.labelDark]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: '#D8D8D8',
  },
  secondary: {
    backgroundColor: '#252525',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  labelDark: {
    color: '#D0D0D0',
  },
});
