import type { ServiceOverviewRow } from '@/lib/email-report-layout';
import type { PnLServiceKey } from '@/lib/pnl-complaints-types';
import { getServiceKeyFromComplaintType } from '@/lib/pnl-complaints-types';

/** Optional MTD / last-month aggregates from the complaints pipeline (per complaint type). */
export interface ComplaintsDailySummaryRow {
  COMPLAINT_TYPE?: string;
  complaint_type?: string;
  YESTERDAY?: number;
  THIS_MONTH?: number;
  LAST_MONTH?: number;
}

function complaintTypeField(row: ComplaintsDailySummaryRow): string {
  return String(row.COMPLAINT_TYPE ?? row.complaint_type ?? '').trim();
}

/** Maps P&L service key to the first-table row label (must match `buildServiceOverviewRows`). */
export function overviewLabelForServiceKey(key: PnLServiceKey): string | null {
  switch (key) {
    case 'oec':
      return 'OEC';
    case 'owwa':
      return 'OWWA';
    case 'ttl':
    case 'ttlSingle':
    case 'ttlDouble':
    case 'ttlMultiple':
      return 'Visa Lebanon';
    case 'tte':
    case 'tteSingle':
    case 'tteDouble':
    case 'tteMultiple':
      return 'Visa Egypt';
    case 'ttj':
      return 'Visa Jordan';
    case 'visaSaudi':
      return 'Visa Saudi';
    case 'schengen':
      return 'Visa Schengen';
    case 'gcc':
      return null;
    case 'filipinaPP':
      return 'Passport Filipina';
    case 'ethiopianPP':
      return 'Passport Ethiopian';
    default:
      return null;
  }
}

export function aggregateComplaintSummaryByOverviewLabel(
  summary: ComplaintsDailySummaryRow[]
): Map<string, { yesterday: number; thisMonth: number; lastMonth: number }> {
  const map = new Map<string, { yesterday: number; thisMonth: number; lastMonth: number }>();
  const bump = (label: string, y: number, m: number, l: number) => {
    const cur = map.get(label) ?? { yesterday: 0, thisMonth: 0, lastMonth: 0 };
    cur.yesterday += y;
    cur.thisMonth += m;
    cur.lastMonth += l;
    map.set(label, cur);
  };

  for (const raw of summary) {
    const ct = complaintTypeField(raw);
    if (!ct) continue;
    const sk = getServiceKeyFromComplaintType(ct);
    if (!sk) continue;
    const label = overviewLabelForServiceKey(sk);
    if (!label) continue;
    bump(
      label,
      Number(raw.YESTERDAY) || 0,
      Number(raw.THIS_MONTH) || 0,
      Number(raw.LAST_MONTH) || 0
    );
  }
  return map;
}

/** Fills total-sales columns from the report-day complaints blob `summary` (YESTERDAY / THIS_MONTH / LAST_MONTH). */
export function applyComplaintSummaryTotalsToRows(
  rows: ServiceOverviewRow[],
  summary?: ComplaintsDailySummaryRow[] | null
): ServiceOverviewRow[] {
  const byLabel =
    summary && summary.length > 0 ? aggregateComplaintSummaryByOverviewLabel(summary) : null;
  return rows.map((r) => {
    const t = byLabel?.get(r.label);
    return {
      ...r,
      totalSalesYesterday: t?.yesterday ?? 0,
      totalSalesThisMonth: t?.thisMonth ?? 0,
      totalSalesLastMonth: t?.lastMonth ?? 0,
    };
  });
}
