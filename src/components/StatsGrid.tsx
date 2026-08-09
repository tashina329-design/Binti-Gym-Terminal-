import React from 'react';
import { DollarSign, TrendingDown, Wallet, Users, AlertTriangle } from 'lucide-react';
import { DashboardData } from '../types';

interface StatsGridProps {
  data: DashboardData;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ data }) => {
  const totalRev = Number(data?.totalRevenue) || 0;
  const totalExp = Number(data?.totalExpenses) || 0;
  const netInc = Number(data?.netIncome) || 0;
  const checkinCnt = Number(data?.checkinCount) || 0;
  const expiringCnt = Number(data?.expiringCount) || 0;
  const isNetPositive = netInc >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
      <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/70 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Gross Sales</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-emerald-400">
          ${totalRev.toFixed(2)}
        </h2>
      </div>

      <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/70 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Expenses</span>
          <TrendingDown className="w-4 h-4 text-rose-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-rose-400">
          ${totalExp.toFixed(2)}
        </h2>
      </div>

      <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/70 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Net Profit</span>
          <Wallet className={`w-4 h-4 ${isNetPositive ? 'text-emerald-400' : 'text-rose-400'}`} />
        </div>
        <h2 className={`text-xl sm:text-2xl font-bold ${isNetPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          ${netInc.toFixed(2)}
        </h2>
      </div>

      <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/70 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Check-Ins</span>
          <Users className="w-4 h-4 text-sky-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-sky-400">
          {checkinCnt}
        </h2>
      </div>

      <div className="bg-slate-800/80 p-4 rounded-xl border border-amber-900/50 shadow-sm col-span-2 md:col-span-1">
        <div className="flex items-center justify-between text-amber-400/90 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Expiring Soon</span>
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-amber-400">
          {expiringCnt}
        </h2>
      </div>
    </div>
  );
};
