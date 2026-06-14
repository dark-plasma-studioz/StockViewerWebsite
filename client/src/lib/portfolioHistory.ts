import type { Holding, Period, ChartDataPoint } from '../types';
import { fetchChartHistory } from './apiClient';
import { getPeriodStartDate } from './periods';
import { rebaseReturnSeries, todayStr } from './calculations';

function getPurchasePrice(h: Holding): number | null {
  const price = h.purchasePriceOverride ?? h.effectivePurchasePrice;
  return price != null && price > 0 ? price : null;
}

function isOwnedOnDate(h: Holding, date: string): boolean {
  if (date < h.purchaseDate) return false;
  if (h.status === 'sold' && h.soldDate && date > h.soldDate) return false;
  return true;
}

function findNearestPrior(
  chart: ChartDataPoint[] | undefined,
  date: string
): ChartDataPoint | null {
  if (!chart?.length) return null;
  let best: ChartDataPoint | null = null;
  for (const p of chart) {
    if (p.date <= date && (!best || p.date > best.date)) {
      best = p;
    }
  }
  return best;
}

async function fetchSymbolChart(
  symbol: string,
  periodStart: string,
  periodEnd: string
): Promise<ChartDataPoint[]> {
  return fetchChartHistory(symbol, { start: periodStart, end: periodEnd });
}

export interface CustomDateRange {
  start: string;
  end: string;
}

/**
 * Build portfolio return % history from live price data.
 * Each holding only contributes from its purchase date — new buys won't spike the chart.
 */
export async function buildPortfolioReturnSeries(
  holdings: Holding[],
  period: Period,
  customRange?: CustomDateRange
): Promise<Array<{ date: string; returnPct: number }>> {
  const eligible = holdings.filter((h) => getPurchasePrice(h) != null);
  if (eligible.length === 0) return [];

  const today = todayStr();
  let periodStart: string;
  let periodEnd: string;

  if (customRange) {
    periodStart = customRange.start;
    periodEnd = customRange.end;
  } else if (period === 'CUSTOM') {
    return [];
  } else {
    periodEnd = today;
    let start = getPeriodStartDate(period);
    if (period === 'MAX' || start == null) {
      start = eligible.reduce(
        (min, h) => (h.purchaseDate < min ? h.purchaseDate : min),
        eligible[0].purchaseDate
      );
    }
    periodStart = start;
  }

  if (periodStart > periodEnd) return [];

  const uniqueSymbols = [...new Set(eligible.map((h) => h.symbol))];
  const symbolCharts = new Map<string, ChartDataPoint[]>();

  await Promise.all(
    uniqueSymbols.map(async (symbol) => {
      const data = await fetchSymbolChart(symbol, periodStart, periodEnd);
      symbolCharts.set(symbol, data);
    })
  );

  const dateSet = new Set<string>();
  for (const data of symbolCharts.values()) {
    for (const p of data) {
      if (p.date >= periodStart && p.date <= periodEnd) {
        dateSet.add(p.date);
      }
    }
  }

  const dates = [...dateSet].sort();
  if (dates.length === 0) return [];

  const series: Array<{ date: string; returnPct: number }> = [];

  for (const date of dates) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const h of eligible) {
      if (!isOwnedOnDate(h, date)) continue;

      const purchasePrice = getPurchasePrice(h)!;
      const chart = symbolCharts.get(h.symbol);
      const bar = chart?.find((p) => p.date === date) ?? findNearestPrior(chart, date);
      if (!bar) continue;

      const holdingReturn = ((bar.close / purchasePrice) - 1) * 100;
      weightedSum += holdingReturn * h.amountInvestedCAD;
      totalWeight += h.amountInvestedCAD;
    }

    if (totalWeight > 0) {
      series.push({ date, returnPct: weightedSum / totalWeight });
    }
  }

  return rebaseReturnSeries(series);
}
