import { useState, useCallback } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { fetchQuotes, fetchHistoricalPrice } from '../lib/apiClient';

interface UsePriceRefreshResult {
  refreshPrices: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function usePriceRefresh(): UsePriceRefreshResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setPrices = usePortfolioStore((s) => s.setPrices);
  const updateHolding = usePortfolioStore((s) => s.updateHolding);
  const recordDailySnapshot = usePortfolioStore((s) => s.recordDailySnapshot);

  const refreshPrices = useCallback(async () => {
    const { holdings } = usePortfolioStore.getState();
    if (holdings.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      // Collect all unique symbols across all profiles
      const uniqueSymbols = [...new Set(holdings.map((h) => h.symbol))];

      // 1. Batch-fetch current quotes
      const quotes = await fetchQuotes(uniqueSymbols);
      setPrices(quotes);

      // 2. For holdings that lack an effective purchase price, fetch historical close
      const needsHistory = holdings.filter(
        (h) =>
          h.status !== 'sold' &&
          h.purchasePriceOverride == null &&
          h.effectivePurchasePrice == null &&
          h.purchaseDate
      );

      // Deduplicate by (symbol, date)
      const historyKeys = new Set<string>();
      const historyFetches: Promise<void>[] = [];

      for (const h of needsHistory) {
        const key = `${h.symbol}:${h.purchaseDate}`;
        if (historyKeys.has(key)) continue;
        historyKeys.add(key);

        historyFetches.push(
          fetchHistoricalPrice(h.symbol, h.purchaseDate).then((price) => {
            if (price == null) return;
            // Apply the fetched price to all holdings sharing the same (symbol, date)
            for (const holding of needsHistory) {
              if (
                holding.symbol === h.symbol &&
                holding.purchaseDate === h.purchaseDate
              ) {
                updateHolding(holding.id, { effectivePurchasePrice: price });
              }
            }
          })
        );
      }

      await Promise.all(historyFetches);

      // 3. Record daily snapshots per profile
      const { holdings: latestHoldings, profiles: latestProfiles } =
        usePortfolioStore.getState();

      for (const profile of latestProfiles) {
        const profileHoldings = latestHoldings.filter(
          (h) => h.profileId === profile.id
        );
        if (profileHoldings.length === 0) continue;
        recordDailySnapshot(profile.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh prices');
    } finally {
      setIsLoading(false);
    }
  }, [setPrices, updateHolding, recordDailySnapshot]);

  return { refreshPrices, isLoading, error };
}
