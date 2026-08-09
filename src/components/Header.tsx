import React, { useState } from 'react';
import { Dumbbell, RefreshCw, QrCode, Monitor, UserCheck, Bell, X, CheckCircle2, Lock, LogOut, Building2, WifiOff } from 'lucide-react';
import { StaffShift, PushNotification } from '../types';
import { getBruneiFormattedDate } from '../lib/api';

interface HeaderProps {
  viewDate: string;
  isToday: boolean;
  isCheckinMode: boolean;
  activeShift: StaffShift | null;
  notifications?: PushNotification[];
  currentStore?: string;
  syncStatus?: 'connected' | 'reconnecting' | 'offline';
  onOpenShiftModal: () => void;
  onLockTerminal: () => void;
  onToggleCheckinMode: () => void;
  onRefresh: () => void;
  onOpenStoreLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewDate,
  isToday,
  isCheckinMode,
  activeShift,
  notifications = [],
  currentStore = 'Binti Gym',
  syncStatus = 'connected',
  onOpenShiftModal,
  onLockTerminal,
  onToggleCheckinMode,
  onRefresh,
  onOpenStoreLogin,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const currentDateFormatted = getBruneiFormattedDate();

  const unreadCount = notifications.length;

  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 mb-6 border-b border-slate-800 gap-4 relative">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
          <Dumbbell className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight flex items-center gap-2">
            {currentStore} Terminal
          </h1>
          <p className="text-xs text-slate-400">Store Operations & Daily Financial Ledger</p>
        </div>

        {/* Store Terminal Login / Switcher Button */}
        {onOpenStoreLogin && (
          <button
            onClick={onOpenStoreLogin}
            className="ml-0 sm:ml-1 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-slate-900 hover:bg-slate-800 text-emerald-300 border-emerald-500/30 transition-all shadow-sm cursor-pointer"
            title="Switch Store or Log into Another Store Terminal"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Store Login</span>
          </button>
        )}

        {/* Working Staff Shift Status Badge */}
        <button
          onClick={onOpenShiftModal}
          className={`ml-0 sm:ml-1 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
            activeShift
              ? 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-emerald-500/40 shadow-sm'
              : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
          }`}
          title="Manage Staff Shift"
        >
          <div className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          {activeShift ? (
            <span>
              <strong className="text-emerald-400">{activeShift.staffName}</strong>
              <span className="text-slate-400 font-normal ml-1">({activeShift.startTime})</span>
            </span>
          ) : (
            <span className="text-amber-300 font-bold">No Shift Active — Start Shift</span>
          )}
        </button>

        {/* Separate Log Out / Lock Terminal Button */}
        <button
          onClick={onLockTerminal}
          className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/60 transition-all shadow-sm cursor-pointer"
          title="Lock Terminal & Require 6-Digit PIN Access"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>

        {/* Real-time Cross-Device Sync & Offline Mode Indicator Badge */}
        <div
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
            syncStatus === 'connected'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : syncStatus === 'reconnecting'
              ? 'bg-amber-950/40 border-amber-500/30 text-amber-300 animate-pulse'
              : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
          }`}
          title={
            syncStatus === 'connected'
              ? 'Live multi-device cloud database sync active'
              : syncStatus === 'reconnecting'
              ? 'Reconnecting to cloud server...'
              : 'Offline Mode active: All transactions save locally to device and auto-sync when online'
          }
        >
          <div
            className={`w-2 h-2 rounded-full ${
              syncStatus === 'connected'
                ? 'bg-emerald-400 animate-pulse'
                : syncStatus === 'reconnecting'
                ? 'bg-amber-400 animate-ping'
                : 'bg-amber-400'
            }`}
          />
          {syncStatus === 'offline' ? (
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <RefreshCw className={`w-3 h-3 ${syncStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`} />
          )}
          <span>
            {syncStatus === 'connected'
              ? 'Multi-Device Sync Live'
              : syncStatus === 'reconnecting'
              ? 'Sync Reconnecting...'
              : 'Offline Mode (Local Active)'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 self-end lg:self-center">
        {/* Terminal Push Notification Bell Icon */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2 rounded-lg border transition-all relative ${
              unreadCount > 0
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Self Check-in Push Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Drawer */}
          {showNotifications && (
            <div className="absolute right-0 top-11 z-50 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 animate-in fade-in space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-400" /> Live Self Check-In Alerts
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1 hover:border-emerald-500/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {n.title}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{n.timestamp}</span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-tight">{n.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4 italic">
                    No self check-in notifications yet today.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCheckinMode}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
            isCheckinMode
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/50'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
          }`}
        >
          {isCheckinMode ? (
            <>
              <Monitor className="w-3.5 h-3.5" /> Switch to Binti Gym Terminal
            </>
          ) : (
            <>
              <QrCode className="w-3.5 h-3.5" /> Self Check-In Terminal Mode
            </>
          )}
        </button>

        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="text-right border-l border-slate-800 pl-3">
          <div className="text-xs text-slate-400">{currentDateFormatted}</div>
          <div className="text-xs font-medium text-emerald-400 mt-0.5">
            {isToday ? "Viewing Today's Summary" : `Date: ${viewDate}`}
          </div>
        </div>
      </div>
    </header>
  );
};

