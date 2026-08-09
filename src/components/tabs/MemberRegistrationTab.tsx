import React, { useState } from 'react';
import { Search, UserPlus, Zap, Trash2 } from 'lucide-react';
import { DashboardData, Member } from '../../types';

interface MemberRegistrationTabProps {
  data: DashboardData;
  onRegisterMember: (data: {
    name: string;
    phone: string;
    planType: string;
    price: number;
    startDate: string;
    endDate: string;
    paymentMethod: string;
  }) => Promise<DashboardData>;
  onOpenRenewModal: (member: Member) => void;
  onDeleteMember?: (memberId: string) => void;
}

export const MemberRegistrationTab: React.FC<MemberRegistrationTabProps> = ({
  data,
  onRegisterMember,
  onOpenRenewModal,
  onDeleteMember,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [planType, setPlanType] = useState('Standard Monthly');
  const [price, setPrice] = useState(55.00);

  const todayStr = new Date().toISOString().split('T')[0];
  const nextMonthObj = new Date();
  nextMonthObj.setMonth(nextMonthObj.getMonth() + 1);
  const nextMonthStr = nextMonthObj.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(nextMonthStr);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);

  const handlePlanChange = (plan: string) => {
    setPlanType(plan);
    setPrice(plan === 'Student Monthly' ? 45.00 : 55.00);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || price < 0) return;

    setLoading(true);
    try {
      await onRegisterMember({
        name,
        phone,
        planType,
        price,
        startDate,
        endDate,
        paymentMethod,
      });
      setName('');
      setPhone('');
    } catch (err: any) {
      alert('Failed to register member: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = searchQuery.trim()
    ? (data.members || []).filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.phone.includes(searchQuery.trim())
      )
    : [];

  const getBadgeStyle = (status: string) => {
    if (status === 'Expiring Soon') return 'bg-amber-950/80 text-amber-300 border border-amber-700/50';
    if (status === 'Expired') return 'bg-rose-950/80 text-rose-300 border border-rose-700/50';
    return 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50';
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-400" /> Search Member Directory
        </h3>
        <div className="relative max-w-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search by name or phone..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 pl-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        </div>

        {/* Search Results */}
        {searchQuery.trim() !== '' && (
          <div className="mt-3 space-y-2 max-w-xl">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((m) => (
                <div
                  key={m.memberId}
                  className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between gap-3 shadow-md"
                >
                  <div>
                    <div className="font-bold text-slate-100 text-sm">{m.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {m.phone} | {m.plan}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Start: {m.startDate} | Renew: <span className="text-slate-300 font-medium">{m.endDate}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getBadgeStyle(m.status)}`}>
                      {m.status}
                    </span>
                    <div className="mt-2">
                      <button
                        onClick={() => onOpenRenewModal(m)}
                        className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Zap className="w-3 h-3" /> Quick Renew
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic p-2">No matching members found.</p>
            )}
          </div>
        )}
      </div>

      <hr className="border-slate-800" />

      {/* New Member Registration Form */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-emerald-400" /> New Member Registration
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 8712345"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Plan Type</label>
            <select
              value={planType}
              onChange={(e) => handlePlanChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="Standard Monthly">Standard Monthly ($55/mo)</option>
              <option value="Student Monthly">Student Monthly ($45/mo)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Fee ($)</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-bold text-emerald-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Registered Date (Start)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Renew Date (Expiry)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="Cash">Cash</option>
              <option value="Baiduri">Baiduri</option>
              <option value="Bibd">Bibd</option>
              <option value="Coupon">Coupon</option>
            </select>
          </div>

          <div className="lg:col-span-1 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Register & Save Sale'}
            </button>
          </div>
        </form>
      </div>

      {/* Members Directory Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-slate-200">Registered Members List</h3>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-700/50 font-bold">
            Total Registered: {data.members ? data.members.length : 0}
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Registered Date</th>
                <th className="p-3">Renew Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.members && data.members.length > 0 ? (
                (searchQuery.trim()
                  ? data.members.filter(
                      (m) =>
                        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        m.phone.includes(searchQuery.trim())
                    )
                  : data.members
                ).map((m) => (
                  <tr key={m.memberId} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-bold text-slate-100">{m.name}</td>
                    <td className="p-3 font-mono text-slate-400">{m.phone}</td>
                    <td className="p-3 text-slate-300">{m.plan}</td>
                    <td className="p-3 text-slate-400">{m.startDate || '-'}</td>
                    <td className="p-3 font-semibold text-slate-200">{m.endDate}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getBadgeStyle(m.status)}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => onOpenRenewModal(m)}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-bold text-[11px] transition-colors inline-flex items-center gap-1"
                          title="Quick renew membership"
                        >
                          <Zap className="w-3 h-3" /> Renew
                        </button>
                        {onDeleteMember && (
                          <button
                            onClick={() => onDeleteMember(m.memberId)}
                            className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors"
                            title="Delete member record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500 italic">
                    No registered members found.
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
