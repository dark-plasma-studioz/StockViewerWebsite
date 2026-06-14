import type { Period } from '../types';
import { todayStr } from './calculations';

export const PORTFOLIO_PERIODS: Period[] = [
  '1D', '5D', '1W', '1M', '1Y', 'YTD', '5Y', 'MAX', 'CUSTOM',
];

export const HOLDING_PERIODS: Period[] = [
  ...PORTFOLIO_PERIODS,
  'SINCE_BUY',
];

export const PERIOD_LABELS: Record<Period, string> = {
  '1D': '1D',
  '5D': '5D',
  '1W': '1W',
  '1M': '1M',
  '1Y': '1Y',
  YTD: 'YTD',
  '5Y': '5Y',
  MAX: 'Max',
  SINCE_BUY: 'Since buy',
  CUSTOM: 'Custom',
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addYears(dateStr: string, years: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function getPeriodStartDate(
  period: Period,
  referenceDate?: string,
  sinceBuyDate?: string
): string | null {
  const today = referenceDate ?? todayStr();

  switch (period) {
    case '1D':
      return addDays(today, -1);
    case '5D':
      return addDays(today, -5);
    case '1W':
      return addDays(today, -7);
    case '1M':
      return addMonths(today, -1);
    case '1Y':
      return addYears(today, -1);
    case 'YTD':
      return `${today.slice(0, 4)}-01-01`;
    case '5Y':
      return addYears(today, -5);
    case 'MAX':
      return null;
    case 'SINCE_BUY':
      return sinceBuyDate ?? null;
    case 'CUSTOM':
      return null;
    default:
      return null;
  }
}

export function filterByPeriod<T extends { date: string }>(
  items: T[],
  period: Period,
  sinceBuyDate?: string
): T[] {
  const start = getPeriodStartDate(period, undefined, sinceBuyDate);
  if (start == null) return items;
  return items.filter((item) => item.date >= start);
}

/** Map period to Yahoo Finance chart range param where applicable */
export function periodToYahooRange(period: Period): string {
  switch (period) {
    case '1D':
      return '1d';
    case '5D':
      return '5d';
    case '1W':
      return '5d';
    case '1M':
      return '1mo';
    case '1Y':
      return '1y';
    case 'YTD':
      return 'ytd';
    case '5Y':
      return '5y';
    case 'MAX':
    case 'SINCE_BUY':
    case 'CUSTOM':
      return 'max';
    default:
      return '1mo';
  }
}

export function periodToUnixRange(
  period: Period,
  sinceBuyDate?: string
): { period1: number; period2: number } {
  const today = todayStr();
  const startStr = getPeriodStartDate(period, today, sinceBuyDate) ?? '1970-01-01';
  const period1 = Math.floor(new Date(startStr + 'T00:00:00').getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  return { period1, period2 };
}
