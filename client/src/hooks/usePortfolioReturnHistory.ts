import { useState, useEffect } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { buildPortfolioReturnSeries, type CustomDateRange } from '../lib/portfolioHistory';
import type { Period } from '../types';

export function usePortfolioReturnHistory(
  period: Period,
  customRange?: CustomDateRange | null
) {
  const activeProfileId = usePortfolioStore((s) => s.activeProfileId);
  const holdings = usePortfolioStore((s) => s.holdings);
  const [data, setData] = useState<Array<{ date: string; returnPct: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const profileHoldings = holdings.filter((h) => h.profileId === activeProfileId);
  const holdingsKey = profileHoldings
    .map((h) => `${h.id}:${h.symbol}:${h.purchaseDate}:${h.status}`)
    .join('|');

  const rangeKey = customRange ? `${customRange.start}:${customRange.end}` : '';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (profileHoldings.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      if (period === 'CUSTOM' && !customRange) {
        setData([]);
        setLoading(false);
        return;
      }

      if (customRange && (!customRange.start || !customRange.end)) {
        setData([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const series = await buildPortfolioReturnSeries(
          profileHoldings,
          period,
          customRange ?? undefined
        );
        if (!cancelled) {
          setData(series);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load history');
          setData([]);
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [period, activeProfileId, holdingsKey, rangeKey, customRange?.start, customRange?.end]);

  return { data, loading, error };
}
