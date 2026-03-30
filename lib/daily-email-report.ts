import { getDailyChatAnalysisData, getDailyDelayTimeData } from '@/lib/chat-storage';
import type { ChatAnalysisData, DelayTimeData } from '@/lib/chat-types';
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

interface DashboardDateApiResponse {
  date: string;
  totalProcessed: number;
  totalConversations: number;
  prospects: Prospects & {
    details?: EnrichedProspectDetail[];
  };
  countryCounts?: Record<string, number>;
  prospectDetails?: EnrichedProspectDetail[];
}

interface ChatApiResponse {
  success: boolean;
  data?: ChatAnalysisData;
  error?: string;
}

interface DelayApiResponse {
  success: boolean;
  data?: DelayTimeData | null;
  error?: string;
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

interface InternalFetchOptions {
  origin: string;
  headers?: HeadersInit;
}

function parseBooleanParam(value: string | null): boolean {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

function createAbsoluteUrl(pathname: string, origin: string): string {
  return new URL(pathname, origin).toString();
}

async function fetchDashboardJson<T>(
  pathname: string,
  { origin, headers }: InternalFetchOptions
): Promise<T> {
  const response = await fetch(createAbsoluteUrl(pathname, origin), {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Request to ${pathname} failed with ${response.status}: ${errorText || response.statusText}`
    );
  }

  return (await response.json()) as T;
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

async function loadDatePayload(
  date: string,
  options: InternalFetchOptions
): Promise<DashboardDateApiResponse> {
  const data = await fetchDashboardJson<DashboardDateApiResponse>(`/api/dates/${date}`, options).catch(
    async () => {
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
  );

  return data;
}

async function getProspectsAndSalesBlock(
  date: string,
  options: InternalFetchOptions
): Promise<Pick<DailyEmailReportData, 'prospects' | 'sales' | 'columnLabelShort'>> {
  const data = await loadDatePayload(date, options);
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
  date: string,
  options: InternalFetchOptions
): Promise<Pick<DailyEmailReportData['chatAnalysis'], 'available' | 'frustrationPercent' | 'confusionPercent'>> {
  const result = await fetchDashboardJson<ChatApiResponse>(`/api/chat-analysis?date=${date}`, options).catch(
    async () => {
      const data = await getDailyChatAnalysisData(date);
      return {
        success: Boolean(data),
        data: data || undefined,
        error: data ? undefined : `No chat analysis data available for ${date}`,
      };
    }
  );

  if (!result.success || !result.data) {
    throw new Error(result.error || `No chat analysis data available for ${date}`);
  }

  const m = result.data.overallMetrics;

  return {
    available: true,
    frustrationPercent: m.frustrationPercentage || 0,
    confusionPercent: m.confusionPercentage || 0,
  };
}

async function getAverageResponseTime(
  date: string,
  options: InternalFetchOptions
): Promise<string | null> {
  const delayResult = await fetchDashboardJson<DelayApiResponse>(`/api/delay-time?date=${date}`, options).catch(
    async () => {
      const data = await getDailyDelayTimeData(date);
      return { success: true, data };
    }
  );

  if (!delayResult.success || !delayResult.data) {
    return null;
  }

  return delayResult.data.dailyAverageDelayFormatted || null;
}

export async function getDailyEmailReportData(
  date: string,
  options: InternalFetchOptions
): Promise<DailyEmailReportData> {
  const [block, chatMetrics, averageResponseTime] = await Promise.all([
    getProspectsAndSalesBlock(date, options),
    getChatAnalysisMetrics(date, options),
    getAverageResponseTime(date, options),
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
