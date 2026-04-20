/**
 * One-off / occasional: recomputes `lib/service-overview-lm-static.json` from all available
 * dashboard snapshots in the **prior calendar month** relative to the anchor date (default: first
 * day of current month so LM = previous month). Commit the JSON after review.
 *
 * Usage: npx tsx scripts/build-service-overview-lm-static.ts [YYYY-MM-DD]
 * Requires the same env as `getDashboardProspectsData` (e.g. Vercel Blob / API access).
 */
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config();

import type { ServiceOverviewLmRowSlice } from '@/lib/service-overview-lm-static';
import {
  applyPeriodAggregatesToRows,
  computeExtendedTotalsRow,
  lastMonthDateRange,
  lastMonthRange,
  loadServiceOverviewSnapshots,
  tryLoadServiceOverviewForDate,
} from '@/lib/email-report-periods';
import type { ServiceOverviewRow } from '@/lib/email-report-layout';

function previousIsoDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

function lmSliceFromRow(r: ServiceOverviewRow): ServiceOverviewLmRowSlice {
  return {
    lmProspectDailyAvgCc: r.lmProspectDailyAvgCc,
    lmProspectDailyAvgMv: r.lmProspectDailyAvgMv,
    lmSalesDailyAvgCc: r.lmSalesDailyAvgCc,
    lmSalesDailyAvgMv: r.lmSalesDailyAvgMv,
    lmProspectTotalCc: r.lmProspectTotalCc,
    lmProspectTotalMv: r.lmProspectTotalMv,
    lmSalesTotalCc: r.lmSalesTotalCc,
    lmSalesTotalMv: r.lmSalesTotalMv,
    lmConversionRate: r.lmConversionRate,
  };
}

async function main(): Promise<void> {
  const anchor = process.argv[2] || '2026-04-01';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    throw new Error('Anchor must be YYYY-MM-DD');
  }

  let baseDate = anchor;
  let baseRows = await tryLoadServiceOverviewForDate(baseDate);
  for (let i = 0; i < 21 && !baseRows; i++) {
    baseDate = previousIsoDate(baseDate);
    baseRows = await tryLoadServiceOverviewForDate(baseDate);
  }
  if (!baseRows) {
    throw new Error('Could not load any recent day for base service overview rows.');
  }

  const lmDates = lastMonthDateRange(anchor);
  const lmSnapshots = await loadServiceOverviewSnapshots(lmDates);
  const { rows } = applyPeriodAggregatesToRows(baseRows, [], lmSnapshots);
  const totals = computeExtendedTotalsRow(rows, [], lmSnapshots);

  const { start } = lastMonthRange(anchor);
  const sourceCalendarMonth = start.slice(0, 7);
  const sourceCalendarMonthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${start}T12:00:00Z`));

  const byLabel: Record<string, ServiceOverviewLmRowSlice> = {};
  for (const r of rows) {
    byLabel[r.label] = lmSliceFromRow(r);
  }

  const payload = {
    sourceCalendarMonth,
    sourceCalendarMonthLabel,
    lmCalendarDays: lmDates.length,
    lmDaysCounted: lmSnapshots.length,
    byLabel,
    totals: lmSliceFromRow(totals),
  };

  const outPath = resolve(process.cwd(), 'lib/service-overview-lm-static.json');
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outPath}`);
  console.log(
    `LM window ${sourceCalendarMonth} (${lmSnapshots.length} snapshot days / ${lmDates.length} calendar days), base row date ${baseDate}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
