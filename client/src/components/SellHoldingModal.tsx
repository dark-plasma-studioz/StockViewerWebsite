import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { usePortfolioStore } from '../store/portfolioStore';
import { fetchHistoricalPrice } from '../lib/apiClient';
import { computeHoldingStats, formatCAD, formatPct } from '../lib/calculations';
import type { HoldingWithStats } from '../types';

interface SellHoldingModalProps {
  holding: HoldingWithStats;
  onClose: () => void;
  onSold?: () => void;
}

type QuantityMode = 'shares' | 'amount';
type AmountSubMode = 'percent' | 'dollar';

export function SellHoldingModal({ holding, onClose, onSold }: SellHoldingModalProps) {
  const sellHolding = usePortfolioStore((s) => s.sellHolding);
  const prices = usePortfolioStore((s) => s.prices);

  const stats = computeHoldingStats(holding, prices[holding.symbol]);
  const purchasePrice =
    holding.purchasePriceOverride ?? holding.effectivePurchasePrice;
  const units = stats.units;

  const [soldDate, setSoldDate] = useState(new Date().toISOString().slice(0, 10));
  const [useSellPrice, setUseSellPrice] = useState(false);
  const [sellPriceStr, setSellPriceStr] = useState('');
  const [quantityMode, setQuantityMode] = useState<QuantityMode>('shares');
  const [amountSubMode, setAmountSubMode] = useState<AmountSubMode>('percent');
  const [sharesStr, setSharesStr] = useState('');
  const [amountValueStr, setAmountValueStr] = useState('');
  const [proceedsStr, setProceedsStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const pricePerShareForCalc = useMemo(() => {
    if (useSellPrice && sellPriceStr) {
      const p = parseFloat(sellPriceStr);
      if (!isNaN(p) && p > 0) return p;
    }
    return stats.currentPrice ?? purchasePrice ?? null;
  }, [useSellPrice, sellPriceStr, stats.currentPrice, purchasePrice]);

  const sharesToSell = useMemo((): number | null => {
    if (units == null || units <= 0) return null;

    if (quantityMode === 'shares') {
      const n = parseFloat(sharesStr);
      if (isNaN(n) || n <= 0) return null;
      return Math.min(n, units);
    }

    if (amountSubMode === 'percent') {
      const pct = parseFloat(amountValueStr);
      if (isNaN(pct) || pct <= 0) return null;
      return Math.min(units * (pct / 100), units);
    }

    const dollars = parseFloat(amountValueStr);
    if (isNaN(dollars) || dollars <= 0 || !pricePerShareForCalc) return null;
    return Math.min(dollars / pricePerShareForCalc, units);
  }, [quantityMode, amountSubMode, sharesStr, amountValueStr, units, pricePerShareForCalc]);

  const soldCostBasis = useMemo(() => {
    if (sharesToSell == null || units == null || units <= 0) return null;
    return (sharesToSell / units) * holding.amountInvestedCAD;
  }, [sharesToSell, units, holding.amountInvestedCAD]);

  // Auto-calculate proceeds when sell price per share is entered
  useEffect(() => {
    if (useSellPrice && sellPriceStr && sharesToSell != null) {
      const price = parseFloat(sellPriceStr);
      if (!isNaN(price) && price > 0) {
        setProceedsStr((price * sharesToSell).toFixed(2));
      }
    }
  }, [useSellPrice, sellPriceStr, sharesToSell]);

  const previewGain =
    proceedsStr && soldCostBasis != null
      ? parseFloat(proceedsStr) - soldCostBasis
      : null;
  const previewGainPct =
    previewGain != null && soldCostBasis != null && soldCostBasis > 0
      ? (previewGain / soldCostBasis) * 100
      : null;

  const isFullSell =
    sharesToSell != null && units != null && sharesToSell >= units - 1e-6;

  async function handleSell() {
    setError(null);

    if (!soldDate) {
      setError('Sell date is required');
      return;
    }

    if (sharesToSell == null || sharesToSell <= 0) {
      setError('Enter a valid amount to sell');
      return;
    }

    if (units != null && sharesToSell > units + 1e-6) {
      setError(`Cannot sell more than ${units.toFixed(4)} shares`);
      return;
    }

    let proceeds = parseFloat(proceedsStr);
    let sellPriceOverride: number | undefined;
    let effectiveSoldPrice: number | undefined;

    if (useSellPrice) {
      const sellPrice = parseFloat(sellPriceStr);
      if (isNaN(sellPrice) || sellPrice <= 0) {
        setError('Sell price per share must be a positive number');
        return;
      }
      sellPriceOverride = sellPrice;
      proceeds = sellPrice * sharesToSell;
    }

    if (isNaN(proceeds) || proceeds <= 0) {
      setError('Total proceeds must be a positive number');
      return;
    }

    setSaving(true);

    if (!sellPriceOverride) {
      const historical = await fetchHistoricalPrice(holding.symbol, soldDate);
      if (historical != null) {
        effectiveSoldPrice = historical;
      }
    }

    sellHolding(holding.id, {
      soldDate,
      soldProceedsCAD: proceeds,
      soldPriceOverride: sellPriceOverride,
      effectiveSoldPrice,
      soldShares: isFullSell ? undefined : sharesToSell,
      soldCostBasisCAD: soldCostBasis ?? undefined,
    });

    setSaving(false);
    onSold?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Sell {holding.symbol}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-sm space-y-1">
          <div className="flex justify-between text-gray-400">
            <span>Invested</span>
            <span className="font-mono text-gray-200">
              {formatCAD(holding.amountInvestedCAD)}
            </span>
          </div>
          {stats.currentValue != null && (
            <div className="flex justify-between text-gray-400">
              <span>Current value</span>
              <span className="font-mono text-gray-200">
                {formatCAD(stats.currentValue)}
              </span>
            </div>
          )}
          {units != null && (
            <div className="flex justify-between text-gray-400">
              <span>Shares held</span>
              <span className="font-mono text-gray-200">{units.toFixed(4)}</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Sell price override — at top */}
          <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-800 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useSellPrice"
                checked={useSellPrice}
                onChange={(e) => setUseSellPrice(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="useSellPrice" className="text-xs text-gray-300">
                Enter sell price per share (auto-calculates proceeds)
              </label>
            </div>
            {useSellPrice && (
              <div>
                <label className="label">Sell price per share (CAD)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder={
                    purchasePrice ? `Purchase was ${purchasePrice.toFixed(2)}` : ''
                  }
                  value={sellPriceStr}
                  onChange={(e) => setSellPriceStr(e.target.value)}
                  disabled={saving}
                />
              </div>
            )}
          </div>

          <div>
            <label className="label">Sell date *</label>
            <input
              className="input"
              type="date"
              value={soldDate}
              onChange={(e) => setSoldDate(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Quantity to sell */}
          <div>
            <label className="label">Amount to sell</label>
            <div className="flex gap-2 mb-3">
              {(['shares', 'amount'] as QuantityMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setQuantityMode(mode)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    quantityMode === mode
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {mode === 'shares' ? 'Shares' : 'Dollar amount'}
                </button>
              ))}
            </div>

            {quantityMode === 'shares' ? (
              <div>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder={units != null ? `Max ${units.toFixed(4)}` : 'Shares to sell'}
                  value={sharesStr}
                  onChange={(e) => setSharesStr(e.target.value)}
                  disabled={saving}
                />
                {units != null && (
                  <button
                    type="button"
                    onClick={() => setSharesStr(units.toFixed(4))}
                    className="text-xs text-emerald-500 hover:text-emerald-400 mt-1"
                  >
                    Sell all ({units.toFixed(4)} shares)
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {(['percent', 'dollar'] as AmountSubMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAmountSubMode(mode)}
                      className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                        amountSubMode === mode
                          ? 'bg-gray-700 text-white'
                          : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {mode === 'percent' ? '% of position' : '$ amount'}
                    </button>
                  ))}
                </div>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step={amountSubMode === 'percent' ? '0.1' : '0.01'}
                  placeholder={
                    amountSubMode === 'percent'
                      ? 'e.g. 50 for half'
                      : stats.currentValue != null
                        ? `Max ~${stats.currentValue.toFixed(2)}`
                        : 'Dollar value to sell'
                  }
                  value={amountValueStr}
                  onChange={(e) => setAmountValueStr(e.target.value)}
                  disabled={saving}
                />
                {amountSubMode === 'percent' && (
                  <button
                    type="button"
                    onClick={() => setAmountValueStr('100')}
                    className="text-xs text-emerald-500 hover:text-emerald-400"
                  >
                    Sell 100%
                  </button>
                )}
              </div>
            )}

            {sharesToSell != null && units != null && (
              <p className="text-xs text-gray-500 mt-2">
                Selling {sharesToSell.toFixed(4)} of {units.toFixed(4)} shares
                {soldCostBasis != null && ` · cost basis ${formatCAD(soldCostBasis)}`}
                {!isFullSell && ' (partial sell)'}
              </p>
            )}
          </div>

          <div>
            <label className="label">Total proceeds (CAD) *</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount received from sale"
              value={proceedsStr}
              onChange={(e) => setProceedsStr(e.target.value)}
              disabled={saving || (useSellPrice && !!sellPriceStr)}
            />
          </div>

          {previewGain != null && !isNaN(previewGain) && (
            <div
              className={`text-sm font-mono ${
                previewGain >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              Realized gain: {formatCAD(previewGain)}
              {previewGainPct != null && ` (${formatPct(previewGainPct)})`}
            </div>
          )}

          {error && (
            <p className="text-red-400 text-xs flex items-center gap-1">
              <AlertTriangle size={13} /> {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button onClick={handleSell} className="btn-primary" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Recording…' : isFullSell ? 'Confirm sell' : 'Confirm partial sell'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
