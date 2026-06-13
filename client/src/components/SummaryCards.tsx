import { TrendingUp, TrendingDown, DollarSign, BarChart2, Wallet, Activity } from 'lucide-react';
import { usePortfolioStats } from '../hooks/usePortfolioStats';
import { usePortfolioStore } from '../store/portfolioStore';
import { formatCAD, formatPct, computeHoldingStats } from '../lib/calculations';
import { useMemo } from 'react';

export function SummaryCards() {
  const { portfolioStats } = usePortfolioStats();
  const allHoldings = usePortfolioStore((s) => s.holdings);
  const activeProfileId = usePortfolioStore((s) => s.activeProfileId);
  const prices = usePortfolioStore((s) => s.prices);

  const {
    totalInvested,
    totalValue,
    totalGainLoss,
    totalGainLossPct,
    totalRealizedGain,
    soldCount,
  } = portfolioStats;
  const isPositive = totalGainLoss >= 0;
  const realizedPositive = totalRealizedGain >= 0;

  // Today's total dollar change across all active holdings
  const todayChange = useMemo(() => {
    const active = allHoldings.filter(
      (h) => h.profileId === activeProfileId && h.status === 'active'
    );
    let total = 0;
    let hasAny = false;
    for (const h of active) {
      const stats = computeHoldingStats(h, prices[h.symbol]);
      if (stats.dayChange != null && stats.units != null) {
        total += stats.units * stats.dayChange;
        hasAny = true;
      }
    }
    return hasAny ? total : null;
  }, [allHoldings, activeProfileId, prices]);

  const todayPositive = (todayChange ?? 0) >= 0;

  const cards = [
    {
      label: 'Total invested',
      value: formatCAD(totalInvested),
      icon: <DollarSign size={18} className="text-gray-500" />,
      valueClass: 'text-white',
    },
    {
      label: 'Portfolio value',
      value: formatCAD(totalValue),
      icon: <BarChart2 size={18} className="text-gray-500" />,
      valueClass: 'text-white',
    },
    {
      label: 'Unrealized gain / loss',
      value: formatCAD(totalGainLoss),
      icon: isPositive ? (
        <TrendingUp size={18} className="text-emerald-500" />
      ) : (
        <TrendingDown size={18} className="text-red-500" />
      ),
      valueClass: isPositive ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'Return',
      value: formatPct(totalGainLossPct),
      icon: isPositive ? (
        <TrendingUp size={18} className="text-emerald-500" />
      ) : (
        <TrendingDown size={18} className="text-red-500" />
      ),
      valueClass: isPositive ? 'text-emerald-400' : 'text-red-400',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {card.label}
              </span>
              {card.icon}
            </div>
            <p className={`text-2xl font-bold font-mono ${card.valueClass}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {(soldCount > 0 || todayChange != null) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {todayChange != null && (
            <div className="card flex items-center gap-3">
              <Activity size={18} className={todayPositive ? 'text-emerald-500' : 'text-red-500'} />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Today's change</p>
                <p className={`text-xl font-bold font-mono ${todayPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {todayChange >= 0 ? '+' : ''}{formatCAD(todayChange)}
                </p>
              </div>
            </div>
          )}
          {soldCount > 0 && (
            <div className="card flex items-center gap-3">
              <Wallet size={18} className="text-gray-500" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Realized gains ({soldCount} sold)
                </p>
                <p className={`text-xl font-bold font-mono ${realizedPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCAD(totalRealizedGain)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
