import { useEffect, useRef, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion } from '../theme';

export type SheetOption = {
  label: string;
  sublabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

export type SheetInput = {
  placeholder: string;
  initialValue?: string;
  submitLabel: string;
  keyboardType?: 'default' | 'decimal-pad';
  autoCapitalize?: 'none' | 'words';
  onSubmit: (value: string) => void;
};

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  options?: SheetOption[];
  input?: SheetInput; // replaces Alert.prompt — text field + submit button
  onClose: () => void;
};

// Branded replacement for Alert.alert/Alert.prompt — dark spring-in bottom sheet.
export default function ActionSheet({ visible, title, message, options = [], input, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const [value, setValue] = useState(input?.initialValue ?? '');

  useEffect(() => {
    if (visible) setValue(input?.initialValue ?? '');
    Animated.spring(slide, { toValue: visible ? 1 : 0, useNativeDriver: true, ...motion.sheet }).start();
  }, [visible]);

  const submit = () => {
    if (!input || !value.trim()) return;
    input.onSubmit(value.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 16, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [360, 0] }) }] },
            ]}
          >
            <Pressable>
              <View style={styles.handle} />
              {title && <Text style={styles.title}>{title}</Text>}
              {message && <Text style={styles.message}>{message}</Text>}

              {input && (
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder={input.placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={setValue}
                    keyboardType={input.keyboardType ?? 'default'}
                    autoFocus
                    autoCapitalize={input.autoCapitalize ?? 'none'}
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={submit}
                  />
                  <TouchableOpacity
                    style={[styles.submitBtn, !value.trim() && styles.submitBtnDisabled]}
                    activeOpacity={0.85}
                    onPress={submit}
                    disabled={!value.trim()}
                  >
                    <Text style={styles.submitText}>{input.submitLabel}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {options.length > 0 && (
                <View style={styles.options}>
                  {options.map((o, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.row}
                      activeOpacity={0.75}
                      onPress={() => { o.onPress(); onClose(); }}
                    >
                      {o.icon && (
                        <Ionicons name={o.icon} size={20} color={o.destructive ? colors.red : colors.textSecondary} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowLabel, o.destructive && styles.rowLabelDestructive]}>{o.label}</Text>
                        {o.sublabel && <Text style={styles.rowSub}>{o.sublabel}</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.cancel} activeOpacity={0.7} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#202023', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 16, paddingTop: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, paddingHorizontal: 4, marginBottom: 2 },
  message: { fontSize: 13.5, color: colors.textMuted, paddingHorizontal: 4, marginBottom: 12, lineHeight: 19 },
  inputWrap: { gap: 10, marginTop: 6 },
  input: {
    height: 50, borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  submitBtn: {
    height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.btnPrimary,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: 15.5, fontWeight: '700', color: '#000' },
  options: { gap: 8, marginTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  rowLabel: { fontSize: 15.5, fontWeight: '600', color: colors.text },
  rowLabelDestructive: { color: colors.red },
  rowSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  cancel: { alignItems: 'center', paddingVertical: 15, marginTop: 8 },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
