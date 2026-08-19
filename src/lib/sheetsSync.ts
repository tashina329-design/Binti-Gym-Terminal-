import { DashboardData } from '../types';

export interface SpreadsheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

export interface DailySummaryMetrics {
  headerTitle: string;
  newMembershipCount: number;
  walkInCount: number;
  cashIn: number;
  baiduriIn: number;
  bibdIn: number;
  couponIn: number;
  totalIncomeIn: number;
  cashOut: number;
  baiduriOut: number;
  bibdOut: number;
  couponOut: number;
  totalExpensesOut: number;
  netCash: number;
  netDaily: number;
  netBaiduri: number;
  netBibd: number;
}

const SPREADSHEET_TITLE = 'IronVault Gym - Management & Sales Log';

/**
 * Helper to format date header: "REPORT FOR THU AUG 20 2026"
 */
export function formatReportDateHeader(isoDateStr?: string): string {
  let d = new Date();
  if (isoDateStr) {
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      const parsed = new Date(isoDateStr);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
  }

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const dayName = days[d.getDay()];
  const monthName = months[d.getMonth()];
  const dayNum = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();

  return `REPORT FOR ${dayName} ${monthName} ${dayNum} ${year}`;
}

/**
 * Calculates complete Daily Summary metrics matching the requested report layout.
 */
export function calculateDailySummaryMetrics(data: DashboardData): DailySummaryMetrics {
  const headerTitle = formatReportDateHeader(data.viewDate);

  // 1. Membership signups & Walk-ins
  const newMembershipCount =
    data.todaySales.filter(
      (s) =>
        /membership|new member|member sign/i.test(s.category) ||
        (/registration/i.test(s.category) && !/walk-?in/i.test(s.category))
    ).length ||
    data.members.filter((m) => m.startDate === data.viewDate).length ||
    0;

  const walkInCount =
    data.todaySales.filter((s) => /walk-?in/i.test(s.category)).length || 0;

  // 2. Income (Payment In)
  let cashIn = 0;
  let baiduriIn = 0;
  let bibdIn = 0;
  let couponIn = 0;

  for (const s of data.todaySales) {
    if (/pt payout|pt out/i.test(s.category)) continue;
    const amt = Number(s.amount) || 0;
    const pay = (s.payment || '').toLowerCase();

    if (pay.includes('cash')) {
      cashIn += amt;
    } else if (pay.includes('baiduri') || pay.includes('card')) {
      baiduriIn += amt;
    } else if (pay.includes('bibd') || pay.includes('online')) {
      bibdIn += amt;
    } else if (pay.includes('coupon') || pay.includes('voucher')) {
      couponIn += amt;
    } else {
      cashIn += amt;
    }
  }

  const totalIncomeIn = cashIn + baiduriIn + bibdIn + couponIn;

  // 3. Expenses (Payment Out)
  let cashOut = 0;
  let baiduriOut = 0;
  let bibdOut = 0;
  let couponOut = 0;

  for (const e of data.todayExpenses) {
    const amt = Number(e.amount) || 0;
    const pay = (e.payment || '').toLowerCase();

    if (pay.includes('cash')) {
      cashOut += amt;
    } else if (pay.includes('baiduri') || pay.includes('card')) {
      baiduriOut += amt;
    } else if (pay.includes('bibd') || pay.includes('online')) {
      bibdOut += amt;
    } else if (pay.includes('coupon') || pay.includes('voucher')) {
      couponOut += amt;
    } else {
      cashOut += amt;
    }
  }

  // Also include any PT Out payouts in expenses
  for (const s of data.todaySales) {
    if (/pt payout|pt out/i.test(s.category)) {
      const amt = Number(s.amount) || 0;
      const pay = (s.payment || '').toLowerCase();

      if (pay.includes('baiduri') || pay.includes('card')) {
        baiduriOut += amt;
      } else if (pay.includes('bibd') || pay.includes('online')) {
        bibdOut += amt;
      } else if (pay.includes('coupon') || pay.includes('voucher')) {
        couponOut += amt;
      } else {
        cashOut += amt;
      }
    }
  }

  const totalExpensesOut = cashOut + baiduriOut + bibdOut + couponOut;

  // 4. Net balances
  const netCash = cashIn - cashOut;
  const netDaily = totalIncomeIn - totalExpensesOut;
  const netBaiduri = baiduriIn - baiduriOut;
  const netBibd = bibdIn - bibdOut;

  return {
    headerTitle,
    newMembershipCount,
    walkInCount,
    cashIn,
    baiduriIn,
    bibdIn,
    couponIn,
    totalIncomeIn,
    cashOut,
    baiduriOut,
    bibdOut,
    couponOut,
    totalExpensesOut,
    netCash,
    netDaily,
    netBaiduri,
    netBibd,
  };
}

/**
 * Formats daily summary block into 2D string array for Google Sheets rows.
 */
export function buildDailySummaryRows(metrics: DailySummaryMetrics): Array<[string, string | number]> {
  const fmt = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  return [
    [metrics.headerTitle, ''],
    ['New Membership Sign-ups', metrics.newMembershipCount],
    ['Walk-In Entries', metrics.walkInCount],
    ['--- INCOME (PAYMENT IN) ---', ''],
    ['Cash In', fmt(metrics.cashIn)],
    ['Baiduri In', fmt(metrics.baiduriIn)],
    ['Bibd In', fmt(metrics.bibdIn)],
    ['Coupon In', fmt(metrics.couponIn)],
    ['TOTAL INCOME IN', fmt(metrics.totalIncomeIn)],
    ['--- EXPENSES (PAYMENT OUT) ---', ''],
    ['Cash Out', fmt(metrics.cashOut)],
    ['Baiduri Out', fmt(metrics.baiduriOut)],
    ['Bibd Out', fmt(metrics.bibdOut)],
    ['Coupon Out', fmt(metrics.couponOut)],
    ['TOTAL EXPENSES OUT', fmt(metrics.totalExpensesOut)],
    ['--- SUMMARY ---', ''],
    ['NET CASH BALANCE (Drawer Cash)', fmt(metrics.netCash)],
    ['NET DAILY BALANCE (All Methods)', fmt(metrics.netDaily)],
    ['NET BAIDURI BALANCE', fmt(metrics.netBaiduri)],
    ['NET BIBD BALANCE', fmt(metrics.netBibd)],
  ];
}

/**
 * Searches Google Drive for existing spreadsheet or creates a new one.
 */
export async function findOrCreateGymSpreadsheet(accessToken: string): Promise<SpreadsheetInfo> {
  // 1. Search in Drive
  const query = encodeURIComponent(
    `name='${SPREADSHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );
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

  // 2. Create new spreadsheet with Daily Summary tab first
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const body = {
    properties: { title: SPREADSHEET_TITLE },
    sheets: [
      { properties: { title: 'Daily Summary' } },
      { properties: { title: 'Sales Log' } },
      { properties: { title: 'Check-In Log' } },
      { properties: { title: 'Members Directory' } },
      { properties: { title: 'Expenses Log' } },
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
 * Fetches existing rows from 'Daily Summary' to preserve historical summaries.
 */
async function fetchExistingDailySummaryRows(accessToken: string, spreadsheetId: string): Promise<string[][]> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Daily Summary'!A1:B1000`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.values) ? data.values : [];
  } catch {
    return [];
  }
}

/**
 * Merges the newest summary block at the very top, preserving older summaries below.
 */
function mergeDailySummariesLatestOnTop(
  currentRows: Array<[string, string | number]>,
  existingRows: string[][],
  currentHeader: string
): Array<[string, string | number]> {
  if (!existingRows || existingRows.length === 0) {
    return currentRows;
  }

  // Parse existing rows into separate blocks
  const blocks: Array<Array<[string, string | number]>> = [];
  let currentBlock: Array<[string, string | number]> = [];

  for (const row of existingRows) {
    const colA = (row[0] || '').trim();
    const colB = row[1] !== undefined ? row[1] : '';

    // Check if this row marks the start of a report block
    if (colA.startsWith('REPORT FOR ') && currentBlock.length > 0) {
      blocks.push(currentBlock);
      currentBlock = [];
    }

    // Ignore old legacy table headers
    if (colA === 'Metric' && colB === 'Value') continue;
    if (colA === 'Report Date') continue;

    currentBlock.push([colA, colB]);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  // Filter out any block that matches current date's header to avoid duplicate on same day
  const filteredPreviousBlocks = blocks.filter((b) => {
    const firstRowA = (b[0]?.[0] || '').toString().trim();
    return firstRowA !== currentHeader;
  });

  const merged: Array<[string, string | number]> = [...currentRows];

  for (const block of filteredPreviousBlocks) {
    // Add separator spacing row between daily summary blocks
    merged.push(['', '']);
    merged.push(...block);
  }

  return merged;
}

/**
 * Writes current gym dashboard data into the Google Sheets tabs, placing the latest summary on top.
 */
export async function syncDataToGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  data: DashboardData
): Promise<void> {
  const summaryMetrics = calculateDailySummaryMetrics(data);
  const todaySummaryRows = buildDailySummaryRows(summaryMetrics);

  // 1. Fetch previous daily summary rows to stack newest at the top
  const existingSummaryRows = await fetchExistingDailySummaryRows(accessToken, spreadsheetId);
  const mergedSummaryRows = mergeDailySummariesLatestOnTop(
    todaySummaryRows,
    existingSummaryRows,
    summaryMetrics.headerTitle
  );

  // 2. Prepare batch update value ranges
  const valueRanges = [
    // 1. Daily Summary (Latest on top)
    {
      range: "'Daily Summary'!A1:B1000",
      values: mergedSummaryRows,
    },
    // 2. Sales Log (Reverse chronological - latest on top)
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
    // 3. Check-In Log (Reverse chronological - latest on top)
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
    // 4. Members Directory
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
    // 5. Expenses Log (Reverse chronological - latest on top)
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

  // 3. Apply rich visual styling matching the screenshot
  try {
    await applyDailySummaryFormatting(accessToken, spreadsheetId);
  } catch (styleErr) {
    console.warn('Optional Google Sheets visual styling notice:', styleErr);
  }
}

/**
 * Applies visual colors, bold headers, and column widths to the 'Daily Summary' sheet.
 */
async function applyDailySummaryFormatting(accessToken: string, spreadsheetId: string): Promise<void> {
  // Fetch sheet metadata to find sheetId of 'Daily Summary'
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) return;
  const metaData = await metaRes.json();
  const summarySheet = metaData.sheets?.find((s: any) => s.properties?.title === 'Daily Summary');
  if (!summarySheet) return;

  const sheetId = summarySheet.properties.sheetId;

  // Formatting requests
  const requests: any[] = [
    // Column widths: Column A = 270px, Column B = 140px
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 1,
        },
        properties: { pixelSize: 270 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 1,
          endIndex: 2,
        },
        properties: { pixelSize: 140 },
        fields: 'pixelSize',
      },
    },
    // Row 1: Header Banner (REPORT FOR ...) - Dark Navy #0F172A, White bold text
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 15 / 255, green: 23 / 255, blue: 42 / 255 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 11,
            },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // Row 4: --- INCOME (PAYMENT IN) --- Green Banner #16A34A, White bold text
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 3,
          endRowIndex: 4,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 22 / 255, green: 163 / 255, blue: 74 / 255 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // Row 9: TOTAL INCOME IN - Light green background #DCFCE7, Dark green bold text #15803D
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 8,
          endRowIndex: 9,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 220 / 255, green: 252 / 255, blue: 231 / 255 },
            textFormat: {
              foregroundColor: { red: 21 / 255, green: 128 / 255, blue: 61 / 255 },
              bold: true,
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    // Row 10: --- EXPENSES (PAYMENT OUT) --- Red Banner #DC2626, White bold text
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 9,
          endRowIndex: 10,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 220 / 255, green: 38 / 255, blue: 38 / 255 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // Row 15: TOTAL EXPENSES OUT - Light red background #FFE4E6, Dark red bold text #B91C1C
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 14,
          endRowIndex: 15,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 255 / 255, green: 228 / 255, blue: 230 / 255 },
            textFormat: {
              foregroundColor: { red: 185 / 255, green: 28 / 255, blue: 28 / 255 },
              bold: true,
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    // Row 16: --- SUMMARY --- Dark Navy Banner #0F172A, White bold text
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 15,
          endRowIndex: 16,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 15 / 255, green: 23 / 255, blue: 42 / 255 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // Row 17: NET CASH BALANCE (Drawer Cash) - Blue bold text #2563EB
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 16,
          endRowIndex: 17,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              foregroundColor: { red: 37 / 255, green: 99 / 255, blue: 235 / 255 },
              bold: true,
            },
          },
        },
        fields: 'userEnteredFormat(textFormat)',
      },
    },
    // Row 18: NET DAILY BALANCE (All Methods) - Soft yellow tint #FEF3C7, Dark amber bold text #B45309
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 17,
          endRowIndex: 18,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 254 / 255, green: 243 / 255, blue: 199 / 255 },
            textFormat: {
              foregroundColor: { red: 180 / 255, green: 83 / 255, blue: 9 / 255 },
              bold: true,
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    // Row 19: NET BAIDURI BALANCE - Blue/Cyan bold text #0284C7
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 18,
          endRowIndex: 19,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              foregroundColor: { red: 2 / 255, green: 132 / 255, blue: 199 / 255 },
              bold: true,
            },
          },
        },
        fields: 'userEnteredFormat(textFormat)',
      },
    },
    // Row 20: NET BIBD BALANCE - Purple bold text #7E22CE
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 19,
          endRowIndex: 20,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              foregroundColor: { red: 126 / 255, green: 34 / 255, blue: 206 / 255 },
              bold: true,
            },
          },
        },
        fields: 'userEnteredFormat(textFormat)',
      },
    },
  ];

  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetch(batchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
}
