import { useEffect, useRef, useState } from 'react';
import { Animated, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Receipt } from '../types';
import { getEmoji } from '../utils/buildReceiptHtml';
import RainbowScanOverlay from './RainbowScanOverlay';
import { formatCurrency } from '../utils/currency';

type Props = {
  parsing: boolean;
  receipt: Receipt | null;
  imageUri?: string | null;
  maxHeight?: number;
};

function SkeletonLine({ width, pulse }: { width: number | `${number}%`; pulse: Animated.Value }) {
  return (
    <Animated.View
      style={[styles.skeletonLine, { width, opacity: pulse }]}
    />
  );
}

function formatReceiptDate(date: string): string {
  // Normalize separators so "2024/01/15" and "2024-01-15" both work
  const normalized = date.replace(/\//g, '-');
  // Parse as local date by appending T00:00 to avoid UTC rollback
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized + 'T00:00' : normalized);
  if (isNaN(d.getTime())) return date; // fall back to raw string
  return d.toLocaleDateString();
}

const DASHES = '- - - - - - - - - - - - - - - - - - -';

function Divider({ double }: { double?: boolean }) {
  if (double) {
    return (
      <View style={styles.divider}>
        <Text style={styles.dividerText}>{'═'.repeat(28)}</Text>
      </View>
    );
  }
  return (
    <View style={styles.divider}>
      <Text style={styles.dividerText}>{DASHES}</Text>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.rowBold]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowBold]}>{value}</Text>
    </View>
  );
}

export default function DigitizedReceipt({ parsing, receipt, imageUri, maxHeight }: Props) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  const [contentH, setContentH] = useState<number | undefined>(undefined);
  const [wrapperH, setWrapperH] = useState(320);
  const [wrapperW, setWrapperW] = useState(0);
  const [photoAspect, setPhotoAspect] = useState<number | null>(null);

  // Measure the real image ratio so the preview box hugs the receipt instead of
  // letterboxing it with cream side bands.
  useEffect(() => {
    if (!imageUri) { setPhotoAspect(null); return; }
    let cancelled = false;
    Image.getSize(imageUri, (w, h) => { if (!cancelled && h > 0) setPhotoAspect(w / h); }, () => {});
    return () => { cancelled = true; };
  }, [imageUri]);

  useEffect(() => {
    if (!parsing) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [parsing]);

  // While scanning, show the real captured photo (raw → whitened by flattenDocument)
  // with the scan line sweeping over it. Skeleton is the fallback (demo has no photo).
  if (parsing && imageUri) {
    const boxH = maxHeight ? Math.min(maxHeight, 460) : 380;
    // Contain the whole receipt inside the available width AND height — no
    // overflow (over-zoom), no crop. The box hugs the image so there are no
    // cream side bands either. Falls back to full width until measured.
    let dims: { width: number | `${number}%`; height: number } = { width: '100%', height: boxH };
    if (photoAspect && wrapperW > 0) {
      let w = wrapperW;
      let h = wrapperW / photoAspect;
      if (h > boxH) { h = boxH; w = boxH * photoAspect; }
      dims = { width: w, height: h };
    }
    return (
      <View
        style={{ flexShrink: 1, alignItems: 'center' }}
        onLayout={(e) => { setWrapperH(e.nativeEvent.layout.height); setWrapperW(e.nativeEvent.layout.width); }}
      >
        <View style={[styles.photoWrap, dims]}>
          <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
        </View>
        <RainbowScanOverlay height={wrapperH} />
      </View>
    );
  }

  return (
    <View style={{ flexShrink: 1, backgroundColor: 'transparent' }} onLayout={(e) => setWrapperH(e.nativeEvent.layout.height)}>
    <ScrollView
      style={[styles.scroll, maxHeight !== undefined && { maxHeight, flexGrow: 0 }]}
      contentContainerStyle={styles.receipt}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!!contentH && !!maxHeight && contentH > maxHeight}
      onContentSizeChange={(_, h) => setContentH(h)}
    >
      {parsing || !receipt ? (
          // Skeleton state
          <>
            <SkeletonLine width="55%" pulse={pulse} />
            <SkeletonLine width="35%" pulse={pulse} />
            <Divider />
            {[...Array(5)].map((_, i) => (
              <SkeletonLine key={i} width={`${60 + (i % 3) * 10}%`} pulse={pulse} />
            ))}
            <Divider />
            <SkeletonLine width="70%" pulse={pulse} />
            <SkeletonLine width="70%" pulse={pulse} />
            <Divider double />
            <SkeletonLine width="75%" pulse={pulse} />
          </>
        ) : (
          // Real receipt data
          <>
            <Text style={styles.merchant}>
              {receipt.merchantName?.toUpperCase() || 'RECEIPT'}
            </Text>
            {receipt.date && (
              <Text style={styles.meta}>{formatReceiptDate(receipt.date)}</Text>
            )}
            <Divider />

            {receipt.items.map((item, i) => (
              <Row key={i} label={`${getEmoji(item.name)} ${item.name}`} value={`${formatCurrency(item.price)}`} />
            ))}

            <Divider />
            <Row label="Subtotal" value={`${formatCurrency(receipt.subtotal)}`} />
            {receipt.tax > 0 && <Row label="Tax" value={`${formatCurrency(receipt.tax)}`} />}
            {receipt.fees > 0 && <Row label="Fees" value={`${formatCurrency(receipt.fees)}`} />}
            {receipt.tip > 0 && <Row label="Tip" value={`${formatCurrency(receipt.tip)}`} />}
            <Divider double />
            <Row label="TOTAL" value={`${formatCurrency(receipt.total)}`} bold />
          </>
        )}
    </ScrollView>
    {parsing && <RainbowScanOverlay height={wrapperH} />}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: '#F5F0E8',
    borderRadius: 20,
  },
  photoWrap: {
    width: '100%',
    backgroundColor: '#F5F0E8',
    borderRadius: 20,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  receipt: {
    padding: 20,
    paddingBottom: 28,
  },
  merchant: {
    fontFamily: 'Courier',
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  meta: {
    fontFamily: 'Courier',
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  divider: {
    height: 12,
    overflow: 'hidden',
    marginVertical: 4,
  },
  dividerText: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: '#C8BEAE',
    letterSpacing: 1,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  rowLabel: {
    fontFamily: 'Courier',
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  rowValue: {
    fontFamily: 'Courier',
    fontSize: 14,
    color: '#1A1A1A',
  },
  rowBold: {
    fontWeight: '700',
    fontSize: 15,
  },
  skeletonLine: {
    height: 10,
    backgroundColor: '#C8BEAE',
    borderRadius: 4,
    marginBottom: 8,
  },
});
