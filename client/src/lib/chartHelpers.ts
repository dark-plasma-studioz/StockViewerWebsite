export const CHART_GREEN = '#10b981';
export const CHART_RED = '#ef4444';

function interpolateDate(dateA: string, dateB: string, ratio: number): string {
  const msA = new Date(dateA + 'T12:00:00').getTime();
  const msB = new Date(dateB + 'T12:00:00').getTime();
  const ms = msA + (msB - msA) * ratio;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Split a return series into positive/negative segments for green/red line coloring */
export function splitSignedSeries(
  points: Array<{ date: string; value: number }>
): Array<{ date: string; positive: number | null; negative: number | null }> {
  if (points.length === 0) return [];

  const result: Array<{ date: string; positive: number | null; negative: number | null }> = [];

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const prev = i > 0 ? points[i - 1] : null;

    if (
      prev &&
      ((prev.value < 0 && curr.value >= 0) || (prev.value >= 0 && curr.value < 0))
    ) {
      const ratio = Math.abs(prev.value) / (Math.abs(prev.value) + Math.abs(curr.value));
      result.push({ date: interpolateDate(prev.date, curr.date, ratio), positive: 0, negative: 0 });
    }

    result.push({
      date: curr.date,
      positive: curr.value >= 0 ? curr.value : null,
      negative: curr.value < 0 ? curr.value : null,
    });
  }

  return result;
}

export function lineColorForValue(value: number): string {
  return value >= 0 ? CHART_GREEN : CHART_RED;
}

export function lastNumericValue(
  data: Array<Record<string, unknown>>,
  key: string
): number | null {
  for (let i = data.length - 1; i >= 0; i--) {
    const v = data[i][key];
    if (typeof v === 'number') return v;
  }
  return null;
}
