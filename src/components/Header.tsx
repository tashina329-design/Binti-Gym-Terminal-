import React, { useState, useRef, useEffect } from 'react';
import {
  Dumbbell,
  RefreshCw,
  QrCode,
  Monitor,
  UserCheck,
  Bell,
  X,
  CheckCircle2,
  LogOut,
  WifiOff,
  Trash2,
  CheckCheck,
  Volume2,
  VolumeX,
  Sparkles,
  Smartphone,
  CreditCard,
  User,
} from 'lucide-react';
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
  isSoundEnabled?: boolean;
  onToggleSound?: () => void;
  onOpenShiftModal: () => void;
  onLockTerminal: () => void;
  onToggleCheckinMode: () => void;
  onRefresh: () => void;
  onClearNotifications?: () => void;
  onClearNotificationItem?: (id: string) => void;
  onTestNotification?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewDate,
  isToday,
  isCheckinMode,
  activeShift,
  notifications = [],
  currentStore = 'Binti Gym',
  syncStatus = 'connected',
  isSoundEnabled = true,
  onToggleSound,
  onOpenShiftModal,
  onLockTerminal,
  onToggleCheckinMode,
  onRefresh,
  onClearNotifications,
  onClearNotificationItem,
  onTestNotification,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const currentDateFormatted = getBruneiFormattedDate();
  const unreadCount = notifications.length;

  // Click outside to close notification dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const getNotificationIcon = (notif: PushNotification) => {
    if (notif.title.toLowerCase().includes('phone')) {
      return <Smartphone className="w-3.5 h-3.5 text-sky-400" />;
    }
    if (notif.title.toLowerCase().includes('walk-in') || notif.title.toLowerCase().includes('pass')) {
      return <CreditCard className="w-3.5 h-3.5 text-amber-400" />;
    }
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  };

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

        {/* Working Staff Shift Status Badge */}
        <button
          onClick={onOpenShiftModal}
          className={`ml-0 sm:ml-1 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
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
        <div className="relative" ref={notifDropdownRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2 rounded-lg border transition-all relative cursor-pointer ${
              unreadCount > 0
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Live Self Check-In Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center animate-bounce shadow">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Drawer */}
          {showNotifications && (
            <div className="absolute right-0 top-11 z-50 w-84 sm:w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200 space-y-3 backdrop-blur-xl">
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      Live Self Check-In Alerts
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {unreadCount === 0 ? 'No new alerts' : `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Sound Chime Toggle */}
                  {onToggleSound && (
                    <button
                      type="button"
                      onClick={onToggleSound}
                      className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                        isSoundEnabled
                          ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400 hover:bg-emerald-900/60'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                      }`}
                      title={isSoundEnabled ? 'Audio chime enabled (Click to mute)' : 'Audio chime muted (Click to unmute)'}
                    >
                      {isSoundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {/* Clear All Notifications Button */}
                  {unreadCount > 0 && onClearNotifications && (
                    <button
                      type="button"
                      onClick={onClearNotifications}
                      className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-rose-100 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Clear all alerts"
                    >
                      <Trash2 className="w-3 h-3" /> Clear All
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Close alerts drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notification Item List */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/40 transition-all text-xs relative group space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {getNotificationIcon(n)}
                          <span className="font-bold text-emerald-400 text-xs">{n.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {n.timestamp}
                          </span>
                          {/* Individual Clear / Dismiss Button */}
                          {onClearNotificationItem && (
                            <button
                              type="button"
                              onClick={() => onClearNotificationItem(n.id)}
                              className="text-slate-500 hover:text-rose-400 p-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Clear this notification"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-slate-200 text-[11px] leading-snug">{n.message}</p>

                      {/* Meta badge */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
                        {n.memberName && (
                          <span className="flex items-center gap-1 text-slate-300 font-medium">
                            <User className="w-3 h-3 text-emerald-400" /> {n.memberName}
                          </span>
                        )}
                        <span className="text-emerald-400/90 font-medium ml-auto flex items-center gap-0.5">
                          ✓ Synced
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 px-4 space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-500">
                      <CheckCheck className="w-5 h-5 text-emerald-400/60" />
                    </div>
                    <p className="text-xs font-semibold text-slate-300">All alerts cleared</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      New self check-in and kiosk activity will appear here in real time.
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                {onTestNotification && (
                  <button
                    type="button"
                    onClick={onTestNotification}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-emerald-950/30 transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> Test Alert & Chime
                  </button>
                )}
                {unreadCount > 0 && onClearNotifications && (
                  <button
                    type="button"
                    onClick={onClearNotifications}
                    className="text-slate-400 hover:text-rose-300 font-medium ml-auto transition py-1 px-2 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    Clear All ({unreadCount})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCheckinMode}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
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
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer"
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


