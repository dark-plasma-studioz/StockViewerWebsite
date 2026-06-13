import type { Period } from '../types';
import { PERIOD_LABELS } from '../lib/periods';

interface PeriodSelectorProps {
  periods: Period[];
  selected: Period;
  onChange: (period: Period) => void;
}

export function PeriodSelector({ periods, selected, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            selected === p
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}
