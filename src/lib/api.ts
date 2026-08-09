import { DashboardData, Member, StaffShift, RegisteredStaff } from '../types';

export interface GymDataStore {
  members: Member[];
  attendance: any[];
  expenses: any[];
  sales: any[];
  registeredStaff: RegisteredStaff[];
  activeShift: StaffShift | null;
  staffPin: string;
}

const STORAGE_KEY = 'gym_data_store_v1';

function getTodayStr(dateObj?: Date): string {
  const d = dateObj || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(dateObj?: Date): string {
  const d = dateObj || new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getMemberStatus(endDateStr: string, referenceDateStr?: string): 'Active' | 'Expiring Soon' | 'Expired' {
  if (!endDateStr) return 'Active';
  try {
    const refDate = referenceDateStr ? new Date(referenceDateStr + 'T00:00:00') : new Date();
    if (isNaN(refDate.getTime())) return 'Active';
    refDate.setHours(0, 0, 0, 0);

    const expDate = new Date(endDateStr + 'T00:00:00');
    if (isNaN(expDate.getTime())) return 'Active';
    expDate.setHours(0, 0, 0, 0);

    const diffTime = expDate.getTime() - refDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays <= 7) return 'Expiring Soon';
    return 'Active';
  } catch (e) {
    return 'Active';
  }
}

function parsePTCustomer(customerStr: string) {
  try {
    const cust = (customerStr || '').toString();
    let clientName = '';
    let trainer = '';
    let sessions = '';

    const trainerMatch = cust.match(/Trainer:\s*([^|,]+)/i);
    const clientMatch = cust.match(/Client:\s*([^|,]+)/i);

    if (trainerMatch) trainer = trainerMatch[1].trim();
    if (clientMatch) clientName = clientMatch[1].trim();

    const sessionsMatch = cust.match(/(\d+\s*session[s]?|session[s]?:?\s*[^|]+)/i);
    if (sessionsMatch) sessions = sessionsMatch[0].trim();

    if (!clientName || !trainer) {
      if (cust.includes('|')) {
        const parts = cust.split('|').map(p => p.trim());
        if (!clientName) clientName = parts[0] || '';
        for (let i = 1; i < parts.length; i++) {
          const p = parts[i];
          if (/^trainer:/i.test(p)) trainer = p.split(':').slice(1).join(':').trim();
          else if (/session/i.test(p)) sessions = p;
          else if (!clientName) clientName = p;
        }
      } else {
        const m = cust.match(/^(.*)\s*\(Trainer:\s*(.*)\)$/i);
        if (m) {
          clientName = clientName || m[1].trim();
          trainer = trainer || m[2].trim();
        } else {
          const t = cust.match(/Trainer:\s*([^|,;]+)/i);
          if (t) trainer = trainer || t[1].trim();
          clientName = clientName || cust.replace(/Trainer:.*$/i, '').replace(/\|/g, '').trim();
        }
      }
    }

    return { clientName, trainer, sessions };
  } catch (e) {
    return { clientName: customerStr || '', trainer: '', sessions: '' };
  }
}

function getDefaultStore(): GymDataStore {
  const dToday = new Date();

  const d30DaysAgo = new Date(dToday);
  d30DaysAgo.setDate(dToday.getDate() - 30);
  const start30Ago = getTodayStr(d30DaysAgo);

  const d5DaysLater = new Date(dToday);
  d5DaysLater.setDate(dToday.getDate() + 5);
  const end5Later = getTodayStr(d5DaysLater);

  const d30DaysLater = new Date(dToday);
  d30DaysLater.setDate(dToday.getDate() + 30);
  const end30Later = getTodayStr(d30DaysLater);

  const d10DaysAgo = new Date(dToday);
  d10DaysAgo.setDate(dToday.getDate() - 10);
  const end10Ago = getTodayStr(d10DaysAgo);

  return {
    members: [
      { memberId: 'MEM-100241', name: 'Ahmad Daniel', phone: '8712345', plan: 'Standard Monthly', startDate: start30Ago, endDate: end30Later, status: 'Active' },
      { memberId: 'MEM-204891', name: 'Siti Nurhaliza', phone: '8823456', plan: 'Student Monthly', startDate: start30Ago, endDate: end5Later, status: 'Expiring Soon' },
      { memberId: 'MEM-309123', name: 'Markus Vance', phone: '8934567', plan: 'Standard Monthly', startDate: '2026-05-01', endDate: end10Ago, status: 'Expired' },
      { memberId: 'MEM-401928', name: 'Jessica Tan', phone: '8765432', plan: 'Standard Monthly', startDate: start30Ago, endDate: end30Later, status: 'Active' }
    ],
    attendance: [
      { timestamp: new Date(Date.now() - 300000).toISOString(), memberId: 'MEM-100241', name: 'Ahmad Daniel', phone: '8712345', plan: 'Standard Monthly', status: 'Active' },
      { timestamp: new Date(Date.now() - 200000).toISOString(), memberId: 'GUEST', name: 'Michael Lee', phone: '-', plan: 'Walk-In Pass', status: 'Active' }
    ],
    expenses: [
      { timestamp: new Date(Date.now() - 7200000).toISOString(), category: 'Utilities', description: 'Water & Filter Restock', paymentMethod: 'Cash', amount: 45, staff: 'System Admin' }
    ],
    sales: [
      { timestamp: new Date(Date.now() - 14400000).toISOString(), category: 'POS', customer: 'Energy Bar x2', paymentMethod: 'Cash', amount: 6, staff: 'System Admin' },
      { timestamp: new Date(Date.now() - 10800000).toISOString(), category: 'Walk-In', customer: 'Michael Lee (Walk-In)', paymentMethod: 'BIBD QuickPay', amount: 10, staff: 'System Admin' },
      { timestamp: new Date(Date.now() - 3600000).toISOString(), category: 'Personal Training', customer: 'Client: Ahmad Daniel | Trainer: Coach Alex | 5 Sessions', paymentMethod: 'Baiduri Card', amount: 150, staff: 'System Admin' }
    ],
    registeredStaff: [
      { id: 'STF-101', name: 'System Admin', phone: '8000000', pin: '123456', registeredAt: new Date().toISOString() }
    ],
    activeShift: null,
    staffPin: '123456'
  };
}

export function loadClientStore(): GymDataStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.registeredStaff || parsed.registeredStaff.length === 0) {
        parsed.registeredStaff = [{ id: 'STF-101', name: 'System Admin', phone: '8000000', pin: '123456', registeredAt: new Date().toISOString() }];
      }
      if (!parsed.staffPin) parsed.staffPin = '123456';
      return parsed;
    }
  } catch (e) {
    // Fallback
  }
  const defaultStore = getDefaultStore();
  saveClientStore(defaultStore);
  return defaultStore;
}

export function saveClientStore(store: GymDataStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

export function getClientDashboardData(dateStr?: string): DashboardData {
  const store = loadClientStore();
  const targetDateStr = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getTodayStr();

  let totalRevenue = 0;
  let totalExpenses = 0;
  let posSalesTotal = 0;
  let classSalesTotal = 0;
  let ptSalesTotal = 0;
  let ptPayoutTotal = 0;
  let walkInSalesTotal = 0;
  let membershipSalesTotal = 0;
  let checkinCount = 0;
  let expiringCount = 0;

  let cashIn = 0;
  let cashOut = 0;
  let baiduriIn = 0;
  let bibdIn = 0;

  const todaySales: any[] = [];
  const todayExpenses: any[] = [];
  const todayAttendance: any[] = [];
  const membersList: Member[] = [];
  const ptDetails: any[] = [];

  for (const m of store.members) {
    const status = getMemberStatus(m.endDate, targetDateStr);
    if (status === 'Expiring Soon' || status === 'Expired') {
      expiringCount++;
    }
    membersList.push({
      memberId: m.memberId,
      name: m.name,
      phone: m.phone,
      plan: m.plan,
      startDate: m.startDate,
      endDate: m.endDate,
      status
    });
  }

  for (const s of store.sales) {
    const d = new Date(s.timestamp);
    const dateOfSale = getTodayStr(d);

    if (dateOfSale === targetDateStr) {
      const category = s.category || '';
      const customer = s.customer || '';
      const paymentRaw = s.paymentMethod || '';
      const payment = paymentRaw.trim().toLowerCase();
      const amount = Number(s.amount) || 0;

      totalRevenue += amount;
      if (/pos|sauna/i.test(category)) posSalesTotal += amount;
      else if (/class/i.test(category)) classSalesTotal += amount;
      else if (/pt/i.test(category)) ptSalesTotal += amount;
      else if (/walk-?in/i.test(category)) walkInSalesTotal += amount;
      else if (/membership/i.test(category)) membershipSalesTotal += amount;

      if (payment.includes('cash')) cashIn += amount;
      else if (payment.includes('baiduri')) baiduriIn += amount;
      else if (payment.includes('bibd')) bibdIn += amount;

      todaySales.push({
        timestamp: s.timestamp,
        time: formatTime(d),
        category,
        customer,
        payment: paymentRaw,
        amount,
        staff: s.staff || 'Duty Staff'
      });

      if (/pt/i.test(category)) {
        const parsed = parsePTCustomer(customer);
        ptDetails.push({
          time: formatTime(d),
          trainer: parsed.trainer || '',
          client: parsed.clientName || '',
          sessions: parsed.sessions || '',
          amount
        });
      }
    }
  }

  for (const e of store.expenses) {
    const d = new Date(e.timestamp);
    const dateOfExp = getTodayStr(d);

    if (dateOfExp === targetDateStr) {
      const category = e.category || '';
      const description = e.description || '';
      const paymentRaw = e.paymentMethod || '';
      const payment = paymentRaw.trim().toLowerCase();
      const amount = Number(e.amount) || 0;

      totalExpenses += amount;
      if (/pt payout/i.test(category)) ptPayoutTotal += amount;
      if (payment.includes('cash')) cashOut += amount;

      todayExpenses.push({
        timestamp: e.timestamp,
        time: formatTime(d),
        category,
        description,
        payment: paymentRaw,
        amount,
        staff: e.staff || 'Duty Staff'
      });
    }
  }

  for (const a of store.attendance) {
    const d = new Date(a.timestamp);
    const dateOfAtt = getTodayStr(d);

    if (dateOfAtt === targetDateStr) {
      checkinCount++;
      todayAttendance.push({
        timestamp: a.timestamp,
        time: formatTime(d),
        name: a.name || 'Guest',
        phone: a.phone || '-',
        plan: a.plan || '-',
        status: a.status || 'Active'
      });
    }
  }

  return {
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
    posSalesTotal,
    classSalesTotal,
    ptSalesTotal,
    ptPayoutTotal,
    walkInSalesTotal,
    membershipSalesTotal,
    checkinCount,
    expiringCount,
    todayAttendance,
    todaySales,
    todayExpenses,
    members: membersList,
    cashIn,
    cashOut,
    baiduriIn,
    bibdIn,
    ptDetails,
    viewDate: targetDateStr
  };
}

export function handleClientFallbackRequest(url: string, options?: RequestInit): any {
  const store = loadClientStore();
  let body: any = {};
  if (options?.body) {
    try {
      body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    } catch {
      body = {};
    }
  }

  const cleanUrl = url.split('?')[0];
  const searchParams = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
  const dateParam = searchParams.get('date') || searchParams.get('viewDate') || undefined;

  const nowISO = new Date().toISOString();

  if (cleanUrl.endsWith('/api/dashboard')) {
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/staff')) {
    return {
      registeredStaff: store.registeredStaff || [],
      activeShift: store.activeShift || null
    };
  }

  if (cleanUrl.endsWith('/api/staff/verify-pin')) {
    const { pin } = body;
    const isCorrect = String(pin).trim() === String(store.staffPin).trim();
    if (isCorrect) return { success: true };
    return { success: false, error: 'Incorrect Staff Terminal PIN' };
  }

  if (cleanUrl.endsWith('/api/staff/register')) {
    const { name, pin, phone } = body;
    const newStaff: RegisteredStaff = {
      id: `STF-${Math.floor(100 + Math.random() * 900)}`,
      name: (name || 'Staff').trim(),
      phone: phone || '8000000',
      pin: (pin || '123456').trim(),
      registeredAt: nowISO
    };
    store.registeredStaff.push(newStaff);
    saveClientStore(store);
    return { success: true, staff: newStaff, registeredStaff: store.registeredStaff };
  }

  if (cleanUrl.endsWith('/api/staff/shift/start') || cleanUrl.endsWith('/api/shift/start')) {
    const { staffName, cashStart, shiftTitle, startingFloat } = body;
    store.activeShift = {
      id: `SHF-${Date.now()}`,
      staffName: staffName || 'Staff',
      shiftTitle: shiftTitle || 'Morning Shift',
      startTime: nowISO,
      startTimestamp: Date.now(),
      startingFloat: Number(cashStart || startingFloat || 0)
    };
    saveClientStore(store);
    return { success: true, activeShift: store.activeShift };
  }

  if (cleanUrl.endsWith('/api/staff/shift/end') || cleanUrl.endsWith('/api/shift/end')) {
    const endedShift = store.activeShift;
    store.activeShift = null;
    saveClientStore(store);
    return { success: true, endedShift };
  }

  if (cleanUrl.endsWith('/api/checkin/phone')) {
    const { phone } = body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      return { success: false, message: 'Please enter a valid phone number.' };
    }
    const matches: any[] = [];
    for (const m of store.members) {
      const mPhone = String(m.phone || '').replace(/\D/g, '');
      if (mPhone && mPhone.includes(cleanPhone)) {
        const status = getMemberStatus(m.endDate);
        matches.push({
          memberId: m.memberId,
          fullName: m.name,
          phone: m.phone,
          plan: m.plan,
          status
        });
      }
    }
    if (matches.length === 0) {
      return { success: false, notFound: true, message: 'Member not found. Check phone number or register as guest.' };
    }
    if (matches.length > 1) {
      return { success: true, multiple: true, members: matches };
    }
    const member = store.members.find(m => m.memberId === matches[0].memberId);
    if (!member) {
      return { success: false, message: 'Member record error.' };
    }
    const status = getMemberStatus(member.endDate);
    if (status === 'Expired') {
      return { success: false, message: `Check-In Denied: ${member.name}'s membership has expired.` };
    }
    store.attendance.unshift({
      timestamp: nowISO,
      memberId: member.memberId,
      name: member.name,
      phone: member.phone,
      plan: member.plan,
      status
    });
    saveClientStore(store);
    return { success: true, message: `Welcome back, ${member.name}!`, members: [matches[0]] };
  }

  if (cleanUrl.endsWith('/api/checkin/id') || cleanUrl.endsWith('/api/checkin')) {
    const { memberId, phone } = body;
    let member = store.members.find(m => String(m.memberId).toUpperCase() === String(memberId || '').toUpperCase());
    if (!member && phone) {
      member = store.members.find(m => m.phone === phone);
    }
    if (!member) {
      return { success: false, message: 'Member ID or record not found.' };
    }
    const status = getMemberStatus(member.endDate);
    if (status === 'Expired') {
      return { success: false, message: `Check-In Denied: ${member.name}'s membership has expired.` };
    }
    store.attendance.unshift({
      timestamp: nowISO,
      memberId: member.memberId,
      name: member.name,
      phone: member.phone,
      plan: member.plan,
      status
    });
    saveClientStore(store);
    return {
      success: true,
      message: `Welcome back, ${member.name}!`,
      status,
      member: {
        id: member.memberId,
        name: member.name,
        plan: member.plan,
        endDate: member.endDate,
        status
      }
    };
  }

  if (cleanUrl.endsWith('/api/walkin')) {
    const { name, phone, plan, amount, paymentMethod, staff } = body;
    store.sales.unshift({
      timestamp: nowISO,
      category: 'Walk-In',
      customer: `${name || 'Guest'} (${plan || 'Walk-In Pass'})`,
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(amount) || 0,
      staff: staff || 'Duty Staff'
    });
    store.attendance.unshift({
      timestamp: nowISO,
      memberId: 'GUEST',
      name: name || 'Walk-In Guest',
      phone: phone || '-',
      plan: plan || 'Walk-In Pass',
      status: 'Active'
    });
    saveClientStore(store);
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/pos')) {
    const { category, item, customer, amount, paymentMethod, staff, itemName, qty } = body;
    const name = itemName || item || category || 'General Item';
    const qtyStr = qty ? ` (x${qty})` : '';
    const custName = customer ? ` - ${customer}` : '';
    store.sales.unshift({
      timestamp: nowISO,
      category: 'POS/Sauna',
      customer: `${name}${qtyStr}${custName}`,
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(amount) || 0,
      staff: staff || 'Duty Staff'
    });
    saveClientStore(store);
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/expense')) {
    const { category, description, amount, paymentMethod, staff } = body;
    store.expenses.unshift({
      timestamp: nowISO,
      category: category || 'General',
      description: description || 'Expense',
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(amount) || 0,
      staff: staff || 'Duty Staff'
    });
    saveClientStore(store);
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/members/register')) {
    const { name, phone, plan, price, paymentMethod, staff, startDate } = body;
    const newMemberId = `MEM-${Math.floor(100000 + Math.random() * 900000)}`;
    const startStr = startDate || getTodayStr();
    
    const dStart = new Date(startStr + 'T00:00:00');
    dStart.setMonth(dStart.getMonth() + 1);
    const endStr = getTodayStr(dStart);

    const newMember: Member = {
      memberId: newMemberId,
      name: name || 'New Member',
      phone: phone || '-',
      plan: plan || 'Standard Monthly',
      startDate: startStr,
      endDate: endStr,
      status: 'Active'
    };

    store.members.push(newMember);
    store.sales.unshift({
      timestamp: nowISO,
      category: 'Membership',
      customer: `${name || 'New Member'} (${plan || 'New Member'})`,
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(price) || 0,
      staff: staff || 'Duty Staff'
    });

    saveClientStore(store);
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/members/renew')) {
    const { memberId, planType, price, paymentMethod, staff } = body;
    const member = store.members.find(m => String(m.memberId) === String(memberId));
    if (member) {
      if (planType) member.plan = planType;
      const dStart = new Date();
      dStart.setMonth(dStart.getMonth() + 1);
      member.endDate = getTodayStr(dStart);
      member.status = 'Active';
      store.sales.unshift({
        timestamp: nowISO,
        category: 'Membership',
        customer: `${member.name} (${planType || member.plan} Renewal)`,
        paymentMethod: paymentMethod || 'Cash',
        amount: Number(price) || 0,
        staff: staff || 'Duty Staff'
      });
      saveClientStore(store);
    }
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/pt/in') || cleanUrl.endsWith('/api/pt/sale')) {
    const { clientName, trainer, sessions, amount, paymentMethod, staff, customer } = body;
    const sessionStr = sessions ? `${sessions} Sessions` : 'Package';
    const custStr = customer || `Client: ${clientName || 'Client'} | Trainer: ${trainer || 'Trainer'} | ${sessionStr}`;
    store.sales.unshift({
      timestamp: nowISO,
      category: 'Personal Training',
      customer: custStr,
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(amount) || 0,
      staff: staff || 'Duty Staff'
    });
    saveClientStore(store);
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/pt/out') || cleanUrl.endsWith('/api/pt/payout')) {
    const { trainer, amount, paymentMethod, notes, staff, description } = body;
    const desc = description || `Trainer Payout: ${trainer || 'Trainer'}${notes ? ` (${notes})` : ''}`;
    store.expenses.unshift({
      timestamp: nowISO,
      category: 'PT Payout',
      description: desc,
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(amount) || 0,
      staff: staff || 'Duty Staff'
    });
    saveClientStore(store);
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/class') || cleanUrl.endsWith('/api/classes/pass')) {
    const { name, phone, className, price, amount, paymentMethod, staff, category, customer } = body;
    const finalAmount = Number(price || amount) || 0;
    const finalClass = className || customer || category || 'Group Class Pass';
    store.sales.unshift({
      timestamp: nowISO,
      category: 'Classes',
      customer: `${name || 'Guest'} (${finalClass})`,
      paymentMethod: paymentMethod || 'Cash',
      amount: finalAmount,
      staff: staff || 'Duty Staff'
    });
    store.attendance.unshift({
      timestamp: nowISO,
      memberId: 'GUEST-CLASS',
      name: name || 'Class Attendee',
      phone: phone || '-',
      plan: finalClass,
      status: 'Active'
    });
    saveClientStore(store);
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/sales/delete')) {
    const { timestamp, customer, amount } = body;
    const idx = store.sales.findIndex((s) => {
      if (timestamp && String(s.timestamp) === String(timestamp)) return true;
      if (customer && s.customer === customer && Number(s.amount) === Number(amount)) return true;
      return false;
    });
    if (idx !== -1) {
      store.sales.splice(idx, 1);
      saveClientStore(store);
    }
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/attendance/delete')) {
    const { timestamp, name, phone } = body;
    const idx = store.attendance.findIndex((a) => {
      if (timestamp && String(a.timestamp) === String(timestamp)) return true;
      if (name && a.name === name && (!phone || a.phone === phone)) return true;
      return false;
    });
    if (idx !== -1) {
      store.attendance.splice(idx, 1);
      saveClientStore(store);
    }
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/expense/delete')) {
    const { timestamp, description, amount } = body;
    const idx = store.expenses.findIndex((e) => {
      if (timestamp && String(e.timestamp) === String(timestamp)) return true;
      if (description && e.description === description && Number(e.amount) === Number(amount)) return true;
      return false;
    });
    if (idx !== -1) {
      store.expenses.splice(idx, 1);
      saveClientStore(store);
    }
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/members/delete')) {
    const { memberId } = body;
    const idx = store.members.findIndex((m) => String(m.memberId) === String(memberId));
    if (idx !== -1) {
      store.members.splice(idx, 1);
      saveClientStore(store);
    }
    return getClientDashboardData(dateParam);
  }

  if (cleanUrl.endsWith('/api/reset')) {
    const defaultStore = getDefaultStore();
    saveClientStore(defaultStore);
    return getClientDashboardData(dateParam);
  }

  return getClientDashboardData(dateParam);
}

let isClientOnlyMode = typeof window !== 'undefined' && (
  sessionStorage.getItem('gym_client_only') === 'true' ||
  window.location.hostname.includes('netlify.app') ||
  window.location.hostname.includes('github.io') ||
  window.location.hostname.includes('surge.sh') ||
  window.location.hostname.includes('vercel.app') ||
  window.location.hostname.includes('render.com') ||
  window.location.hostname.includes('firebaseapp.com') ||
  window.location.hostname.includes('web.app') ||
  (!window.location.hostname.includes('run.app') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
);

export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  if (isClientOnlyMode) {
    return handleClientFallbackRequest(url, options) as T;
  }

  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (res.ok && isJson) {
      try {
        return await res.json();
      } catch (e) {
        isClientOnlyMode = true;
        if (typeof window !== 'undefined') sessionStorage.setItem('gym_client_only', 'true');
        return handleClientFallbackRequest(url, options) as T;
      }
    }

    if (res.ok && !isJson) {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        isClientOnlyMode = true;
        if (typeof window !== 'undefined') sessionStorage.setItem('gym_client_only', 'true');
        return handleClientFallbackRequest(url, options) as T;
      }
    }

    if (!res.ok) {
      if (isJson) {
        try {
          const errorData = await res.json();
          if (errorData && (errorData.message || errorData.error)) {
            const errorMessage = errorData.message || errorData.error;
            if (
              errorMessage.includes('PIN') ||
              errorMessage.includes('Expired') ||
              errorMessage.includes('Denied') ||
              errorMessage.includes('incorrect')
            ) {
              throw new Error(errorMessage);
            }
          }
        } catch (e: any) {
          if (
            e.message &&
            (e.message.includes('PIN') ||
              e.message.includes('Expired') ||
              e.message.includes('Denied') ||
              e.message.includes('incorrect'))
          ) {
            throw e;
          }
        }
      }

      isClientOnlyMode = true;
      if (typeof window !== 'undefined') sessionStorage.setItem('gym_client_only', 'true');
      return handleClientFallbackRequest(url, options) as T;
    }

    return await res.json();
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes('PIN') ||
        err.message.includes('Expired') ||
        err.message.includes('Denied') ||
        err.message.includes('incorrect'))
    ) {
      throw err;
    }
    isClientOnlyMode = true;
    if (typeof window !== 'undefined') sessionStorage.setItem('gym_client_only', 'true');
    return handleClientFallbackRequest(url, options) as T;
  }
}
