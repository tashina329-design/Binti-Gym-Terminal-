import { DashboardData } from '../types';

export interface SpreadsheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

const SPREADSHEET_TITLE = 'IronVault Gym - Management & Sales Log';

/**
 * Searches Google Drive for existing spreadsheet or creates a new one.
 */
export async function findOrCreateGymSpreadsheet(accessToken: string): Promise<SpreadsheetInfo> {
  // 1. Search in Drive
  const query = encodeURIComponent(`name='${SPREADSHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const err = await searchRes.json();
    throw new Error(err.error?.message || 'Failed to search Google Drive');
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const file = searchData.files[0];
    return {
      spreadsheetId: file.id,
      spreadsheetUrl: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
      title: file.name,
    };
  }

  // 2. Create new spreadsheet with styled tabs
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const body = {
    properties: { title: SPREADSHEET_TITLE },
    sheets: [
      { properties: { title: 'Sales Log' } },
      { properties: { title: 'Check-In Log' } },
      { properties: { title: 'Members Directory' } },
      { properties: { title: 'Expenses Log' } },
      { properties: { title: 'Daily Summary' } },
    ],
  };

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err.error?.message || 'Failed to create Google Spreadsheet');
  }

  const newSheet = await createRes.json();
  return {
    spreadsheetId: newSheet.spreadsheetId,
    spreadsheetUrl: newSheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newSheet.spreadsheetId}`,
    title: SPREADSHEET_TITLE,
  };
}

/**
 * Writes current gym dashboard data into the Google Sheets tabs.
 */
export async function syncDataToGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  data: DashboardData
): Promise<void> {
  // Prepare batch update data
  const valueRanges = [
    // 1. Sales Log
    {
      range: "'Sales Log'!A1:F500",
      values: [
        ['Timestamp / Time', 'Staff on Duty', 'Category', 'Customer', 'Payment Method', 'Amount ($)'],
        ...data.todaySales.map((s) => [
          s.timestamp || s.time,
          s.staff || 'Duty Staff',
          s.category,
          s.customer,
          s.payment,
          s.amount,
        ]),
      ],
    },
    // 2. Check-In Log
    {
      range: "'Check-In Log'!A1:F500",
      values: [
        ['Check-In Time', 'Member Name', 'Phone Number', 'Plan', 'Check-In Status'],
        ...data.todayAttendance.map((a) => [
          a.timestamp || a.time,
          a.name,
          a.phone,
          a.plan,
          a.status,
        ]),
      ],
    },
    // 3. Members Directory
    {
      range: "'Members Directory'!A1:G500",
      values: [
        ['Member ID', 'Full Name', 'Phone', 'Plan', 'Start Date', 'End Date', 'Status'],
        ...data.members.map((m) => [
          m.memberId,
          m.name,
          m.phone,
          m.plan,
          m.startDate,
          m.endDate,
          m.status,
        ]),
      ],
    },
    // 4. Expenses Log
    {
      range: "'Expenses Log'!A1:F500",
      values: [
        ['Time', 'Staff on Duty', 'Category', 'Description', 'Payment Method', 'Amount ($)'],
        ...data.todayExpenses.map((e) => [
          e.timestamp || e.time,
          e.staff || 'Duty Staff',
          e.category,
          e.description,
          e.payment,
          e.amount,
        ]),
      ],
    },
    // 5. Daily Summary
    {
      range: "'Daily Summary'!A1:B15",
      values: [
        ['Metric', 'Value'],
        ['Report Date', data.viewDate],
        ['Total Revenue ($)', data.totalRevenue],
        ['Total Expenses ($)', data.totalExpenses],
        ['Net Income ($)', data.netIncome],
        ['Total Attendance Check-Ins', data.checkinCount],
        ['Members Expiring Soon', data.expiringCount],
        ['POS & Merchandise Sales ($)', data.posSalesTotal],
        ['Class Ticket Sales ($)', data.classSalesTotal],
        ['Personal Training Sales ($)', data.ptSalesTotal],
        ['Walk-In Pass Sales ($)', data.walkInSalesTotal],
        ['Membership Sales ($)', data.membershipSalesTotal],
        ['Cash Collected ($)', data.cashIn],
        ['Baiduri Bank In ($)', data.baiduriIn],
        ['BIBD Bank In ($)', data.bibdIn],
      ],
    },
  ];

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const body = {
    valueInputOption: 'USER_ENTERED',
    data: valueRanges,
  };

  const res = await fetch(updateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Failed to update Google Sheets data');
  }
}
