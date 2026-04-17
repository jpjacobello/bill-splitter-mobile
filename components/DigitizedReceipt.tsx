import { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Receipt } from '../types';
import { getEmoji } from '../utils/buildReceiptHtml';

type Props = {
  parsing: boolean;
  receipt: Receipt | null;
  onRetake: () => void;
  hideRetake?: boolean;
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

export default function DigitizedReceipt({ parsing, receipt, onRetake, hideRetake }: Props) {
  const pulse = useRef(new Animated.Value(0.4)).current;

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

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.receipt}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
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
              <Row key={i} label={`${getEmoji(item.name)} ${item.name}`} value={`$${item.price.toFixed(2)}`} />
            ))}

            <Divider />
            <Row label="Subtotal" value={`$${receipt.subtotal.toFixed(2)}`} />
            {receipt.tax > 0 && <Row label="Tax" value={`$${receipt.tax.toFixed(2)}`} />}
            {receipt.fees > 0 && <Row label="Fees" value={`$${receipt.fees.toFixed(2)}`} />}
            {receipt.tip > 0 && <Row label="Tip" value={`$${receipt.tip.toFixed(2)}`} />}
            <Divider double />
            <Row label="TOTAL" value={`$${receipt.total.toFixed(2)}`} bold />
          </>
        )}
      </ScrollView>

      {!parsing && !hideRetake && (
        <TouchableOpacity style={styles.retakeBtn} onPress={onRetake}>
          <Text style={styles.retakeBtnText}>Retake</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  scroll: {
    backgroundColor: '#F5F0E8',
    borderRadius: 12,
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
});
