import React, { useState } from 'react';
import { Footprints, CheckCircle2 } from 'lucide-react';
import { DashboardData } from '../../types';

interface WalkInTabProps {
  onRecordWalkIn: (data: { name: string; phone?: string; amount: number; paymentMethod: string }) => Promise<DashboardData>;
}

export const WalkInTab: React.FC<WalkInTabProps> = ({ onRecordWalkIn }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState(4.00);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount < 0) return;

    setLoading(true);
    setSuccessMsg(null);
    const guestName = name.trim() || 'Guest Visitor';
    try {
      await onRecordWalkIn({
        name: guestName,
        phone: phone.trim() || undefined,
        amount,
        paymentMethod,
      });
      setSuccessMsg(`Walk-in recorded! ${guestName} checked in ($${amount.toFixed(2)} via ${paymentMethod}).`);
      setName('');
      setPhone('');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('Failed to record walk-in: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg space-y-4">
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-3 text-emerald-400 font-semibold text-sm animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
          <Footprints className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">Log Daily Pass / Walk-in</h3>
          <p className="text-xs text-slate-400">Collect walk-in entry fee and immediately check in visitor.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Visitor Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 8712345"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Entry Fee ($)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            required
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
          >
            <option value="Cash">Cash</option>
            <option value="Baiduri">Baiduri</option>
            <option value="Bibd">Bibd</option>
            <option value="Coupon">Coupon</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm rounded-lg transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? 'Processing...' : 'Collect Fee & Check-In'}
        </button>
      </form>
    </div>
  );
};
