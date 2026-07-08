import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  BottomSheetModal, BottomSheetView, BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

// Thin wrapper over @gorhom/bottom-sheet keeping a simple {visible,onClose}
// API. gorhom handles the drag-to-dismiss gesture and keyboard tracking
// natively (via reanimated + gesture-handler), which RN's Modal cannot.
export default function BottomSheet({
  visible, onClose, children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.6} />
  ), []);

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={onClose}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  handleIndicator: { backgroundColor: 'rgba(255,255,255,0.28)', width: 44, height: 5 },
  content: { paddingHorizontal: 20, paddingTop: 4 },
});
