import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from '../lib/nanoid';
import type { Profile, Holding, Snapshot, QuoteData, ExportData } from '../types';
import {
  todayStr,
  computeHoldingStats,
  computePortfolioStats,
  computeSnapshotReturn,
  computeTotalRealizedGain,
} from '../lib/calculations';

interface SellHoldingInput {
  soldDate: string;
  soldProceedsCAD: number;
  soldPriceOverride?: number;
  effectiveSoldPrice?: number;
}

interface PortfolioState {
  profiles: Profile[];
  holdings: Holding[];
  snapshots: Snapshot[];
  activeProfileId: string | null;
  prices: Record<string, QuoteData>;

  addProfile: (name: string) => string;
  updateProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;

  addHolding: (holding: Omit<Holding, 'id' | 'createdAt' | 'status'> & { status?: Holding['status'] }) => string;
  updateHolding: (id: string, updates: Partial<Omit<Holding, 'id' | 'profileId' | 'createdAt'>>) => void;
  deleteHolding: (id: string) => void;
  sellHolding: (id: string, sellData: SellHoldingInput) => void;

  setPrices: (prices: Record<string, QuoteData>) => void;
  recordDailySnapshot: (profileId: string) => void;
  importData: (data: ExportData, mode: 'merge' | 'replace') => void;
}

function migrateHolding(h: Holding): Holding {
  return { ...h, status: h.status ?? 'active' };
}

function migrateSnapshot(sn: Snapshot): Snapshot {
  const returnIndex = sn.returnIndex ?? 100;
  const returnPct =
    sn.returnPct ??
    (sn.totalInvestedCAD > 0
      ? ((sn.totalValueCAD - sn.totalInvestedCAD) / sn.totalInvestedCAD) * 100
      : 0);
  return {
    ...sn,
    returnIndex,
    returnPct,
    totalRealizedGainCAD: sn.totalRealizedGainCAD ?? 0,
  };
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      profiles: [],
      holdings: [],
      snapshots: [],
      activeProfileId: null,
      prices: {},

      addProfile: (name) => {
        const id = nanoid();
        set((s) => ({
          profiles: [
            ...s.profiles,
            { id, name: name.trim(), createdAt: new Date().toISOString() },
          ],
          activeProfileId: s.activeProfileId ?? id,
        }));
        return id;
      },

      updateProfile: (id, name) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === id ? { ...p, name: name.trim() } : p
          ),
        })),

      deleteProfile: (id) =>
        set((s) => {
          const remaining = s.profiles.filter((p) => p.id !== id);
          let nextActive = s.activeProfileId;
          if (nextActive === id) {
            nextActive = remaining[0]?.id ?? null;
          }
          return {
            profiles: remaining,
            holdings: s.holdings.filter((h) => h.profileId !== id),
            snapshots: s.snapshots.filter((sn) => sn.profileId !== id),
            activeProfileId: nextActive,
          };
        }),

      setActiveProfile: (id) => set({ activeProfileId: id }),

      addHolding: (holding) => {
        const id = nanoid();
        set((s) => ({
          holdings: [
            ...s.holdings,
            {
              ...holding,
              status: holding.status ?? 'active',
              id,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
        return id;
      },

      updateHolding: (id, updates) =>
        set((s) => ({
          holdings: s.holdings.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        })),

      deleteHolding: (id) =>
        set((s) => ({ holdings: s.holdings.filter((h) => h.id !== id) })),

      sellHolding: (id, sellData) =>
        set((s) => ({
          holdings: s.holdings.map((h) =>
            h.id === id
              ? {
                  ...h,
                  status: 'sold' as const,
                  soldDate: sellData.soldDate,
                  soldProceedsCAD: sellData.soldProceedsCAD,
                  soldPriceOverride: sellData.soldPriceOverride,
                  effectiveSoldPrice: sellData.effectiveSoldPrice,
                }
              : h
          ),
        })),

      setPrices: (prices) =>
        set((s) => ({ prices: { ...s.prices, ...prices } })),

      recordDailySnapshot: (profileId) => {
        const state = get();
        const prices = state.prices;
        const profileHoldings = state.holdings
          .filter((h) => h.profileId === profileId)
          .map((h) => migrateHolding(h));

        const withStats = profileHoldings.map((h) =>
          computeHoldingStats(h, prices[h.symbol])
        );
        const { totalInvested, totalValue } = computePortfolioStats(withStats);
        const totalRealizedGain = computeTotalRealizedGain(withStats);

        const today = todayStr();
        const prevSnapshot = state.snapshots
          .filter((sn) => sn.profileId === profileId && sn.date < today)
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        const { returnIndex, returnPct } = computeSnapshotReturn(
          prevSnapshot ? migrateSnapshot(prevSnapshot) : undefined,
          totalValue,
          totalInvested
        );

        const snapshotData = {
          totalValueCAD: totalValue,
          totalInvestedCAD: totalInvested,
          returnIndex,
          returnPct,
          totalRealizedGainCAD: totalRealizedGain,
        };

        const alreadyRecorded = state.snapshots.some(
          (sn) => sn.profileId === profileId && sn.date === today
        );

        if (alreadyRecorded) {
          set((s) => ({
            snapshots: s.snapshots.map((sn) =>
              sn.profileId === profileId && sn.date === today
                ? { ...sn, ...snapshotData }
                : sn
            ),
          }));
        } else {
          set((s) => ({
            snapshots: [
              ...s.snapshots,
              { id: nanoid(), profileId, date: today, ...snapshotData },
            ],
          }));
        }
      },

      importData: (data, mode) => {
        const holdings = data.holdings.map(migrateHolding);
        const snapshots = data.snapshots.map(migrateSnapshot);

        if (mode === 'replace') {
          set({
            profiles: data.profiles,
            holdings,
            snapshots,
            activeProfileId: data.profiles[0]?.id ?? null,
          });
        } else {
          set((s) => {
            const mergedProfiles = mergeById(s.profiles, data.profiles) as Profile[];
            const mergedHoldings = mergeById(s.holdings, holdings).map(migrateHolding);
            const mergedSnapshots = mergeById(s.snapshots, snapshots).map(migrateSnapshot);
            return {
              profiles: mergedProfiles,
              holdings: mergedHoldings,
              snapshots: mergedSnapshots,
              activeProfileId:
                s.activeProfileId ?? mergedProfiles[0]?.id ?? null,
            };
          });
        }
      },
    }),
    {
      name: 'stockViewer_v1',
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as PortfolioState;
        if (version < 2) {
          state.holdings = (state.holdings ?? []).map(migrateHolding);
          state.snapshots = (state.snapshots ?? []).map(migrateSnapshot);
        }
        return state;
      },
    }
  )
);

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}
