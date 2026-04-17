import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../components/Button';
import { useBillStore } from '../store/useBillStore';
import { mockReceipt, mockPeople } from '../data/mockData';

const HAS_LAUNCHED_KEY = 'hasLaunched';
const SAVED_NAME_KEY = 'savedHostName';

export default function StartScreen() {
  const router = useRouter();
  const { setReceipt, setHostName, addPerson, reset, setPendingImageUri } = useBillStore();
  const [isReturningUser, setIsReturningUser] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<'scan' | 'options'>('scan');

  const scanOpacity = useRef(new Animated.Value(1)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(12)).current;
  const nameInputRef = useRef<TextInput>(null);
  useEffect(() => {
    AsyncStorage.multiGet([HAS_LAUNCHED_KEY, SAVED_NAME_KEY]).then(([launched, savedName]) => {
      setIsReturningUser(launched[1] === 'true');
      if (savedName[1]) setName(savedName[1]);
    });
  }, []);

  const transitionToOptions = () => {
    Animated.timing(scanOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setPhase('options');
      Animated.parallel([
        Animated.timing(optionsOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(optionsTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleScanReceipt = async () => {
    reset();
    if (isReturningUser) {
      const savedName = await AsyncStorage.getItem(SAVED_NAME_KEY);
      if (savedName) setHostName(savedName);
    } else {
      if (!name.trim()) return;
      setHostName(name.trim());
      await Promise.all([
        AsyncStorage.setItem(SAVED_NAME_KEY, name.trim()),
        AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true'),
      ]);
    }
    transitionToOptions();
  };

  const handleDemo = () => {
    reset();
    setHostName(name.trim() || 'You');
    mockPeople.filter((p) => !p.isHost).forEach((p) => addPerson(p.name));
    setReceipt(mockReceipt);
    router.push({ pathname: '/receipt-upload', params: { demo: 'true' } });
  };

  const openPicker = async (useCamera: boolean) => {
    const { status } = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
      router.push({ pathname: '/receipt-upload', params: { isReturning: 'true' } });
    }
  };

  if (isReturningUser === null) return null;

  const handleDevReset = async () => {
    await AsyncStorage.multiRemove([HAS_LAUNCHED_KEY, SAVED_NAME_KEY]);
    reset();
    setIsReturningUser(false);
    setName('');
    setPhase('scan');
    scanOpacity.setValue(1);
    optionsOpacity.setValue(0);
    optionsTranslateY.setValue(12);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.inner}>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')} activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={22} color="#888" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.devReset} onPress={handleDevReset} activeOpacity={1} />

        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>DIVI</Text>
          </View>
          <Text style={styles.title}>Split the bill,{'\n'}not the{'\n'}friendship.</Text>
          <Text style={styles.subtitle}>
            Scan a receipt, assign items,{'\n'}and settle up in seconds.
          </Text>
        </View>

        <View style={styles.actions}>
          {phase === 'scan' ? (
            <Animated.View style={{ opacity: scanOpacity, alignSelf: 'stretch', gap: 12 }}>
              {!isReturningUser && (
                <TextInput
                  ref={nameInputRef}
                  style={styles.nameInput}
                  placeholder="Your name"
                  placeholderTextColor="#777"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              )}
              <Button
                label="Scan Receipt"
                onPress={handleScanReceipt}
                disabled={!isReturningUser && !name.trim()}
              />
              {!isReturningUser && (
                <TouchableOpacity
                  onPress={name.trim() ? handleDemo : undefined}
                  activeOpacity={0.6}
                  style={styles.demoLink}
                >
                  <Text style={[styles.demoLinkText, !name.trim() && styles.demoLinkDisabled]}>
                    Try Demo Receipt
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          ) : (
            <Animated.View style={[
              styles.optionsWrapper,
              { opacity: optionsOpacity, transform: [{ translateY: optionsTranslateY }] },
            ]}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => openPicker(true)} activeOpacity={0.75}>
                <Ionicons name="camera-outline" size={22} color="#000" />
                <Text style={styles.iconBtnLabel}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnSecondary]} onPress={() => openPicker(false)} activeOpacity={0.75}>
                <Ionicons name="image-outline" size={22} color="#D0D0D0" />
                <Text style={[styles.iconBtnLabel, styles.iconBtnLabelSecondary]}>Select Image</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

      </View>
      </TouchableWithoutFeedback>
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
    paddingBottom: 40,
    justifyContent: 'flex-end',
  },
  hero: {
    marginBottom: 48,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 3,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#D0D0D0',
    lineHeight: 50,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  actions: {
    gap: 12,
    minHeight: 180,
    justifyContent: 'flex-start',
    marginBottom: 90,
  },
  nameInput: {
    height: 52,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.13)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
  },
  optionsWrapper: {
    gap: 12,
  },
  iconBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#D8D8D8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  iconBtnSecondary: {
    backgroundColor: '#252525',
  },
  iconBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  iconBtnLabelSecondary: {
    color: '#D0D0D0',
  },
  settingsBtn: {
    position: 'absolute', top: 2, right: 4,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  devReset: {
    position: 'absolute', top: 0, left: 0,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  demoLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  demoLinkText: {
    fontSize: 15,
    color: '#666',
  },
  demoLinkDisabled: {
    color: '#333',
  },
});
