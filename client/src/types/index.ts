export interface Profile {
  id: string;
  name: string;
  createdAt: string;
}

export type HoldingStatus = 'active' | 'sold';

export type PurchaseInputMode = 'amount' | 'shares';

export interface Holding {
  id: string;
  profileId: string;
  symbol: string;
  label?: string;
  amountInvestedCAD: number;
  purchaseDate: string; // YYYY-MM-DD
  status: HoldingStatus;
  /** How the position was entered — by dollar amount or share count */
  purchaseInputMode?: PurchaseInputMode;
  /** Share count when bought by shares (otherwise derived from amount / price) */
  shares?: number;
  /** User-provided override for purchase price (skips historical API call) */
  purchasePriceOverride?: number;
  /** User-provided override for current price (skips live quote) */
  manualPriceOverride?: number;
  /** Cached historical close fetched from the API on purchase date */
  effectivePurchasePrice?: number;
  /** Date the position was sold (YYYY-MM-DD) */
  soldDate?: string;
  /** Total proceeds received from the sale in CAD */
  soldProceedsCAD?: number;
  /** User-provided override for sell price per share */
  soldPriceOverride?: number;
  /** Cached historical close fetched from the API on sell date */
  effectiveSoldPrice?: number;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  profileId: string;
  date: string; // YYYY-MM-DD
  totalValueCAD: number;
  totalInvestedCAD: number;
  /** Time-weighted return index (base 100) — unaffected by new purchases */
  returnIndex: number;
  /** Cumulative return % derived from returnIndex */
  returnPct: number;
  /** Cumulative realized gains from sold positions at snapshot time */
  totalRealizedGainCAD: number;
}

export interface QuoteData {
  price: number;
  dayChange: number;
  dayChangePct: number;
  previousClose: number;
  source: 'yahoo' | 'fmp' | 'unavailable';
  stale: boolean;
  fetchedAt: number;
}

export interface ChartDataPoint {
  date: string;
  close: number;
}

export type Period =
  | '1D'
  | '5D'
  | '1W'
  | '1M'
  | '1Y'
  | 'YTD'
  | '5Y'
  | 'MAX'
  | 'SINCE_BUY'
  | 'CUSTOM';

export type HoldingsFilter = 'active' | 'sold' | 'both';

export interface HoldingWithStats extends Holding {
  currentPrice?: number;
  units?: number;
  currentValue?: number;
  gainLoss?: number;
  gainLossPct?: number;
  priceStale?: boolean;
  priceUnavailable?: boolean;
  /** Intraday change */
  dayChange?: number;
  dayChangePct?: number;
  /** For sold holdings */
  realizedGain?: number;
  realizedGainPct?: number;
}

export interface PortfolioStats {
  totalInvested: number;
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPct: number;
  totalRealizedGain: number;
  activeCount: number;
  soldCount: number;
}

export interface ExportData {
  schemaVersion: number;
  exportedAt: string;
  profiles: Profile[];
  holdings: Holding[];
  snapshots: Snapshot[];
}
