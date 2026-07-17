import { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View, Text, TouchableOpacity, Animated, Easing, ActivityIndicator, InteractionManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ActionSheet from '../components/ActionSheet';
import DigitizedReceipt from '../components/DigitizedReceipt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBillStore } from '../store/useBillStore';
import { startNewBill } from '../utils/startBill';
import { activeParser } from '../services/receiptParser';
import { flattenDocument, enhanceDocument } from '../modules/document-flattener';
import { mockReceipt } from '../data/mockData';
import { DEFAULT_TIP_KEY } from '../utils/tipPrefs';
import { colors, ui as C } from '../theme';

const SCREEN_H = Dimensions.get('window').height;

const SHIMMER_DURATION = 1600;
const CHAR_DELAY = 60;

function ShimmerText({ text, active }: { text: string; active: boolean }) {
  const anims = useRef(text.split('').map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!active) { anims.forEach((a) => a.setValue(0)); return; }
    const loop = Animated.loop(
      Animated.stagger(
        CHAR_DELAY,
        anims.map((a) =>
          Animated.sequence([
            Animated.timing(a, { toValue: 1, duration: SHIMMER_DURATION * 0.3, useNativeDriver: false }),
            Animated.timing(a, { toValue: 0, duration: SHIMMER_DURATION * 0.5, useNativeDriver: false }),
            Animated.delay(SHIMMER_DURATION * 0.2),
          ])
        )
      )
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <View style={{ flexDirection: 'row' }}>
      {text.split('').map((char, i) => (
        <Animated.Text key={i} style={{
          fontSize: 22, fontWeight: '300', letterSpacing: 0.3,
          color: anims[i].interpolate({ inputRange: [0, 1], outputRange: [C.faint, C.text] }),
        }}>
          {char}
        </Animated.Text>
      ))}
    </View>
  );
}


export default function ReceiptUploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isReturning, demo, source } = useLocalSearchParams<{ isReturning?: string; demo?: string; source?: string }>();
  const { setReceipt, receipt, people, pendingImageUri, setPendingImageUri, setReceiptImageUri, reset, updateTip, updateReceiptField } = useBillStore();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isRetakeMode, setIsRetakeMode] = useState(false);
  const [notReceiptMode, setNotReceiptMode] = useState(false);
  const [showRetakeSheet, setShowRetakeSheet] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const [scanErrorOpen, setScanErrorOpen] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const pendingFired = useRef(false);
  const demoFired = useRef(false);
  const sourceFired = useRef(false);
  const continueLock = useRef(false); // one-shot guard against double-tap on Continue

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

  // Returns true once the user actually picks an image; false if they cancel
  // (or deny permission) before selecting — the caller uses this to back out.
  const pickImage = async (useCamera: boolean): Promise<boolean> => {
    let rawUri: string;

    if (useCamera) {
      const { scannedImages } = await DocumentScanner.scanDocument();
      if (!scannedImages || scannedImages.length === 0) return false;
      rawUri = scannedImages[0];
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return false;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets[0]) return false;
      rawUri = result.assets[0].uri;
    }

    setIsRetakeMode(false);
    setNotReceiptMode(false);
    // Show the raw capture immediately (scan line starts).
    setImageUri(rawUri);
    setParsing(true);
    // The cropped/flattened image is COSMETIC — for the preview + saved photo only.
    // OCR always runs on the raw capture so cropping/zoom/tone can never corrupt
    // what the parser reads. Library path crops; camera path is already cropped.
    const cleanUri = useCamera
      ? await enhanceDocument(rawUri).catch(() => rawUri)
      : await flattenDocument(rawUri).catch(() => rawUri);
    if (cleanUri !== rawUri) setImageUri(cleanUri);
    try {
      const parsed = await activeParser(rawUri);
      if (parsed.items.length === 0 && parsed.total === 0) {
        setParsing(false);
        setImageUri(null);
        setNotReceiptMode(true);
        return true;
      }
      // Read live from the store: startNewBill (widget path) mutates people
      // after this handler's closure captured the render-time roster.
      const allIds = useBillStore.getState().people.map((p) => p.id);
      const receipt = {
        ...parsed,
        items: parsed.items.map((item) =>
          item.id === 'auto-surcharge' || item.id === 'auto-fee' || item.price < 0
            ? { ...item, assignedTo: allIds }
            : item
        ),
      };
      setReceipt(receipt);
      setReceiptImageUri(cleanUri);
      setParsing(false);
      await routeAfterParse(receipt);
    } catch (err) {
      setParsing(false);
      setImageUri(null);
      setNotReceiptMode(true);
      setScanErrorOpen(true);
      console.error('Receipt parse error:', err);
    }
    return true;
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
          const builtReceipt = {
            ...parsed,
            items: parsed.items.map((item) =>
              item.id === 'auto-surcharge' || item.id === 'auto-fee'
                ? { ...item, assignedTo: allIds }
                : item
            ),
          };
          setReceipt(builtReceipt);
          setReceiptImageUri(uri);
          setParsing(false);
          routeAfterParse(builtReceipt);
        })
        .catch((err) => {
          setParsing(false);
          setImageUri(null);
          setIsRetakeMode(true);
          setScanErrorOpen(true);
          console.error('Receipt parse error:', err);
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Entered from the + dial with an intent → fire the picker.
  // Wait for the screen transition to finish first — presenting the native
  // camera/scanner mid-transition makes it flash open then go black.
  useEffect(() => {
    if ((source !== 'camera' && source !== 'library') || sourceFired.current) return;
    sourceFired.current = true;
    const task = InteractionManager.runAfterInteractions(async () => {
      // Widget deep links land here directly (unlike the in-app dial, which calls
      // startNewBill first). Reset + seed the host so a warm start doesn't carry
      // the previous roster and a cold start isn't left with no host at all.
      await startNewBill();
      let picked = false;
      try {
        picked = await pickImage(source === 'camera');
      } catch {
        picked = false; // some scanner cancels reject instead of resolving empty
      }
      // Cancelled before picking anything: get out of this now-dead screen. A
      // widget COLD-start has no back stack (canGoBack === false), so it was
      // stranding the user on a spinner — fall back to Home in that case.
      if (!picked) {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }
    });
    return () => task.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (demo !== 'true' || demoFired.current) return;
    demoFired.current = true;
    setReceipt(mockReceipt);
    setIsDemoMode(true);
    setParsing(true);
    const t = setTimeout(() => setParsing(false), 1800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDemo = () => {
    setReceipt(mockReceipt);
    setIsDemoMode(true);
    router.push('/split-method');
  };

  const routeAfterParse = async (parsed: typeof receipt) => {
    if (!parsed) return;
    let tip = parsed.tip;
    if (tip === 0 && !parsed.tipIsFromReceipt) {
      const val = await AsyncStorage.getItem(DEFAULT_TIP_KEY);
      if (val) {
        const pct = parseFloat(val);
        tip = parseFloat((parsed.subtotal * pct).toFixed(2));
        updateTip(tip);
        updateReceiptField('total', parseFloat((parsed.subtotal + parsed.tax + (parsed.fees ?? 0) + tip).toFixed(2)));
      }
    }
    router.push('/split-method');
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
          <View style={styles.receiptSection}>
            <View style={[styles.previewWrapper, parsing && styles.previewWrapperParsing]}>
              <DigitizedReceipt
                parsing={parsing}
                receipt={receipt}
                imageUri={imageUri}
                maxHeight={SCREEN_H - insets.top - insets.bottom - 90 - 80 - 56 - 16}
              />
              {!parsing && !isDemoMode && (
                <TouchableOpacity style={styles.retakeBtn} onPress={() => openSheet()}>
                  <Text style={styles.retakeBtnText}>Retake</Text>
                </TouchableOpacity>
              )}
            </View>
            {parsing && (
              <View style={styles.shimmerContainer}>
                <ShimmerText text="Analyzing receipt" active={parsing} />
              </View>
            )}
          </View>
        ) : notReceiptMode || isRetakeMode ? (
          <View style={styles.notReceiptArea}>
            <View style={styles.notReceiptCard}>
              <Ionicons name="document-outline" size={52} color={C.faint} />
              <Text style={styles.notReceiptQuestion}>?</Text>
            </View>
            <Text style={styles.notReceiptText}>
              {notReceiptMode ? "Doesn't look like a receipt." : "Couldn't read the receipt."}
            </Text>
          </View>
        ) : (
          <View style={styles.launcher}>
            <ActivityIndicator color={C.faint} />
            <Text style={styles.launcherText}>Opening {source === 'library' ? 'library' : 'camera'}…</Text>
          </View>
        )}

        <View style={styles.footer}>
          {(imageUri || isDemoLoaded) && !parsing ? (
            receipt && (
              <TouchableOpacity style={styles.continueBtn} onPress={() => { if (continueLock.current) return; continueLock.current = true; router.push('/split-method'); setTimeout(() => { continueLock.current = false; }, 600); }} activeOpacity={0.85}>
                <Text style={styles.continueBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color={C.bg} />
              </TouchableOpacity>
            )
          ) : isRetakeMode || notReceiptMode ? (
            <View style={styles.retakeActions}>
              <TouchableOpacity style={styles.retakeIconBtn} onPress={() => pickImage(true)} activeOpacity={0.75}>
                <Ionicons name="camera-outline" size={22} color={C.bg} />
                <Text style={styles.retakeIconBtnLabel}>Take New Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.retakeIconBtn, styles.retakeIconBtnSecondary]} onPress={() => pickImage(false)} activeOpacity={0.75}>
                <Ionicons name="image-outline" size={22} color={C.text} />
                <Text style={[styles.retakeIconBtnLabel, styles.retakeIconBtnLabelSecondary]}>Select New Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { reset(); router.replace('/'); }} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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
                <Ionicons name="camera-outline" size={22} color={C.text} />
                <Text style={styles.sheetBtnText}>Take New Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnSecondary]} onPress={() => closeSheet(() => pickImage(false))} activeOpacity={0.75}>
                <Ionicons name="image-outline" size={22} color={C.text} />
                <Text style={styles.sheetBtnText}>Choose from Library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => closeSheet()}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

      </View>

      <ActionSheet
        visible={scanErrorOpen}
        title="Scan Failed"
        message="Could not read the receipt. Please try again or use a clearer photo."
        onClose={() => setScanErrorOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
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
    color: C.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: C.faint,
  },
  launcher: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  launcherText: {
    fontSize: 14,
    color: C.faint,
  },
  receiptSection: {
    gap: 12,
    marginBottom: 16,
  },
  previewWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '82%',
  },
  previewWrapperParsing: {
    minHeight: 300,
  },
  shimmerContainer: {
    alignItems: 'center',
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
    borderColor: C.line,
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
    color: C.text,
  },
  demoLoadedSub: {
    fontSize: 14,
    color: C.faint,
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
    backgroundColor: C.text,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notReceiptQuestion: {
    fontSize: 28,
    fontWeight: '700',
    color: C.faint,
    marginTop: 4,
  },
  notReceiptText: {
    fontSize: 16,
    color: C.dim,
    textAlign: 'center',
  },
  retakeActions: {
    gap: 12,
  },
  retakeIconBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: C.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  retakeIconBtnSecondary: {
    backgroundColor: C.card,
  },
  retakeIconBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: C.bg,
  },
  retakeIconBtnLabelSecondary: {
    color: C.text,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeBtnText: {
    fontSize: 15,
    color: C.faint,
    fontWeight: '500',
  },
  footer: {
    marginTop: 16,
  },
  continueBtn: {
    height: 54, borderRadius: 15, backgroundColor: C.text,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  continueBtnText: { fontSize: 16.5, fontWeight: '700', color: C.bg },
  sheetBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.scrim,
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#26262B',
    gap: 10,
    borderWidth: 0.5,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.faint,
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
    color: C.text,
  },
  sheetCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 2,
  },
  sheetCancelText: {
    fontSize: 15,
    color: C.faint,
    fontWeight: '500',
  },
});
