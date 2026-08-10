import React, { useState } from 'react';
import {
  BarChart3,
  Smartphone,
  ShoppingBag,
  Activity,
  Dumbbell,
  Footprints,
  CreditCard,
  DollarSign,
  QrCode,
  FileSpreadsheet,
  Grid,
  X,
  UserCheck,
  Monitor,
} from 'lucide-react';
import { StaffShift } from '../types';

export type TabId =
  | 'sales'
  | 'staffcheckin'
  | 'pos'
  | 'classes'
  | 'pt'
  | 'walkin'
  | 'membership'
  | 'expense'
  | 'qrposter'
  | 'sheets';

interface NavigationTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  activeShift?: StaffShift | null;
  onOpenShiftModal?: () => void;
  onToggleCheckinMode?: () => void;
}

interface TabItem {
  id: TabId;
  label: string;
  category: 'Operations' | 'Members' | 'Tools';
  icon: React.ReactNode;
  badge?: string;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onTabChange,
  activeShift,
  onOpenShiftModal,
  onToggleCheckinMode,
}) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const tabs: TabItem[] = [
    { id: 'sales', label: 'Sales & Logs', category: 'Operations', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'staffcheckin', label: 'Phone Check-In', category: 'Operations', icon: <Smartphone className="w-4 h-4" />, badge: 'Fast' },
    { id: 'pos', label: 'POS & Sauna', category: 'Operations', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'classes', label: 'Dance & Fitness Classes', category: 'Operations', icon: <Activity className="w-4 h-4" /> },
    { id: 'pt', label: 'PT (Check In/Out)', category: 'Members', icon: <Dumbbell className="w-4 h-4" /> },
    { id: 'walkin', label: 'Walk-In Pass', category: 'Members', icon: <Footprints className="w-4 h-4" /> },
    { id: 'membership', label: 'Register Member', category: 'Members', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'expense', label: 'Expense Outflow', category: 'Members', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'qrposter', label: 'Wall QR Poster', category: 'Tools', icon: <QrCode className="w-4 h-4" /> },
    { id: 'sheets', label: 'Google Sheets Sync', category: 'Tools', icon: <FileSpreadsheet className="w-4 h-4" />, badge: 'Sync' },
  ];

  const handleSelectTab = (tabId: TabId) => {
    onTabChange(tabId);
    setShowMobileMenu(false);
  };

  const activeTabItem = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div className="space-y-4 mb-6">
      {/* ========================================================= */}
      {/* DESKTOP / TABLET MAIN NAVIGATION PANEL (Original Top Place) */}
      {/* ========================================================= */}
      <div className="bg-slate-900/95 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl space-y-4">
        {/* Categorized Tab Buttons Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Daily Operations */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block px-1">
              ⚡ Daily Operations
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {tabs
                .filter((t) => t.category === 'Operations')
                .map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleSelectTab(tab.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all border ${
                        isActive
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40'
                          : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={isActive ? 'text-slate-950' : 'text-emerald-400'}>{tab.icon}</span>
                        <span className="truncate">{tab.label}</span>
                      </div>
                      {tab.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                            isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Services & Members */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block px-1">
              👥 Services & Members
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {tabs
                .filter((t) => t.category === 'Members')
                .map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleSelectTab(tab.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all border ${
                        isActive
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40'
                          : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={isActive ? 'text-slate-950' : 'text-emerald-400'}>{tab.icon}</span>
                        <span className="truncate">{tab.label}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Tools & Cloud Sync */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block px-1">
              🛠️ Tools & Cloud Sync
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {tabs
                .filter((t) => t.category === 'Tools')
                .map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleSelectTab(tab.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all border ${
                        isActive
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40'
                          : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={isActive ? 'text-slate-950' : 'text-emerald-400'}>{tab.icon}</span>
                        <span className="truncate">{tab.label}</span>
                      </div>
                      {tab.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                            isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MOBILE BOTTOM NAVIGATION MENU (Visible on mobile)         */}
      {/* ========================================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 border-t border-slate-800 backdrop-blur-xl px-3 py-2 shadow-2xl">
        <div className="flex items-center gap-2">
          {/* Scrollable Horizontal Tab Bar */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 min-w-0 flex-1 touch-pan-x">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectTab(tab.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 shrink-0 transition-all border ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/50'
                      : 'bg-slate-800/90 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                  }`}
                >
                  <span className={isActive ? 'text-slate-950' : 'text-emerald-400'}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* All Tabs Drawer Toggle Button */}
          <button
            onClick={() => setShowMobileMenu(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-bold rounded-xl text-xs shrink-0 flex items-center gap-1.5 shadow-sm"
            title="Open All Tabs Menu"
          >
            <Grid className="w-4 h-4" />
            <span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay Modal listing all 10 tabs in a 2-column grid */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-end p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Grid className="w-5 h-5 text-emerald-400" /> Navigation Menu
                </h3>
                <p className="text-xs text-slate-400">Select an operational view or tool</p>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Active Tab Banner */}
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500 text-slate-950 rounded-lg">{activeTabItem.icon}</span>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Currently Active</span>
                  <span className="font-bold text-white">{activeTabItem.label}</span>
                </div>
              </div>
            </div>

            {/* 2-Column Grid of All Tabs */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSelectTab(tab.id)}
                    className={`p-3 rounded-2xl text-left border flex flex-col justify-between gap-2 transition-all ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-lg shadow-emerald-950/50'
                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`p-2 rounded-xl text-xs ${
                          isActive ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-emerald-400'
                        }`}
                      >
                        {tab.icon}
                      </span>
                      {tab.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            isActive ? 'bg-slate-950/30 text-slate-950' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

