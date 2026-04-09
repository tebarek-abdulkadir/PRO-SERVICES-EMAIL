import {
  buildServiceOverviewRows,
  formatServiceConversionRate,
  serviceOverviewProspectTotal,
  serviceOverviewSalesTotal,
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

/**
 * Load service overview rows for one day. Returns null if prospects/sales data is missing
 * (no blob, incomplete payload, etc.) so the day is excluded from MTD/LM averages.
 */
export async function tryLoadServiceOverviewForDate(date: string): Promise<ServiceOverviewRow[] | null> {
  try {
    const d = await getDashboardProspectsData(date);
    if (!d.emailSalesCcMv || !d.byContractType) {
      return null;
    }
    const ccCt = d.countryCountsByContractType || { MV: {}, CC: {} };
    return buildServiceOverviewRows(d.byContractType, ccCt, d.emailSalesCcMv);
  } catch {
    return null;
  }
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

function fmtAvg(n: number, days: number): number {
  if (days <= 0) return 0;
  return Math.round((n / days) * 10) / 10;
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

    const prospectMtdAvgCc = fmtAvg(prospectMtdCc, mtdN);
    const prospectMtdAvgMv = fmtAvg(prospectMtdMv, mtdN);
    const salesMtdAvgCc = fmtAvg(salesMtdCc, mtdN);
    const salesMtdAvgMv = fmtAvg(salesMtdMv, mtdN);

    const conversionRateMtd = formatServiceConversionRate(
      prospectMtdCc + prospectMtdMv,
      salesMtdCc + salesMtdMv
    );

    const lmProspectDailyAvg = lmN ? Math.round(((l.pcc + l.pmv) / lmN) * 10) / 10 : 0;
    const lmSalesDailyAvg = lmN ? Math.round(((l.scc + l.smv) / lmN) * 10) / 10 : 0;
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
      lmProspectDailyAvg,
      lmSalesDailyAvg,
      lmConversionRate,
    };
  });

  return { rows, mtdDaysCounted: mtdN, lmDaysCounted: lmN };
}

/** Totals row with same shape as detail rows (sums + derived averages). */
export function computeExtendedTotalsRow(
  rows: ServiceOverviewRow[],
  mtdDaysCounted: number,
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

  const mtdN = mtdDaysCounted;
  const prospectMtdAvgCc = fmtAvg(prospectMtdCc, mtdN);
  const prospectMtdAvgMv = fmtAvg(prospectMtdMv, mtdN);
  const salesMtdAvgCc = fmtAvg(salesMtdCc, mtdN);
  const salesMtdAvgMv = fmtAvg(salesMtdMv, mtdN);

  const pt = prospectCc + prospectMv;
  const st = salesCc + salesMv;
  const conversionRate = formatServiceConversionRate(pt, st);
  const conversionRateMtd = formatServiceConversionRate(prospectMtdCc + prospectMtdMv, salesMtdCc + salesMtdMv);

  let lmProsSum = 0;
  let lmSalSum = 0;
  if (lmSnapshots.length > 0) {
    for (const snap of lmSnapshots) {
      lmProsSum += serviceOverviewProspectTotal(snap);
      lmSalSum += serviceOverviewSalesTotal(snap);
    }
  }
  const lmN = lmSnapshots.length;
  const lmProspectDailyAvg = lmN ? Math.round((lmProsSum / lmN) * 10) / 10 : 0;
  const lmSalesDailyAvg = lmN ? Math.round((lmSalSum / lmN) * 10) / 10 : 0;
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
    lmProspectDailyAvg,
    lmSalesDailyAvg,
    lmConversionRate,
  };
}
