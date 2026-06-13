import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import { fetchChartHistory } from '../lib/apiClient';
import { PeriodSelector } from './PeriodSelector';
import {
  HOLDING_PERIODS,
  periodToYahooRange,
  periodToUnixRange,
  filterByPeriod,
} from '../lib/periods';
import {
  formatCAD,
  formatPct,
  pricesToReturnSeries,
} from '../lib/calculations';
import { usePortfolioStore } from '../store/portfolioStore';
import type { HoldingWithStats, Period, ChartDataPoint } from '../types';

// Each lot gets its own coloured return line overlaid on the stock chart
const LOT_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

interface SymbolDetailModalProps {
  holdings: HoldingWithStats[];
  onClose: () => void;
  onViewLot: (holding: HoldingWithStats) => void;
}

interface ChartPoint {
  date: string;
  stockReturn: number;
  [key: string]: number | string; // lot_0, lot_1 …
}

export function SymbolDetailModal({
  holdings,
  onClose,
  onViewLot,
}: SymbolDetailModalProps) {
  const prices = usePortfolioStore((s) => s.prices);
  const [period, setPeriod] = useState<Period>('SINCE_BUY');
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<ChartDataPoint[]>([]);

  const symbol = holdings[0].symbol;
  const quoteData = prices[symbol];
  const currentPrice = quoteData?.price;
  const hasDayChange = quoteData?.dayChange != null;
  const dayPositive = (quoteData?.dayChangePct ?? 0) >= 0;

  // Aggregate stats across all lots
  const totalInvested = holdings.reduce((s, h) => s + h.amountInvestedCAD, 0);
  const hasAllValues = holdings.every((h) => h.currentValue != null);
  const totalValue = hasAllValues
    ? holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0)
    : null;
  const totalGainLoss = totalValue != null ? totalValue - totalInvested : null;
  const weightedReturnPct =
    totalInvested > 0 && totalGainLoss != null
      ? (totalGainLoss / totalInvested) * 100
      : null;

  // Earliest purchase date (for SINCE_BUY)
  const earliestBuy = holdings.reduce(
    (min, h) => (h.purchaseDate < min ? h.purchaseDate : min),
    holdings[0].purchaseDate
  );

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let data: ChartDataPoint[];
      if (period === 'SINCE_BUY') {
        const { period1, period2 } = periodToUnixRange('SINCE_BUY', earliestBuy);
        const start = new Date(period1 * 1000).toISOString().slice(0, 10);
        const end = new Date(period2 * 1000).toISOString().slice(0, 10);
        data = await fetchChartHistory(symbol, { start, end });
      } else {
        const range = periodToYahooRange(period);
        data = await fetchChartHistory(symbol, { range });
      }
      if (!cancelled) {
        setRawData(data);
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [symbol, earliestBuy, period]);

  const chartData = useMemo((): ChartPoint[] => {
    if (rawData.length === 0) return [];
    const filtered =
      period === 'SINCE_BUY' ? rawData : filterByPeriod(rawData, period);
    if (filtered.length === 0) return [];

    const stockReturns = pricesToReturnSeries(filtered);

    // For each lot, compute % return from purchase price, rebased to 0% at first date in period
    const lotSeries = holdings.map((h) => {
      const pp = h.purchasePriceOverride ?? h.effectivePurchasePrice;
      if (!pp || pp <= 0) return null;
      // Points on/after purchase date within the filtered range
      const ownedFiltered = filtered.filter((p) => p.date >= h.purchaseDate);
      if (ownedFiltered.length === 0) return null;
      // Use price-relative return from purchase price, then shift so it starts at 0
      const raw = ownedFiltered.map((p) => ({
        date: p.date,
        returnPct: ((p.close / pp) - 1) * 100,
      }));
      const base = raw[0].returnPct;
      return raw.map((r) => ({ date: r.date, returnPct: r.returnPct - base }));
    });

    const lotMaps = lotSeries.map((series) =>
      series ? new Map(series.map((p) => [p.date, p.returnPct])) : null
    );

    return stockReturns.map((s) => {
      const point: ChartPoint = { date: s.date, stockReturn: s.returnPct };
      lotMaps.forEach((map, i) => {
        if (map?.has(s.date)) {
          point[`lot_${i}`] = map.get(s.date)!;
        }
      });
      return point;
    });
  }, [rawData, period, holdings]);

  const periodReturn =
    chartData.length >= 2 ? chartData[chartData.length - 1].stockReturn : null;

  // Which lot purchase dates fall in the current chart range?
  const entryDates = holdings
    .map((h) => h.purchaseDate)
    .filter(
      (d) =>
        chartData.length > 0 &&
        d >= chartData[0].date &&
        d <= chartData[chartData.length - 1].date
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold font-mono text-white">{symbol}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{holdings.length} lots</p>
          </div>
          <div className="flex items-center gap-3">
            {currentPrice != null && (
              <div className="text-right">
                <p className="font-mono font-bold text-white text-lg">
                  {formatCAD(currentPrice)}
                </p>
                {hasDayChange && (
                  <p
                    className={`text-xs font-mono flex items-center justify-end gap-1 ${
                      dayPositive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {dayPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {quoteData!.dayChange >= 0 ? '+' : ''}
                    {quoteData!.dayChange.toFixed(2)} ({formatPct(quoteData!.dayChangePct)})
                  </p>
                )}
              </div>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-200 p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Aggregate stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatBox label="Total invested" value={formatCAD(totalInvested)} />
          <StatBox
            label="Total value"
            value={totalValue != null ? formatCAD(totalValue) : '—'}
          />
          <StatBox
            label="Total gain / loss"
            value={totalGainLoss != null ? formatCAD(totalGainLoss) : '—'}
            colored={totalGainLoss}
          />
          <StatBox
            label="Weighted return"
            value={weightedReturnPct != null ? formatPct(weightedReturnPct) : '—'}
            colored={weightedReturnPct}
          />
        </div>

        {/* Lots breakdown table */}
        <div className="mb-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Individual lots
          </h3>
          <div className="rounded-lg overflow-hidden border border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-800/50 text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-3 py-2 font-medium">Bought</th>
                  <th className="text-right px-3 py-2 font-medium">Shares</th>
                  <th className="text-right px-3 py-2 font-medium">Cost basis</th>
                  <th className="text-right px-3 py-2 font-medium">Invested</th>
                  <th className="text-right px-3 py-2 font-medium">Value</th>
                  <th className="text-right px-3 py-2 font-medium">Return</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {holdings.map((h, i) => {
                  const pp = h.purchasePriceOverride ?? h.effectivePurchasePrice;
                  const returnPct = h.gainLossPct ?? h.realizedGainPct;
                  const positive = (returnPct ?? 0) >= 0;
                  return (
                    <tr
                      key={h.id}
                      className="hover:bg-gray-800/30 cursor-pointer transition-colors"
                      onClick={() => onViewLot(h)}
                    >
                      <td className="px-3 py-2 text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: LOT_COLORS[i % LOT_COLORS.length] }}
                          />
                          {h.purchaseDate}
                          {h.status === 'sold' && (
                            <span className="text-gray-500">→ {h.soldDate}</span>
                          )}
                        </div>
                        {h.label && (
                          <div className="text-gray-600 mt-0.5 pl-3.5">{h.label}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-400">
                        {h.units != null ? h.units.toFixed(4) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-400">
                        {pp != null ? formatCAD(pp) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">
                        {formatCAD(h.amountInvestedCAD)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">
                        {h.currentValue != null ? formatCAD(h.currentValue) : '—'}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-semibold ${
                          returnPct == null
                            ? 'text-gray-500'
                            : positive
                              ? 'text-emerald-400'
                              : 'text-red-400'
                        }`}
                      >
                        {returnPct != null ? formatPct(returnPct) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 hover:text-gray-300 text-xs">
                        Detail →
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-300">Price history</h3>
          <PeriodSelector periods={HOLDING_PERIODS} selected={period} onChange={setPeriod} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-52 text-gray-500">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading chart…
          </div>
        ) : chartData.length < 2 ? (
          <div className="flex items-center justify-center h-52 text-gray-600 text-sm">
            Not enough price data for this period
          </div>
        ) : (
          <>
            {periodReturn != null && (
              <p className="text-xs text-gray-400 mb-2">
                Stock period return:{' '}
                <span className={periodReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {formatPct(periodReturn)}
                </span>
                {' '}· coloured lines = each lot's % gain from entry
              </p>
            )}
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d: string) => d.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  width={44}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                        <p className="text-gray-400 mb-1">{label}</p>
                        {payload.map((p) => (
                          <p key={String(p.dataKey)} style={{ color: p.color }}>
                            {p.name}: {formatPct(p.value as number)}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="4 2" />
                {/* Purchase date markers */}
                {entryDates.map((d) => (
                  <ReferenceLine
                    key={d}
                    x={d}
                    stroke="#6b7280"
                    strokeDasharray="3 3"
                  />
                ))}
                {/* Stock price line */}
                <Line
                  type="monotone"
                  dataKey="stockReturn"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Stock"
                  strokeDasharray="6 3"
                />
                {/* One line per lot */}
                {holdings.map((h, i) => (
                  <Line
                    key={h.id}
                    type="monotone"
                    dataKey={`lot_${i}`}
                    stroke={LOT_COLORS[i % LOT_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    name={`${h.purchaseDate}${h.label ? ` (${h.label})` : ''}`}
                  />
                ))}
                <Legend
                  formatter={(v) => (
                    <span className="text-xs text-gray-400">{v}</span>
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-600 mt-1">
              Blue dashed = stock % change from period start · coloured = lot's % gain
              since entry, rebased to 0 at lot start
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  colored,
}: {
  label: string;
  value: string;
  colored?: number | null;
}) {
  const colorClass =
    colored == null
      ? 'text-white'
      : colored >= 0
        ? 'text-emerald-400'
        : 'text-red-400';
  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-bold font-mono ${colorClass}`}>{value}</p>
    </div>
  );
}
