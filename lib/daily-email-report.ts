import { buildByConversationEmailPayload, type ByConversationEmailPayload } from '@/lib/email-by-conversation-email';
import { getDailyChatAnalysisData, getDailyDelayTimeData } from '@/lib/chat-storage';
import {
  buildServiceOverviewRows,
  formatServiceConversionRate,
  serviceOverviewProspectTotal,
  serviceOverviewSalesTotal,
  shortDateColumnLabel,
  type ServiceOverviewRow,
} from '@/lib/email-report-layout';
import {
  applyPeriodAggregatesToRows,
  computeExtendedTotalsRow,
  lastMonthDateRange,
  loadServiceOverviewSnapshots,
  mtdDateRange,
} from '@/lib/email-report-periods';
import type { EmailSalesCcMvSplit, EnrichedProspectDetail } from '@/lib/prospects-report';
import { getDashboardProspectsData } from '@/lib/prospects-report';
import type { ByContractType, Prospects } from '@/lib/types';

/** Report timezone for labels; default calendar day for data is **today** in this zone (see `resolveReportDate`). */
const REPORT_DATE_TIMEZONE = process.env.REPORT_DATE_TIMEZONE || 'Africa/Nairobi';

interface DatePayload {
  date: string;
  totalProcessed: number;
  totalConversations: number;
  prospects: Prospects & {
    details?: EnrichedProspectDetail[];
  };
  countryCounts?: Record<string, number>;
  countryCountsByContractType?: { MV: Record<string, number>; CC: Record<string, number> };
  byContractType?: ByContractType;
  emailSalesCcMv?: EmailSalesCcMvSplit;
  prospectDetails?: EnrichedProspectDetail[];
}

export type { ServiceOverviewRow };

export interface DailyEmailReportData {
  date: string;
  displayDate: string;
  columnLabelShort: string;
  timezone: string;
  generatedAt: string;
  prospects: {
    rows: ServiceOverviewRow[];
    totalsRow: ServiceOverviewRow;
    /** Days in MTD window that had complete prospect/sales data */
    mtdDaysCounted: number;
    /** Days in last calendar month that had complete prospect/sales data */
    lmDaysCounted: number;
    /** Sum of prospect CC + MV across rows */
    total: number;
    /** Sum of sales CC + MV across rows */
    totalSales: number;
    /** Overall conversion: total sales / total prospects */
    totalConversionRate: string;
    totalProcessed: number;
    totalConversations: number;
  };
  chatAnalysis: {
    available: boolean;
    averageResponseTime: string | null;
    /** Overall people-based rates (same blob as dashboard header), for logging / text fallback */
    overallFrustrationPercent: number;
    overallConfusionPercent: number;
  };
  /** By Conversation tab metrics — section 3 tables */
  byConversationEmail: ByConversationEmailPayload;
}

/** Safe for `JSON.stringify`. */
export function serializeDailyEmailReportForJson(report: DailyEmailReportData): Record<string, unknown> {
  return { ...report };
}

function parseBooleanParam(value: string | null): boolean {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

function formatDisplayDate(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}

async function loadDatePayload(date: string): Promise<DatePayload> {
  const d = await getDashboardProspectsData(date);
  return {
    date: d.date,
    totalProcessed: d.totalProcessed,
    totalConversations: d.totalConversations,
    prospects: d.prospects,
    countryCounts: d.countryCounts,
    countryCountsByContractType: d.countryCountsByContractType,
    byContractType: d.byContractType,
    emailSalesCcMv: d.emailSalesCcMv,
    prospectDetails: d.prospectDetails,
  };
}

async function getProspectsAndSalesBlock(
  date: string
): Promise<Pick<DailyEmailReportData, 'prospects' | 'columnLabelShort'>> {
  const data = await loadDatePayload(date);
  const countryCountsByContractType = data.countryCountsByContractType || { MV: {}, CC: {} };
  const byContractType = data.byContractType;
  if (!byContractType) {
    throw new Error('Missing byContractType for email report; ensure dashboard data includes MV/CC breakdown.');
  }
  if (!data.emailSalesCcMv) {
    throw new Error('Missing emailSalesCcMv for email report; ensure prospects data includes conversion split.');
  }

  const rows = buildServiceOverviewRows(byContractType, countryCountsByContractType, data.emailSalesCcMv);
  const totalProspects = serviceOverviewProspectTotal(rows);
  const totalSalesCount = serviceOverviewSalesTotal(rows);

  const columnLabelShort = shortDateColumnLabel(date, REPORT_DATE_TIMEZONE);

  const mtdDates = mtdDateRange(date);
  const lmDates = lastMonthDateRange(date);
  const [mtdSnapshots, lmSnapshots] = await Promise.all([
    loadServiceOverviewSnapshots(mtdDates),
    loadServiceOverviewSnapshots(lmDates),
  ]);
  const { rows: periodRows, mtdDaysCounted, lmDaysCounted } = applyPeriodAggregatesToRows(
    rows,
    mtdSnapshots,
    lmSnapshots
  );
  const totalsRow = computeExtendedTotalsRow(periodRows, mtdSnapshots, lmSnapshots);

  return {
    columnLabelShort,
    prospects: {
      rows: periodRows,
      totalsRow,
      mtdDaysCounted,
      lmDaysCounted,
      total: totalProspects,
      totalSales: totalSalesCount,
      totalConversionRate: formatServiceConversionRate(totalProspects, totalSalesCount),
      totalProcessed: data.totalProcessed || 0,
      totalConversations: data.totalConversations || 0,
    },
  };
}

async function getAverageResponseTime(date: string): Promise<string | null> {
  const data = await getDailyDelayTimeData(date);
  return data?.dailyAverageDelayFormatted || null;
}

export async function getDailyEmailReportData(date: string): Promise<DailyEmailReportData> {
  const [block, chatData, averageResponseTime] = await Promise.all([
    getProspectsAndSalesBlock(date),
    getDailyChatAnalysisData(date),
    getAverageResponseTime(date),
  ]);

  if (!chatData) {
    throw new Error(`No chat analysis data available for ${date}`);
  }

  const byConversationEmail = await buildByConversationEmailPayload(date, chatData);

  const m = chatData.overallMetrics;

  return {
    date,
    displayDate: formatDisplayDate(date, REPORT_DATE_TIMEZONE),
    columnLabelShort: block.columnLabelShort,
    timezone: REPORT_DATE_TIMEZONE,
    generatedAt: new Date().toISOString(),
    prospects: block.prospects,
    chatAnalysis: {
      available: true,
      averageResponseTime,
      overallFrustrationPercent: m.frustrationPercentage || 0,
      overallConfusionPercent: m.confusionPercentage || 0,
    },
    byConversationEmail,
  };
}

export function getDateInTimeZone(now: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to derive date in timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

export function getPreviousDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() - 1);
  return utcDate.toISOString().slice(0, 10);
}

export function resolveReportDate(searchParams: URLSearchParams, now = new Date()): string {
  const overrideDate = searchParams.get('date');

  if (overrideDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) {
      throw new Error('date must use YYYY-MM-DD format');
    }

    return overrideDate;
  }

  /** Default: today in REPORT_DATE_TIMEZONE (daily row + MTD + trends through this calendar day). */
  return getDateInTimeZone(now, REPORT_DATE_TIMEZONE);
}

export function isDryRun(searchParams: URLSearchParams): boolean {
  return parseBooleanParam(searchParams.get('dryRun')) || parseBooleanParam(searchParams.get('preview'));
}

export function getReportTimezone(): string {
  return REPORT_DATE_TIMEZONE;
}

/** Timezone used to pick and label the report calendar day (default `Africa/Nairobi`). */
export function getReportDateTimezone(): string {
  return REPORT_DATE_TIMEZONE;
}
