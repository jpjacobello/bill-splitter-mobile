import { StyleSheet, View } from 'react-native';

// Divi's signature motif: a receipt-style perforation line. Reused across the
// redesigned screens to tie the bill-splitter identity into the dark UI.
export default function Perforation({ dots = 34 }: { dots?: number }) {
  return (
    <View style={styles.perf}>
      {Array.from({ length: dots }).map((_, i) => <View key={i} style={styles.dot} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  perf: { flexDirection: 'row', justifyContent: 'space-between', overflow: 'hidden', marginVertical: 16 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.13)' },
});
