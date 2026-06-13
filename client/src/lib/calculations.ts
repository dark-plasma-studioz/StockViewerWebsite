import type { Holding, QuoteData, HoldingWithStats, PortfolioStats, Snapshot } from '../types';

export function computeHoldingStats(
  holding: Holding,
  quoteData?: QuoteData
): HoldingWithStats {
  if (holding.status === 'sold') {
    const proceeds = holding.soldProceedsCAD ?? 0;
    const realizedGain = proceeds - holding.amountInvestedCAD;
    const realizedGainPct =
      holding.amountInvestedCAD > 0
        ? (realizedGain / holding.amountInvestedCAD) * 100
        : 0;
    return {
      ...holding,
      currentValue: proceeds,
      gainLoss: realizedGain,
      gainLossPct: realizedGainPct,
      realizedGain,
      realizedGainPct,
    };
  }

  const purchasePrice =
    holding.purchasePriceOverride ?? holding.effectivePurchasePrice;

  const currentPrice = holding.manualPriceOverride ?? quoteData?.price;
  const priceStale = !holding.manualPriceOverride && (quoteData?.stale ?? false);
  const priceUnavailable =
    !holding.manualPriceOverride &&
    (quoteData == null || quoteData.source === 'unavailable');
  const dayChange = !holding.manualPriceOverride ? quoteData?.dayChange : undefined;
  const dayChangePct = !holding.manualPriceOverride ? quoteData?.dayChangePct : undefined;

  if (purchasePrice == null || purchasePrice <= 0 || currentPrice == null || currentPrice <= 0) {
    return { ...holding, currentPrice, priceStale, priceUnavailable, dayChange, dayChangePct };
  }

  const units =
    holding.shares ??
    (purchasePrice != null && purchasePrice > 0
      ? holding.amountInvestedCAD / purchasePrice
      : undefined);
  if (units == null || units <= 0) {
    return { ...holding, currentPrice, priceStale, priceUnavailable, dayChange, dayChangePct };
  }

  const currentValue = units * currentPrice;
  const gainLoss = currentValue - holding.amountInvestedCAD;
  const gainLossPct = (gainLoss / holding.amountInvestedCAD) * 100;

  return {
    ...holding,
    currentPrice,
    units,
    currentValue,
    gainLoss,
    gainLossPct,
    priceStale,
    priceUnavailable,
    dayChange,
    dayChangePct,
  };
}

export function computeWeightedReturnPct(holdings: HoldingWithStats[]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const h of holdings) {
    if (h.status !== 'active' || h.gainLossPct == null) continue;
    weightedSum += h.gainLossPct * h.amountInvestedCAD;
    totalWeight += h.amountInvestedCAD;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

export function computeTotalRealizedGain(holdings: HoldingWithStats[]): number {
  return holdings
    .filter((h) => h.status === 'sold')
    .reduce((sum, h) => sum + (h.realizedGain ?? 0), 0);
}

/**
 * Time-weighted return index update.
 * New purchases (cash flows) do not spike the return curve.
 */
export function computeSnapshotReturn(
  prev: Snapshot | undefined,
  totalValue: number,
  totalInvested: number
): { returnIndex: number; returnPct: number } {
  if (!prev || prev.returnIndex == null) {
    return { returnIndex: 100, returnPct: 0 };
  }

  const cashFlow = totalInvested - prev.totalInvestedCAD;
  const prevValue = prev.totalValueCAD;

  let periodReturn = 0;
  if (prevValue > 0) {
    periodReturn = (totalValue - cashFlow - prevValue) / prevValue;
  }

  const returnIndex = (prev.returnIndex ?? 100) * (1 + periodReturn);
  const returnPct = (returnIndex / 100 - 1) * 100;

  return { returnIndex, returnPct };
}

export function computePortfolioStats(holdings: HoldingWithStats[]): PortfolioStats {
  const active = holdings.filter((h) => h.status === 'active');
  const sold = holdings.filter((h) => h.status === 'sold');

  const totalInvested = active.reduce((sum, h) => sum + h.amountInvestedCAD, 0);
  const totalValue = active.reduce(
    (sum, h) => sum + (h.currentValue ?? h.amountInvestedCAD),
    0
  );
  const totalGainLoss = totalValue - totalInvested;
  const totalGainLossPct =
    totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;
  const totalRealizedGain = sold.reduce(
    (sum, h) => sum + (h.realizedGain ?? 0),
    0
  );

  return {
    totalInvested,
    totalValue,
    totalGainLoss,
    totalGainLossPct,
    totalRealizedGain,
    activeCount: active.length,
    soldCount: sold.length,
  };
}

export function formatCAD(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Re-baseline return % series so the first point in the range is 0% */
export function rebaseReturnSeries(
  points: Array<{ date: string; returnPct: number }>
): Array<{ date: string; returnPct: number }> {
  if (points.length === 0) return [];
  const baseline = points[0].returnPct;
  return points.map((p) => ({
    date: p.date,
    returnPct: p.returnPct - baseline,
  }));
}

/** Convert price series to % change from first price */
export function pricesToReturnSeries(
  points: Array<{ date: string; close: number }>
): Array<{ date: string; returnPct: number }> {
  if (points.length === 0) return [];
  const base = points[0].close;
  if (base <= 0) return [];
  return points.map((p) => ({
    date: p.date,
    returnPct: ((p.close / base) - 1) * 100,
  }));
}

/** Personal return % at each price point given purchase price (only on/after purchaseDate) */
export function personalReturnSeries(
  points: Array<{ date: string; close: number }>,
  purchasePrice: number,
  purchaseDate: string
): Array<{ date: string; returnPct: number | null }> {
  if (purchasePrice <= 0) return [];
  return points.map((p) => ({
    date: p.date,
    returnPct:
      p.date >= purchaseDate
        ? ((p.close / purchasePrice) - 1) * 100
        : null,
  }));
}
