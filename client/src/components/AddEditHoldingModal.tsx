import { useState, useEffect } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { usePortfolioStore } from '../store/portfolioStore';
import { fetchHistoricalPrice } from '../lib/apiClient';
import { normalizeSymbol } from '../lib/normalizeSymbol';
import type { Holding, PurchaseInputMode } from '../types';

interface AddEditHoldingModalProps {
  holding: Holding | null;
  onClose: () => void;
  onSaved?: () => void;
}

function deriveShares(holding: Holding): string {
  if (holding.shares != null) return String(holding.shares);
  const price = holding.purchasePriceOverride ?? holding.effectivePurchasePrice;
  if (price && price > 0) {
    return String(holding.amountInvestedCAD / price);
  }
  return '';
}

export function AddEditHoldingModal({ holding, onClose, onSaved }: AddEditHoldingModalProps) {
  const activeProfileId = usePortfolioStore((s) => s.activeProfileId);
  const addHolding = usePortfolioStore((s) => s.addHolding);
  const updateHolding = usePortfolioStore((s) => s.updateHolding);

  const isEdit = holding != null;
  const initialMode: PurchaseInputMode =
    holding?.purchaseInputMode ??
    (holding?.shares != null ? 'shares' : 'amount');

  const [symbol, setSymbol] = useState(holding?.symbol ?? '');
  const [label, setLabel] = useState(holding?.label ?? '');
  const [inputMode, setInputMode] = useState<PurchaseInputMode>(initialMode);
  const [amountStr, setAmountStr] = useState(
    holding ? String(holding.amountInvestedCAD) : ''
  );
  const [sharesStr, setSharesStr] = useState(holding ? deriveShares(holding) : '');
  const [purchaseDate, setPurchaseDate] = useState(holding?.purchaseDate ?? '');
  const [purchasePriceOverride, setPurchasePriceOverride] = useState(
    holding?.purchasePriceOverride ? String(holding.purchasePriceOverride) : ''
  );
  const [manualPriceOverride, setManualPriceOverride] = useState(
    holding?.manualPriceOverride ? String(holding.manualPriceOverride) : ''
  );

  const [saving, setSaving] = useState(false);
  const [fetchWarning, setFetchWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSave() {
    setFormError(null);
    setFetchWarning(null);

    const normalizedSymbol = normalizeSymbol(symbol);
    if (!normalizedSymbol) {
      setFormError('Symbol is required (e.g. XSP.TO or AAPL)');
      return;
    }

    if (!purchaseDate) {
      setFormError('Purchase date is required');
      return;
    }

    const purchasePriceNum = purchasePriceOverride
      ? parseFloat(purchasePriceOverride)
      : undefined;
    if (purchasePriceOverride && (isNaN(purchasePriceNum!) || purchasePriceNum! <= 0)) {
      setFormError('Purchase price override must be a positive number');
      return;
    }

    const manualPriceNum = manualPriceOverride
      ? parseFloat(manualPriceOverride)
      : undefined;
    if (manualPriceOverride && (isNaN(manualPriceNum!) || manualPriceNum! <= 0)) {
      setFormError('Current price override must be a positive number');
      return;
    }

    setSaving(true);

    let effectivePurchasePrice: number | undefined =
      isEdit ? holding.effectivePurchasePrice : undefined;
    let warningMessage: string | null = null;

    let resolvedPurchasePrice = purchasePriceNum;
    if (!resolvedPurchasePrice) {
      const historicalPrice = await fetchHistoricalPrice(normalizedSymbol, purchaseDate);
      if (historicalPrice != null) {
        effectivePurchasePrice = historicalPrice;
        resolvedPurchasePrice = historicalPrice;
      } else {
        warningMessage =
          `Could not fetch the historical price for ${normalizedSymbol} on ${purchaseDate}. ` +
          `Add a purchase price override, or gain/loss won't be calculated.`;
      }
    }

    let amountInvestedCAD: number;
    let shares: number | undefined;

    if (inputMode === 'shares') {
      const shareCount = parseFloat(sharesStr);
      if (isNaN(shareCount) || shareCount <= 0) {
        setFormError('Number of shares must be a positive number');
        setSaving(false);
        return;
      }
      if (!resolvedPurchasePrice) {
        setFormError(
          'Purchase price is required for share-based entry — add an override or ensure the API can fetch it'
        );
        setSaving(false);
        return;
      }
      shares = shareCount;
      amountInvestedCAD = shareCount * resolvedPurchasePrice;
    } else {
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        setFormError('Amount invested must be a positive number');
        setSaving(false);
        return;
      }
      amountInvestedCAD = amount;
      shares = undefined;
    }

    const holdingData: Omit<Holding, 'id' | 'createdAt'> = {
      profileId: activeProfileId!,
      symbol: normalizedSymbol,
      status: holding?.status ?? 'active',
      label: label.trim() || undefined,
      amountInvestedCAD,
      purchaseDate,
      purchaseInputMode: inputMode,
      shares,
      purchasePriceOverride: purchasePriceNum,
      manualPriceOverride: manualPriceNum,
      effectivePurchasePrice: purchasePriceNum ?? effectivePurchasePrice,
    };

    if (isEdit) {
      updateHolding(holding.id, holdingData);
    } else {
      addHolding(holdingData);
    }

    setSaving(false);

    if (warningMessage) {
      setFetchWarning(warningMessage);
      return;
    }

    onSaved?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">
            {isEdit ? 'Edit holding' : 'Add holding'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Ticker symbol *</label>
            <input
              className="input"
              placeholder="e.g. XSP.TO, VFV.TO, AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-gray-500 mt-1">
              CAD-hedged S&amp;P 500 ETF example: <span className="text-gray-400">XSP.TO</span>
            </p>
          </div>

          <div>
            <label className="label">Label (optional)</label>
            <input
              className="input"
              placeholder="e.g. S&P 500 CAD Hedged"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="label">Purchase date *</label>
            <input
              className="input"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="label">How did you buy? *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInputMode('amount')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === 'amount'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
                disabled={saving}
              >
                Dollar amount
              </button>
              <button
                type="button"
                onClick={() => setInputMode('shares')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === 'shares'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
                disabled={saving}
              >
                Number of shares
              </button>
            </div>
          </div>

          {inputMode === 'amount' ? (
            <div>
              <label className="label">Amount invested (CAD) *</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 5000"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                disabled={saving}
              />
            </div>
          ) : (
            <div>
              <label className="label">Number of shares *</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.0001"
                placeholder="e.g. 10"
                value={sharesStr}
                onChange={(e) => setSharesStr(e.target.value)}
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                Total cost is calculated from shares × price on purchase date.
              </p>
            </div>
          )}

          <details className="group">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none">
              Advanced overrides (optional)
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="label">Purchase price per share (CAD)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="Leave blank to auto-fetch"
                  value={purchasePriceOverride}
                  onChange={(e) => setPurchasePriceOverride(e.target.value)}
                  disabled={saving}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for share-based entry if the API can&apos;t fetch the price.
                </p>
              </div>
              <div>
                <label className="label">Current price override (CAD)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="Leave blank to use live quote"
                  value={manualPriceOverride}
                  onChange={(e) => setManualPriceOverride(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </details>

          {formError && (
            <p className="text-red-400 text-xs flex items-center gap-1">
              <AlertTriangle size={13} /> {formError}
            </p>
          )}

          {fetchWarning && (
            <div className="bg-yellow-900/40 border border-yellow-700/50 rounded-lg p-3 text-xs text-yellow-300">
              <p className="font-medium flex items-center gap-1 mb-1">
                <AlertTriangle size={13} /> Historical price unavailable
              </p>
              <p>{fetchWarning}</p>
              <button
                onClick={onClose}
                className="mt-2 text-yellow-400 underline hover:text-yellow-200"
              >
                Close anyway
              </button>
            </div>
          )}

          {!fetchWarning && (
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="btn-secondary" disabled={saving}>
                Cancel
              </button>
              <button onClick={handleSave} className="btn-primary" disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add holding'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
