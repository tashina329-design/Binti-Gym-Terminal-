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
import { PinCodeModal } from './components/PinCodeModal';
import { playSelfCheckinNotificationSound } from './lib/soundNotification';
import { apiFetch } from './lib/api';
import { subscribeLiveSync, broadcastLiveSync, SyncEventPayload } from './lib/firebaseSync';

import { DashboardData, Member, CheckInResponse, StaffShift, RegisteredStaff, PushNotification } from './types';

export default function App() {
  const getTodayIsoDate = () => new Date().toISOString().split('T')[0];

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

  // Registered Staff state (supports 6-digit PIN with no duplicate numbers)
  const [registeredStaff, setRegisteredStaff] = useState<RegisteredStaff[]>(() => {
    try {
      const saved = localStorage.getItem('gym_registered_staff');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'STF-001',
        name: 'Alex (Duty Staff)',
        phone: '8123456',
        pin: '123456', // 6 unique digits
        registeredAt: new Date().toISOString(),
      },
    ];
  });

  // Security PIN and Staff Shift state (persisted in localStorage)
  const [staffPin, setStaffPin] = useState<string>(() => {
    return localStorage.getItem('gym_staff_pin') || '123456';
  });

  // Multi-Store Terminal State (persisted in localStorage)
  const [currentStore, setCurrentStore] = useState<string>(() => {
    return localStorage.getItem('current_store_name') || 'Binti Gym';
  });

  const [availableStores, setAvailableStores] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gym_available_stores');
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['Binti Gym', 'Apex Fitness Terminal', 'Iron Vault Gym', 'Pulse Health Club', 'Metro Fitness Club'];
  });

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

  const handleRegisterStaff = (newStaff: RegisteredStaff) => {
    setRegisteredStaff((prev) => {
      const updated = [...prev, newStaff];
      localStorage.setItem('gym_registered_staff', JSON.stringify(updated));
      return updated;
    });
    setStaffPin(newStaff.pin);
    localStorage.setItem('gym_staff_pin', newStaff.pin);
  };

  const [activeShift, setActiveShift] = useState<StaffShift | null>(() => {
    try {
      const saved = localStorage.getItem('gym_active_shift');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);

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

  // Check URL parameters for ?p=checkin
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('p') === 'checkin') {
      setIsCheckinMode(true);
    }
  }, []);

  // Auto-prompt Staff Shift modal when terminal is opened without active staff shift
  useEffect(() => {
    if (!activeShift && !isCheckinMode) {
      setShowShiftModal(true);
    }
  }, [activeShift, isCheckinMode]);

  // Fetch Dashboard Data
  const loadDashboard = useCallback(async (dateToFetch?: string) => {
    setIsRefreshing(true);
    const dateQuery = dateToFetch || selectedDate;
    try {
      const data: DashboardData = await apiFetch(`/api/dashboard?date=${dateQuery}`);
      setDashboardData(data);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDashboard(selectedDate);
  }, [selectedDate, loadDashboard]);

  // Real-Time Multi-Channel Live Sync & Cross-Device Listener
  useEffect(() => {
    const unsubscribe = subscribeLiveSync((eventData?: SyncEventPayload, isRemote?: boolean) => {
      // Reload dashboard state
      loadDashboard(selectedDate);

      // If update came from another device/tab, play chime & display notification banner
      if (isRemote && eventData) {
        const title = eventData.title || '⚡ Live Device Sync Alert';
        const message = eventData.message || 'Data updated in real time from another device.';
        const timeStr =
          eventData.timestamp ||
          new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          });

        // Play audio chime on listening device
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
    });

    return () => unsubscribe();
  }, [selectedDate, loadDashboard]);

  // Periodic Auto-refresh fallback every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadDashboard(selectedDate);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedDate, loadDashboard]);

  // Handler functions
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handleResetToday = () => {
    const today = getTodayIsoDate();
    setSelectedDate(today);
  };

  const handleResetDatabase = async () => {
    if (!window.confirm('Reset database to standard demo seed records?')) return;
    setIsRefreshing(true);
    try {
      const data = await apiFetch('/api/reset', { method: 'POST' });
      setDashboardData(data);
      broadcastLiveSync({
        type: 'reset',
        title: '🔄 Database Reset',
        message: 'System database was reset to standard demo seed records.',
      });
    } catch (err: any) {
      alert('Error resetting database: ' + (err.message || err));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Check-In API calls
  const handleCheckinPhone = async (phone: string): Promise<CheckInResponse> => {
    const result: CheckInResponse = await apiFetch('/api/checkin/phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (result.success && !result.multiple) {
      loadDashboard();
      const matchedMember = result.members?.[0];
      const name = matchedMember?.fullName || 'Member';
      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      broadcastLiveSync({
        type: 'checkin',
        title: '🔔 Terminal Phone Check-In',
        message: `${name} checked in via terminal using Phone (${phone})!`,
        timestamp: timeStr,
        memberName: name,
        memberId: matchedMember?.memberId,
      });

      triggerSelfCheckinNotification(
        '🔔 Self Check-In Alert',
        `${name} checked in via terminal using Phone (${phone})!`,
        name,
        matchedMember?.memberId
      );
    }
    return result;
  };

  const handleCheckinId = async (memberId: string): Promise<CheckInResponse> => {
    const result: CheckInResponse = await apiFetch('/api/checkin/id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    });
    if (result.success) {
      loadDashboard();
      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      broadcastLiveSync({
        type: 'checkin',
        title: '🔔 Terminal Member Check-In',
        message: `Member #${memberId} successfully checked in at terminal!`,
        timestamp: timeStr,
        memberId: memberId,
      });

      triggerSelfCheckinNotification(
        '🔔 Self Check-In Alert',
        `Member #${memberId} successfully checked in at Binti Gym terminal!`,
        `Member #${memberId}`,
        memberId
      );
    }
    return result;
  };

  // Transaction API calls
  const handleRecordWalkIn = async (data: { name: string; phone?: string; amount: number; paymentMethod: string }) => {
    const updated: DashboardData = await apiFetch(`/api/walkin?date=${selectedDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, viewDate: selectedDate, staff: activeShift?.staffName || 'Duty Staff' }),
    });
    setDashboardData(updated);

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    broadcastLiveSync({
      type: 'walkin',
      title: '🎟️ Walk-In Pass Issued',
      message: `Guest ${data.name || 'Walk-In'} registered & checked in ($${data.amount || 4.00})!`,
      timestamp: timeStr,
      memberName: data.name,
    });

    if (isCheckinMode) {
      triggerSelfCheckinNotification(
        '🔔 Walk-In Pass Check-In Alert',
        `Guest ${data.name || 'Walk-In'} registered & checked in ($${data.amount || 4.00})!`,
        data.name
      );
    } else {
      setActiveTab('sales');
    }
    return updated;
  };

  const handleRecordPOS = async (data: { itemName: string; qty: number; amount: number; paymentMethod: string }) => {
    const updated: DashboardData = await apiFetch(`/api/pos?date=${selectedDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, viewDate: selectedDate, staff: activeShift?.staffName || 'Duty Staff' }),
    });
    setDashboardData(updated);

    broadcastLiveSync({
      type: 'pos',
      title: '🛒 POS Item Sold',
      message: `Sold ${data.itemName || 'Item'} (x${data.qty || 1}) - $${data.amount}`,
    });

    setActiveTab('sales');
    return updated;
  };

  const handleRecordClass = async (data: { className: string; clientName: string; amount: number; paymentMethod: string }) => {
    const updated: DashboardData = await apiFetch(`/api/class?date=${selectedDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, viewDate: selectedDate, staff: activeShift?.staffName || 'Duty Staff' }),
    });
    setDashboardData(updated);

    broadcastLiveSync({
      type: 'class',
      title: '🧘 Class Pass Sold',
      message: `Class pass for ${data.className || 'Class'} recorded for ${data.clientName || 'Client'}`,
    });

    setActiveTab('sales');
    return updated;
  };

  const handleRecordPTIn = async (data: { trainerName: string; clientName: string; sessions: string; amount: number; paymentMethod: string }) => {
    const updated: DashboardData = await apiFetch(`/api/pt/in?date=${selectedDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, viewDate: selectedDate, staff: activeShift?.staffName || 'Duty Staff' }),
    });
    setDashboardData(updated);

    broadcastLiveSync({
      type: 'pt',
      title: '💪 Personal Training Package',
      message: `PT Package: ${data.clientName} with Coach ${data.trainerName}`,
    });

    setActiveTab('sales');
    return updated;
  };

  const handleRecordPTOut = async (data: { trainerName: string; description: string; amount: number; paymentMethod: string }) => {
    const updated: DashboardData = await apiFetch(`/api/pt/out?date=${selectedDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, viewDate: selectedDate, staff: activeShift?.staffName || 'Duty Staff' }),
    });
    setDashboardData(updated);

    broadcastLiveSync({
      type: 'pt',
      title: '💸 PT Payout Recorded',
      message: `PT payout for Coach ${data.trainerName}: $${data.amount}`,
    });

    setActiveTab('sales');
    return updated;
  };

  const handleRecordExpense = async (data: { category: string; description: string; amount: number; paymentMethod: string }) => {
    const updated: DashboardData = await apiFetch(`/api/expense?date=${selectedDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, viewDate: selectedDate, staff: activeShift?.staffName || 'Duty Staff' }),
    });
    setDashboardData(updated);

    broadcastLiveSync({
      type: 'expense',
      title: '🧾 Expense Logged',
      message: `Expense logged: ${data.description || data.category} ($${data.amount})`,
    });

    setActiveTab('sales');
    return updated;
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
    const updated: DashboardData = await apiFetch(`/api/members/register?date=${selectedDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, viewDate: selectedDate, staff: activeShift?.staffName || 'Duty Staff' }),
    });
    setDashboardData(updated);

    broadcastLiveSync({
      type: 'membership',
      title: '⭐ New Member Registered',
      message: `Registered new member ${data.name} (${data.planType})`,
      memberName: data.name,
    });

    setActiveTab('sales');
    return updated;
  };

  const handleConfirmRenew = async (data: {
    memberId: string;
    planType: string;
    price: number;
    paymentMethod: string;
  }) => {
    const updated: DashboardData = await apiFetch(`/api/members/renew?date=${selectedDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, viewDate: selectedDate, staff: activeShift?.staffName || 'Duty Staff' }),
    });
    setDashboardData(updated);

    broadcastLiveSync({
      type: 'membership',
      title: '🔄 Membership Renewed',
      message: `Renewed membership for #${data.memberId} (${data.planType})`,
      memberId: data.memberId,
    });

    setActiveTab('sales');
    return updated;
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
      let endpoint = '';
      let body: any = { date: selectedDate, viewDate: selectedDate };

      if (type === 'sale') {
        endpoint = '/api/sales/delete';
        body = { ...body, ...data };
      } else if (type === 'attendance') {
        endpoint = '/api/attendance/delete';
        body = { ...body, ...data };
      } else if (type === 'expense') {
        endpoint = '/api/expense/delete';
        body = { ...body, ...data };
      } else if (type === 'member') {
        endpoint = '/api/members/delete';
        body = { ...body, memberId: data.memberId || data };
      }

      const updated: DashboardData = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      setDashboardData(updated);
      broadcastLiveSync();
    } catch (err: any) {
      console.error('Delete error:', err);
    }
  };

  const handleStartShift = (shift: StaffShift) => {
    setActiveShift(shift);
    localStorage.setItem('gym_active_shift', JSON.stringify(shift));
  };

  const handleEndShift = () => {
    setActiveShift(null);
    localStorage.removeItem('gym_active_shift');
    setShowShiftModal(false);
  };

  const handleUpdatePin = (newPin: string) => {
    setStaffPin(newPin);
    localStorage.setItem('gym_staff_pin', newPin);
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
                    ✓ Logged to Binti Gym Operational Records
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
          staffPin={staffPin}
          registeredStaff={registeredStaff}
          currentStore={currentStore}
          availableStores={availableStores}
          onRegisterStaff={handleRegisterStaff}
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
                  ✓ Logged to Binti Gym Operational Records
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

      <div className="max-w-[1600px] w-full mx-auto space-y-6">
        {/* Header */}
        <Header
          viewDate={dashboardData.viewDate || selectedDate}
          isToday={isToday}
          isCheckinMode={isCheckinMode}
          activeShift={activeShift}
          notifications={notifications}
          currentStore={currentStore}
          onOpenShiftModal={() => setShowShiftModal(true)}
          onLockTerminal={() => setShowPinModal(true)}
          onToggleCheckinMode={() => setIsCheckinMode(true)}
          onRefresh={() => loadDashboard(selectedDate)}
          onOpenStoreLogin={() => setShowPinModal(true)}
        />

        {/* Controls Toolbar */}
        <Toolbar
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onRefresh={() => loadDashboard(selectedDate)}
          onResetToday={handleResetToday}
          onResetDatabase={handleResetDatabase}
          isRefreshing={isRefreshing}
        />

        {/* Real-time Metrics Grid (Gross Sales, Expenses, Net Profit, Check-Ins, Expiring Soon) */}
        <StatsGrid data={dashboardData} />

        {/* Navigation Tabs Bar (Positioned between Gross Sales & Payment Method Summary) */}
        <NavigationTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeShift={activeShift}
          onOpenShiftModal={() => setShowShiftModal(true)}
          onToggleCheckinMode={() => setIsCheckinMode(true)}
        />

        {/* Active Tab View Content (Terminal locked when no active staff shift) */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl">
          {!activeShift ? (
            <div className="text-center py-12 px-4 space-y-5 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-xl">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Active Staff Shift Required</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Terminal access is restricted until a staff member logs in and starts an active duty shift.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftModal(true)}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" /> Start Staff Shift
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
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
        staffPin={staffPin}
        dashboardData={dashboardData}
        currentStore={currentStore}
        onStartShift={handleStartShift}
        onEndShift={handleEndShift}
        onUpdatePin={handleUpdatePin}
        onClose={() => setShowShiftModal(false)}
      />

      {/* Security Pin Code Verification & Multi-Store Terminal Login Modal */}
      <PinCodeModal
        isOpen={showPinModal}
        correctPin={staffPin}
        registeredStaff={registeredStaff}
        selectedStoreName={currentStore}
        availableStores={availableStores}
        onRegisterStaff={handleRegisterStaff}
        onSuccess={(authenticatedStaff, storeName) => {
          const finalStore = storeName?.trim() || currentStore;
          setCurrentStore(finalStore);
          localStorage.setItem('current_store_name', finalStore);
          setAvailableStores((prev) => {
            if (!prev.includes(finalStore)) {
              const updated = [...prev, finalStore];
              localStorage.setItem('gym_available_stores', JSON.stringify(updated));
              return updated;
            }
            return prev;
          });

          setShowPinModal(false);
          setIsCheckinMode(false);
          if (authenticatedStaff && !activeShift) {
            handleStartShift({
              id: 'shift-' + Date.now(),
              staffName: authenticatedStaff.name,
              shiftTitle: 'Morning shift',
              startTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              startTimestamp: Date.now(),
              startingFloat: 50.0,
            });
          }
        }}
        onCancel={() => setShowPinModal(false)}
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
    </div>
  );
}
