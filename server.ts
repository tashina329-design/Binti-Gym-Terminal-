import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(express.json());

// Vercel Serverless Function URL Normalization Middleware
app.use((req, res, next) => {
  const orig = (req.originalUrl || req.url || '').split('?')[0];

  // Only normalize requests targeted at /api or rewritten by Vercel
  const isApiReq =
    orig.startsWith('/api') ||
    (req.query && (req.query.path !== undefined || req.query['0'] !== undefined)) ||
    (typeof req.headers['x-forwarded-uri'] === 'string' && req.headers['x-forwarded-uri'].startsWith('/api'));

  if (isApiReq) {
    let subpath = '';
    if (req.query && typeof req.query.path === 'string' && req.query.path.trim()) {
      subpath = req.query.path.trim();
    } else if (req.query && Array.isArray(req.query.path) && req.query.path.length > 0) {
      subpath = req.query.path.join('/');
    } else if (req.query && typeof req.query['0'] === 'string' && req.query['0'].trim()) {
      subpath = req.query['0'].trim();
    } else {
      subpath = orig.replace(/^\/api\/?/, '');
    }

    subpath = subpath.replace(/^\/+/, '');
    req.url = '/api' + (subpath ? '/' + subpath : '');
  }

  next();
});

// File path for persistence
function getDataFilePath(): string {
  if (process.env.VERCEL || process.env.NOW_BUILDER) {
    const tmpFile = path.join('/tmp', 'gym_data.json');
    if (!fs.existsSync(tmpFile)) {
      const defaultFile = path.join(process.cwd(), 'gym_data.json');
      if (fs.existsSync(defaultFile)) {
        try {
          fs.copyFileSync(defaultFile, tmpFile);
        } catch (e) {
          // Ignore copy error
        }
      }
    }
    return tmpFile;
  }
  return path.join(process.cwd(), 'gym_data.json');
}

interface MemberRow {
  memberId: string;
  name: string;
  phone: string;
  plan: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

interface AttendanceRow {
  timestamp: string; // ISO String
  memberId: string;
  name: string;
  phone: string;
  plan: string;
  status: string;
}

interface SalesRow {
  timestamp: string; // ISO String
  category: string;
  customer: string;
  paymentMethod: string;
  amount: number;
  staff?: string;
}

interface ExpenseRow {
  timestamp: string; // ISO String
  category: string;
  description: string;
  paymentMethod: string;
  amount: number;
  staff?: string;
}

interface RegisteredStaffRow {
  id: string;
  name: string;
  phone: string;
  pin: string;
  registeredAt: string;
}

interface StaffShiftRow {
  id: string;
  staffName: string;
  shiftTitle: string;
  startTime: string;
  startTimestamp: number;
  startingFloat: number;
  notes?: string;
}

interface GymDataStore {
  members: MemberRow[];
  attendance: AttendanceRow[];
  sales: SalesRow[];
  expenses: ExpenseRow[];
  registeredStaff?: RegisteredStaffRow[];
  activeShift?: StaffShiftRow | null;
  staffPin?: string;
}

const BRUNEI_TIMEZONE = 'Asia/Brunei';

function getBruneiTodayIsoDate(dateObj?: Date): string {
  const d = dateObj || new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRUNEI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

function getBruneiFormattedTime(dateObj?: Date): string {
  const d = dateObj || new Date();
  return d.toLocaleTimeString('en-US', {
    timeZone: BRUNEI_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getTodayStr(d = new Date()): string {
  return getBruneiTodayIsoDate(d);
}

function isSameDate(timestamp: any, targetDateStr: string): boolean {
  if (!timestamp || !targetDateStr) return false;
  const str = String(timestamp).trim();
  if (str.startsWith(targetDateStr)) return true;

  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return false;

  const bruneiDate = getBruneiTodayIsoDate(d);
  if (bruneiDate === targetDateStr) return true;

  try {
    const utcDate = d.toISOString().split('T')[0];
    if (utcDate === targetDateStr) return true;
  } catch (e) {}

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const localDate = `${year}-${month}-${day}`;
  if (localDate === targetDateStr) return true;

  return false;
}

function formatTime(d: Date): string {
  if (!d || isNaN(d.getTime())) return getBruneiFormattedTime();
  return getBruneiFormattedTime(d);
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

// Initial seed data
function getDefaultData(): GymDataStore {
  const today = getTodayStr();
  const nowISO = new Date().toISOString();

  // Compute dates for sample members
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
      { memberId: 'MEM-100241', name: 'Ahmad Daniel', phone: '8712345', plan: 'Standard Monthly', startDate: start30Ago, endDate: end30Later },
      { memberId: 'MEM-204891', name: 'Siti Nurhaliza', phone: '8823456', plan: 'Student Monthly', startDate: start30Ago, endDate: end5Later },
      { memberId: 'MEM-309123', name: 'Markus Vance', phone: '8934567', plan: 'Standard Monthly', startDate: '2026-05-01', endDate: end10Ago },
      { memberId: 'MEM-401928', name: 'Jessica Tan', phone: '8765432', plan: 'Standard Monthly', startDate: start30Ago, endDate: end30Later }
    ],
    attendance: [
      { timestamp: new Date(Date.now() - 300000).toISOString(), memberId: 'MEM-100241', name: 'Ahmad Daniel', phone: '8712345', plan: 'Standard Monthly', status: 'Active' },
      { timestamp: new Date(Date.now() - 200000).toISOString(), memberId: 'GUEST', name: 'Michael Lee', phone: '-', plan: 'Walk-In Pass', status: 'Active' },
      { timestamp: new Date(Date.now() - 100000).toISOString(), memberId: 'CLASS', name: 'Sarah Connor', phone: '-', plan: 'Class: Trampoline', status: 'Active' }
    ],
    sales: [
      { timestamp: new Date(Date.now() - 500000).toISOString(), category: 'Membership', customer: 'Ahmad Daniel (Standard Monthly)', paymentMethod: 'Baiduri', amount: 55.00, staff: 'Alex (Duty Staff)' },
      { timestamp: new Date(Date.now() - 400000).toISOString(), category: 'Walk-In Pass', customer: 'Michael Lee', paymentMethod: 'Cash', amount: 4.00, staff: 'Alex (Duty Staff)' },
      { timestamp: new Date(Date.now() - 300000).toISOString(), category: 'Class Pass', customer: 'Sarah Connor | Trampoline', paymentMethod: 'Cash', amount: 6.00, staff: 'Alex (Duty Staff)' },
      { timestamp: new Date(Date.now() - 200000).toISOString(), category: 'POS/Sauna', customer: 'Big Water Bottle (x2)', paymentMethod: 'Cash', amount: 4.00, staff: 'Alex (Duty Staff)' },
      { timestamp: new Date(Date.now() - 100000).toISOString(), category: 'PT Payment', customer: 'Trainer: Coach Alex | Client: Mark Lee | 10 Sessions Package', paymentMethod: 'Bibd', amount: 300.00, staff: 'Alex (Duty Staff)' }
    ],
    expenses: [
      { timestamp: new Date(Date.now() - 200000).toISOString(), category: 'Stock Restock', description: 'Water Bottle Restock 5 cases', paymentMethod: 'Cash', amount: 35.00, staff: 'Alex (Duty Staff)' },
      { timestamp: new Date(Date.now() - 100000).toISOString(), category: 'PT Payout', description: 'Coach Alex - 50% Commission for Mark Lee', paymentMethod: 'Bibd', amount: 150.00, staff: 'Alex (Duty Staff)' }
    ]
  };
}

// Live SSE Clients for zero-delay synchronization across devices
const sseClients: express.Response[] = [];

function broadcastDataUpdate(payload?: any) {
  const dataString = `data: ${JSON.stringify(payload || { type: 'data_updated', timestamp: Date.now() })}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(dataString);
    } catch (err) {
      sseClients.splice(i, 1);
    }
  }
}

interface BusinessMeta {
  name: string;
  pin: string;
  registeredAt: string;
}

interface MultiBusinessContainer {
  businesses: Record<string, BusinessMeta>;
  stores: Record<string, GymDataStore>;
}

function normalizeBusinessKey(name?: string): string {
  const clean = (name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return clean || 'binti_gym';
}

function getBusinessNameFromReq(req: express.Request): string {
  const name =
    (req.headers['x-business-name'] as string) ||
    (req.query.businessName as string) ||
    (req.body && req.body.businessName) ||
    'Binti Gym';
  return name.trim() || 'Binti Gym';
}

let multiStoreContainer: MultiBusinessContainer | null = null;

function loadRootContainer(): MultiBusinessContainer {
  if (multiStoreContainer) {
    return multiStoreContainer;
  }
  const filePath = getDataFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.businesses && parsed.stores) {
        multiStoreContainer = parsed;
        return parsed;
      } else if (parsed.members) {
        const key = 'binti_gym';
        multiStoreContainer = {
          businesses: {
            [key]: {
              name: 'Binti Gym',
              pin: parsed.staffPin || '1234',
              registeredAt: new Date().toISOString(),
            },
          },
          stores: {
            [key]: parsed,
          },
        };
        saveRootContainer(multiStoreContainer);
        return multiStoreContainer;
      }
    }
  } catch (err) {
    console.error('Failed to load gym data file:', err);
  }

  const key = 'binti_gym';
  const defaultData = getDefaultData();
  multiStoreContainer = {
    businesses: {
      [key]: {
        name: 'Binti Gym',
        pin: '1234',
        registeredAt: new Date().toISOString(),
      },
    },
    stores: {
      [key]: defaultData,
    },
  };
  saveRootContainer(multiStoreContainer);
  return multiStoreContainer;
}

function saveRootContainer(container: MultiBusinessContainer) {
  multiStoreContainer = container;
  const filePath = getDataFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(container, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save gym data:', err);
  }
  try {
    broadcastDataUpdate();
  } catch (err) {
    // Ignore SSE errors
  }
}

function loadData(businessName?: string): GymDataStore {
  const container = loadRootContainer();
  const key = normalizeBusinessKey(businessName);
  if (!container.stores[key]) {
    container.stores[key] = {
      members: [],
      attendance: [],
      sales: [],
      expenses: [],
      registeredStaff: [],
      activeShift: null,
      staffPin: container.businesses[key]?.pin || '1234',
    };
    if (!container.businesses[key]) {
      container.businesses[key] = {
        name: businessName || 'Binti Gym',
        pin: '1234',
        registeredAt: new Date().toISOString(),
      };
    }
    saveRootContainer(container);
  }
  return container.stores[key];
}

function saveData(data: GymDataStore, businessName?: string) {
  const container = loadRootContainer();
  const key = normalizeBusinessKey(businessName);
  container.stores[key] = data;
  saveRootContainer(container);
}

function getDashboardData(dateStr?: string, businessName?: string) {
  const store = loadData(businessName);
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
  const membersList: any[] = [];
  const ptDetails: any[] = [];

  // Members
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

  // Sales
  for (const s of store.sales) {
    if (isSameDate(s.timestamp, targetDateStr)) {
      const d = new Date(s.timestamp);
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

  // Expenses
  for (const e of store.expenses) {
    if (isSameDate(e.timestamp, targetDateStr)) {
      const d = new Date(e.timestamp);
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

  // Attendance
  for (const a of store.attendance) {
    if (isSameDate(a.timestamp, targetDateStr)) {
      const d = new Date(a.timestamp);
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
    viewDate: targetDateStr,
    store
  };
}

// API ROUTE HANDLERS
const apiRouter = express.Router();

// Middleware to enforce 4-digit PIN verification per dedicated business store
apiRouter.use((req, res, next) => {
  if (
    req.path === '/events' ||
    req.path === '/stores' ||
    req.path === '/stores/register' ||
    req.path === '/stores/login'
  ) {
    return next();
  }

  const bizName = getBusinessNameFromReq(req);
  const key = normalizeBusinessKey(bizName);
  const container = loadRootContainer();
  const biz = container.businesses[key];

  const reqPin = (req.headers['x-business-pin'] as string) || (req.body && req.body.businessPin) || '';

  if (biz && biz.pin && reqPin.trim() !== biz.pin) {
    return res.status(401).json({
      success: false,
      message: `Access denied. Invalid 4-digit PIN for store "${biz.name}".`,
    });
  }

  next();
});

// GET /api/events - Real-time Server-Sent Events for live sync without delay
apiRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  // Initial connection ping
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// GET /api/stores - List all registered business names
apiRouter.get('/stores', (req, res, next) => {
  try {
    const container = loadRootContainer();
    const list = Object.values(container.businesses).map((b) => ({
      name: b.name,
      registeredAt: b.registeredAt,
    }));
    res.json({ success: true, stores: list });
  } catch (err) {
    next(err);
  }
});

// POST /api/stores/register - Register new business & set 4-digit PIN
apiRouter.post('/stores/register', (req, res, next) => {
  try {
    const { name, pin } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Business Name is required.' });
    }
    const cleanName = String(name).trim();
    const cleanPin = String(pin || '').trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return res.status(400).json({ success: false, message: 'PIN code must be exactly 4 numeric digits.' });
    }

    const container = loadRootContainer();
    const key = normalizeBusinessKey(cleanName);

    if (container.businesses[key]) {
      return res.status(400).json({
        success: false,
        message: `Business "${cleanName}" is already registered. Please select it and enter your 4-digit PIN code.`,
      });
    }

    // Initialize business metadata and empty store
    container.businesses[key] = {
      name: cleanName,
      pin: cleanPin,
      registeredAt: new Date().toISOString(),
    };
    container.stores[key] = {
      members: [],
      attendance: [],
      sales: [],
      expenses: [],
      registeredStaff: [],
      activeShift: null,
      staffPin: cleanPin,
    };
    saveRootContainer(container);

    res.json({
      success: true,
      businessName: cleanName,
      pin: cleanPin,
      store: container.stores[key],
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/stores/login - Log into existing business with 4-digit PIN
apiRouter.post('/stores/login', (req, res, next) => {
  try {
    const { name, pin, store: incomingStore } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Business Name is required.' });
    }
    const cleanName = String(name).trim();
    const cleanPin = String(pin || '').trim();
    const container = loadRootContainer();
    const key = normalizeBusinessKey(cleanName);

    let biz = container.businesses[key];

    // If business is not yet registered in server state, auto-register/adopt it with this PIN
    if (!biz) {
      biz = {
        name: cleanName,
        pin: cleanPin,
        registeredAt: new Date().toISOString(),
      };
      container.businesses[key] = biz;
      if (!container.stores[key]) {
        container.stores[key] = {
          members: [],
          attendance: [],
          sales: [],
          expenses: [],
          registeredStaff: [],
          activeShift: null,
          staffPin: cleanPin,
        };
      }
      saveRootContainer(container);
    }

    if (biz.pin && biz.pin !== cleanPin) {
      return res.status(401).json({
        success: false,
        message: `Incorrect 4-digit PIN code for "${biz.name}". Access denied.`,
      });
    }

    if (incomingStore && typeof incomingStore === 'object') {
      const current = container.stores[key] || loadData(cleanName);
      container.stores[key] = {
        ...current,
        ...incomingStore,
        members: incomingStore.members || current.members || [],
        attendance: incomingStore.attendance || current.attendance || [],
        sales: incomingStore.sales || current.sales || [],
        expenses: incomingStore.expenses || current.expenses || [],
      };
      saveRootContainer(container);
    }

    const store = container.stores[key] || loadData(cleanName);
    res.json({
      success: true,
      businessName: biz.name,
      pin: biz.pin,
      store,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sync - Synchronize store data state across cloud and server
apiRouter.post('/sync', (req, res, next) => {
  try {
    const { store: incomingStore } = req.body || {};
    const bizName = getBusinessNameFromReq(req);
    const currentStore = loadData(bizName);

    if (incomingStore && typeof incomingStore === 'object') {
      const updatedStore: GymDataStore = {
        ...currentStore,
        ...incomingStore,
        members: incomingStore.members || currentStore.members || [],
        attendance: incomingStore.attendance || currentStore.attendance || [],
        sales: incomingStore.sales || currentStore.sales || [],
        expenses: incomingStore.expenses || currentStore.expenses || [],
        registeredStaff: incomingStore.registeredStaff || currentStore.registeredStaff || [],
        activeShift: incomingStore.activeShift !== undefined ? incomingStore.activeShift : currentStore.activeShift,
      };

      saveData(updatedStore, bizName);

      // Notify any connected SSE clients
      const sseMsg = JSON.stringify({
        type: 'data_updated',
        timestamp: Date.now(),
        businessName: bizName,
        store: updatedStore,
      });
      for (const client of sseClients) {
        try {
          client.write(`data: ${sseMsg}\n\n`);
        } catch {}
      }

      return res.json({ success: true, store: updatedStore });
    }

    res.json({ success: true, store: currentStore });
  } catch (err) {
    next(err);
  }
});

// GET /api/staff - Fetch registered staff and active shift across all devices
apiRouter.get('/staff', (req, res, next) => {
  try {
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    res.json({
      registeredStaff: store.registeredStaff || [],
      activeShift: store.activeShift || null,
      staffPin: store.staffPin || '1234',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/staff/register - Register new staff or PIN across all devices
apiRouter.post('/staff/register', (req, res, next) => {
  try {
    const { newStaff } = req.body || {};
    if (!newStaff || !newStaff.pin) {
      return res.status(400).json({ success: false, message: 'Invalid staff payload' });
    }

    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    if (!store.registeredStaff) store.registeredStaff = [];

    store.registeredStaff.push(newStaff);
    store.staffPin = newStaff.pin;

    saveData(store, bizName);
    res.json({ success: true, registeredStaff: store.registeredStaff, staffPin: store.staffPin });
  } catch (err) {
    next(err);
  }
});

// POST /api/staff/shift/start - Start shift
apiRouter.post('/staff/shift/start', (req, res, next) => {
  try {
    const { shift } = req.body || {};
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    store.activeShift = shift;
    saveData(store, bizName);
    res.json({ success: true, activeShift: shift });
  } catch (err) {
    next(err);
  }
});

// POST /api/staff/shift/end - End shift
apiRouter.post('/staff/shift/end', (req, res, next) => {
  try {
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    store.activeShift = null;
    saveData(store, bizName);
    res.json({ success: true, activeShift: null });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard
apiRouter.get('/dashboard', (req, res, next) => {
  try {
    const dateStr = req.query.date as string | undefined;
    const bizName = getBusinessNameFromReq(req);
    const data = getDashboardData(dateStr, bizName);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/checkin/phone
apiRouter.post('/checkin/phone', (req, res, next) => {
  try {
    const { phone } = req.body || {};
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    const cleanPhone = String(phone || '').replace(/\D/g, '');

    if (!cleanPhone) {
      return res.json({ success: false, message: 'Please enter a valid phone number.' });
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
      return res.json({ success: false, notFound: true, message: 'Member not found. Check phone number or register as guest.' });
    }

    if (matches.length > 1) {
      return res.json({ success: true, multiple: true, members: matches });
    }

    // Single match
    const member = store.members.find(m => m.memberId === matches[0].memberId);
    if (!member) {
      return res.json({ success: false, message: 'Member record error.' });
    }

    const status = getMemberStatus(member.endDate);
    if (status === 'Expired') {
      return res.json({ success: false, message: `Check-In Denied: ${member.name}'s membership has expired.` });
    }

    store.attendance.unshift({
      timestamp: new Date().toISOString(),
      memberId: member.memberId,
      name: member.name,
      phone: member.phone,
      plan: member.plan,
      status
    });

    saveData(store, bizName);
    return res.json({ success: true, message: `Welcome back, ${member.name}!`, store });
  } catch (err) {
    next(err);
  }
});

// POST /api/checkin/id
apiRouter.post('/checkin/id', (req, res, next) => {
  try {
    const { memberId } = req.body || {};
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);

    const member = store.members.find(m => String(m.memberId) === String(memberId));
    if (!member) {
      return res.json({ success: false, message: 'Member record not found.' });
    }

    const status = getMemberStatus(member.endDate);
    if (status === 'Expired') {
      return res.json({ success: false, message: `Check-In Denied: ${member.name}'s membership has expired.` });
    }

    store.attendance.unshift({
      timestamp: new Date().toISOString(),
      memberId: member.memberId,
      name: member.name,
      phone: member.phone,
      plan: member.plan,
      status
    });

    saveData(store, bizName);
    return res.json({ success: true, message: `Welcome back, ${member.name}!`, store });
  } catch (err) {
    next(err);
  }
});

// POST /api/walkin
apiRouter.post('/walkin', (req, res, next) => {
  try {
    const { name, phone, amount, paymentMethod, staff, viewDate, date } = req.body || {};
    const targetDate = (req.query.date as string) || viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    const nowISO = new Date().toISOString();

    store.sales.unshift({
      timestamp: nowISO,
      category: 'Walk-In Pass',
      customer: name || 'Guest Walk-in',
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(amount) || 0,
      staff: staff || 'Duty Staff'
    });

    store.attendance.unshift({
      timestamp: nowISO,
      memberId: 'GUEST',
      name: name || 'Guest Walk-in',
      phone: phone || '-',
      plan: 'Walk-In Pass',
      status: 'Active'
    });

    saveData(store, bizName);
    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// POST /api/pos
apiRouter.post('/pos', (req, res, next) => {
  try {
    const { itemName, qty, amount, paymentMethod, staff, viewDate, date } = req.body || {};
    const targetDate = (req.query.date as string) || viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    const nowISO = new Date().toISOString();

    store.sales.unshift({
      timestamp: nowISO,
      category: 'POS/Sauna',
      customer: `${itemName || 'Item'} (x${qty || 1})`,
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(amount) || 0,
      staff: staff || 'Duty Staff'
    });

    saveData(store, bizName);
    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// POST /api/class
apiRouter.post('/class', (req, res, next) => {
  try {
    const { className, clientName, amount, paymentMethod, staff, viewDate, date } = req.body || {};
    const targetDate = (req.query.date as string) || viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    const nowISO = new Date().toISOString();

    store.sales.unshift({
      timestamp: nowISO,
      category: 'Class Pass',
      customer: `${clientName || 'Client'} | ${className || 'Class'}`,
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(amount) || 0,
      staff: staff || 'Duty Staff'
    });

    store.attendance.unshift({
      timestamp: nowISO,
      memberId: 'CLASS',
      name: clientName || 'Guest',
      phone: '-',
      plan: `Class: ${className || 'Class'}`,
      status: 'Active'
    });

    saveData(store, bizName);
    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// POST /api/pt/in
apiRouter.post('/pt/in', (req, res, next) => {
  try {
    const { trainerName, clientName, sessions, amount, paymentMethod, staff, viewDate, date } = req.body || {};
    const targetDate = (req.query.date as string) || viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    const nowISO = new Date().toISOString();

    const parts = [];
    if (trainerName && String(trainerName).trim()) parts.push(`Trainer: ${String(trainerName).trim()}`);
    if (clientName && String(clientName).trim()) parts.push(`Client: ${String(clientName).trim()}`);
    if (sessions && String(sessions).trim()) parts.push(String(sessions).trim());
    const customerField = parts.join(' | ') || `${clientName || 'Client'} | Trainer: ${trainerName || 'Coach'}`;

    store.sales.unshift({
      timestamp: nowISO,
      category: 'PT Payment',
      customer: customerField,
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(amount) || 0,
      staff: staff || 'Duty Staff'
    });

    saveData(store, bizName);
    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// POST /api/pt/out
apiRouter.post('/pt/out', (req, res, next) => {
  try {
    const { trainerName, description, amount, paymentMethod, staff, viewDate, date } = req.body || {};
    const targetDate = (req.query.date as string) || viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    const nowISO = new Date().toISOString();

    store.expenses.unshift({
      timestamp: nowISO,
      category: 'PT Payout',
      description: `${trainerName || 'Coach'} - ${description || 'Payout'}`,
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(amount) || 0,
      staff: staff || 'Duty Staff'
    });

    saveData(store, bizName);
    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// POST /api/expense
apiRouter.post('/expense', (req, res, next) => {
  try {
    const { category, description, amount, paymentMethod, staff, viewDate, date } = req.body || {};
    const targetDate = (req.query.date as string) || viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    const nowISO = new Date().toISOString();

    store.expenses.unshift({
      timestamp: nowISO,
      category: category || 'Misc',
      description: description || '',
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(amount) || 0,
      staff: staff || 'Duty Staff'
    });

    saveData(store, bizName);
    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// POST /api/members/register
apiRouter.post('/members/register', (req, res, next) => {
  try {
    const { name, phone, planType, price, startDate, endDate, paymentMethod, staff, viewDate, date } = req.body || {};
    const targetDate = (req.query.date as string) || viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    const nowISO = new Date().toISOString();
    const memberId = 'MEM-' + Math.floor(100000 + Math.random() * 900000);

    const startStr = startDate || getTodayStr();
    const endStr = endDate || getTodayStr();

    store.members.unshift({
      memberId,
      name: name || '',
      phone: phone || '',
      plan: planType || 'Standard Monthly',
      startDate: startStr,
      endDate: endStr
    });

    store.sales.unshift({
      timestamp: nowISO,
      category: 'Membership',
      customer: `${name} (${planType})`,
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(price) || 0,
      staff: staff || 'Duty Staff'
    });

    saveData(store, bizName);
    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// POST /api/members/renew
apiRouter.post('/members/renew', (req, res, next) => {
  try {
    const { memberId, planType, price, paymentMethod, staff, viewDate, date } = req.body || {};
    const targetDate = (req.query.date as string) || viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);
    const nowISO = new Date().toISOString();

    const member = store.members.find(m => String(m.memberId) === String(memberId));
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member record not found.' });
    }

    const today = new Date();
    const currentEnd = new Date((member.endDate || getTodayStr()) + 'T00:00:00');
    const baseDate = !isNaN(currentEnd.getTime()) && currentEnd > today ? currentEnd : today;

    const newEndDateObj = new Date(baseDate);
    newEndDateObj.setMonth(newEndDateObj.getMonth() + 1);
    const newEndDateStr = getTodayStr(newEndDateObj);

    if (planType) member.plan = planType;
    member.endDate = newEndDateStr;

    store.sales.unshift({
      timestamp: nowISO,
      category: 'Membership',
      customer: `${member.name} (${planType || member.plan} Renewal)`,
      paymentMethod: paymentMethod || 'Cash',
      amount: Number(price) || 0,
      staff: staff || 'Duty Staff'
    });

    saveData(store, bizName);
    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sales/delete
apiRouter.post('/sales/delete', (req, res, next) => {
  try {
    const { timestamp, customer, amount, date, viewDate } = req.body || {};
    const targetDate = viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);

    const idx = store.sales.findIndex((s) => {
      if (timestamp && String(s.timestamp) === String(timestamp)) return true;
      if (customer && s.customer === customer && Number(s.amount) === Number(amount)) return true;
      return false;
    });

    if (idx !== -1) {
      store.sales.splice(idx, 1);
      saveData(store, bizName);
    }

    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/attendance/delete
apiRouter.post('/attendance/delete', (req, res, next) => {
  try {
    const { timestamp, name, phone, date, viewDate } = req.body || {};
    const targetDate = viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);

    const idx = store.attendance.findIndex((a) => {
      if (timestamp && String(a.timestamp) === String(timestamp)) return true;
      if (name && a.name === name && (!phone || a.phone === phone)) return true;
      return false;
    });

    if (idx !== -1) {
      store.attendance.splice(idx, 1);
      saveData(store, bizName);
    }

    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/expense/delete
apiRouter.post('/expense/delete', (req, res, next) => {
  try {
    const { timestamp, description, amount, date, viewDate } = req.body || {};
    const targetDate = viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);

    const idx = store.expenses.findIndex((e) => {
      if (timestamp && String(e.timestamp) === String(timestamp)) return true;
      if (description && e.description === description && Number(e.amount) === Number(amount)) return true;
      return false;
    });

    if (idx !== -1) {
      store.expenses.splice(idx, 1);
      saveData(store, bizName);
    }

    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/members/delete
apiRouter.post('/members/delete', (req, res, next) => {
  try {
    const { memberId, date, viewDate } = req.body || {};
    const targetDate = viewDate || date;
    const bizName = getBusinessNameFromReq(req);
    const store = loadData(bizName);

    const idx = store.members.findIndex((m) => String(m.memberId) === String(memberId));
    if (idx !== -1) {
      store.members.splice(idx, 1);
      saveData(store, bizName);
    }

    res.json(getDashboardData(targetDate, bizName));
  } catch (err) {
    next(err);
  }
});

// POST /api/reset
apiRouter.post('/reset', (req, res, next) => {
  try {
    const bizName = getBusinessNameFromReq(req);
    const defaultData = getDefaultData();
    saveData(defaultData, bizName);
    res.json(getDashboardData(undefined, bizName));
  } catch (err) {
    next(err);
  }
});

// Mount API router ONLY for /api prefix
app.use('/api', apiRouter);

// Fallback JSON 404 handler for missing API endpoints
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API route not found' });
});

// Global Express error handler to prevent Vercel FUNCTION_INVOCATION_FAILED crashes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({ success: false, error: err?.message || 'A server error occurred' });
  }
});

// SPA Route Fallback for Entrance Check-In
app.get('/checkin', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  } else {
    next();
  }
});

// Server Initialization
async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;

if (!process.env.VERCEL && !process.env.NOW_BUILDER) {
  startServer();
}
