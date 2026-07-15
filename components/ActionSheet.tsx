import { useEffect, useRef, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, ui as C } from '../theme';

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
  // Finger-follows-sheet drag. Only downward travel counts (clamped); release
  // past a threshold (or a fast flick) dismisses, otherwise it springs back.
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) { setValue(input?.initialValue ?? ''); dragY.setValue(0); }
    Animated.spring(slide, { toValue: visible ? 1 : 0, useNativeDriver: true, ...motion.sheet }).start();
  }, [visible]);

  const onGestureEvent = Animated.event([{ nativeEvent: { translationY: dragY } }], { useNativeDriver: true });
  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.state !== State.END) return;
    const { translationY, velocityY } = e.nativeEvent;
    if (translationY > 120 || velocityY > 900) onClose();
    else Animated.spring(dragY, { toValue: 0, useNativeDriver: true, ...motion.sheet }).start();
  };
  const dragTranslate = dragY.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: 'clamp' });
  const slideTranslate = slide.interpolate({ inputRange: [0, 1], outputRange: [360, 0] });

  const submit = () => {
    if (!input || !value.trim()) return;
    input.onSubmit(value.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 16, transform: [{ translateY: Animated.add(slideTranslate, dragTranslate) }] },
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
                    placeholderTextColor={C.faint}
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
                        <View style={[styles.rowIcon, o.destructive && styles.rowIconDestructive]}>
                          <Ionicons name={o.icon} size={17} color={o.destructive ? '#E86A78' : C.text} />
                        </View>
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
          </PanGestureHandler>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#26262B', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.24)', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.2, paddingHorizontal: 4, marginBottom: 4 },
  message: { fontSize: 13.5, color: C.dim, paddingHorizontal: 4, marginBottom: 14, lineHeight: 19 },
  inputWrap: { gap: 10, marginTop: 4 },
  input: {
    height: 52, borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: C.text,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.line,
  },
  submitBtn: {
    height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.text,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: 15.5, fontWeight: '700', color: C.bg },
  options: { gap: 8, marginTop: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: C.line,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  rowIconDestructive: { backgroundColor: 'rgba(224,90,106,0.12)' },
  rowLabel: { fontSize: 15.5, fontWeight: '600', color: C.text },
  rowLabelDestructive: { color: '#E86A78' },
  rowSub: { fontSize: 12.5, color: C.dim, marginTop: 2 },
  cancel: { alignItems: 'center', paddingVertical: 15, marginTop: 10 },
  cancelText: { fontSize: 15, fontWeight: '600', color: C.dim },
});
