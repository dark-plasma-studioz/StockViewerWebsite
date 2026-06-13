import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { usePortfolioStats } from '../hooks/usePortfolioStats';

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16',
  '#e11d48', '#0ea5e9',
];

interface SliceEntry {
  name: string;
  value: number;
  pct: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SliceEntry }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-semibold text-white">{d.name}</p>
      <p className="text-gray-300">
        CA${d.value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="text-gray-400">{d.pct.toFixed(1)}%</p>
    </div>
  );
}

export function AllocationChart() {
  const { holdingsWithStats } = usePortfolioStats();

  // Aggregate by symbol so duplicate lots merge into one slice
  const symbolMap = new Map<string, number>();
  for (const h of holdingsWithStats.filter((h) => (h.currentValue ?? 0) > 0)) {
    symbolMap.set(h.symbol, (symbolMap.get(h.symbol) ?? 0) + (h.currentValue ?? 0));
  }
  let data: SliceEntry[] = [...symbolMap.entries()].map(([name, value]) => ({
    name,
    value,
    pct: 0,
  }));

  // Fallback to invested amount if no prices resolved yet
  if (data.length === 0) {
    const investedMap = new Map<string, number>();
    holdingsWithStats.forEach((h) => {
      if (h.amountInvestedCAD > 0) {
        investedMap.set(h.symbol, (investedMap.get(h.symbol) ?? 0) + h.amountInvestedCAD);
      }
    });
    data = [...investedMap.entries()].map(([name, value]) => ({ name, value, pct: 0 }));
  }

  if (data.length === 0) {
    return (
      <div className="card flex items-center justify-center h-64 text-gray-600 text-sm">
        No allocation data yet
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  data.forEach((d) => { d.pct = total > 0 ? (d.value / total) * 100 : 0; });

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">Allocation</h2>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={50}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-gray-400">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
