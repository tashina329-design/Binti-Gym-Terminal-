import React, { useState, useEffect } from 'react';
import { Building2, Lock, KeyRound, ArrowRight, ShieldCheck, PlusCircle, LogIn, Store } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { authenticateCloudBusinessStore, fetchStoresFromCloud, broadcastLiveSync } from '../lib/firebaseSync';

interface BusinessAuthModalProps {
  isOpen: boolean;
  onAuthenticated: (businessName: string, pin: string) => void;
  currentBusinessName?: string;
  canClose?: boolean;
  onClose?: () => void;
}

export const BusinessAuthModal: React.FC<BusinessAuthModalProps> = ({
  isOpen,
  onAuthenticated,
  currentBusinessName = '',
  canClose = false,
  onClose,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [businessName, setBusinessName] = useState(currentBusinessName);
  const [selectedStoreFromList, setSelectedStoreFromList] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingStores, setExistingStores] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadExistingStores();
      setError(null);
      setPin('');
      setConfirmPin('');
    }
  }, [isOpen]);

  const loadExistingStores = async () => {
    try {
      let serverNames: string[] = [];
      try {
        const res = await apiFetch('/api/stores');
        if (res && res.stores && Array.isArray(res.stores)) {
          serverNames = res.stores.map((s: any) => s.name);
        }
      } catch {}

      const cloudNames = await fetchStoresFromCloud();
      const merged = Array.from(new Set([...serverNames, ...cloudNames])).filter(Boolean);

      if (merged.length > 0) {
        setExistingStores(merged);
        if (!businessName) {
          setSelectedStoreFromList(merged[0]);
          setBusinessName(merged[0]);
          setMode('login');
        }
      }
    } catch {
      // Fallback ignore
    }
  };

  if (!isOpen) return null;

  const handleDigitClick = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const activeName = (mode === 'login' && selectedStoreFromList ? selectedStoreFromList : businessName).trim();

    if (!activeName) {
      setError('Please enter or select a Business Name.');
      return;
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('Please enter a valid 4-digit PIN code.');
      return;
    }

    if (mode === 'register') {
      if (pin !== confirmPin) {
        setError('PIN codes do not match. Please try again.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/stores/register' : '/api/stores/login';
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: activeName, pin }),
      });

      if (res && res.success) {
        localStorage.setItem('current_business_name', activeName);
        localStorage.setItem('current_business_pin', pin);
        if (res.store) {
          try {
            localStorage.setItem('gym_data_store_v1', JSON.stringify(res.store));
          } catch {}
        }
        await broadcastLiveSync(undefined, res.store, activeName);
        onAuthenticated(activeName, pin);
        return;
      } else if (res && res.message && res.message.includes('Incorrect 4-digit PIN')) {
        setError(res.message);
        return;
      }

      // Try direct cloud authentication across devices if API was not definitive or in fallback mode
      const cloudRes = await authenticateCloudBusinessStore(activeName, pin, mode);
      if (cloudRes.success) {
        localStorage.setItem('current_business_name', activeName);
        localStorage.setItem('current_business_pin', pin);
        if (cloudRes.store) {
          try {
            localStorage.setItem('gym_data_store_v1', JSON.stringify(cloudRes.store));
          } catch {}
        }
        await broadcastLiveSync(undefined, cloudRes.store, activeName);
        onAuthenticated(activeName, pin);
      } else {
        setError(cloudRes.message || 'Authentication failed. Check business name and 4-digit PIN.');
      }
    } catch (err: any) {
      // Fallback to cloud authentication
      try {
        const cloudRes = await authenticateCloudBusinessStore(activeName, pin, mode);
        if (cloudRes.success) {
          localStorage.setItem('current_business_name', activeName);
          localStorage.setItem('current_business_pin', pin);
          if (cloudRes.store) {
            try {
              localStorage.setItem('gym_data_store_v1', JSON.stringify(cloudRes.store));
            } catch {}
          }
          await broadcastLiveSync(undefined, cloudRes.store, activeName);
          onAuthenticated(activeName, pin);
          return;
        } else {
          setError(cloudRes.message || 'Authentication failed. Check business name and 4-digit PIN.');
        }
      } catch {
        setError(err?.message || 'Failed to connect. Check 4-digit PIN and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-slate-800/80 to-slate-900 border-b border-slate-800 text-center relative">
          {canClose && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
            >
              ✕
            </button>
          )}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3 shadow-inner">
            <Building2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Business & Terminal Terminal</h2>
          <p className="text-xs text-slate-400 mt-1">
            Isolated store database synced across all devices
          </p>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 mt-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setPin('');
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl transition ${
                mode === 'login'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Log In Store
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setPin('');
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl transition ${
                mode === 'register'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Register New Store
            </button>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2 animate-shake">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Business Name Field */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              Business Name
            </label>

            {mode === 'login' && existingStores.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={selectedStoreFromList}
                  onChange={(e) => {
                    setSelectedStoreFromList(e.target.value);
                    setBusinessName(e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {existingStores.map((store) => (
                    <option key={store} value={store}>
                      {store}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Or enter custom business name:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedStoreFromList('')}
                    className="text-emerald-400 hover:underline"
                  >
                    Type Name
                  </button>
                </div>
              </div>
            ) : (
              <input
                type="text"
                placeholder="e.g. Binti Gym, Alpha Fitness"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            )}
          </div>

          {/* 4-Digit PIN Input Display */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                {mode === 'register' ? 'Set 4-Digit Security PIN' : 'Enter 4-Digit Security PIN'}
              </span>
              <span className="text-[11px] text-slate-500">4 Numeric Digits</span>
            </label>

            {/* PIN Code Box */}
            <div className="flex justify-center items-center gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-12 h-14 rounded-xl border flex items-center justify-center text-xl font-bold transition-all ${
                      filled
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm'
                        : 'border-slate-800 bg-slate-950 text-slate-600'
                    }`}
                  >
                    {filled ? '●' : ''}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Confirm PIN in Register Mode */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Confirm 4-Digit PIN
                </span>
              </label>
              <input
                type="password"
                maxLength={4}
                placeholder="Confirm 4-Digit PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-center tracking-widest text-lg font-bold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Onscreen Keypad for quick 4-Digit entry */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitClick(digit)}
                className="py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-white font-semibold text-lg rounded-xl transition active:scale-95 shadow-sm border border-slate-700/50"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPin('');
                setError(null);
              }}
              className="py-2.5 bg-slate-800/40 hover:bg-slate-800 text-slate-400 text-xs font-medium rounded-xl transition"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigitClick('0')}
              className="py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-white font-semibold text-lg rounded-xl transition active:scale-95 shadow-sm border border-slate-700/50"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-2.5 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl transition flex items-center justify-center"
            >
              ⌫
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || pin.length !== 4 || !businessName.trim()}
            className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span>{mode === 'register' ? 'Register Store & Sync' : 'Connect & Lock Terminal'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
