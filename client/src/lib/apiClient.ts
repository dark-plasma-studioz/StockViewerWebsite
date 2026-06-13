import type { ChartDataPoint } from '../types';

export async function fetchQuotes(
  symbols: string[]
): Promise<Record<string, import('../types').QuoteData>> {
  if (symbols.length === 0) return {};

  const res = await fetch(`/api/quote?symbols=${symbols.join(',')}`);
  if (!res.ok) throw new Error(`Quote fetch failed: ${res.status}`);

  const raw: Record<
    string,
    {
      price: number;
      dayChange: number;
      dayChangePct: number;
      previousClose: number;
      source: 'yahoo' | 'fmp' | 'unavailable';
      stale: boolean;
    }
  > = await res.json();
  const now = Date.now();

  return Object.fromEntries(
    Object.entries(raw).map(([sym, entry]) => [
      sym,
      { ...entry, fetchedAt: now },
    ])
  );
}

export async function fetchHistoricalPrice(
  symbol: string,
  date: string
): Promise<number | null> {
  const res = await fetch(`/api/history?symbol=${symbol}&date=${date}`);
  if (!res.ok) return null;
  const data: { price: number | null } = await res.json();
  return data.price;
}

export async function fetchChartHistory(
  symbol: string,
  options: { range?: string; start?: string; end?: string }
): Promise<ChartDataPoint[]> {
  const params = new URLSearchParams({ symbol });
  if (options.range) {
    params.set('range', options.range);
  } else if (options.start && options.end) {
    params.set('start', options.start);
    params.set('end', options.end);
  } else {
    params.set('range', '1mo');
  }

  const res = await fetch(`/api/chart?${params}`);
  if (!res.ok) return [];
  const data: { data: ChartDataPoint[] } = await res.json();
  return data.data ?? [];
}
