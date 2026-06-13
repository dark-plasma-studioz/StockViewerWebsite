import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { usePortfolioStats } from '../hooks/usePortfolioStats';
import { formatCAD, formatPct } from '../lib/calculations';

interface BarEntry {
  symbol: string;
  gainLoss: number;
  returnPct: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: BarEntry }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const positive = d.gainLoss >= 0;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-semibold text-white font-mono">{d.symbol}</p>
      <p className={positive ? 'text-emerald-400' : 'text-red-400'}>
        {formatCAD(d.gainLoss)}
      </p>
      <p className="text-gray-400">{formatPct(d.returnPct)}</p>
    </div>
  );
}

export function GainLossChart() {
  const { holdingsWithStats } = usePortfolioStats('active');

  // Aggregate by symbol
  const symbolMap = new Map<
    string,
    { gainLoss: number; returnPct: number; invested: number }
  >();
  for (const h of holdingsWithStats) {
    if (h.gainLoss == null || h.gainLossPct == null) continue;
    const prev = symbolMap.get(h.symbol);
    if (prev) {
      const newInvested = prev.invested + h.amountInvestedCAD;
      const newGainLoss = prev.gainLoss + h.gainLoss;
      const newReturnPct = newInvested > 0 ? (newGainLoss / newInvested) * 100 : 0;
      symbolMap.set(h.symbol, {
        gainLoss: newGainLoss,
        returnPct: newReturnPct,
        invested: newInvested,
      });
    } else {
      symbolMap.set(h.symbol, {
        gainLoss: h.gainLoss,
        returnPct: h.gainLossPct,
        invested: h.amountInvestedCAD,
      });
    }
  }

  const data: BarEntry[] = [...symbolMap.entries()]
    .map(([symbol, v]) => ({ symbol, ...v }))
    .sort((a, b) => b.gainLoss - a.gainLoss);

  if (data.length === 0) {
    return (
      <div className="card flex items-center justify-center h-64 text-gray-600 text-sm">
        No gain / loss data yet
      </div>
    );
  }

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.gainLoss)), 1);

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">Gain / loss by holding</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v === 0
                ? '$0'
                : `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(1)}k`
            }
            domain={[-maxAbs * 1.15, maxAbs * 1.15]}
          />
          <YAxis
            type="category"
            dataKey="symbol"
            tick={{ fill: '#d1d5db', fontSize: 11, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine x={0} stroke="#374151" />
          <Bar dataKey="gainLoss" radius={[0, 3, 3, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.gainLoss >= 0 ? '#10b981' : '#ef4444'}
                opacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
