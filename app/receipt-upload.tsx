import { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View, Text, TouchableOpacity, Alert, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/Button';
import RainbowScanOverlay from '../components/RainbowScanOverlay';
import DigitizedReceipt from '../components/DigitizedReceipt';
import { useBillStore } from '../store/useBillStore';
import { activeParser } from '../services/receiptParser';
import { mockReceipt } from '../data/mockData';

const SCREEN_H = Dimensions.get('window').height;

export default function ReceiptUploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isReturning, demo } = useLocalSearchParams<{ isReturning?: string; demo?: string }>();
  const { setReceipt, receipt, people, pendingImageUri, setPendingImageUri, setReceiptImageUri, reset } = useBillStore();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isRetakeMode, setIsRetakeMode] = useState(false);
  const [notReceiptMode, setNotReceiptMode] = useState(false);
  const [showRetakeSheet, setShowRetakeSheet] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const pendingFired = useRef(false);
  const demoFired = useRef(false);

  const openSheet = () => {
    setSheetMounted(true);
    setShowRetakeSheet(true);
    sheetAnim.setValue(0);
    Animated.timing(sheetAnim, {
      toValue: 1, duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = (onDone?: () => void) => {
    Animated.timing(sheetAnim, {
      toValue: 0, duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowRetakeSheet(false);
      setSheetMounted(false);
      onDone?.();
    });
  };

  const isDemoLoaded = isDemoMode && imageUri === null;

  const pickImage = async (useCamera: boolean) => {
    const { status } = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') return;

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setIsRetakeMode(false);
      setNotReceiptMode(false);
      setImageUri(uri);
      setParsing(true);
      try {
        const parsed = await activeParser(uri);
        if (parsed.items.length === 0 && parsed.total === 0) {
          setParsing(false);
          setImageUri(null);
          setNotReceiptMode(true);
          return;
        }
        const allIds = people.map((p) => p.id);
        const receipt = {
          ...parsed,
          items: parsed.items.map((item) =>
            item.id === 'auto-surcharge' || item.id === 'auto-fee' || item.price < 0
              ? { ...item, assignedTo: allIds }
              : item
          ),
        };
        setReceipt(receipt);
        setReceiptImageUri(uri);
        setParsing(false);
      } catch (err) {
        setParsing(false);
        setImageUri(null);
        setNotReceiptMode(true);
        Alert.alert(
          'Scan Failed',
          'Could not read the receipt. Please try again or use a clearer photo.',
        );
        console.error('Receipt parse error:', err);
      }
    }
  };

  useEffect(() => {
    if (pendingImageUri && !pendingFired.current) {
      pendingFired.current = true;
      const uri = pendingImageUri;
      setPendingImageUri(null);
      setImageUri(uri);
      setParsing(true);
      const allIds = people.map((p) => p.id);
      activeParser(uri)
        .then((parsed) => {
          if (parsed.items.length === 0 && parsed.total === 0) {
            setParsing(false);
            setImageUri(null);
            setNotReceiptMode(true);
            return;
          }
          setReceipt({
            ...parsed,
            items: parsed.items.map((item) =>
              item.id === 'auto-surcharge' || item.id === 'auto-fee'
                ? { ...item, assignedTo: allIds }
                : item
            ),
          });
          setReceiptImageUri(uri);
          setParsing(false);
        })
        .catch((err) => {
          setParsing(false);
          setImageUri(null);
          setIsRetakeMode(true);
          Alert.alert('Scan Failed', 'Could not read the receipt. Please try again or use a clearer photo.');
          console.error('Receipt parse error:', err);
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (demo !== 'true' || demoFired.current) return;
    demoFired.current = true;
    setIsDemoMode(true);
    setParsing(true);
    const t = setTimeout(() => setParsing(false), 1800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDemo = () => {
    setReceipt(mockReceipt);
    setIsDemoMode(true);
    router.push('/receipt-review');
  };

  const handleContinue = () => {
    router.push('/receipt-review');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Receipt</Text>
          <Text style={styles.subtitle}>Take a photo or upload from your library.</Text>
        </View>

        {/* Preview or upload area */}
        {imageUri || isDemoLoaded ? (
          <View style={[styles.previewWrapper, parsing && styles.previewWrapperParsing]}>
            <DigitizedReceipt
              parsing={parsing}
              receipt={receipt}
              maxHeight={SCREEN_H - insets.top - insets.bottom - 90 - 80 - 56 - 16}
            />
            {!parsing && !isDemoMode && (
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => openSheet()}
              >
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : notReceiptMode ? (
          <View style={styles.notReceiptArea}>
            <View style={styles.notReceiptCard}>
              <Ionicons name="document-outline" size={52} color="#555" />
              <Text style={styles.notReceiptQuestion}>?</Text>
            </View>
            <Text style={styles.notReceiptText}>Doesn't look like a receipt.</Text>
          </View>
        ) : isRetakeMode ? (
          <View style={styles.retakeArea} />
        ) : (
          <View style={styles.uploadArea}>
            <Text style={styles.uploadIcon}>📷</Text>
            <Text style={styles.uploadTitle}>No receipt yet</Text>
            <Text style={styles.uploadHint}>Take a photo or choose from your library</Text>
          </View>
        )}

        {/* Actions */}
        {!imageUri && !isDemoLoaded && !isRetakeMode && !notReceiptMode && (
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(true)}>
              <Text style={styles.photoBtnIcon}>📸</Text>
              <Text style={styles.photoBtnText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(false)}>
              <Text style={styles.photoBtnIcon}>🖼️</Text>
              <Text style={styles.photoBtnText}>Library</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          {(imageUri || isDemoLoaded) && !parsing ? (
            <Button label="Review Receipt" onPress={handleContinue} />
          ) : isRetakeMode || notReceiptMode ? (
            <View style={styles.retakeActions}>
              <TouchableOpacity style={styles.retakeIconBtn} onPress={() => pickImage(true)} activeOpacity={0.75}>
                <Ionicons name="camera-outline" size={22} color="#000" />
                <Text style={styles.retakeIconBtnLabel}>Take New Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.retakeIconBtn, styles.retakeIconBtnSecondary]} onPress={() => pickImage(false)} activeOpacity={0.75}>
                <Ionicons name="image-outline" size={22} color="#D0D0D0" />
                <Text style={[styles.retakeIconBtnLabel, styles.retakeIconBtnLabelSecondary]}>Select New Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { reset(); router.replace('/'); }} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            !imageUri && !isReturning && !isDemoMode && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
                <Button label="Use Demo Receipt" onPress={handleDemo} variant="secondary" />
              </>
            )
          )}
        </View>
        {/* Retake sheet */}
        {sheetMounted && (
          <>
            <Animated.View
              style={[styles.sheetBackdrop, { opacity: sheetAnim }]}
              pointerEvents={showRetakeSheet ? 'auto' : 'none'}
            >
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => closeSheet()} />
            </Animated.View>
            <Animated.View style={[styles.sheet, {
              opacity: sheetAnim,
              transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] }) }],
            }]}>
              <Text style={styles.sheetTitle}>Replace Receipt</Text>
              <TouchableOpacity style={styles.sheetBtn} onPress={() => closeSheet(() => pickImage(true))} activeOpacity={0.75}>
                <Ionicons name="camera-outline" size={22} color="#D0D0D0" />
                <Text style={styles.sheetBtnText}>Take New Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnSecondary]} onPress={() => closeSheet(() => pickImage(false))} activeOpacity={0.75}>
                <Ionicons name="image-outline" size={22} color="#D0D0D0" />
                <Text style={styles.sheetBtnText}>Choose from Library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => closeSheet()}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151515',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#D0D0D0',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
  },
  uploadArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2C2C2C',
    borderRadius: 20,
    padding: 32,
    gap: 8,
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#D0D0D0',
  },
  uploadHint: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  previewWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewWrapperParsing: {
    height: 320,
  },
  retakeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  retakeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  demoLoaded: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2C2C2C',
    borderRadius: 20,
    gap: 8,
  },
  demoLoadedIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  demoLoadedTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#D0D0D0',
  },
  demoLoadedSub: {
    fontSize: 14,
    color: '#555',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  photoBtn: {
    flex: 1,
    height: 72,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoBtnIcon: {
    fontSize: 24,
  },
  photoBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D0D0D0',
  },
  retakeArea: {
    flex: 1,
  },
  notReceiptArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  notReceiptCard: {
    width: '55%',
    aspectRatio: 0.65,
    backgroundColor: '#D0D0D0',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notReceiptQuestion: {
    fontSize: 28,
    fontWeight: '700',
    color: '#555',
    marginTop: 4,
  },
  notReceiptText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  retakeActions: {
    gap: 12,
  },
  retakeIconBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#D8D8D8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  retakeIconBtnSecondary: {
    backgroundColor: '#252525',
  },
  retakeIconBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  retakeIconBtnLabelSecondary: {
    color: '#D0D0D0',
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeBtnText: {
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },
  footer: {
    marginTop: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2C2C2C',
  },
  dividerText: {
    fontSize: 14,
    color: '#555',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#1C1C1C',
    gap: 10,
    borderWidth: 0.5,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sheetBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sheetBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sheetBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D0D0D0',
  },
  sheetCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 2,
  },
  sheetCancelText: {
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },
});
