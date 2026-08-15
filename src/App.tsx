import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, AlertTriangle, Lock, Play, UserCheck, Bell, X } from 'lucide-react';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { StatsGrid } from './components/StatsGrid';
import { NavigationTabs, TabId } from './components/NavigationTabs';
import { SalesTab } from './components/tabs/SalesTab';
import { PhoneCheckinTab } from './components/tabs/PhoneCheckinTab';
import { PosTab } from './components/tabs/PosTab';
import { ClassesTab } from './components/tabs/ClassesTab';
import { PersonalTrainerTab } from './components/tabs/PersonalTrainerTab';
import { WalkInTab } from './components/tabs/WalkInTab';
import { MemberRegistrationTab } from './components/tabs/MemberRegistrationTab';
import { ExpenseTab } from './components/tabs/ExpenseTab';
import { QrPosterTab } from './components/tabs/QrPosterTab';
import { GoogleSheetsTab } from './components/tabs/GoogleSheetsTab';
import { QuickRenewModal } from './components/QuickRenewModal';
import { EntranceCheckInView } from './components/EntranceCheckInView';
import { StaffShiftModal } from './components/StaffShiftModal';
import { BusinessAuthModal } from './components/BusinessAuthModal';
import { playSelfCheckinNotificationSound } from './lib/soundNotification';
import {
  subscribeFirestoreBusiness,
  dbCheckInPhone,
  dbCheckInId,
  dbRecordWalkIn,
  dbRecordPOS,
  dbRecordClass,
  dbRecordPTIn,
  dbRecordPTOut,
  dbRecordExpense,
  dbRegisterMember,
  dbRenewMember,
  dbDeleteSale,
  dbDeleteAttendance,
  dbDeleteExpense,
  dbDeleteMember,
  dbStartShift,
  dbEndShift,
  dbResetDemoData,
  fetchStoresFromCloud,
  getBruneiTodayIsoDate,
  SyncEventPayload,
} from './lib/firebaseSync';

import { DashboardData, Member, CheckInResponse, StaffShift, PushNotification } from './types';

export default function App() {
  const getTodayIsoDate = () => getBruneiTodayIsoDate();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayIsoDate());
  const [activeTab, setActiveTab] = useState<TabId>('sales');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckinMode, setIsCheckinMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('p') === 'checkin' || params.get('mode') === 'checkin' || window.location.hash === '#checkin';
    }
    return false;
  });

  const [syncStatus, setSyncStatus] = useState<'connected' | 'reconnecting' | 'offline'>('connected');

  // Listen for URL parameter changes or hash changes for QR Code entrance terminal
  useEffect(() => {
    const checkUrlMode = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('p') === 'checkin' || params.get('mode') === 'checkin' || window.location.hash === '#checkin') {
          setIsCheckinMode(true);
        }
      }
    };

    checkUrlMode();
    window.addEventListener('popstate', checkUrlMode);
    window.addEventListener('hashchange', checkUrlMode);
    return () => {
      window.removeEventListener('popstate', checkUrlMode);
      window.removeEventListener('hashchange', checkUrlMode);
    };
  }, []);

  // Multi-Store Terminal State (persisted in localStorage)
  const [currentBusinessName, setCurrentBusinessName] = useState<string>(() => {
    try {
      return localStorage.getItem('current_business_name') || '';
    } catch {
      return '';
    }
  });

  const [currentBusinessPin, setCurrentBusinessPin] = useState<string>(() => {
    try {
      return localStorage.getItem('current_business_pin') || '';
    } catch {
      return '';
    }
  });

  const [showBusinessAuthModal, setShowBusinessAuthModal] = useState<boolean>(
    () => !currentBusinessName || !currentBusinessPin
  );

  const [currentStore, setCurrentStore] = useState<string>(() => {
    return currentBusinessName || localStorage.getItem('current_store_name') || 'Binti Gym';
  });

  const [availableStores, setAvailableStores] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gym_available_stores');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    fetchStoresFromCloud().then((stores) => {
      if (stores && stores.length > 0) {
        setAvailableStores(stores);
        try {
          localStorage.setItem('gym_available_stores', JSON.stringify(stores));
        } catch {}
      }
    });
  }, []);

  const handleBusinessAuthenticated = (bizName: string, pin: string) => {
    setCurrentBusinessName(bizName);
    setCurrentBusinessPin(pin);
    setCurrentStore(bizName);
    try {
      localStorage.setItem('current_store_name', bizName);
      localStorage.setItem('current_business_name', bizName);
      localStorage.setItem('current_business_pin', pin);
    } catch {}
    setShowBusinessAuthModal(false);
  };

  const handleLogout = () => {
    setCurrentBusinessName('');
    setCurrentBusinessPin('');
    try {
      localStorage.removeItem('current_business_name');
      localStorage.removeItem('current_business_pin');
      localStorage.removeItem('current_store_name');
    } catch {}
    setShowBusinessAuthModal(true);
  };

  // Terminal Push Notifications State
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [activePushBanner, setActivePushBanner] = useState<PushNotification | null>(null);

  const triggerSelfCheckinNotification = (
    title: string,
    message: string,
    memberName?: string,
    memberId?: string
  ) => {
    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const newNotif: PushNotification = {
      id: 'notif-' + Date.now(),
      title,
      message,
      timestamp: timeStr,
      memberName,
      memberId,
      type: 'checkin',
      read: false,
    };

    // Sound chime notification
    playSelfCheckinNotificationSound();

    setNotifications((prev) => [newNotif, ...prev]);
    setActivePushBanner(newNotif);

    // Auto dismiss banner after 6s
    setTimeout(() => {
      setActivePushBanner((current) => (current?.id === newNotif.id ? null : current));
    }, 6000);
  };

  const [activeShift, setActiveShift] = useState<StaffShift | null>(null);
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [dismissShiftBanner, setDismissShiftBanner] = useState<boolean>(false);

  // Quick renew modal state
  const [renewMember, setRenewMember] = useState<Member | null>(null);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'sale' | 'attendance' | 'expense' | 'member';
    title: string;
    subtitle: string;
    data: any;
  } | null>(null);

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    posSalesTotal: 0,
    classSalesTotal: 0,
    ptSalesTotal: 0,
    ptPayoutTotal: 0,
    walkInSalesTotal: 0,
    membershipSalesTotal: 0,
    checkinCount: 0,
    expiringCount: 0,
    todayAttendance: [],
    todaySales: [],
    todayExpenses: [],
    members: [],
    cashIn: 0,
    cashOut: 0,
    baiduriIn: 0,
    bibdIn: 0,
    ptDetails: [],
    viewDate: getTodayIsoDate(),
  });

  // Real-Time Firestore Single Source of Truth Subscription
  useEffect(() => {
    if (!currentStore) return;

    const unsubscribe = subscribeFirestoreBusiness(
      currentStore,
      (liveDashboard: DashboardData, eventData?: SyncEventPayload, isRemote?: boolean) => {
        setDashboardData(liveDashboard);
        if (liveDashboard.store?.activeShift !== undefined) {
          setActiveShift(liveDashboard.store.activeShift);
        }
        if (liveDashboard.store?.availableStores && liveDashboard.store.availableStores.length > 0) {
          setAvailableStores(liveDashboard.store.availableStores);
        }

        // If change came from another device/terminal in real-time, play audio chime & show notification
        if (isRemote && eventData) {
          const title = eventData.title || '⚡ Live Cloud Sync Alert';
          const message = eventData.message || 'Data updated in real time from another terminal.';
          const timeStr =
            eventData.timestamp ||
            new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            });

          playSelfCheckinNotificationSound(
            eventData.type === 'pos' || eventData.type === 'walkin' ? 'sale' : 'checkin'
          );

          const newNotif: PushNotification = {
            id: 'notif-' + Date.now(),
            title,
            message,
            timestamp: timeStr,
            memberName: eventData.memberName,
            memberId: eventData.memberId,
            type: 'checkin',
            read: false,
          };

          setNotifications((prev) => [newNotif, ...prev]);
          setActivePushBanner(newNotif);

          setTimeout(() => {
            setActivePushBanner((current) => (current?.id === newNotif.id ? null : current));
          }, 6000);
        }
      },
      (status) => {
        setSyncStatus(status);
      },
      selectedDate
    );

    return () => unsubscribe();
  }, [currentStore, selectedDate]);

  // Handler functions
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handleResetToday = () => {
    const today = getTodayIsoDate();
    setSelectedDate(today);
  };

  const handleResetDatabase = async () => {
    if (!window.confirm('Reset Firestore database to standard demo seed records?')) return;
    setIsRefreshing(true);
    try {
      await dbResetDemoData(currentStore);
    } catch (err: any) {
      alert('Error resetting database: ' + (err.message || err));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Check-In API calls
  const handleCheckinPhone = async (phone: string): Promise<CheckInResponse> => {
    try {
      const result = await dbCheckInPhone(currentStore, phone);
      if (result.success && !result.multiple) {
        const matchedMember = result.members?.[0];
        const name = matchedMember?.fullName || 'Member';
        triggerSelfCheckinNotification(
          '🔔 Self Check-In Alert',
          `${name} checked in via terminal using Phone (${phone})!`,
          name,
          matchedMember?.memberId
        );
      }
      return result;
    } catch (err: any) {
      return { success: false, message: err.message || 'Check-in failed.' };
    }
  };

  const handleCheckinId = async (memberId: string): Promise<CheckInResponse> => {
    try {
      const result = await dbCheckInId(currentStore, memberId);
      if (result.success) {
        triggerSelfCheckinNotification(
          '🔔 Self Check-In Alert',
          `Member #${memberId} successfully checked in at Binti Gym terminal!`,
          `Member #${memberId}`,
          memberId
        );
      }
      return result;
    } catch (err: any) {
      return { success: false, message: err.message || 'Check-in failed.' };
    }
  };

  // Transaction Actions (Direct Firestore Subcollection Writes)
  const handleRecordWalkIn = async (data: { name: string; phone?: string; amount: number; paymentMethod: string }) => {
    await dbRecordWalkIn(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    });

    if (isCheckinMode) {
      triggerSelfCheckinNotification(
        '🔔 Walk-In Pass Check-In Alert',
        `Guest ${data.name || 'Walk-In'} registered & checked in ($${data.amount || 4.0})!`,
        data.name
      );
    }
    return dashboardData;
  };

  const handleRecordPOS = async (data: { itemName: string; qty: number; amount: number; paymentMethod: string }) => {
    await dbRecordPOS(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    });
    return dashboardData;
  };

  const handleRecordClass = async (data: { className: string; clientName: string; amount: number; paymentMethod: string }) => {
    await dbRecordClass(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    });
    return dashboardData;
  };

  const handleRecordPTIn = async (data: { trainerName: string; clientName: string; sessions: string; amount: number; paymentMethod: string }) => {
    await dbRecordPTIn(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    });
    return dashboardData;
  };

  const handleRecordPTOut = async (data: { trainerName: string; description: string; amount: number; paymentMethod: string }) => {
    await dbRecordPTOut(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    });
    return dashboardData;
  };

  const handleRecordExpense = async (data: { category: string; description: string; amount: number; paymentMethod: string }) => {
    await dbRecordExpense(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    });
    return dashboardData;
  };

  const handleRegisterMember = async (data: {
    name: string;
    phone: string;
    planType: string;
    price: number;
    startDate: string;
    endDate: string;
    paymentMethod: string;
  }) => {
    await dbRegisterMember(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    });
    return dashboardData;
  };

  const handleConfirmRenew = async (data: {
    memberId: string;
    planType: string;
    price: number;
    paymentMethod: string;
  }) => {
    await dbRenewMember(currentStore, {
      ...data,
      viewDate: selectedDate,
      staff: activeShift?.staffName || 'Duty Staff',
    });
    return dashboardData;
  };

  // Deletion Handlers triggering custom confirmation modal
  const handleDeleteSale = (record: any) => {
    setDeleteTarget({
      type: 'sale',
      title: 'Delete Income Record',
      subtitle: `Are you sure you want to delete "${record.customer || record.category}" ($${Number(record.amount || 0).toFixed(2)})?`,
      data: record,
    });
  };

  const handleDeleteAttendance = (record: any) => {
    setDeleteTarget({
      type: 'attendance',
      title: 'Delete Attendance Log',
      subtitle: `Are you sure you want to delete check-in log for "${record.name}" (${record.phone})?`,
      data: record,
    });
  };

  const handleDeleteExpense = (record: any) => {
    setDeleteTarget({
      type: 'expense',
      title: 'Delete Expense Record',
      subtitle: `Are you sure you want to delete expense "${record.description || record.category}" ($${Number(record.amount || 0).toFixed(2)})?`,
      data: record,
    });
  };

  const handleDeleteMember = (memberId: string) => {
    const member = dashboardData.members?.find((m) => m.memberId === memberId);
    const nameStr = member ? member.name : memberId;
    setDeleteTarget({
      type: 'member',
      title: 'Delete Member Record',
      subtitle: `Are you sure you want to delete registered member "${nameStr}"? This action cannot be undone.`,
      data: { memberId },
    });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const { type, data } = deleteTarget;
    setDeleteTarget(null);

    try {
      if (type === 'sale') {
        await dbDeleteSale(currentStore, data);
      } else if (type === 'attendance') {
        await dbDeleteAttendance(currentStore, data);
      } else if (type === 'expense') {
        await dbDeleteExpense(currentStore, data);
      } else if (type === 'member') {
        await dbDeleteMember(currentStore, data.memberId || data);
      }
    } catch (err: any) {
      console.error('Delete error in Firestore:', err);
    }
  };

  const handleStartShift = async (shift: StaffShift) => {
    setActiveShift(shift);
    await dbStartShift(currentStore, shift);
    setShowShiftModal(false);
  };

  const handleEndShift = async () => {
    setActiveShift(null);
    await dbEndShift(currentStore);
    setShowShiftModal(false);
  };

  // Standalone Customer Entrance Check-In Terminal Mode
  if (isCheckinMode) {
    return (
      <div className="relative min-h-screen">
        {/* Floating Push Notification Banner in Check-in Mode */}
        {activePushBanner && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in slide-in-from-top duration-300">
            <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl shadow-emerald-950/80 flex items-start justify-between gap-3 text-slate-100 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 animate-pulse">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                      {activePushBanner.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {activePushBanner.timestamp}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-100 mt-0.5 leading-snug">
                    {activePushBanner.message}
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-emerald-400 mt-1">
                    ✓ Logged to Firestore Cloud Database
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePushBanner(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <EntranceCheckInView
          onCheckinPhone={handleCheckinPhone}
          onCheckinId={handleCheckinId}
          onRecordWalkIn={handleRecordWalkIn}
          onBackToStaffPOS={() => {
            setIsCheckinMode(false);
            if (typeof window !== 'undefined' && window.location.search.includes('checkin')) {
              window.history.pushState(null, '', window.location.pathname);
            }
          }}
          currentStore={currentBusinessName || currentStore}
          availableStores={availableStores}
          currentBusinessPin={currentBusinessPin}
        />
      </div>
    );
  }

  const isToday = selectedDate === getTodayIsoDate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-5 lg:p-8 font-sans pb-28 md:pb-8 relative">
      {/* Floating Push Notification Banner on Main Terminal */}
      {activePushBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in slide-in-from-top duration-300">
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl shadow-emerald-950/80 flex items-start justify-between gap-3 text-slate-100 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 animate-pulse">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                    {activePushBanner.title}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {activePushBanner.timestamp}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 mt-0.5 leading-snug">
                  {activePushBanner.message}
                </p>
                <span className="inline-block text-[10px] font-semibold text-emerald-400 mt-1">
                  ✓ Synced across all terminal screens
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActivePushBanner(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <Header
          viewDate={selectedDate}
          isToday={selectedDate === getTodayIsoDate()}
          isCheckinMode={isCheckinMode}
          activeShift={activeShift}
          notifications={notifications}
          currentStore={currentBusinessName || currentStore}
          syncStatus={syncStatus}
          onOpenShiftModal={() => setShowShiftModal(true)}
          onLockTerminal={handleLogout}
          onToggleCheckinMode={() => setIsCheckinMode(true)}
          onRefresh={() => {
            setIsRefreshing(true);
            setTimeout(() => setIsRefreshing(false), 500);
          }}
        />

        {/* Global Toolbar & Date Navigation */}
        <Toolbar
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onResetToday={handleResetToday}
          onResetDatabase={handleResetDatabase}
          isRefreshing={isRefreshing}
          onRefresh={() => {
            setIsRefreshing(true);
            setTimeout(() => setIsRefreshing(false), 500);
          }}
        />

        {/* Shift Warning Banner if not started */}
        {!activeShift && !dismissShiftBanner && (
          <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-amber-200 backdrop-blur-sm relative">
            <div className="flex items-center gap-3 pr-6 sm:pr-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-amber-100">No Active Staff Shift Started</p>
                <p className="text-[11px] sm:text-xs text-amber-300/80">
                  Transactions are logged under generic "Duty Staff". Start a shift to track cashier duty & starting float.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setShowShiftModal(true)}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition shrink-0 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" /> Start Duty Shift
              </button>
              <button
                type="button"
                onClick={() => setDismissShiftBanner(true)}
                className="p-1.5 text-amber-400/60 hover:text-amber-200 rounded-lg hover:bg-amber-900/40 transition cursor-pointer"
                title="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Operational Statistics Grid */}
        <StatsGrid
          data={dashboardData}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Navigation Tabs Bar (Positioned between Gross Sales & Payment Method Summary) */}
        <NavigationTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeShift={activeShift}
          onOpenShiftModal={() => setShowShiftModal(true)}
          onToggleCheckinMode={() => setIsCheckinMode(true)}
        />

        {/* Active Tab View Content */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl">
          {activeTab === 'sales' && (
            <SalesTab
              data={dashboardData}
              onDeleteSale={handleDeleteSale}
              onDeleteAttendance={handleDeleteAttendance}
              onDeleteExpense={handleDeleteExpense}
            />
          )}

          {activeTab === 'staffcheckin' && (
            <PhoneCheckinTab
              onCheckinPhone={handleCheckinPhone}
              onCheckinId={handleCheckinId}
            />
          )}

          {activeTab === 'pos' && <PosTab onRecordPOS={handleRecordPOS} />}

          {activeTab === 'classes' && <ClassesTab onRecordClass={handleRecordClass} />}

          {activeTab === 'pt' && (
            <PersonalTrainerTab
              onRecordPTIn={handleRecordPTIn}
              onRecordPTOut={handleRecordPTOut}
            />
          )}

          {activeTab === 'walkin' && <WalkInTab onRecordWalkIn={handleRecordWalkIn} />}

          {activeTab === 'membership' && (
            <MemberRegistrationTab
              data={dashboardData}
              onRegisterMember={handleRegisterMember}
              onOpenRenewModal={(m) => setRenewMember(m)}
              onDeleteMember={handleDeleteMember}
            />
          )}

          {activeTab === 'expense' && <ExpenseTab onRecordExpense={handleRecordExpense} />}

          {activeTab === 'qrposter' && <QrPosterTab />}

          {activeTab === 'sheets' && <GoogleSheetsTab dashboardData={dashboardData} />}
        </div>
      </div>

      {/* Quick Renew Modal */}
      <QuickRenewModal
        member={renewMember}
        onClose={() => setRenewMember(null)}
        onConfirmRenew={handleConfirmRenew}
      />

      {/* Staff Shift Management Modal */}
      <StaffShiftModal
        isOpen={showShiftModal}
        activeShift={activeShift}
        dashboardData={dashboardData}
        currentStore={currentStore}
        onStartShift={handleStartShift}
        onEndShift={handleEndShift}
        onClose={() => setShowShiftModal(false)}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">{deleteTarget.title}</h3>
                <p className="text-xs text-slate-400">Confirm Deletion</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              {deleteTarget.subtitle}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-950/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Store Registration / Multi-Device Business Login Modal */}
      <BusinessAuthModal
        isOpen={showBusinessAuthModal}
        currentBusinessName={currentBusinessName}
        canClose={!!currentBusinessName && !!currentBusinessPin}
        onClose={() => setShowBusinessAuthModal(false)}
        onAuthenticated={handleBusinessAuthenticated}
      />
    </div>
  );
}
