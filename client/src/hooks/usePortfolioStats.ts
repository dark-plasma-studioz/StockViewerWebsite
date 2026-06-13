import { useMemo } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { computeHoldingStats, computePortfolioStats } from '../lib/calculations';
import type { HoldingWithStats, PortfolioStats, HoldingsFilter } from '../types';

interface UsePortfolioStatsResult {
  holdingsWithStats: HoldingWithStats[];
  portfolioStats: PortfolioStats;
}

export function usePortfolioStats(
  filter: HoldingsFilter = 'active'
): UsePortfolioStatsResult {
  const activeProfileId = usePortfolioStore((s) => s.activeProfileId);
  const allHoldings = usePortfolioStore((s) => s.holdings);
  const prices = usePortfolioStore((s) => s.prices);

  const holdingsWithStats = useMemo(() => {
    let profileHoldings = allHoldings.filter(
      (h) => h.profileId === activeProfileId
    );

    if (filter === 'active') {
      profileHoldings = profileHoldings.filter((h) => h.status !== 'sold');
    } else if (filter === 'sold') {
      profileHoldings = profileHoldings.filter((h) => h.status === 'sold');
    }

    return profileHoldings.map((h) =>
      computeHoldingStats(h, prices[h.symbol])
    );
  }, [activeProfileId, allHoldings, prices, filter]);

  const portfolioStats = useMemo(() => {
    const allProfileHoldings = allHoldings
      .filter((h) => h.profileId === activeProfileId)
      .map((h) => computeHoldingStats(h, prices[h.symbol]));
    return computePortfolioStats(allProfileHoldings);
  }, [activeProfileId, allHoldings, prices]);

  return { holdingsWithStats, portfolioStats };
}
