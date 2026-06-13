import { useState } from 'react';
import {
  Pencil,
  Trash2,
  AlertCircle,
  Clock,
  TrendingDown,
  Eye,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { usePortfolioStats } from '../hooks/usePortfolioStats';
import { usePortfolioStore } from '../store/portfolioStore';
import { formatCAD, formatPct } from '../lib/calculations';
import type { HoldingWithStats, Holding, HoldingsFilter } from '../types';

interface HoldingsTableProps {
  onEdit: (holding: Holding) => void;
  onView: (holding: HoldingWithStats) => void;
  onViewSymbol: (holdings: HoldingWithStats[]) => void;
  onSell: (holding: HoldingWithStats) => void;
}

interface SymbolGroup {
  symbol: string;
  lots: HoldingWithStats[];
  totalInvested: number;
  totalValue: number | null;
  totalGainLoss: number | null;
  weightedReturnPct: number | null;
  totalDayChange: number | null;
}

const FILTER_OPTIONS: { value: HoldingsFilter; label: string }[] = [
  { value: 'active', label: 'Current' },
  { value: 'sold', label: 'Sold' },
  { value: 'both', label: 'Both' },
];

function buildGroups(holdings: HoldingWithStats[]): SymbolGroup[] {
  const map = new Map<string, HoldingWithStats[]>();
  for (const h of holdings) {
    const arr = map.get(h.symbol) ?? [];
    arr.push(h);
    map.set(h.symbol, arr);
  }

  return [...map.entries()].map(([symbol, lots]) => {
    const totalInvested = lots.reduce((s, h) => s + h.amountInvestedCAD, 0);

    const hasAllValues = lots.every((h) => h.currentValue != null);
    const totalValue = hasAllValues
      ? lots.reduce((s, h) => s + (h.currentValue ?? 0), 0)
      : null;

    const totalGainLoss =
      totalValue != null ? totalValue - totalInvested : null;

    const weightedReturnPct =
      totalInvested > 0 && totalGainLoss != null
        ? (totalGainLoss / totalInvested) * 100
        : null;

    const hasDayChange = lots.some((h) => h.dayChange != null);
    const totalDayChange = hasDayChange
      ? lots.reduce((s, h) => s + ((h.units ?? 0) * (h.dayChange ?? 0)), 0)
      : null;

    return {
      symbol,
      lots,
      totalInvested,
      totalValue,
      totalGainLoss,
      weightedReturnPct,
      totalDayChange,
    };
  });
}

export function HoldingsTable({
  onEdit,
  onView,
  onViewSymbol,
  onSell,
}: HoldingsTableProps) {
  const [filter, setFilter] = useState<HoldingsFilter>('active');
  const { holdingsWithStats } = usePortfolioStats(filter);
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(
    new Set()
  );

  const groups = buildGroups(holdingsWithStats);

  function toggleSymbol(symbol: string) {
    setExpandedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }

  const emptyMessage =
    filter === 'sold'
      ? 'No sold positions yet.'
      : filter === 'active'
        ? 'No holdings yet. Click "Add holding" to get started.'
        : 'No holdings to display.';

  return (
    <div className="card overflow-x-auto p-0">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-300">Holdings</h2>
        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={filter}
          onChange={(e) => setFilter(e.target.value as HoldingsFilter)}
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-gray-500 text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-5 py-3 font-medium">Symbol</th>
              <th className="text-right px-4 py-3 font-medium">Invested</th>
              <th className="text-right px-4 py-3 font-medium">
                {filter === 'sold' ? 'Proceeds' : 'Value'}
              </th>
              <th className="text-right px-4 py-3 font-medium">Gain / loss</th>
              <th className="text-right px-4 py-3 font-medium">Return</th>
              <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Day</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {groups.map((group) => {
              const isExpanded = expandedSymbols.has(group.symbol);
              const multiLot = group.lots.length > 1;
              const gainPositive = (group.totalGainLoss ?? 0) >= 0;
              const gainColor =
                group.totalGainLoss == null
                  ? 'text-gray-500'
                  : gainPositive
                    ? 'text-emerald-400'
                    : 'text-red-400';
              const dayPositive = (group.totalDayChange ?? 0) >= 0;
              const dayColor =
                group.totalDayChange == null
                  ? 'text-gray-600'
                  : dayPositive
                    ? 'text-emerald-400'
                    : 'text-red-400';

              return [
                /* ── Group header row ── */
                <tr
                  key={`group-${group.symbol}`}
                  className="hover:bg-gray-800/30 transition-colors cursor-pointer group"
                  onClick={() =>
                    multiLot
                      ? toggleSymbol(group.symbol)
                      : onView(group.lots[0])
                  }
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {multiLot && (
                        <span className="text-gray-500">
                          {isExpanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </span>
                      )}
                      <span className="font-mono font-semibold text-white">
                        {group.symbol}
                      </span>
                      {multiLot && (
                        <span className="text-xs bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded">
                          {group.lots.length} lots
                        </span>
                      )}
                      {group.lots.some((h) => h.priceStale) && (
                        <span title="Price data may be stale" className="text-yellow-500">
                          <Clock size={12} />
                        </span>
                      )}
                      {group.lots.some((h) => h.priceUnavailable) && (
                        <span title="Price unavailable" className="text-red-500">
                          <AlertCircle size={12} />
                        </span>
                      )}
                    </div>
                    {!multiLot && group.lots[0] && (
                      <div className="text-xs text-gray-600 mt-0.5 ml-0">
                        {group.lots[0].status === 'sold'
                          ? `Bought ${group.lots[0].purchaseDate} · Sold ${group.lots[0].soldDate}`
                          : `Bought ${group.lots[0].purchaseDate}${
                              group.lots[0].units != null
                                ? ` · ${group.lots[0].units.toFixed(4)} shares`
                                : ''
                            }`}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-gray-300 font-mono">
                    {formatCAD(group.totalInvested)}
                  </td>

                  <td className="px-4 py-3 text-right font-mono">
                    {group.totalValue != null ? (
                      <span className="text-white">{formatCAD(group.totalValue)}</span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>

                  <td className={`px-4 py-3 text-right font-mono ${gainColor}`}>
                    {group.totalGainLoss != null
                      ? formatCAD(group.totalGainLoss)
                      : <span className="text-gray-600">—</span>}
                  </td>

                  <td className={`px-4 py-3 text-right font-mono font-semibold ${gainColor}`}>
                    {group.weightedReturnPct != null
                      ? formatPct(group.weightedReturnPct)
                      : <span className="text-gray-600">—</span>}
                  </td>

                  <td className={`px-4 py-3 text-right font-mono text-xs hidden sm:table-cell ${dayColor}`}>
                    {group.totalDayChange != null
                      ? (group.totalDayChange >= 0 ? '+' : '') +
                        group.totalDayChange.toLocaleString('en-CA', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : '—'}
                  </td>

                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SingleLotActions
                      group={group}
                      multiLot={multiLot}
                      onView={onView}
                      onViewSymbol={onViewSymbol}
                      onEdit={onEdit}
                      onSell={onSell}
                    />
                  </td>
                </tr>,

                /* ── Expanded lot rows ── */
                ...(isExpanded && multiLot
                  ? group.lots.map((h) => (
                      <LotRow
                        key={h.id}
                        holding={h}
                        onView={() => onView(h)}
                        onEdit={() => onEdit(h)}
                        onSell={() => onSell(h)}
                      />
                    ))
                  : []),
              ];
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Actions shown on single-lot group rows (eye + sell + edit + delete)
function SingleLotActions({
  group,
  multiLot,
  onView,
  onViewSymbol,
  onEdit,
  onSell,
}: {
  group: SymbolGroup;
  multiLot: boolean;
  onView: (h: HoldingWithStats) => void;
  onViewSymbol: (hs: HoldingWithStats[]) => void;
  onEdit: (h: Holding) => void;
  onSell: (h: HoldingWithStats) => void;
}) {
  const deleteHolding = usePortfolioStore((s) => s.deleteHolding);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lot = group.lots[0];
  const isSold = !multiLot && lot?.status === 'sold';

  if (multiLot) {
    return (
      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onViewSymbol(group.lots)}
          className="p-1 text-gray-500 hover:text-gray-200 transition-colors"
          title="View all lots"
        >
          <Eye size={14} />
        </button>
      </div>
    );
  }

  if (!lot) return null;

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <span className="text-xs text-red-400">Delete?</span>
        <button
          onClick={() => deleteHolding(lot.id)}
          className="text-xs text-red-400 hover:text-red-300 underline"
        >
          Yes
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="text-xs text-gray-500 hover:text-gray-300 underline"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => onView(lot)}
        className="p-1 text-gray-500 hover:text-gray-200 transition-colors"
        title="View details"
      >
        <Eye size={14} />
      </button>
      {!isSold && (
        <>
          <button
            onClick={() => onSell(lot)}
            className="p-1 text-gray-500 hover:text-yellow-400 transition-colors"
            title="Sell holding"
          >
            <TrendingDown size={14} />
          </button>
          <button
            onClick={() => onEdit(lot)}
            className="p-1 text-gray-500 hover:text-gray-200 transition-colors"
            title="Edit holding"
          >
            <Pencil size={14} />
          </button>
        </>
      )}
      <button
        onClick={() => setConfirmDelete(true)}
        className="p-1 text-gray-500 hover:text-red-400 transition-colors"
        title="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

interface LotRowProps {
  holding: HoldingWithStats;
  onView: () => void;
  onEdit: () => void;
  onSell: () => void;
}

function LotRow({ holding: h, onView, onEdit, onSell }: LotRowProps) {
  const deleteHolding = usePortfolioStore((s) => s.deleteHolding);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isSold = h.status === 'sold';
  const isPositive = (h.gainLoss ?? 0) >= 0;
  const gainColor =
    h.gainLoss == null
      ? 'text-gray-500'
      : isPositive
        ? 'text-emerald-400'
        : 'text-red-400';
  const dayPositive = (h.dayChangePct ?? 0) >= 0;
  const dayColor =
    h.dayChangePct == null
      ? 'text-gray-600'
      : dayPositive
        ? 'text-emerald-400'
        : 'text-red-400';

  function handleDelete() {
    if (confirmDelete) {
      deleteHolding(h.id);
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <tr
      className="bg-gray-900/40 hover:bg-gray-800/30 transition-colors group cursor-pointer"
      onClick={onView}
    >
      <td className="pl-10 pr-4 py-2.5">
        <div className="flex items-center gap-2">
          {isSold && (
            <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
              Sold
            </span>
          )}
          {h.label && (
            <span className="text-xs text-gray-400">{h.label}</span>
          )}
        </div>
        <div className="text-xs text-gray-600 mt-0.5">
          {isSold
            ? `Bought ${h.purchaseDate} · Sold ${h.soldDate}`
            : `Bought ${h.purchaseDate}${
                h.units != null ? ` · ${h.units.toFixed(4)} sh` : ''
              }`}
        </div>
      </td>

      <td className="px-4 py-2.5 text-right text-gray-400 font-mono text-xs">
        {formatCAD(h.amountInvestedCAD)}
      </td>

      <td className="px-4 py-2.5 text-right font-mono text-xs">
        {h.currentValue != null ? (
          <span className="text-gray-300">{formatCAD(h.currentValue)}</span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>

      <td className={`px-4 py-2.5 text-right font-mono text-xs ${gainColor}`}>
        {h.gainLoss != null ? formatCAD(h.gainLoss) : '—'}
      </td>

      <td className={`px-4 py-2.5 text-right font-mono font-semibold text-xs ${gainColor}`}>
        {h.gainLossPct != null ? formatPct(h.gainLossPct) : '—'}
      </td>

      <td className={`px-4 py-2.5 text-right font-mono text-xs hidden sm:table-cell ${dayColor}`}>
        {h.dayChangePct != null
          ? formatPct(h.dayChangePct)
          : '—'}
      </td>

      <td
        className="px-4 py-2.5 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmDelete ? (
          <div className="flex items-center gap-1 justify-end">
            <span className="text-xs text-red-400">Delete?</span>
            <button
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-300 underline"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-500 hover:text-gray-300 underline"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onView}
              className="p-1 text-gray-500 hover:text-gray-200 transition-colors"
              title="View lot detail"
            >
              <Eye size={13} />
            </button>
            {!isSold && (
              <>
                <button
                  onClick={onSell}
                  className="p-1 text-gray-500 hover:text-yellow-400 transition-colors"
                  title="Sell"
                >
                  <TrendingDown size={13} />
                </button>
                <button
                  onClick={onEdit}
                  className="p-1 text-gray-500 hover:text-gray-200 transition-colors"
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>
              </>
            )}
            <button
              onClick={handleDelete}
              className="p-1 text-gray-500 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
