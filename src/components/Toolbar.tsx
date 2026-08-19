import React from 'react';
import { RefreshCw, Calendar, RotateCcw } from 'lucide-react';

interface ToolbarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onResetToday: () => void;
  onResetDatabase: () => void;
  isRefreshing: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  selectedDate,
  onDateChange,
  onResetToday,
  onResetDatabase,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 bg-slate-800/60 p-3 rounded-xl border border-slate-800">
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-lg text-sm">
        <Calendar className="w-4 h-4 text-emerald-400" />
        <label htmlFor="toolbar-date" className="text-xs font-semibold text-slate-400">
          Summary Date:
        </label>
        <input
          type="date"
          id="toolbar-date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="bg-slate-950 text-slate-100 border border-slate-700 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-emerald-500"
        />
      </div>

      <button
        type="button"
        onClick={onResetToday}
        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
      >
        Today
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onResetDatabase}
          className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          title="Reset database with demo seed records or clear to zero"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset / Seed DB
        </button>
      </div>
    </div>
  );
};
