import React from 'react';
import { Trash2 } from 'lucide-react';
import { DashboardData, SalesRecord, AttendanceRecord, ExpenseRecord } from '../../types';

interface SalesTabProps {
  data: DashboardData;
  onDeleteSale?: (record: SalesRecord & { index?: number }) => void;
  onDeleteAttendance?: (record: AttendanceRecord & { index?: number }) => void;
  onDeleteExpense?: (record: ExpenseRecord & { index?: number }) => void;
}

export const SalesTab: React.FC<SalesTabProps> = ({
  data,
  onDeleteSale,
  onDeleteAttendance,
  onDeleteExpense,
}) => {
  const netCash = (data.cashIn || 0) - (data.cashOut || 0);

  const getBadgeStyle = (status: string) => {
    if (status === 'Expiring Soon') return 'bg-amber-950/80 text-amber-300 border border-amber-700/50';
    if (status === 'Expired') return 'bg-rose-950/80 text-rose-300 border border-rose-700/50';
    if (status === 'Expense') return 'bg-rose-950/80 text-rose-300 border border-rose-700/50';
    return 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50';
  };

  return (
    <div className="space-y-6">
      {/* Payment Method Summary */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-3">Payment Method Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-emerald-600/40 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-semibold uppercase text-emerald-400">💵 Net Cash</span>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">${netCash.toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-sky-600/40 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-semibold uppercase text-sky-400">💳 Total Baiduri Sales</span>
            <h3 className="text-2xl font-bold text-sky-400 mt-1">${(data.baiduriIn || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-purple-600/40 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-semibold uppercase text-purple-400">📱 Total BIBD Sales</span>
            <h3 className="text-2xl font-bold text-purple-400 mt-1">${(data.bibdIn || 0).toFixed(2)}</h3>
          </div>
        </div>
      </div>

      {/* Categorized Income Breakdown */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-3">Categorized Income Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">👕 POS & Sauna</span>
            <h3 className="text-lg font-bold text-slate-100 mt-1">${(data.posSalesTotal || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">💃 Classes</span>
            <h3 className="text-lg font-bold text-purple-400 mt-1">${(data.classSalesTotal || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">🏋️‍♂️ PT Payment IN</span>
            <h3 className="text-lg font-bold text-emerald-400 mt-1">${(data.ptSalesTotal || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">💸 PT Payment OUT</span>
            <h3 className="text-lg font-bold text-rose-400 mt-1">${(data.ptPayoutTotal || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">👟 Walk-In Passes</span>
            <h3 className="text-lg font-bold text-sky-400 mt-1">${(data.walkInSalesTotal || 0).toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">💳 Memberships</span>
            <h3 className="text-lg font-bold text-emerald-400 mt-1">${(data.membershipSalesTotal || 0).toFixed(2)}</h3>
          </div>
        </div>
      </div>

      {/* Income & Revenue Log Table */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-2">Income & Revenue Log</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3">Time</th>
                <th className="p-3">Staff on Duty</th>
                <th className="p-3">Category</th>
                <th className="p-3">Details</th>
                <th className="p-3">Payment Method</th>
                <th className="p-3">Amount</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.todaySales && data.todaySales.length > 0 ? (
                data.todaySales.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{s.time}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800/90 text-slate-300 border border-slate-700">
                        👤 {s.staff || 'Duty Staff'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                        {s.category}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-slate-200">{s.customer}</td>
                    <td className="p-3 text-slate-400">{s.payment}</td>
                    <td className="p-3 font-bold text-emerald-400">+${Number(s.amount).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      {onDeleteSale && (
                        <button
                          type="button"
                          onClick={() => onDeleteSale({ ...s, index: i })}
                          className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors"
                          title="Delete sale record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500 italic">
                    No sales recorded for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Log Table */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-2">Attendance Log</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3">Time</th>
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Plan / Activity</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.todayAttendance && data.todayAttendance.length > 0 ? (
                data.todayAttendance.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{a.time}</td>
                    <td className="p-3 font-bold text-slate-100">{a.name}</td>
                    <td className="p-3 text-slate-400">{a.phone}</td>
                    <td className="p-3 text-slate-300">{a.plan}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getBadgeStyle(a.status)}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {onDeleteAttendance && (
                        <button
                          type="button"
                          onClick={() => onDeleteAttendance({ ...a, index: i })}
                          className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors"
                          title="Delete attendance log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                    No check-ins recorded for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Outflows Table */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-2">Expense Outflows</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3">Time</th>
                <th className="p-3">Staff on Duty</th>
                <th className="p-3">Category</th>
                <th className="p-3">Description</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Amount</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.todayExpenses && data.todayExpenses.length > 0 ? (
                data.todayExpenses.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{e.time}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800/90 text-slate-300 border border-slate-700">
                        👤 {e.staff || 'Duty Staff'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/50">
                        {e.category}
                      </span>
                    </td>
                    <td className="p-3 text-slate-200">{e.description}</td>
                    <td className="p-3 text-slate-400">{e.payment}</td>
                    <td className="p-3 font-bold text-rose-400">-${Number(e.amount).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      {onDeleteExpense && (
                        <button
                          type="button"
                          onClick={() => onDeleteExpense({ ...e, index: i })}
                          className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors"
                          title="Delete expense record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500 italic">
                    No expenses recorded for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
