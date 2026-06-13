import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { PeriodSelector } from './PeriodSelector';
import { PORTFOLIO_PERIODS } from '../lib/periods';
import { formatPct } from '../lib/calculations';
import { usePortfolioReturnHistory } from '../hooks/usePortfolioReturnHistory';
import type { Period } from '../types';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function ReturnTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      {value != null && (
        <p className={`font-medium ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatPct(value)}
        </p>
      )}
    </div>
  );
}

export function PortfolioReturnChart() {
  const [period, setPeriod] = useState<Period>('1M');
  const { data, loading, error } = usePortfolioReturnHistory(period);

  const values = data.map((d) => d.returnPct);
  const minY = values.length ? Math.min(...values, 0) - 1 : -1;
  const maxY = values.length ? Math.max(...values, 0) + 1 : 1;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-300">Portfolio return %</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Weighted by holding — new purchases won&apos;t spike the chart
          </p>
        </div>
        <PeriodSelector periods={PORTFOLIO_PERIODS} selected={period} onChange={setPeriod} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-52 text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading history…
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-52 text-red-400 text-sm">
          {error}
        </div>
      ) : data.length < 2 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-gray-500 text-sm">Not enough price data</p>
          <p className="text-gray-600 text-xs mt-1">
            Make sure holdings have a purchase price (refresh or add an override).
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis
              domain={[minY, maxY]}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              width={48}
            />
            <Tooltip content={<ReturnTooltip />} />
            <ReferenceLine y={0} stroke="#374151" strokeDasharray="4 2" />
            <Line
              type="monotone"
              dataKey="returnPct"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="Return %"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
