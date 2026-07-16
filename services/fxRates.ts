import AsyncStorage from '@react-native-async-storage/async-storage';

// FX rates for convert-on-scan (Pro). Source: open.er-api.com — free, no API
// key (deliberately: keyless avoids the EAS EXPO_PUBLIC env-var pitfalls), ~160
// currencies, updated daily. We cache the whole base table in AsyncStorage and
// only refetch when it's stale (>~24h) or missing the target code, so a normal
// session makes zero network calls.

const CACHE_KEY = 'fxRateTable';
const TTL_MS = 24 * 60 * 60 * 1000; // rates move slowly; one fetch/day is plenty

type RateTable = {
  fetchedAt: number; // ms epoch when we stored it
  base: string; // base currency the rates are relative to
  rates: Record<string, number>; // 1 base = rates[code] of that currency
};

let memo: RateTable | null = null; // in-memory cache for the session

async function loadCache(): Promise<RateTable | null> {
  if (memo) return memo;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    memo = JSON.parse(raw) as RateTable;
    return memo;
  } catch {
    return null;
  }
}

async function fetchTable(base: string, now: number): Promise<RateTable | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.result !== 'success' || !data.rates) return null;
    const table: RateTable = { fetchedAt: now, base, rates: data.rates };
    memo = table;
    try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(table)); } catch {}
    return table;
  } catch {
    return null; // offline / API down — caller keeps the original currency
  }
}

/**
 * How many `to` units 1 `from` unit is worth (e.g. getRate('JPY','USD') ≈ 0.0066).
 * Returns null on network failure or an unknown code — callers must treat null
 * as "conversion unavailable" and leave amounts untouched. Never throws.
 *
 * `now` is injectable so tests can control staleness (default: real clock — only
 * called from app code, never from a workflow sandbox).
 */
export async function getRate(from: string, to: string, now: number = Date.now()): Promise<number | null> {
  if (!from || !to) return null;
  if (from === to) return 1;

  let table = await loadCache();
  const stale = !table || now - table.fetchedAt > TTL_MS;
  const missing = !!table && (table.rates[from] == null || table.rates[to] == null);
  if (stale || missing) {
    const fresh = await fetchTable('USD', now); // USD base covers all pairs via cross-rate
    if (fresh) table = fresh;
  }
  if (!table) return null;

  const rFrom = table.rates[from];
  const rTo = table.rates[to];
  if (rFrom == null || rTo == null || rFrom === 0) return null;
  // rates are per-1-base(USD): 1 from = (1/rFrom) base, = rTo/rFrom of `to`.
  return rTo / rFrom;
}
