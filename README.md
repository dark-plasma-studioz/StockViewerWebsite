# Family Portfolio Tracker

A private portfolio tracker for families that share a brokerage account. Each family member gets their own profile with accurate cost-basis tracking, live prices, and performance charts.

## Features

- **Profile switching** — one profile per family member, all stored in the browser
- **Holdings tracking** — enter the amount you invested (CAD) and the purchase date; the app calculates current value and gain/loss automatically
- **Live prices** — uses Yahoo Finance via the Node.js server (no API key required); TSX tickers like `XSP.TO` are fully supported
- **CAD-hedged ETF support** — enter tickers with `.TO` suffix (e.g. `XSP.TO`, `VFV.TO`, `ZSP.TO`)
- **Manual price override** — if a ticker isn't found by the API, enter the current price yourself
- **Portfolio return % history** — time-weighted return chart with 1D, 5D, 1W, 1M, 1Y, YTD, 5Y, and Max periods (new purchases won't spike the chart)
- **Per-stock detail view** — click any holding to see stock price history vs your personal return, with the same periods plus "Since buy"
- **Sell tracking** — record sells with date and proceeds; realized gains tracked over time
- **Holdings filter** — dropdown to view Current, Sold, or Both positions
- **Allocation pie chart** — see how each holding makes up your portfolio
- **Export / Import** — download a JSON backup and import it on another device to sync data between family members

## Getting started

### Prerequisites

- Node.js 18 or later
- npm 8 or later

### Install dependencies

```bash
npm install
```

### Configure the server (optional)

```bash
cp server/.env.example server/.env
```

Edit `server/.env` if you want to change the port or add an FMP API key for fallback quotes.

### Run in development

```bash
npm run dev
```

This starts both the React client at [http://localhost:5173](http://localhost:5173) and the API server at [http://localhost:3001](http://localhost:3001). The client proxies all `/api` requests to the server automatically.

## Using the app

### 1. Create profiles

On first launch you will see a welcome screen. Enter a name and click **Create** to add the first profile. You can add more profiles via **"Add profile"** in the header — one per family member.

### 2. Add holdings

Click **"Add holding"** and fill in:

| Field | Description |
|-------|-------------|
| Ticker symbol | The stock or ETF symbol. Use `.TO` suffix for TSX (e.g. `XSP.TO`). |
| Amount invested (CAD) | How much you put in, in Canadian dollars. |
| Purchase date | The date you bought the position. |
| Purchase price override | Optional. Fill in if the API cannot fetch the historical price. |
| Current price override | Optional. Fill in if the ticker is not supported by Yahoo Finance. |

The app will automatically look up the historical closing price on your purchase date to calculate how many units you hold.

### 3. Refresh prices

Click **Refresh** in the header to fetch the latest prices. Prices are cached for 30 minutes on the server so you won't hit rate limits with normal usage.

### 4. Export and import (sync between devices)

Each family member's data lives only in their browser. To sync:

1. On device A, click **Export** to download a `portfolio-backup-YYYY-MM-DD.json` file.
2. On device B, click **Import** and choose the file.
3. Select **Merge** to combine both devices' data, or **Replace all** to overwrite.

## Supported ticker symbols

| Type | Example | Notes |
|------|---------|-------|
| TSX ETF (CAD-hedged) | `XSP.TO` | iShares S&P 500 CAD Hedged |
| TSX ETF (unhedged) | `VFV.TO` | Vanguard S&P 500 |
| TSX stock | `RY.TO` | Royal Bank |
| US stock | `AAPL` | Apple Inc. |
| US ETF | `VTI` | Vanguard Total Market |

You can also enter symbols as `XSP`, `XSP:CA` — the app normalizes them to `XSP.TO`.

## Architecture

```
StockViewerWebsite/
  package.json        npm workspaces root
  client/             React 18 + Vite + TypeScript + Tailwind
    src/
      components/     UI components
      hooks/          usePortfolioStats, usePriceRefresh
      store/          Zustand store (persisted to localStorage)
      lib/            Calculations, API client, export/import utils
      types/          Shared TypeScript interfaces
  server/             Node.js + Express + TypeScript
    src/
      routes/         /api/quote, /api/history
      services/       Yahoo Finance wrapper, TTL cache
```

Data flow:
1. Portfolio data (profiles, holdings, snapshots) lives entirely in the **browser** via `localStorage`.
2. The **server** is a price proxy only — it never stores your holdings.
3. Prices are cached server-side for 30 minutes (quotes) and 24 hours (historical).

## Environment variables

Create `server/.env` from `server/.env.example`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port the API server listens on |
| `FMP_API_KEY` | _(empty)_ | Optional Financial Modeling Prep API key for fallback quotes when Yahoo Finance fails. Free tier gives 250 requests/day — plenty for a family portfolio. Sign up at [financialmodelingprep.com](https://financialmodelingprep.com/developer/docs/). |
