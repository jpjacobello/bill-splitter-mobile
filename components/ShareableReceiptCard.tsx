import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PersonBreakdown, Receipt } from '../types';
import { getEmoji } from '../utils/buildReceiptHtml';

type Props = {
  receipt: Receipt;
  person?: PersonBreakdown;
  allPeople?: PersonBreakdown[];
};

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.rowBold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowBold]}>{value}</Text>
    </View>
  );
}

function formatReceiptDate(date: string): string {
  const normalized = date.replace(/\//g, '-');
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized + 'T00:00' : normalized);
  if (isNaN(d.getTime())) return date;
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

// Per-person card
function PersonCard({ breakdown: b, receipt }: { breakdown: PersonBreakdown; receipt: Receipt }) {
  return (
    <>
      <Text style={styles.merchant}>{receipt.merchantName?.toUpperCase() || 'RECEIPT'}</Text>
      {receipt.date && (
        <Text style={styles.meta}>{formatReceiptDate(receipt.date)}</Text>
      )}
      <Divider />
      <Text style={styles.personName}>{b.person.name}{b.person.isHost ? ' · paid' : ''}</Text>
      <Divider />
      {b.assignedItems.map(({ item, share }, i) => (
        <Row key={i} label={`${getEmoji(item.name)} ${item.name}`} value={`$${share.toFixed(2)}`} />
      ))}
      <Divider />
      <Row label="Subtotal" value={`$${b.subtotal.toFixed(2)}`} />
      <Row label="Tax" value={`$${b.taxShare.toFixed(2)}`} />
      {b.feesShare > 0 && <Row label="Fees" value={`$${b.feesShare.toFixed(2)}`} />}
      <Row label="Tip" value={`$${b.tipShare.toFixed(2)}`} />
      <Divider double />
      <Row label="YOU OWE" value={`$${b.totalOwed.toFixed(2)}`} bold />
    </>
  );
}

// Full summary card
function FullCard({ allPeople, receipt }: { allPeople: PersonBreakdown[]; receipt: Receipt }) {
  return (
    <>
      <Text style={styles.merchant}>{receipt.merchantName?.toUpperCase() || 'RECEIPT'}</Text>
      {receipt.date && (
        <Text style={styles.meta}>{formatReceiptDate(receipt.date)}</Text>
      )}
      <Divider />
      {allPeople.map((b, i) => (
        <Row
          key={i}
          label={`${b.person.name}${b.person.isHost ? ' (paid)' : ''}`}
          value={`$${b.totalOwed.toFixed(2)}`}
        />
      ))}
      <Divider double />
      <Row label="TOTAL" value={`$${receipt.total.toFixed(2)}`} bold />
    </>
  );
}

function ReceiptOnlyCard({ receipt }: { receipt: Receipt }) {
  return (
    <>
      <Text style={styles.merchant}>{receipt.merchantName?.toUpperCase() || 'RECEIPT'}</Text>
      {receipt.date && <Text style={styles.meta}>{formatReceiptDate(receipt.date)}</Text>}
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
  );
}

const ShareableReceiptCard = forwardRef<View, Props>(({ receipt, person, allPeople }, ref) => {
  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {person ? (
        <PersonCard breakdown={person} receipt={receipt} />
      ) : allPeople ? (
        <FullCard allPeople={allPeople} receipt={receipt} />
      ) : (
        <ReceiptOnlyCard receipt={receipt} />
      )}
      <Divider />
      <Text style={styles.brand}>DIVI</Text>
    </View>
  );
});

export default ShareableReceiptCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F5F0E8',
    padding: 24,
    width: 320,
  },
  merchant: {
    fontFamily: 'Courier',
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 2,
  },
  meta: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
  personName: {
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    marginVertical: 2,
  },
  divider: {
    height: 14,
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
    fontSize: 12,
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  rowValue: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#1A1A1A',
  },
  rowBold: {
    fontWeight: '700',
    fontSize: 14,
  },
  brand: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: '#AAAAAA',
    textAlign: 'center',
    letterSpacing: 3,
    marginTop: 2,
  },
});
