import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { HoldingsTable } from './components/HoldingsTable';
import { AllocationChart } from './components/AllocationChart';
import { PortfolioReturnChart } from './components/PortfolioReturnChart';
import { GainLossChart } from './components/GainLossChart';
import { AddEditHoldingModal } from './components/AddEditHoldingModal';
import { HoldingDetailModal } from './components/HoldingDetailModal';
import { SymbolDetailModal } from './components/SymbolDetailModal';
import { SellHoldingModal } from './components/SellHoldingModal';
import { usePortfolioStore } from './store/portfolioStore';
import { usePriceRefresh } from './hooks/usePriceRefresh';
import type { Holding, HoldingWithStats } from './types';

export default function App() {
  const activeProfileId = usePortfolioStore((s) => s.activeProfileId);
  const profiles = usePortfolioStore((s) => s.profiles);
  const holdings = usePortfolioStore((s) => s.holdings);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [viewingHolding, setViewingHolding] = useState<HoldingWithStats | null>(null);
  const [viewingSymbol, setViewingSymbol] = useState<HoldingWithStats[] | null>(null);
  const [sellingHolding, setSellingHolding] = useState<HoldingWithStats | null>(null);

  const { refreshPrices, isLoading, error } = usePriceRefresh();

  const holdingsCount = holdings.length;
  const holdingSymbols = holdings.map((h) => h.symbol).join(',');

  useEffect(() => {
    if (holdingsCount > 0) {
      void refreshPrices();
    }
  }, [holdingsCount, holdingSymbols, refreshPrices]);

  function openAdd() {
    setEditingHolding(null);
    setModalOpen(true);
  }

  function openEdit(holding: Holding) {
    setEditingHolding(holding);
    setModalOpen(true);
  }

  const hasProfiles = profiles.length > 0;
  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header onAddHolding={openAdd} onRefresh={refreshPrices} isLoading={isLoading} />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-5 py-3 text-sm text-red-300">
            Price refresh error: {error}
          </div>
        )}

        {!hasProfiles ? (
          <EmptyProfiles />
        ) : !activeProfile ? (
          <div className="text-center py-20 text-gray-600">
            Select a profile above to view your portfolio.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-gray-200">
                {activeProfile.name}&apos;s Portfolio
              </h1>
            </div>
            <SummaryCards />
            <HoldingsTable
              onEdit={openEdit}
              onView={setViewingHolding}
              onViewSymbol={setViewingSymbol}
              onSell={setSellingHolding}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PortfolioReturnChart />
              <GainLossChart />
            </div>
            <AllocationChart />
          </>
        )}
      </main>

      {modalOpen && (
        <AddEditHoldingModal
          holding={editingHolding}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            void refreshPrices();
          }}
        />
      )}

      {viewingHolding && (
        <HoldingDetailModal
          holding={viewingHolding}
          onClose={() => setViewingHolding(null)}
        />
      )}

      {viewingSymbol && (
        <SymbolDetailModal
          holdings={viewingSymbol}
          onClose={() => setViewingSymbol(null)}
          onViewLot={(h) => {
            setViewingSymbol(null);
            setViewingHolding(h);
          }}
        />
      )}

      {sellingHolding && (
        <SellHoldingModal
          holding={sellingHolding}
          onClose={() => setSellingHolding(null)}
          onSold={() => {
            setSellingHolding(null);
            void refreshPrices();
          }}
        />
      )}
    </div>
  );
}

function EmptyProfiles() {
  const addProfile = usePortfolioStore((s) => s.addProfile);
  const [name, setName] = useState('');

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    addProfile(trimmed);
    setName('');
  }

  return (
    <div className="flex flex-col items-center justify-center py-28 gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-200 mb-2">Welcome to Family Portfolio</h2>
        <p className="text-gray-500 max-w-md">
          Create a profile for each family member to track their investments
          separately — even when they share a brokerage account.
        </p>
      </div>
      <div className="flex gap-2 w-full max-w-xs">
        <input
          className="input flex-1"
          placeholder="Your name (e.g. Dad)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button onClick={handleCreate} className="btn-primary">
          Create
        </button>
      </div>
    </div>
  );
}
