import lmStatic from '@/lib/service-overview-lm-static.json';

/** LM-only slice merged into `ServiceOverviewRow` (first email table). */
export interface ServiceOverviewLmRowSlice {
  lmProspectDailyAvgCc: number;
  lmProspectDailyAvgMv: number;
  lmSalesDailyAvgCc: number;
  lmSalesDailyAvgMv: number;
  lmProspectTotalCc: number;
  lmProspectTotalMv: number;
  lmSalesTotalCc: number;
  lmSalesTotalMv: number;
  lmConversionRate: string;
}

/**
 * Precomputed last-calendar-month aggregates for the service overview table.
 * Built once via `npm run build:service-overview-lm-static` and committed; all daily reports reuse it.
 */
export interface ServiceOverviewLmStatic {
  /** ISO month the LM window refers to, e.g. `2026-03` */
  sourceCalendarMonth: string;
  /** Human label for footnotes, e.g. `March 2026` */
  sourceCalendarMonthLabel: string;
  lmCalendarDays: number;
  lmDaysCounted: number;
  byLabel: Record<string, ServiceOverviewLmRowSlice>;
  totals: ServiceOverviewLmRowSlice;
}

export const SERVICE_OVERVIEW_LM_STATIC = lmStatic as ServiceOverviewLmStatic;
