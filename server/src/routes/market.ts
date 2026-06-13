import { Router, Request, Response } from 'express';
import { TTLCache } from '../services/cache.js';
import { fetchQuotes, fetchHistoricalClose, fetchChartRange, fetchChartByRange, type QuoteResult } from '../services/yahoo.js';

const router = Router();

export interface QuoteEntry {
  price: number;
  dayChange: number;
  dayChangePct: number;
  previousClose: number;
  source: 'yahoo' | 'fmp' | 'unavailable';
  stale: boolean;
}

const quoteCache = new TTLCache<QuoteEntry>();
const historyCache = new TTLCache<number | null>();
const chartCache = new TTLCache<Array<{ date: string; close: number }>>();

const QUOTE_TTL_MS = 30 * 60 * 1000;
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
const CHART_TTL_MS = 30 * 60 * 1000;

async function tryFmpQuote(symbol: string): Promise<number | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/quote-short/${symbol}?apikey=${apiKey}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ price?: number }>;
    return data?.[0]?.price ?? null;
  } catch {
    return null;
  }
}

router.get('/quote', async (req: Request, res: Response) => {
  const symbolsParam = req.query.symbols as string | undefined;
  if (!symbolsParam?.trim()) {
    res.status(400).json({ error: 'symbols query parameter is required' });
    return;
  }

  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const result: Record<string, QuoteEntry> = {};
  const toFetch: string[] = [];

  for (const sym of symbols) {
    const cached = quoteCache.get(sym);
    if (cached) {
      result[sym] = cached;
    } else {
      toFetch.push(sym);
    }
  }

  if (toFetch.length > 0) {
    const prices = await fetchQuotes(toFetch);

    for (const sym of toFetch) {
      const q = prices[sym];
      if (q != null) {
        const entry: QuoteEntry = { ...q, source: 'yahoo', stale: false };
        quoteCache.set(sym, entry, QUOTE_TTL_MS);
        result[sym] = entry;
      } else {
        // Attempt FMP fallback (price only — no day-change data from free tier)
        const fmpPrice = await tryFmpQuote(sym);
        if (fmpPrice != null) {
          const entry: QuoteEntry = {
            price: fmpPrice,
            dayChange: 0,
            dayChangePct: 0,
            previousClose: fmpPrice,
            source: 'fmp',
            stale: false,
          };
          quoteCache.set(sym, entry, QUOTE_TTL_MS);
          result[sym] = entry;
        } else {
          result[sym] = {
            price: 0,
            dayChange: 0,
            dayChangePct: 0,
            previousClose: 0,
            source: 'unavailable',
            stale: true,
          };
        }
      }
    }
  }

  res.json(result);
});

router.get('/history', async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string | undefined)?.trim().toUpperCase();
  const date = (req.query.date as string | undefined)?.trim();

  if (!symbol || !date) {
    res.status(400).json({ error: 'symbol and date query parameters are required' });
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    return;
  }

  const cacheKey = `${symbol}:${date}`;
  const cached = historyCache.get(cacheKey);
  if (cached !== undefined) {
    res.json({ symbol, date, price: cached });
    return;
  }

  const price = await fetchHistoricalClose(symbol, date);
  historyCache.set(cacheKey, price, HISTORY_TTL_MS);
  res.json({ symbol, date, price });
});

router.get('/chart', async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string | undefined)?.trim().toUpperCase();
  const range = (req.query.range as string | undefined)?.trim();
  const start = (req.query.start as string | undefined)?.trim();
  const end = (req.query.end as string | undefined)?.trim();

  if (!symbol) {
    res.status(400).json({ error: 'symbol query parameter is required' });
    return;
  }

  const cacheKey = range
    ? `${symbol}:range:${range}`
    : `${symbol}:${start}:${end}`;

  const cached = chartCache.get(cacheKey);
  if (cached) {
    res.json({ symbol, data: cached });
    return;
  }

  let data: Array<{ date: string; close: number }>;

  if (range) {
    data = await fetchChartByRange(symbol, range);
  } else if (start && end) {
    const period1 = Math.floor(new Date(start + 'T00:00:00').getTime() / 1000);
    const period2 = Math.floor(new Date(end + 'T23:59:59').getTime() / 1000);
    data = await fetchChartRange(symbol, period1, period2);
  } else {
    res.status(400).json({ error: 'Provide range or start+end query parameters' });
    return;
  }

  chartCache.set(cacheKey, data, CHART_TTL_MS);
  res.json({ symbol, data });
});

export default router;
