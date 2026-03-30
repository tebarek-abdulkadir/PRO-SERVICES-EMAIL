import { getDailyChatAnalysisData, getDailyDelayTimeData } from '@/lib/chat-storage';
import {
  buildProspectsEmailRows,
  buildSalesEmailRows,
  shortDateColumnLabel,
  tableRowsTotal,
  type EmailReportTableRow,
} from '@/lib/email-report-layout';
import type { EnrichedProspectDetail } from '@/lib/prospects-report';
import { getDashboardProspectsData } from '@/lib/prospects-report';
import type { Prospects } from '@/lib/types';

const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || 'Asia/Dubai';

interface DatePayload {
  date: string;
  totalProcessed: number;
  totalConversations: number;
  prospects: Prospects & {
    details?: EnrichedProspectDetail[];
  };
  countryCounts?: Record<string, number>;
  prospectDetails?: EnrichedProspectDetail[];
}

export type { EmailReportTableRow };

export interface DailyEmailReportData {
  date: string;
  displayDate: string;
  columnLabelShort: string;
  timezone: string;
  generatedAt: string;
  prospects: {
    rows: EmailReportTableRow[];
    total: number;
    totalProcessed: number;
    totalConversations: number;
  };
  sales: {
    rows: EmailReportTableRow[];
    total: number;
  };
  chatAnalysis: {
    available: boolean;
    averageResponseTime: string | null;
    frustrationPercent: number;
    confusionPercent: number;
  };
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
    prospectDetails: d.prospectDetails,
  };
}

async function getProspectsAndSalesBlock(
  date: string
): Promise<Pick<DailyEmailReportData, 'prospects' | 'sales' | 'columnLabelShort'>> {
  const data = await loadDatePayload(date);
  const details =
    (data.prospects.details as EnrichedProspectDetail[] | undefined) ||
    data.prospectDetails ||
    [];
  const countryCounts = data.countryCounts || {};

  const prospectRows = buildProspectsEmailRows(data.prospects, countryCounts);
  const salesRows = buildSalesEmailRows(
    details.map((d) => ({
      ...d,
      convertedServices: d.convertedServices || [],
    }))
  );

  const columnLabelShort = shortDateColumnLabel(date, REPORT_TIMEZONE);

  return {
    columnLabelShort,
    prospects: {
      rows: prospectRows,
      total: tableRowsTotal(prospectRows),
      totalProcessed: data.totalProcessed || 0,
      totalConversations: data.totalConversations || 0,
    },
    sales: {
      rows: salesRows,
      total: tableRowsTotal(salesRows),
    },
  };
}

async function getChatAnalysisMetrics(
  date: string
): Promise<Pick<DailyEmailReportData['chatAnalysis'], 'available' | 'frustrationPercent' | 'confusionPercent'>> {
  const data = await getDailyChatAnalysisData(date);

  if (!data) {
    throw new Error(`No chat analysis data available for ${date}`);
  }

  const m = data.overallMetrics;

  return {
    available: true,
    frustrationPercent: m.frustrationPercentage || 0,
    confusionPercent: m.confusionPercentage || 0,
  };
}

async function getAverageResponseTime(date: string): Promise<string | null> {
  const data = await getDailyDelayTimeData(date);
  return data?.dailyAverageDelayFormatted || null;
}

export async function getDailyEmailReportData(date: string): Promise<DailyEmailReportData> {
  const [block, chatMetrics, averageResponseTime] = await Promise.all([
    getProspectsAndSalesBlock(date),
    getChatAnalysisMetrics(date),
    getAverageResponseTime(date),
  ]);

  return {
    date,
    displayDate: formatDisplayDate(date, REPORT_TIMEZONE),
    columnLabelShort: block.columnLabelShort,
    timezone: REPORT_TIMEZONE,
    generatedAt: new Date().toISOString(),
    prospects: block.prospects,
    sales: block.sales,
    chatAnalysis: {
      available: chatMetrics.available,
      averageResponseTime,
      frustrationPercent: chatMetrics.frustrationPercent,
      confusionPercent: chatMetrics.confusionPercent,
    },
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

  return getPreviousDate(getDateInTimeZone(now, REPORT_TIMEZONE));
}

export function isDryRun(searchParams: URLSearchParams): boolean {
  return parseBooleanParam(searchParams.get('dryRun')) || parseBooleanParam(searchParams.get('preview'));
}

export function getReportTimezone(): string {
  return REPORT_TIMEZONE;
}
