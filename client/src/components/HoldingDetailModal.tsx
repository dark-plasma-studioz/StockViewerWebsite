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
} from 'recharts';
import { CHART_GREEN, CHART_RED, splitSignedSeries } from '../lib/chartHelpers';
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
  computeHoldingStats,
} from '../lib/calculations';
import { usePortfolioStore } from '../store/portfolioStore';
import type { HoldingWithStats, Period, ChartDataPoint } from '../types';

interface HoldingDetailModalProps {
  holding: HoldingWithStats;
  onClose: () => void;
}

interface ChartPoint {
  date: string;
  returnPct: number;
}

export function HoldingDetailModal({ holding, onClose }: HoldingDetailModalProps) {
  const prices = usePortfolioStore((s) => s.prices);
  const [period, setPeriod] = useState<Period>('SINCE_BUY');
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<ChartDataPoint[]>([]);

  const stats = computeHoldingStats(holding, prices[holding.symbol]);
  const purchasePrice = holding.purchasePriceOverride ?? holding.effectivePurchasePrice;
  const isSold = holding.status === 'sold';

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
        const { period1, period2 } = periodToUnixRange('SINCE_BUY', holding.purchaseDate);
        const start = new Date(period1 * 1000).toISOString().slice(0, 10);
        const end = new Date(period2 * 1000).toISOString().slice(0, 10);
        data = await fetchChartHistory(holding.symbol, { start, end });
      } else {
        const range = periodToYahooRange(period);
        data = await fetchChartHistory(holding.symbol, { range });
      }

      if (isSold && holding.soldDate) {
        data = data.filter((d) => d.date <= holding.soldDate!);
      }

      if (!cancelled) {
        setRawData(data);
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [holding.symbol, holding.purchaseDate, holding.soldDate, isSold, period]);

  // Chart data: % change rebased to 0% from first data point in the period
  const chartData = useMemo((): ChartPoint[] => {
    if (rawData.length === 0) return [];
    const filtered =
      period === 'SINCE_BUY'
        ? rawData
        : filterByPeriod(rawData, period);
    if (filtered.length === 0) return [];
    return pricesToReturnSeries(filtered);
  }, [rawData, period]);

  // The purchase date may fall within the chart range (non-SINCE_BUY periods)
  const purchaseDateInRange =
    period !== 'SINCE_BUY' &&
    chartData.length > 0 &&
    holding.purchaseDate >= chartData[0].date &&
    holding.purchaseDate <= chartData[chartData.length - 1].date;

  // What the stock return was at the purchase date within the current period
  const entryPoint = purchaseDateInRange
    ? chartData.find((p) => p.date >= holding.purchaseDate)
    : null;

  const periodReturn = chartData.length >= 2
    ? chartData[chartData.length - 1].returnPct
    : null;

  const signedChartData = useMemo(
    () =>
      splitSignedSeries(
        chartData.map((d) => ({ date: d.date, value: d.returnPct }))
      ),
    [chartData]
  );

  // Personal total return (all-time, from purchase price)
  const personalReturn = stats.gainLossPct ?? stats.realizedGainPct ?? null;

  // Day change info
  const hasDayChange = stats.dayChange != null;
  const dayPositive = (stats.dayChangePct ?? 0) >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold font-mono text-white">{holding.symbol}</h2>
            {holding.label && (
              <p className="text-sm text-gray-500 mt-0.5">{holding.label}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {stats.currentPrice != null && (
              <div className="text-right">
                <p className="font-mono font-bold text-white text-lg">
                  {formatCAD(stats.currentPrice)}
                </p>
                {hasDayChange && (
                  <p className={`text-xs font-mono ${dayPositive ? 'text-emerald-400' : 'text-red-400'} flex items-center justify-end gap-1`}>
                    {dayPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {stats.dayChange! >= 0 ? '+' : ''}{stats.dayChange!.toFixed(2)}
                    {' '}({formatPct(stats.dayChangePct!)})
                  </p>
                )}
              </div>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-200 p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatBox label="Invested" value={formatCAD(holding.amountInvestedCAD)} />
          <StatBox
            label={isSold ? 'Proceeds' : 'Current value'}
            value={
              isSold
                ? formatCAD(holding.soldProceedsCAD ?? 0)
                : stats.currentValue != null
                  ? formatCAD(stats.currentValue)
                  : '—'
            }
          />
          <StatBox
            label="Total gain / loss"
            value={stats.gainLoss != null ? formatCAD(stats.gainLoss) : '—'}
            colored={stats.gainLoss}
          />
          <StatBox
            label="Total return"
            value={personalReturn != null ? formatPct(personalReturn) : '—'}
            colored={personalReturn}
          />
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5 text-xs">
          {purchasePrice != null && (
            <MiniStat label="Cost basis" value={formatCAD(purchasePrice)} />
          )}
          {stats.units != null && (
            <MiniStat label="Shares" value={stats.units.toFixed(4)} />
          )}
          {purchasePrice != null && stats.currentPrice != null && (
            <MiniStat
              label="Price change"
              value={formatPct(((stats.currentPrice - purchasePrice) / purchasePrice) * 100)}
              colored={stats.currentPrice - purchasePrice}
            />
          )}
          <MiniStat label="Bought" value={holding.purchaseDate} />
          {isSold && holding.soldDate && (
            <MiniStat label="Sold" value={holding.soldDate} />
          )}
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
            <div className="flex items-center gap-4 mb-2">
              {periodReturn != null && (
                <p className="text-xs text-gray-400">
                  Period:{' '}
                  <span className={periodReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {formatPct(periodReturn)}
                  </span>
                </p>
              )}
              {entryPoint != null && (
                <p className="text-xs text-gray-400">
                  Your entry:{' '}
                  <span className={entryPoint.returnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {formatPct(entryPoint.returnPct)} into period
                  </span>
                </p>
              )}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={signedChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                    const val = payload.find((p) => p.value != null)?.value as number;
                    if (val == null) return null;
                    return (
                      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                        <p className="text-gray-400 mb-1">{label}</p>
                        <p className={val >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {formatPct(val)}
                        </p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="4 2" />
                {purchaseDateInRange && (
                  <ReferenceLine
                    x={holding.purchaseDate}
                    stroke="#f59e0b"
                    strokeDasharray="4 3"
                    label={{
                      value: 'Bought',
                      fill: '#f59e0b',
                      fontSize: 9,
                      position: 'insideTopRight',
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="positive"
                  stroke={CHART_GREEN}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  name="Stock return"
                />
                <Line
                  type="monotone"
                  dataKey="negative"
                  stroke={CHART_RED}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  legendType="none"
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-600 mt-1">
              % change from start of selected period
              {purchaseDateInRange
                ? ' · amber line = your purchase date'
                : ''}
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

function MiniStat({
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
      ? 'text-gray-300'
      : colored >= 0
        ? 'text-emerald-400'
        : 'text-red-400';
  return (
    <div className="bg-gray-800/30 rounded-lg px-3 py-2">
      <p className="text-gray-600 mb-0.5">{label}</p>
      <p className={`font-mono font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}

