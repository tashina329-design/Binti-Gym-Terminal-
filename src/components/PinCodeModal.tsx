import React, { useState, useEffect } from 'react';
import { Lock, Delete, X, AlertCircle, CheckCircle2, KeyRound, UserPlus, UserCheck, ShieldCheck, Building2, Store } from 'lucide-react';
import { RegisteredStaff } from '../types';

interface PinCodeModalProps {
  isOpen: boolean;
  correctPin: string;
  registeredStaff: RegisteredStaff[];
  selectedStoreName?: string;
  availableStores?: string[];
  onSuccess: (authenticatedStaff?: RegisteredStaff, storeName?: string) => void;
  onRegisterStaff: (staff: RegisteredStaff) => void;
  onCancel: () => void;
}

export const PinCodeModal: React.FC<PinCodeModalProps> = ({
  isOpen,
  correctPin,
  registeredStaff,
  selectedStoreName = 'Binti Gym',
  availableStores = [],
  onSuccess,
  onRegisterStaff,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<'enter_pin' | 'register'>('enter_pin');

  // Multi-Store Input State - User enters their store name directly
  const [storeChoice, setStoreChoice] = useState<string>(selectedStoreName);

  // PIN Unlock State
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Registration Form State
  const [regPin, setRegPin] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg(null);
      setIsSuccess(false);
      setRegPin('');
      setRegError(null);
      setRegSuccess(false);
      setActiveTab('enter_pin');
      setStoreChoice(selectedStoreName || '');
    }
  }, [isOpen, selectedStoreName]);

  // Helper: check duplicate digits in a PIN string
  const hasDuplicateDigits = (pinStr: string): boolean => {
    const chars = pinStr.split('');
    const unique = new Set(chars);
    return unique.size !== chars.length;
  };

  const getResolvedStoreName = (): string => {
    return storeChoice.trim() || selectedStoreName || 'Store Terminal';
  };

  // Keypress handler for 6-digit PIN login
  const handleKeyPress = (digit: string) => {
    if (pin.length >= 6) return;
    setErrorMsg(null);
    const newPin = pin + digit;
    setPin(newPin);

    // Auto verify when 6 digits reached
    if (newPin.length === 6) {
      // Check if matches default staffPin or any registered staff PIN
      const foundStaff = registeredStaff.find((s) => s.pin === newPin);
      const isMasterPin = newPin === correctPin;

      if (foundStaff || isMasterPin) {
        setIsSuccess(true);
        const resolvedStore = getResolvedStoreName();
        setTimeout(() => {
          onSuccess(foundStaff, resolvedStore);
        }, 300);
      } else {
        setErrorMsg('Invalid 6-Digit PIN code. Enter a registered staff PIN for this store terminal.');
        setTimeout(() => {
          setPin('');
        }, 700);
      }
    }
  };

  const handleBackspace = () => {
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg(null);
    setPin('');
  };

  // Handle Staff/Gym Terminal Registration Submit
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const resolvedStore = getResolvedStoreName();
    const cleanName = `${resolvedStore} Terminal`;
    const cleanPin = regPin.trim();

    // 1. PIN must be 6 digits
    if (!/^\d{6}$/.test(cleanPin)) {
      setRegError('PIN code must be exactly 6 numeric digits.');
      return;
    }

    // 2. No duplicate numbers in PIN
    if (hasDuplicateDigits(cleanPin)) {
      setRegError('No duplicate numbers allowed! Every digit in the 6-digit PIN must be unique (e.g. 123456).');
      return;
    }

    // 3. Check if same 6-digit PIN code is already taken during registration
    const pinTaken = registeredStaff.some((s) => s.pin === cleanPin) || cleanPin === correctPin;
    if (pinTaken) {
      setRegError(`Number is taken! The 6-digit PIN "${cleanPin}" is already registered. Please choose another PIN code.`);
      return;
    }

    // Create terminal access staff record
    const newStaff: RegisteredStaff = {
      id: 'STF-' + Math.floor(100000 + Math.random() * 900000),
      name: cleanName,
      phone: 'PIN-' + cleanPin,
      pin: cleanPin,
      registeredAt: new Date().toISOString(),
    };

    onRegisterStaff(newStaff);
    setRegSuccess(true);

    setTimeout(() => {
      onSuccess(newStaff, resolvedStore);
    }, 600);
  };

  // Keyboard support for enter_pin mode
  useEffect(() => {
    if (!isOpen || activeTab !== 'enter_pin') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, activeTab, storeChoice]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-sm sm:max-w-md w-full shadow-2xl relative text-slate-100 flex flex-col items-center max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock / Shield Icon */}
        <div
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-2 transition-all ${
            isSuccess || regSuccess
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 scale-110'
              : errorMsg || regError
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              : 'bg-slate-800 text-emerald-400 border border-slate-700'
          }`}
        >
          {isSuccess || regSuccess ? (
            <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
          ) : (
            <Store className="w-6 h-6 sm:w-7 sm:h-7" />
          )}
        </div>

        <h2 className="text-lg sm:text-xl font-black text-center text-white tracking-tight">
          Store Terminal Authorization & Login
        </h2>
        <p className="text-xs text-slate-400 text-center mb-3 mt-0.5 font-medium">
          Enter Store Terminal Name & 6-Digit Staff PIN
        </p>

        {/* STORE SELECTION PROMPT - USER ENTERS STORE NAME DIRECTLY */}
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3 mb-4 space-y-2">
          <label className="block text-[11px] font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Target Store Terminal Name:
          </label>
          <input
            type="text"
            placeholder="Enter Store / Gym Terminal Name..."
            value={storeChoice}
            onChange={(e) => setStoreChoice(e.target.value)}
            list="available-store-terminals"
            className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold text-emerald-300 focus:outline-none placeholder:text-slate-500 placeholder:font-normal"
          />
          {availableStores.length > 0 && (
            <datalist id="available-store-terminals">
              {availableStores.map((st) => (
                <option key={st} value={st} />
              ))}
            </datalist>
          )}

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 px-0.5">
            <span>Active Target:</span>
            <span className="font-bold text-emerald-400 font-mono">
              {getResolvedStoreName()}
            </span>
          </div>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full mb-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('enter_pin');
              setRegError(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'enter_pin'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" /> Log in to Terminal
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" /> Create 6-Digit PIN
          </button>
        </div>

        {/* TAB 1: Enter 6-Digit PIN */}
        {activeTab === 'enter_pin' && (
          <div className="w-full flex flex-col items-center animate-in fade-in">
            {/* 6-Digit PIN Indicators */}
            <div className="flex gap-2.5 mb-4 justify-center">
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const isFilled = pin.length > index;
                return (
                  <div
                    key={index}
                    className={`w-9 h-11 sm:w-10 sm:h-12 rounded-xl border-2 flex items-center justify-center transition-all ${
                      isSuccess
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : errorMsg
                        ? 'border-rose-500 bg-rose-500/10'
                        : isFilled
                        ? 'border-emerald-400 bg-slate-950 text-emerald-400 font-bold text-2xl shadow-sm'
                        : 'border-slate-800 bg-slate-950 text-slate-600'
                    }`}
                  >
                    {isFilled ? '•' : ''}
                  </div>
                );
              })}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-3 text-xs font-bold text-rose-300 bg-rose-950/60 border border-rose-800/80 px-3 py-2 rounded-xl flex items-center gap-2 text-center animate-in fade-in max-w-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mb-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  className="h-11 sm:h-12 bg-slate-950 hover:bg-slate-800 active:bg-emerald-500 active:text-slate-950 border border-slate-800 rounded-2xl text-xl font-black text-slate-100 shadow-sm transition-all flex items-center justify-center select-none"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="h-11 sm:h-12 bg-rose-950/40 hover:bg-rose-900/60 active:bg-rose-600 border border-rose-800/50 rounded-2xl text-xs font-extrabold text-rose-300 shadow-sm transition-all flex items-center justify-center select-none"
              >
                CLR
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="h-11 sm:h-12 bg-slate-950 hover:bg-slate-800 active:bg-emerald-500 active:text-slate-950 border border-slate-800 rounded-2xl text-xl font-black text-slate-100 shadow-sm transition-all flex items-center justify-center select-none"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleBackspace()}
                className="h-11 sm:h-12 bg-amber-950/40 hover:bg-amber-900/60 active:bg-amber-500 active:text-slate-950 border border-amber-800/50 rounded-2xl text-xs font-bold text-amber-300 shadow-sm transition-all flex items-center justify-center select-none"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <div className="text-[11px] text-slate-500 text-center mt-1">
              {registeredStaff.length > 0 ? (
                <span>
                  Registered Staff:{' '}
                  <strong className="text-slate-300">
                    {registeredStaff.map((s) => s.name).join(', ')}
                  </strong>
                </span>
              ) : (
                <span>
                  Master PIN: <strong className="text-emerald-400 font-mono">123456</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Create 6-Digit PIN Code for Terminal */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="w-full space-y-3.5 animate-in fade-in">
            {regError && (
              <div className="text-xs font-semibold text-rose-300 bg-rose-950/60 border border-rose-800/80 px-3 py-2 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 px-3 py-2 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>6-Digit PIN created successfully! Unlocking {getResolvedStoreName()} terminal...</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Create 6-Digit PIN Code * (No Duplicate Numbers)
              </label>
              <input
                type="password"
                maxLength={6}
                placeholder="e.g. 123456 (Must be 6 unique digits)"
                value={regPin}
                onChange={(e) => setRegPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono font-bold text-sm tracking-widest focus:outline-none focus:border-emerald-500"
                required
              />
              <div className="flex justify-between text-[10px] mt-1">
                <span className={regPin.length === 6 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {regPin.length}/6 Digits
                </span>
                <span
                  className={
                    regPin.length > 0 && hasDuplicateDigits(regPin)
                      ? 'text-rose-400 font-bold'
                      : 'text-slate-500'
                  }
                >
                  {regPin.length > 0 && hasDuplicateDigits(regPin)
                    ? '⚠️ Duplicate numbers detected'
                    : '✓ Unique digits requirement'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={regSuccess}
              className="w-full py-3 mt-2 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" /> Log into {getResolvedStoreName()}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

