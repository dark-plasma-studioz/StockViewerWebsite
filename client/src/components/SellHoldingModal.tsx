import { useState, useEffect } from 'react';
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

export function SellHoldingModal({ holding, onClose, onSold }: SellHoldingModalProps) {
  const sellHolding = usePortfolioStore((s) => s.sellHolding);
  const prices = usePortfolioStore((s) => s.prices);

  const stats = computeHoldingStats(holding, prices[holding.symbol]);
  const purchasePrice =
    holding.purchasePriceOverride ?? holding.effectivePurchasePrice;
  const units = stats.units;

  const [soldDate, setSoldDate] = useState(new Date().toISOString().slice(0, 10));
  const [proceedsStr, setProceedsStr] = useState('');
  const [sellPriceStr, setSellPriceStr] = useState('');
  const [useSellPrice, setUseSellPrice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Auto-calculate proceeds when sell price per share is entered
  useEffect(() => {
    if (useSellPrice && sellPriceStr && units != null) {
      const price = parseFloat(sellPriceStr);
      if (!isNaN(price) && price > 0) {
        setProceedsStr((price * units).toFixed(2));
      }
    }
  }, [useSellPrice, sellPriceStr, units]);

  async function handleSell() {
    setError(null);

    if (!soldDate) {
      setError('Sell date is required');
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
      if (units != null) {
        proceeds = sellPrice * units;
      }
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
    });

    setSaving(false);
    onSold?.();
  }

  const previewGain = proceedsStr
    ? parseFloat(proceedsStr) - holding.amountInvestedCAD
    : null;
  const previewGainPct = previewGain != null && holding.amountInvestedCAD > 0
    ? (previewGain / holding.amountInvestedCAD) * 100
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">
            Sell {holding.symbol}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-sm space-y-1">
          <div className="flex justify-between text-gray-400">
            <span>Invested</span>
            <span className="font-mono text-gray-200">{formatCAD(holding.amountInvestedCAD)}</span>
          </div>
          {stats.currentValue != null && (
            <div className="flex justify-between text-gray-400">
              <span>Current value</span>
              <span className="font-mono text-gray-200">{formatCAD(stats.currentValue)}</span>
            </div>
          )}
          {units != null && (
            <div className="flex justify-between text-gray-400">
              <span>Units</span>
              <span className="font-mono text-gray-200">{units.toFixed(4)}</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
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

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useSellPrice"
              checked={useSellPrice}
              onChange={(e) => setUseSellPrice(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="useSellPrice" className="text-xs text-gray-400">
              Enter sell price per share (auto-calculates proceeds)
            </label>
          </div>

          {useSellPrice ? (
            <div>
              <label className="label">Sell price per share (CAD)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.0001"
                placeholder={purchasePrice ? `Purchase was ${purchasePrice.toFixed(2)}` : ''}
                value={sellPriceStr}
                onChange={(e) => setSellPriceStr(e.target.value)}
                disabled={saving}
              />
            </div>
          ) : null}

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
            <div className={`text-sm font-mono ${previewGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
              {saving ? 'Recording…' : 'Confirm sell'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
