import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PersonBreakdown, Receipt } from '../types';
import { getEmoji } from '../utils/buildReceiptHtml';
import { formatCurrency } from '../utils/currency';

type Props = {
  receipt: Receipt;
  person?: PersonBreakdown;
  allPeople?: PersonBreakdown[];
  scale?: number;
  paidById?: string;
};

// Fixed parts height estimate (padding, merchant, dividers, totals, brand)
const FIXED_HEIGHT = 290;
const ROW_HEIGHT = 19;
const TARGET_HEIGHT = 680;

export function calcCardScale(itemCount: number): number {
  const estimated = FIXED_HEIGHT + itemCount * ROW_HEIGHT;
  return Math.min(1, TARGET_HEIGHT / estimated);
}

function Row({ label, value, bold, sc }: { label: string; value: string; bold?: boolean; sc: (n: number) => number }) {
  return (
    <View style={[styles.row, { marginBottom: sc(3) }]}>
      <Text style={[styles.rowLabel, bold && styles.rowBold, { fontSize: sc(bold ? 14 : 12) }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowBold, { fontSize: sc(bold ? 14 : 12) }]}>{value}</Text>
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

function Divider({ double, sc }: { double?: boolean; sc: (n: number) => number }) {
  return (
    <View style={[styles.divider, { height: sc(14), marginVertical: sc(4) }]}>
      <Text style={[styles.dividerText, { fontSize: sc(10) }]}>
        {double ? '═'.repeat(28) : DASHES}
      </Text>
    </View>
  );
}

// Per-person card
function PersonCard({ breakdown: b, receipt, sc, paidById }: { breakdown: PersonBreakdown; receipt: Receipt; sc: (n: number) => number; paidById?: string }) {
  const hasPaid = b.person.id === paidById;
  return (
    <>
      <Text style={[styles.merchant, { fontSize: sc(15), marginBottom: sc(2) }]}>{receipt.merchantName?.toUpperCase() || 'RECEIPT'}</Text>
      {receipt.date && <Text style={[styles.meta, { fontSize: sc(11) }]}>{formatReceiptDate(receipt.date)}</Text>}
      <Divider sc={sc} />
      <Text style={[styles.personName, { fontSize: sc(13), marginVertical: sc(2) }]}>{b.person.name}{hasPaid ? ' · paid' : ''}</Text>
      <Divider sc={sc} />
      {b.assignedItems.map(({ item, share }, i) => (
        <Row key={i} label={`${getEmoji(item.name)} ${item.name}`} value={`${formatCurrency(share)}`} sc={sc} />
      ))}
      <Divider sc={sc} />
      <Row label="Subtotal" value={`${formatCurrency(b.subtotal)}`} sc={sc} />
      <Row label="Tax" value={`${formatCurrency(b.taxShare)}`} sc={sc} />
      {b.feesShare > 0 && <Row label="Fees" value={`${formatCurrency(b.feesShare)}`} sc={sc} />}
      <Row label="Tip" value={`${formatCurrency(b.tipShare)}`} sc={sc} />
      <Divider double sc={sc} />
      <Row label="YOU OWE" value={`${formatCurrency(b.totalOwed)}`} bold sc={sc} />
    </>
  );
}

// Full summary card
function FullCard({ allPeople, receipt, sc, paidById }: { allPeople: PersonBreakdown[]; receipt: Receipt; sc: (n: number) => number; paidById?: string }) {
  return (
    <>
      <Text style={[styles.merchant, { fontSize: sc(15), marginBottom: sc(2) }]}>{receipt.merchantName?.toUpperCase() || 'RECEIPT'}</Text>
      {receipt.date && <Text style={[styles.meta, { fontSize: sc(11) }]}>{formatReceiptDate(receipt.date)}</Text>}
      <Divider sc={sc} />
      {allPeople.map((b, i) => {
        return <Row key={i} label={`${b.person.name}${b.person.id === paidById ? ' (paid)' : ''}`} value={`${formatCurrency(b.totalOwed)}`} sc={sc} />;
      })}
      <Divider double sc={sc} />
      <Row label="TOTAL" value={`${formatCurrency(receipt.total)}`} bold sc={sc} />
    </>
  );
}

function ReceiptOnlyCard({ receipt, sc }: { receipt: Receipt; sc: (n: number) => number }) {
  return (
    <>
      <Text style={[styles.merchant, { fontSize: sc(15), marginBottom: sc(2) }]}>{receipt.merchantName?.toUpperCase() || 'RECEIPT'}</Text>
      {receipt.date && <Text style={[styles.meta, { fontSize: sc(11) }]}>{formatReceiptDate(receipt.date)}</Text>}
      <Divider sc={sc} />
      {receipt.items.map((item, i) => (
        <Row key={i} label={`${getEmoji(item.name)} ${item.name}`} value={`${formatCurrency(item.price)}`} sc={sc} />
      ))}
      <Divider sc={sc} />
      <Row label="Subtotal" value={`${formatCurrency(receipt.subtotal)}`} sc={sc} />
      {receipt.tax > 0 && <Row label="Tax" value={`${formatCurrency(receipt.tax)}`} sc={sc} />}
      {receipt.fees > 0 && <Row label="Fees" value={`${formatCurrency(receipt.fees)}`} sc={sc} />}
      {receipt.tip > 0 && <Row label="Tip" value={`${formatCurrency(receipt.tip)}`} sc={sc} />}
      <Divider double sc={sc} />
      <Row label="TOTAL" value={`${formatCurrency(receipt.total)}`} bold sc={sc} />
    </>
  );
}

const ShareableReceiptCard = forwardRef<View, Props>(({ receipt, person, allPeople, scale = 1, paidById }, ref) => {
  const sc = (n: number) => Math.round(n * scale);
  return (
    <View ref={ref} style={[styles.card, { paddingTop: Math.max(sc(24), 52), paddingBottom: sc(24), paddingHorizontal: sc(24) }]} collapsable={false}>
      {person ? (
        <PersonCard breakdown={person} receipt={receipt} sc={sc} paidById={paidById} />
      ) : allPeople ? (
        <FullCard allPeople={allPeople} receipt={receipt} sc={sc} paidById={paidById} />
      ) : (
        <ReceiptOnlyCard receipt={receipt} sc={sc} />
      )}
      <Divider sc={sc} />
      <Text style={[styles.brand, { fontSize: sc(11), letterSpacing: sc(3), marginTop: sc(2) }]}>DIVI</Text>
    </View>
  );
});

export default ShareableReceiptCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F5F0E8',
    padding: 24,
    width: 320,
    borderRadius: 20,
    overflow: 'hidden',
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
