import { SplitSummary } from '../types';
import { formatCurrency } from './currency';

type ShareOptions = {
  merchantName?: string;
  hostName?: string;
  detailed?: boolean;
};

/*
 * Short version — fits in a single iMessage bubble
 *
 * Example:
 *   🧾 Osteria Italiana
 *   Split by JP · 3 people
 *
 *   Alex   $28.40
 *   Sara   $24.10
 *   JP     $32.00  (paid)
 *
 *   Total $84.50 · via SplitTab
 */
export function buildShortSummary(summary: SplitSummary, opts: ShareOptions = {}): string {
  const { merchantName, hostName } = opts;
  const lines: string[] = [];

  lines.push(merchantName ? `🧾 ${merchantName}` : '🧾 Bill Split');
  if (hostName) lines.push(`Split by ${hostName} · ${summary.people.length} people`);
  lines.push('');

  const maxNameLen = Math.max(...summary.people.map((b) => b.person.name.length));
  for (const b of summary.people) {
    const name = b.person.name.padEnd(maxNameLen + 2);
    const amount = `${formatCurrency(b.totalOwed)}`;
    const tag = b.person.isHost ? '  (paid)' : '';
    lines.push(`${name}${amount}${tag}`);
  }

  lines.push('');
  lines.push(`Total ${formatCurrency(summary.receiptTotal)} · via SplitTab`);

  return lines.join('\n');
}

/*
 * Detailed version — includes item breakdowns per person
 *
 * Example:
 *   🧾 Osteria Italiana
 *   Split by JP · 3 people
 *   ─────────────────────
 *
 *   Alex  $28.40
 *   • Margherita Pizza   $9.00
 *   • Sparkling Water    $1.33
 *   • Subtotal $10.33 · Tax $0.93 · Tip $1.55
 *
 *   ...
 *
 *   Total $84.50 · via SplitTab
 */
export function buildDetailedSummary(summary: SplitSummary, opts: ShareOptions = {}): string {
  const { merchantName, hostName } = opts;
  const lines: string[] = [];

  lines.push(merchantName ? `🧾 ${merchantName}` : '🧾 Bill Split');
  if (hostName) lines.push(`Split by ${hostName} · ${summary.people.length} people`);
  lines.push('─────────────────────');

  for (const b of summary.people) {
    lines.push('');
    const tag = b.person.isHost ? ' (paid)' : '';
    lines.push(`${b.person.name}  ${formatCurrency(b.totalOwed)}${tag}`);

    for (const { item, share } of b.assignedItems) {
      const itemLine = `• ${item.name}`;
      const price = `${formatCurrency(share)}`;
      lines.push(`${itemLine.padEnd(28)}${price}`);
    }

    lines.push(
      `  Subtotal ${formatCurrency(b.subtotal)} · Tax ${formatCurrency(b.taxShare)} · Tip ${formatCurrency(b.tipShare)}`
    );
  }

  lines.push('');
  lines.push('─────────────────────');
  lines.push(`Total ${formatCurrency(summary.receiptTotal)} · via SplitTab`);

  if (!summary.reconciles) {
    lines.push(`⚠ Calculated ${formatCurrency(summary.calculatedTotal)}`);
  }

  return lines.join('\n');
}
