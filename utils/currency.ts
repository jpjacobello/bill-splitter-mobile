// Multi-currency display support (formatting only — no FX conversion).
// A bill is split in a single currency; everyone at the table uses the host's currency.

export type CurrencyInfo = {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  symbolAfter?: boolean; // symbol trails the amount (e.g. "12.00 kr")
  decimals?: number; // default 2
};

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵', decimals: 0 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'KRW', symbol: '₩', name: 'Korean Won', flag: '🇰🇷', decimals: 0 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', flag: '🇭🇰' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', flag: '🇳🇿' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', flag: '🇨🇭', symbolAfter: true },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', flag: '🇸🇪', symbolAfter: true },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', flag: '🇳🇴', symbolAfter: true },
];

const DEFAULT_CODE = 'USD';

// Module-level cache so non-React string builders (share text, clipboard) can
// format without threading the code through everywhere. Set at app start from
// the user's saved setting (native) or from the session doc (web recipient).
let _activeCode = DEFAULT_CODE;

export function setActiveCurrency(code: string | undefined | null): void {
  if (code && CURRENCIES.some((c) => c.code === code)) _activeCode = code;
}

export function getActiveCurrency(): string {
  return _activeCode;
}

export function currencyInfo(code?: string): CurrencyInfo {
  return (
    CURRENCIES.find((c) => c.code === (code ?? _activeCode)) ?? CURRENCIES[0]
  );
}

export function currencySymbol(code?: string): string {
  return currencyInfo(code).symbol;
}

/**
 * Format a money amount with the active (or explicitly passed) currency.
 * Pass `code` explicitly on the web recipient screen (uses the session's
 * currency); native screens rely on the module cache.
 */
export function formatCurrency(amount: number | null | undefined, code?: string): string {
  const info = currencyInfo(code);
  const decimals = info.decimals ?? 2;
  const n = (amount ?? 0).toFixed(decimals);
  return info.symbolAfter ? `${n} ${info.symbol}` : `${info.symbol}${n}`;
}
