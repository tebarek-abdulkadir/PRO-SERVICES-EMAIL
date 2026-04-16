import { eligibleDailyMean } from '@/lib/email-eligible-daily-mean';
import {
  buildServiceOverviewRows,
  formatServiceConversionRate,
  type ServiceOverviewRow,
} from '@/lib/email-report-layout';
import { getDashboardProspectsData } from '@/lib/prospects-report';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Inclusive list of YYYY-MM-DD from start through end (chronological). */
export function enumerateDatesInclusive(start: string, end: string): string[] {
  if (start > end) return [];
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    const [y, m, d] = cur.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    cur = `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
  }
  return out;
}

/** First day of the same calendar month as `reportDate` (YYYY-MM-DD). */
export function monthStartDate(reportDate: string): string {
  const [y, m] = reportDate.split('-');
  return `${y}-${m}-01`;
}

/** MTD range: month start through report date (inclusive). */
export function mtdDateRange(reportDate: string): string[] {
  return enumerateDatesInclusive(monthStartDate(reportDate), reportDate);
}

/** First and last day of the previous calendar month relative to `reportDate`. */
export function lastMonthRange(reportDate: string): { start: string; end: string } {
  const [ys, ms] = reportDate.split('-');
  let y = Number(ys);
  let m = Number(ms);
  if (m === 1) {
    y -= 1;
    m = 12;
  } else {
    m -= 1;
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${pad2(m)}-01`,
    end: `${y}-${pad2(m)}-${pad2(lastDay)}`,
  };
}

export function lastMonthDateRange(reportDate: string): string[] {
  const { start, end } = lastMonthRange(reportDate);
  return enumerateDatesInclusive(start, end);
}

/** First day of trend window: April 6 of the report year (dashboard data available from this anchor). */
export function emailTrendStartDate(reportDate: string): string {
  const y = reportDate.slice(0, 4);
  return `${y}-04-06`;
}

/** Inclusive dates from April 6 through report date; empty if report is before April 6. */
export function emailTrendDateRange(reportDate: string): string[] {
  const start = emailTrendStartDate(reportDate);
  if (start > reportDate) return [];
  return enumerateDatesInclusive(start, reportDate);
}

/** First day of chat breakdown trend window: April 13 of the report year (email PNG #2). */
export function emailChatTrendStartDate(reportDate: string): string {
  const y = reportDate.slice(0, 4);
  return `${y}-04-13`;
}

/** Inclusive dates from April 13 through report date; empty if report is before April 13. */
export function emailChatTrendDateRange(reportDate: string): string[] {
  const start = emailChatTrendStartDate(reportDate);
  if (start > reportDate) return [];
  return enumerateDatesInclusive(start, reportDate);
}

/**
 * Load service overview rows for one day. Returns null if prospects/sales data is missing
 * (no blob, incomplete payload, etc.) so the day is excluded from MTD/LM averages.
 */
const LOAD_SERVICE_OVERVIEW_RETRIES = 3;
const LOAD_SERVICE_OVERVIEW_RETRY_MS = 250;

export async function tryLoadServiceOverviewForDate(date: string): Promise<ServiceOverviewRow[] | null> {
  for (let attempt = 0; attempt < LOAD_SERVICE_OVERVIEW_RETRIES; attempt++) {
    try {
      const d = await getDashboardProspectsData(date);
      if (!d.emailSalesCcMv || !d.byContractType) {
        return null;
      }
      const ccCt = d.countryCountsByContractType || { MV: {}, CC: {} };
      return buildServiceOverviewRows(d.byContractType, ccCt, d.emailSalesCcMv);
    } catch {
      if (attempt < LOAD_SERVICE_OVERVIEW_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, LOAD_SERVICE_OVERVIEW_RETRY_MS));
      }
    }
  }
  return null;
}

export async function loadServiceOverviewSnapshots(dates: string[]): Promise<ServiceOverviewRow[][]> {
  const out: ServiceOverviewRow[][] = [];
  for (const date of dates) {
    const rows = await tryLoadServiceOverviewForDate(date);
    if (rows !== null && rows.length > 0) {
      out.push(rows);
    }
  }
  return out;
}

type Sums = { pcc: number; pmv: number; scc: number; smv: number };

function sumByLabel(snapshots: ServiceOverviewRow[][]): Map<string, Sums> {
  const map = new Map<string, Sums>();
  if (snapshots.length === 0) {
    return map;
  }
  const labels = snapshots[0].map((r) => r.label);
  for (const label of labels) {
    let pcc = 0;
    let pmv = 0;
    let scc = 0;
    let smv = 0;
    for (const snap of snapshots) {
      const row = snap.find((r) => r.label === label);
      if (row) {
        pcc += row.prospectCc;
        pmv += row.prospectMv;
        scc += row.salesCc;
        smv += row.salesMv;
      }
    }
    map.set(label, { pcc, pmv, scc, smv });
  }
  return map;
}

/** One value per snapshot day (omit days where the row is missing — no push). */
function dailyValuesForLabel(
  snapshots: ServiceOverviewRow[][],
  label: string,
  pick: (r: ServiceOverviewRow) => number
): number[] {
  const out: number[] = [];
  for (const snap of snapshots) {
    const row = snap.find((r) => r.label === label);
    if (!row) continue;
    out.push(pick(row));
  }
  return out;
}

export interface EmailRowPeriodStats {
  rows: ServiceOverviewRow[];
  mtdDaysCounted: number;
  lmDaysCounted: number;
}

/**
 * Merge MTD / LM aggregates into daily rows. Daily fields on `dailyRows` stay as-is.
 */
export function applyPeriodAggregatesToRows(
  dailyRows: ServiceOverviewRow[],
  mtdSnapshots: ServiceOverviewRow[][],
  lmSnapshots: ServiceOverviewRow[][]
): EmailRowPeriodStats {
  const mtdN = mtdSnapshots.length;
  const lmN = lmSnapshots.length;
  const mtdSum = sumByLabel(mtdSnapshots);
  const lmSum = sumByLabel(lmSnapshots);

  const rows = dailyRows.map((row) => {
    const m = mtdSum.get(row.label) ?? { pcc: 0, pmv: 0, scc: 0, smv: 0 };
    const l = lmSum.get(row.label) ?? { pcc: 0, pmv: 0, scc: 0, smv: 0 };

    const prospectMtdCc = m.pcc;
    const prospectMtdMv = m.pmv;
    const salesMtdCc = m.scc;
    const salesMtdMv = m.smv;

    const prospectMtdAvgCc = eligibleDailyMean(
      dailyValuesForLabel(mtdSnapshots, row.label, (r) => r.prospectCc)
    );
    const prospectMtdAvgMv = eligibleDailyMean(
      dailyValuesForLabel(mtdSnapshots, row.label, (r) => r.prospectMv)
    );
    const salesMtdAvgCc = eligibleDailyMean(
      dailyValuesForLabel(mtdSnapshots, row.label, (r) => r.salesCc)
    );
    const salesMtdAvgMv = eligibleDailyMean(
      dailyValuesForLabel(mtdSnapshots, row.label, (r) => r.salesMv)
    );

    const conversionRateMtd = formatServiceConversionRate(
      prospectMtdCc + prospectMtdMv,
      salesMtdCc + salesMtdMv
    );

    const lmProspectDailyAvgCc = eligibleDailyMean(
      dailyValuesForLabel(lmSnapshots, row.label, (r) => r.prospectCc)
    );
    const lmProspectDailyAvgMv = eligibleDailyMean(
      dailyValuesForLabel(lmSnapshots, row.label, (r) => r.prospectMv)
    );
    const lmSalesDailyAvgCc = eligibleDailyMean(
      dailyValuesForLabel(lmSnapshots, row.label, (r) => r.salesCc)
    );
    const lmSalesDailyAvgMv = eligibleDailyMean(
      dailyValuesForLabel(lmSnapshots, row.label, (r) => r.salesMv)
    );
    const lmConversionRate = formatServiceConversionRate(l.pcc + l.pmv, l.scc + l.smv);

    return {
      ...row,
      prospectMtdCc,
      prospectMtdMv,
      prospectMtdAvgCc,
      prospectMtdAvgMv,
      salesMtdCc,
      salesMtdMv,
      salesMtdAvgCc,
      salesMtdAvgMv,
      conversionRateMtd,
      lmProspectDailyAvgCc,
      lmProspectDailyAvgMv,
      lmSalesDailyAvgCc,
      lmSalesDailyAvgMv,
      lmConversionRate,
    };
  });

  return { rows, mtdDaysCounted: mtdN, lmDaysCounted: lmN };
}

/** Totals row with same shape as detail rows (sums + derived averages). */
export function computeExtendedTotalsRow(
  rows: ServiceOverviewRow[],
  mtdSnapshots: ServiceOverviewRow[][],
  lmSnapshots: ServiceOverviewRow[][]
): ServiceOverviewRow {
  let prospectCc = 0;
  let prospectMv = 0;
  let prospectMtdCc = 0;
  let prospectMtdMv = 0;
  let salesCc = 0;
  let salesMv = 0;
  let salesMtdCc = 0;
  let salesMtdMv = 0;

  for (const r of rows) {
    prospectCc += r.prospectCc;
    prospectMv += r.prospectMv;
    prospectMtdCc += r.prospectMtdCc;
    prospectMtdMv += r.prospectMtdMv;
    salesCc += r.salesCc;
    salesMv += r.salesMv;
    salesMtdCc += r.salesMtdCc;
    salesMtdMv += r.salesMtdMv;
  }

  const dailyGrandPcc = mtdSnapshots.map((snap) =>
    snap.reduce((s, r) => s + r.prospectCc, 0)
  );
  const dailyGrandPmv = mtdSnapshots.map((snap) =>
    snap.reduce((s, r) => s + r.prospectMv, 0)
  );
  const dailyGrandScc = mtdSnapshots.map((snap) =>
    snap.reduce((s, r) => s + r.salesCc, 0)
  );
  const dailyGrandSmv = mtdSnapshots.map((snap) =>
    snap.reduce((s, r) => s + r.salesMv, 0)
  );

  const prospectMtdAvgCc = eligibleDailyMean(dailyGrandPcc);
  const prospectMtdAvgMv = eligibleDailyMean(dailyGrandPmv);
  const salesMtdAvgCc = eligibleDailyMean(dailyGrandScc);
  const salesMtdAvgMv = eligibleDailyMean(dailyGrandSmv);

  const pt = prospectCc + prospectMv;
  const st = salesCc + salesMv;
  const conversionRate = formatServiceConversionRate(pt, st);
  const conversionRateMtd = formatServiceConversionRate(prospectMtdCc + prospectMtdMv, salesMtdCc + salesMtdMv);

  let lmProsSum = 0;
  let lmSalSum = 0;
  const lmDailyPcc: number[] = [];
  const lmDailyPmv: number[] = [];
  const lmDailyScc: number[] = [];
  const lmDailySmv: number[] = [];
  if (lmSnapshots.length > 0) {
    for (const snap of lmSnapshots) {
      let dayPcc = 0;
      let dayPmv = 0;
      let dayScc = 0;
      let daySmv = 0;
      for (const r of snap) {
        dayPcc += r.prospectCc;
        dayPmv += r.prospectMv;
        dayScc += r.salesCc;
        daySmv += r.salesMv;
      }
      lmDailyPcc.push(dayPcc);
      lmDailyPmv.push(dayPmv);
      lmDailyScc.push(dayScc);
      lmDailySmv.push(daySmv);
      lmProsSum += dayPcc + dayPmv;
      lmSalSum += dayScc + daySmv;
    }
  }
  const lmProspectDailyAvgCc = eligibleDailyMean(lmDailyPcc);
  const lmProspectDailyAvgMv = eligibleDailyMean(lmDailyPmv);
  const lmSalesDailyAvgCc = eligibleDailyMean(lmDailyScc);
  const lmSalesDailyAvgMv = eligibleDailyMean(lmDailySmv);
  const lmConversionRate = formatServiceConversionRate(lmProsSum, lmSalSum);

  return {
    label: 'TOTALS',
    prospectCc,
    prospectMv,
    prospectMtdCc,
    prospectMtdMv,
    prospectMtdAvgCc,
    prospectMtdAvgMv,
    salesCc,
    salesMv,
    salesMtdCc,
    salesMtdMv,
    salesMtdAvgCc,
    salesMtdAvgMv,
    conversionRate,
    conversionRateMtd,
    lmProspectDailyAvgCc,
    lmProspectDailyAvgMv,
    lmSalesDailyAvgCc,
    lmSalesDailyAvgMv,
    lmConversionRate,
  };
}
