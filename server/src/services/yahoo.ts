/**
 * Yahoo Finance data fetching via the public chart API.
 * This approach avoids the crumb/session mechanism that breaks on server IPs.
 */

const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        regularMarketChange?: number;
        regularMarketChangePercent?: number;
        previousClose?: number;
        currency?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: (number | null)[] }>;
      };
    }>;
    error?: { code: string; description: string };
  };
}

async function fetchChart(
  symbol: string,
  params: Record<string, string>
): Promise<YahooChartResponse | null> {
  const qs = new URLSearchParams(params).toString();
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?${qs}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; portfolio-tracker/1.0)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as YahooChartResponse;
  } catch {
    return null;
  }
}

export interface QuoteResult {
  price: number;
  dayChange: number;
  dayChangePct: number;
  previousClose: number;
}

export async function fetchQuotes(
  symbols: string[]
): Promise<Record<string, QuoteResult>> {
  const results: Record<string, QuoteResult> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      const data = await fetchChart(symbol, { interval: '1d', range: '1d' });
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice != null) {
        results[symbol] = {
          price: meta.regularMarketPrice,
          dayChange: meta.regularMarketChange ?? 0,
          dayChangePct: meta.regularMarketChangePercent ?? 0,
          previousClose: meta.previousClose ?? meta.regularMarketPrice,
        };
      }
    })
  );

  return results;
}

export async function fetchHistoricalClose(
  symbol: string,
  dateStr: string
): Promise<number | null> {
  const target = new Date(dateStr);
  // 10-day window ending the day after, to handle weekends and holidays
  const period1 = Math.floor(
    new Date(target.getTime() - 10 * 86_400_000).getTime() / 1000
  );
  const period2 = Math.floor(
    new Date(target.getTime() + 2 * 86_400_000).getTime() / 1000
  );

  const data = await fetchChart(symbol, {
    interval: '1d',
    period1: String(period1),
    period2: String(period2),
  });

  const result = data?.chart?.result?.[0];
  if (!result?.timestamp) return null;

  const timestamps = result.timestamp;
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const targetMs = target.getTime();

  // Find the last trading day on or before the target date
  let best: { close: number; dateMs: number } | null = null;
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null) continue;
    const dateMs = timestamps[i] * 1000;
    if (dateMs <= targetMs + 86_400_000) {
      if (!best || dateMs > best.dateMs) {
        best = { close, dateMs };
      }
    }
  }

  return best?.close ?? null;
}

export interface ChartBar {
  date: string;
  close: number;
}

export async function fetchChartRange(
  symbol: string,
  period1: number,
  period2: number
): Promise<ChartBar[]> {
  const data = await fetchChart(symbol, {
    interval: '1d',
    period1: String(period1),
    period2: String(period2),
  });

  const result = data?.chart?.result?.[0];
  if (!result?.timestamp) return [];

  const timestamps = result.timestamp;
  const closes = result.indicators?.quote?.[0]?.close ?? [];

  const bars: ChartBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null) continue;
    bars.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      close,
    });
  }
  return bars;
}

export async function fetchChartByRange(
  symbol: string,
  range: string
): Promise<ChartBar[]> {
  const data = await fetchChart(symbol, { interval: '1d', range });
  const result = data?.chart?.result?.[0];
  if (!result?.timestamp) return [];

  const timestamps = result.timestamp;
  const closes = result.indicators?.quote?.[0]?.close ?? [];

  const bars: ChartBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null) continue;
    bars.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      close,
    });
  }
  return bars;
}
