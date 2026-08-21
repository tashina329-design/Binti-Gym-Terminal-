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
  AlertCircle,
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
  isOpenNotifications?: boolean;
  onToggleNotifications?: (isOpen: boolean) => void;
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
  isOpenNotifications,
  onToggleNotifications,
}) => {
  const [internalShowNotifications, setInternalShowNotifications] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const showNotifications = isOpenNotifications !== undefined ? isOpenNotifications : internalShowNotifications;
  const setShowNotifications = (val: boolean) => {
    if (onToggleNotifications) {
      onToggleNotifications(val);
    } else {
      setInternalShowNotifications(val);
    }
  };

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
    if (notif.type === 'expired' || notif.type === 'blocked' || notif.title.toLowerCase().includes('expired') || notif.title.toLowerCase().includes('blocked')) {
      return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
    }
    if (notif.title.toLowerCase().includes('phone')) {
      return <Smartphone className="w-3.5 h-3.5 text-sky-400" />;
    }
    if (notif.title.toLowerCase().includes('walk-in') || notif.title.toLowerCase().includes('pass')) {
      return <CreditCard className="w-3.5 h-3.5 text-amber-400" />;
    }
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  };

  return (
    <header className="pb-4 mb-6 border-b border-slate-800 space-y-3 relative">
      {/* Top Main Row: Logo, Title & Primary Action Controls */}
      <div className="flex items-center justify-between gap-2 w-full">
        {/* Left: Logo & Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
            <Dumbbell className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="truncate">
            <h1 className="text-base sm:text-2xl font-bold text-emerald-400 tracking-tight flex items-center gap-2 truncate">
              {currentStore} Terminal
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate">Store Operations & Financial Ledger</p>
          </div>
        </div>

        {/* Right: Quick Action Controls (Sound, Notifications Bell, Staff Status) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0" ref={notifDropdownRef}>
          {/* Sound Chime Toggle */}
          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              className={`p-2 sm:p-2.5 rounded-xl border text-xs transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center ${
                isSoundEnabled
                  ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400 hover:bg-emerald-900/60'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
              title={isSoundEnabled ? 'Audio chime enabled (Click to mute)' : 'Audio chime muted (Click to unmute)'}
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}

          {/* Terminal Push Notification Bell Icon with Unread Pulse */}
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2 sm:p-2.5 rounded-xl border transition-all relative cursor-pointer min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center ${
              unreadCount > 0
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 hover:bg-amber-500/30 ring-2 ring-amber-500/30'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Live Self Check-In Alerts & Notifications"
          >
            <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-300'}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-lg ring-2 ring-slate-950">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Desktop Right Controls (Mode Toggle & Refresh) */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={onToggleCheckinMode}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer min-h-[38px] ${
                isCheckinMode
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {isCheckinMode ? (
                <>
                  <Monitor className="w-3.5 h-3.5" /> Staff Terminal
                </>
              ) : (
                <>
                  <QrCode className="w-3.5 h-3.5" /> Customer Kiosk Mode
                </>
              )}
            </button>

            <button
              onClick={onRefresh}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Second Row: Staff Shift Status, Logout & Sync Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
        <div className="flex flex-wrap items-center gap-2">
          {/* Working Staff Shift Status Badge */}
          <button
            onClick={onOpenShiftModal}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer min-h-[34px] ${
              activeShift
                ? 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-emerald-500/40 shadow-sm'
                : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40 animate-pulse'
            }`}
            title="Staff Shift Duty Status"
          >
            <div className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
            <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {activeShift ? (
              <span className="truncate max-w-[130px] sm:max-w-none">
                <strong className="text-emerald-400">{activeShift.staffName}</strong>
                <span className="text-slate-400 font-normal ml-1">({activeShift.startTime})</span>
              </span>
            ) : (
              <span className="text-rose-300 font-bold">🔒 No Staff — Clock In</span>
            )}
          </button>

          {/* Separate Log Out / Lock Terminal Button */}
          <button
            onClick={onLockTerminal}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/60 transition-all shadow-sm cursor-pointer min-h-[34px]"
            title="Lock Terminal & Require 6-Digit PIN Access"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>

          {/* Real-time Cross-Device Sync & Offline Mode Indicator Badge */}
          <div
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all min-h-[34px] ${
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
              className={`w-2 h-2 rounded-full shrink-0 ${
                syncStatus === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : syncStatus === 'reconnecting'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-amber-400'
              }`}
            />
            {syncStatus === 'offline' ? (
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <RefreshCw className={`w-3 h-3 shrink-0 ${syncStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`} />
            )}
            <span className="text-[11px] sm:text-xs">
              {syncStatus === 'connected'
                ? 'Sync Live'
                : syncStatus === 'reconnecting'
                ? 'Reconnecting...'
                : 'Offline Mode'}
            </span>
          </div>
        </div>

        {/* Mobile Sub-Toolbar (Mode Toggle, Refresh & Date) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full lg:w-auto lg:hidden pt-1">
          <button
            onClick={onToggleCheckinMode}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all cursor-pointer min-h-[32px] ${
              isCheckinMode
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {isCheckinMode ? (
              <>
                <Monitor className="w-3 h-3" /> Staff View
              </>
            ) : (
              <>
                <QrCode className="w-3 h-3" /> Kiosk Mode
              </>
            )}
          </button>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <div className="text-right text-[11px] text-slate-400 font-mono">
            {currentDateFormatted}
          </div>
        </div>

        {/* Desktop Date Display */}
        <div className="hidden lg:block text-right border-l border-slate-800 pl-3">
          <div className="text-xs text-slate-400">{currentDateFormatted}</div>
          <div className="text-xs font-medium text-emerald-400 mt-0.5">
            {isToday ? "Viewing Today's Summary" : `Date: ${viewDate}`}
          </div>
        </div>
      </div>

      {/* Notifications Drawer (Mobile: Full-width Centered Modal with backdrop / Desktop: Dropdown) */}
      {showNotifications && (
        <>
          {/* Mobile Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99998] md:hidden animate-in fade-in duration-200"
            onClick={() => setShowNotifications(false)}
          />

          <div
            className="fixed inset-x-3 top-16 md:absolute md:inset-x-auto md:right-0 md:top-12 z-[99999] md:w-[380px] max-w-lg bg-slate-900 border-2 border-emerald-500/40 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-4 animate-in fade-in slide-in-from-top-3 duration-200 space-y-3 backdrop-blur-2xl"
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    Live Check-In Alerts
                  </h3>
                  <p className="text-[11px] text-slate-400">
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
                    className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
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
                    className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-rose-100 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Clear all alerts"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                  title="Close alerts drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification Item List */}
            <div className="max-h-[60vh] md:max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {notifications.length > 0 ? (
                notifications.map((n) => {
                  const isExpiredItem = n.type === 'expired' || n.type === 'blocked' || n.title.toLowerCase().includes('expired') || n.title.toLowerCase().includes('blocked');
                  return (
                    <div
                      key={n.id}
                      className={`p-3 rounded-2xl border transition-all text-xs relative group space-y-1.5 shadow-sm ${
                        isExpiredItem
                          ? 'bg-rose-950/40 border-rose-800/80 hover:border-rose-500'
                          : 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {getNotificationIcon(n)}
                          <span className={`font-bold text-xs ${isExpiredItem ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {n.title}
                          </span>
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
                              className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Clear this notification"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-slate-200 text-xs leading-snug">{n.message}</p>

                      {/* Meta badge */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
                        {n.memberName && (
                          <span className="flex items-center gap-1 text-slate-300 font-medium">
                            <User className={`w-3 h-3 ${isExpiredItem ? 'text-rose-400' : 'text-emerald-400'}`} /> {n.memberName}
                          </span>
                        )}
                        <span className={`${isExpiredItem ? 'text-rose-400 font-bold' : 'text-emerald-400/90 font-medium'} ml-auto flex items-center gap-0.5`}>
                          {isExpiredItem ? '⚠️ Action Required' : '✓ Synced'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 px-4 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-500">
                    <CheckCheck className="w-6 h-6 text-emerald-400/80" />
                  </div>
                  <p className="text-xs font-bold text-slate-200">All alerts cleared</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    New self check-in, walk-in, and member activity will appear here in real time with audio chime.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
              {onTestNotification && (
                <button
                  type="button"
                  onClick={onTestNotification}
                  className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-950/60 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Test Alert Chime
                </button>
              )}
              {unreadCount > 0 && onClearNotifications && (
                <button
                  type="button"
                  onClick={onClearNotifications}
                  className="text-slate-400 hover:text-rose-300 font-medium ml-auto transition py-1.5 px-3 rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  Clear All ({unreadCount})
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};


