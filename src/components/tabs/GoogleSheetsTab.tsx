import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  LogOut,
  Sparkles,
  Calendar,
  Users,
  DollarSign,
  ClipboardList,
  Eye,
  TrendingUp,
  CreditCard,
  Smartphone,
  Coins
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  googleSignOut,
  getAccessToken
} from '../../lib/googleAuth';
import {
  findOrCreateGymSpreadsheet,
  syncDataToGoogleSheets,
  calculateDailySummaryMetrics,
  SpreadsheetInfo
} from '../../lib/sheetsSync';
import { DashboardData } from '../../types';

interface GoogleSheetsTabProps {
  dashboardData: DashboardData;
}

export const GoogleSheetsTab: React.FC<GoogleSheetsTabProps> = ({ dashboardData }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetInfo | null>(null);
  const [isLoadingSpreadsheet, setIsLoadingSpreadsheet] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(() => {
    return localStorage.getItem('last_sheets_sync_time');
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Compute live Daily Summary Report metrics
  const summaryMetrics = useMemo(() => {
    return calculateDailySummaryMetrics(dashboardData);
  }, [dashboardData]);

  const fmtCurrency = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  // Initialize Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        loadSpreadsheet(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadSpreadsheet = async (accessToken: string) => {
    setIsLoadingSpreadsheet(true);
    setErrorMsg(null);
    try {
      const info = await findOrCreateGymSpreadsheet(accessToken);
      setSpreadsheet(info);
    } catch (err: any) {
      console.error('Failed to load spreadsheet:', err);
      setErrorMsg(err.message || 'Unable to access Google Drive/Sheets. Please try signing in again.');
    } finally {
      setIsLoadingSpreadsheet(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        await loadSpreadsheet(result.accessToken);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Google Sign-In failed or was cancelled.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setUser(null);
    setToken(null);
    setSpreadsheet(null);
    setSuccessMsg('Signed out of Google Workspace.');
  };

  const handleTriggerSync = () => {
    if (!token || !spreadsheet) {
      setErrorMsg('Please connect your Google Account first.');
      return;
    }
    setShowConfirmModal(true);
  };

  const executeSync = async () => {
    setShowConfirmModal(false);
    let activeToken = token;
    if (!activeToken) {
      activeToken = getAccessToken();
    }
    if (!activeToken || !spreadsheet) {
      setErrorMsg('Google session expired. Please sign in again.');
      return;
    }

    setIsSyncing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await syncDataToGoogleSheets(activeToken, spreadsheet.spreadsheetId, dashboardData);
      const nowStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSynced(nowStr);
      localStorage.setItem('last_sheets_sync_time', nowStr);
      setSuccessMsg(`Successfully pushed Daily Summary (Latest on Top), sales, check-ins, members, & expenses to Google Sheets at ${nowStr}!`);
    } catch (err: any) {
      console.error('Sync failed:', err);
      setErrorMsg(err.message || 'Failed to sync data to Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Google Sheets Real-Time Sync
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Google Workspace
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sync Daily Summary (Latest on Top), Net Baiduri, Net BIBD, sales, check-ins, and expenses directly to Google Sheets.
              </p>
            </div>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-700" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                {user.email?.[0].toUpperCase() || 'G'}
              </div>
            )}
            <div className="text-xs">
              <p className="font-bold text-slate-200">{user.displayName || 'Connected Account'}</p>
              <p className="text-[11px] text-slate-400 font-mono">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="ml-2 p-2 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
            {/* Official Material Google Sign-In Button */}
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="flex items-center gap-3 px-4 py-2.5 bg-white text-slate-800 hover:bg-slate-100 font-bold rounded-xl text-xs shadow-md transition-all border border-slate-300 disabled:opacity-50"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              {isSigningIn ? 'Connecting...' : 'Sign in with Google'}
            </button>
          </div>
        )}
      </div>

      {/* Error & Success Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Connection Status Card */}
      {!user ? (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 max-w-xl mx-auto my-6">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Google Workspace Auth Required</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Connect your Google account to enable automatic cloud backup and live synchronization with Google Sheets. You will be able to view and manage your sales spreadsheets anytime in Google Drive.
          </p>
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-2 mx-auto"
          >
            <Sparkles className="w-4 h-4" />
            {isSigningIn ? 'Connecting to Google...' : 'Connect Google Workspace Account'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Target info & Quick stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Spreadsheet Target Info */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Active Destination Spreadsheet
                </h3>
                {spreadsheet && (
                  <a
                    href={spreadsheet.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in Google Sheets
                  </a>
                )}
              </div>

              {isLoadingSpreadsheet ? (
                <div className="p-6 bg-slate-950 rounded-xl text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" /> Fetching spreadsheet from Google Drive...
                </div>
              ) : spreadsheet ? (
                <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div>
                      <p className="text-xs text-slate-400">Spreadsheet Name</p>
                      <p className="text-sm font-bold text-white mt-0.5">{spreadsheet.title}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold rounded-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Ready
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Synced Tabs (Latest on Top)</span>
                      <span className="font-semibold text-slate-200">Daily Summary, Sales, Check-Ins, Members, Expenses</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Last Sync Status</span>
                      <span className="font-semibold text-emerald-400">
                        {lastSynced ? `Synced at ${lastSynced}` : 'Never synced'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-300">
                  No active spreadsheet found. Click "Sync Current Data" to generate a new spreadsheet in your Google Drive.
                </div>
              )}

              {/* Sync Controls */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={handleTriggerSync}
                  disabled={isSyncing || !spreadsheet}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-950/40"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Pushing Data to Google Sheets...' : 'Sync Current Data to Google Sheets'}
                </button>

                <p className="text-[11px] text-slate-400">
                  🔒 Safe & encrypted via Google Workspace OAuth API
                </p>
              </div>
            </div>

            {/* Sync Content Payload Stats */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                <ClipboardList className="w-4 h-4 text-emerald-400" /> Current Data Payload to Sync
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Sales Records
                  </span>
                  <p className="text-base font-bold text-white">{dashboardData.todaySales.length}</p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-sky-400" /> Check-In Visits
                  </span>
                  <p className="text-base font-bold text-white">{dashboardData.todayAttendance.length}</p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Users className="w-3.5 h-3.5 text-purple-400" /> Registered
                  </span>
                  <p className="text-base font-bold text-white">{dashboardData.members.length}</p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <DollarSign className="w-3.5 h-3.5 text-rose-400" /> Expenses
                  </span>
                  <p className="text-base font-bold text-white">{dashboardData.todayExpenses.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Daily Summary Report Preview (Matching User Screenshot Layout) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" /> Daily Summary Report Format
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-600/30 px-2 py-0.5 rounded">
                Live Preview
              </span>
            </div>

            {/* Google Sheets Style Rendered Table */}
            <div className="border border-slate-700/80 rounded-xl overflow-hidden text-xs bg-slate-950 shadow-inner font-sans">
              {/* Header: REPORT FOR ... */}
              <div className="bg-slate-950 border-b border-slate-800 p-2.5 text-center font-bold text-white tracking-wide text-xs">
                {summaryMetrics.headerTitle}
              </div>

              {/* Counts */}
              <div className="divide-y divide-slate-800/60 bg-slate-900/40">
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>New Membership Sign-ups</span>
                  <span className="font-semibold text-white">{summaryMetrics.newMembershipCount}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Walk-In Entries</span>
                  <span className="font-semibold text-white">{summaryMetrics.walkInCount}</span>
                </div>
              </div>

              {/* INCOME BANNER */}
              <div className="bg-emerald-600 px-3 py-1.5 text-center font-bold text-white text-[11px] tracking-wider">
                --- INCOME (PAYMENT IN) ---
              </div>

              {/* Income Rows */}
              <div className="divide-y divide-slate-800/60 bg-slate-900/40">
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Cash In</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.cashIn)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Baiduri In</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.baiduriIn)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Bibd In</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.bibdIn)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Coupon In</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.couponIn)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 bg-emerald-950/60 text-emerald-400 font-bold border-t border-emerald-800/40">
                  <span>TOTAL INCOME IN</span>
                  <span className="font-mono">{fmtCurrency(summaryMetrics.totalIncomeIn)}</span>
                </div>
              </div>

              {/* EXPENSES BANNER */}
              <div className="bg-rose-600 px-3 py-1.5 text-center font-bold text-white text-[11px] tracking-wider">
                --- EXPENSES (PAYMENT OUT) ---
              </div>

              {/* Expenses Rows */}
              <div className="divide-y divide-slate-800/60 bg-slate-900/40">
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Cash Out</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.cashOut)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Baiduri Out</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.baiduriOut)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Bibd Out</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.bibdOut)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-slate-300">
                  <span>Coupon Out</span>
                  <span className="font-mono text-slate-200">{fmtCurrency(summaryMetrics.couponOut)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 bg-rose-950/60 text-rose-400 font-bold border-t border-rose-800/40">
                  <span>TOTAL EXPENSES OUT</span>
                  <span className="font-mono">{fmtCurrency(summaryMetrics.totalExpensesOut)}</span>
                </div>
              </div>

              {/* SUMMARY BANNER */}
              <div className="bg-slate-950 px-3 py-1.5 text-center font-bold text-white text-[11px] tracking-wider border-t border-slate-800">
                --- SUMMARY ---
              </div>

              {/* Summary Rows */}
              <div className="divide-y divide-slate-800/60 bg-slate-900/40">
                <div className="flex justify-between px-3 py-1.5 font-bold text-sky-400">
                  <span>NET CASH BALANCE (Drawer Cash)</span>
                  <span className="font-mono">{fmtCurrency(summaryMetrics.netCash)}</span>
                </div>
                <div className="flex justify-between px-3 py-2 font-bold bg-amber-950/40 text-amber-300 border-t border-amber-800/30">
                  <span>NET DAILY BALANCE (All Methods)</span>
                  <span className="font-mono">{fmtCurrency(summaryMetrics.netDaily)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 font-bold text-sky-400">
                  <span>NET BAIDURI BALANCE</span>
                  <span className="font-mono">{fmtCurrency(summaryMetrics.netBaiduri)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 font-bold text-purple-400">
                  <span>NET BIBD BALANCE</span>
                  <span className="font-mono">{fmtCurrency(summaryMetrics.netBibd)}</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 text-center">
              Synced to Google Sheets tab "Daily Summary" with newest reports at row 1.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal prior to data mutation */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Google Sheets Sync</h3>
                <p className="text-xs text-slate-400">Google Drive & Sheets Integration</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              Are you sure you want to sync the formatted <strong>Daily Summary</strong> (with Net Baiduri & Net BIBD, latest on top), along with sales ({dashboardData.todaySales.length}), check-ins ({dashboardData.todayAttendance.length}), members ({dashboardData.members.length}), and expenses to your Google Spreadsheet (<strong>{spreadsheet?.title}</strong>)?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeSync}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-950/40"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm & Sync Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
