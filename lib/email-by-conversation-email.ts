import { enrichChatAnalysisData } from '@/lib/chat-analysis-enrich';
import { eligibleDailyMean } from '@/lib/email-eligible-daily-mean';
import { createEmptyByConversationViewData } from '@/lib/chat-by-conversation-metrics';
import { getDailyChatAnalysisData } from '@/lib/chat-storage';
import { mtdDateRange } from '@/lib/email-report-periods';
import type { ChatAnalysisData, ConversationSectionMetrics } from '@/lib/chat-types';

function emptyInitiatorRow(): InitiatorTableRow {
  return {
    totalChats: 0,
    frustratedByBotCount: 0,
    frustratedByBotPct: 0,
    frustratedByAgentCount: 0,
    frustratedByAgentPct: 0,
    confusedByBotCount: 0,
    confusedByBotPct: 0,
    confusedByAgentCount: 0,
    confusedByAgentPct: 0,
    agentScoreAvg: null,
    averageAgentResponseTimeSeconds: null,
  };
}

/** Same as GET /api/chat-analysis: enrich blob then read `byConversationView` (never stale MTD vs dashboard). */
function viewFromData(data: ChatAnalysisData | null) {
  if (!data) return null;
  return enrichChatAnalysisData(data).byConversationView ?? null;
}

export interface ConsumerBotCoverageSlice {
  totalChats: number;
  botCoverageCount: number;
  botCoveragePct: number;
  fullyBotCount: number;
  fullyBotPct: number;
  atLeastOneAgentCount: number;
  atLeastOneAgentPct: number;
}

export interface InitiatorTableRow {
  totalChats: number;
  frustratedByBotCount: number;
  frustratedByBotPct: number;
  frustratedByAgentCount: number;
  frustratedByAgentPct: number;
  confusedByBotCount: number;
  confusedByBotPct: number;
  confusedByAgentCount: number;
  confusedByAgentPct: number;
  agentScoreAvg: number | null;
  averageAgentResponseTimeSeconds: number | null;
}

export interface ByConversationEmailPayload {
  /** MTD window days that had chat analysis saved (missing calendar days are skipped for all MTD columns). */
  mtdDaysWithChatData: number;
  consumerBotCoverageToday: ConsumerBotCoverageSlice;
  consumerBotCoverageMtd: ConsumerBotCoverageSlice;
  clientInitiatedToday: InitiatorTableRow;
  clientInitiatedMtd: InitiatorTableRow;
  agentInitiatedToday: InitiatorTableRow;
  agentInitiatedMtd: InitiatorTableRow;
}

function consumerSlice(s: ConversationSectionMetrics): ConsumerBotCoverageSlice {
  return {
    totalChats: s.totalChats,
    botCoverageCount: s.chatbotCoverageCount,
    botCoveragePct: s.chatbotCoveragePct,
    fullyBotCount: s.fullyBotCount,
    fullyBotPct: s.fullyBotPct,
    atLeastOneAgentCount: s.atLeastOneAgentMessageCount,
    atLeastOneAgentPct: s.atLeastOneAgentMessagePct,
  };
}

function initiatorRow(s: ConversationSectionMetrics): InitiatorTableRow {
  return {
    totalChats: s.totalChats,
    frustratedByBotCount: s.frustrationByBotOrSystemCount,
    frustratedByBotPct: s.frustrationByBotOrSystemPct,
    frustratedByAgentCount: s.frustrationByAgentCount,
    frustratedByAgentPct: s.frustrationByAgentPct,
    confusedByBotCount: s.confusionByBotOrSystemCount,
    confusedByBotPct: s.confusionByBotOrSystemPct,
    confusedByAgentCount: s.confusionByAgentCount,
    confusedByAgentPct: s.confusionByAgentPct,
    agentScoreAvg: s.agentScoreAvg,
    averageAgentResponseTimeSeconds: s.averageAgentResponseTimeSeconds,
  };
}

function eligibleNullableMean(values: (number | null | undefined)[]): number | null {
  const nums = values.filter(
    (x): x is number => x != null && typeof x === 'number' && !Number.isNaN(x) && x !== 0
  );
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1000) / 1000;
}

/** MTD = mean of daily values; each field drops null/undefined and zero days for that metric. */
function averageInitiatorRowsMtd(dailies: InitiatorTableRow[]): InitiatorTableRow {
  return {
    totalChats: eligibleDailyMean(dailies.map((d) => d.totalChats)),
    frustratedByBotCount: eligibleDailyMean(dailies.map((d) => d.frustratedByBotCount)),
    frustratedByBotPct: eligibleDailyMean(dailies.map((d) => d.frustratedByBotPct)),
    frustratedByAgentCount: eligibleDailyMean(dailies.map((d) => d.frustratedByAgentCount)),
    frustratedByAgentPct: eligibleDailyMean(dailies.map((d) => d.frustratedByAgentPct)),
    confusedByBotCount: eligibleDailyMean(dailies.map((d) => d.confusedByBotCount)),
    confusedByBotPct: eligibleDailyMean(dailies.map((d) => d.confusedByBotPct)),
    confusedByAgentCount: eligibleDailyMean(dailies.map((d) => d.confusedByAgentCount)),
    confusedByAgentPct: eligibleDailyMean(dailies.map((d) => d.confusedByAgentPct)),
    agentScoreAvg: eligibleNullableMean(dailies.map((d) => d.agentScoreAvg)),
    averageAgentResponseTimeSeconds: eligibleNullableMean(dailies.map((d) => d.averageAgentResponseTimeSeconds)),
  };
}

function averageConsumerBotCoverageMtd(slices: ConsumerBotCoverageSlice[]): ConsumerBotCoverageSlice {
  return {
    totalChats: eligibleDailyMean(slices.map((s) => s.totalChats)),
    botCoverageCount: eligibleDailyMean(slices.map((s) => s.botCoverageCount)),
    botCoveragePct: eligibleDailyMean(slices.map((s) => s.botCoveragePct)),
    fullyBotCount: eligibleDailyMean(slices.map((s) => s.fullyBotCount)),
    fullyBotPct: eligibleDailyMean(slices.map((s) => s.fullyBotPct)),
    atLeastOneAgentCount: eligibleDailyMean(slices.map((s) => s.atLeastOneAgentCount)),
    atLeastOneAgentPct: eligibleDailyMean(slices.map((s) => s.atLeastOneAgentPct)),
  };
}

/**
 * Section 3 email: By Conversation metrics — today from report date; MTD = month-to-date with missing days omitted.
 * Pass `todayData` when the caller already loaded the daily blob to avoid a duplicate fetch.
 */
export async function buildByConversationEmailPayload(
  reportDate: string,
  todayData?: ChatAnalysisData | null
): Promise<ByConversationEmailPayload> {
  const resolvedToday = todayData ?? (await getDailyChatAnalysisData(reportDate));
  if (!resolvedToday) {
    throw new Error(`No chat analysis data for ${reportDate}`);
  }

  const todayView = viewFromData(resolvedToday) ?? createEmptyByConversationViewData();

  const mtdDates = mtdDateRange(reportDate);
  const dailyData = await Promise.all(mtdDates.map((d) => getDailyChatAnalysisData(d)));

  const dailyConsumerSlices: ConsumerBotCoverageSlice[] = [];
  const dailyClientRows: InitiatorTableRow[] = [];
  const dailyAgentRows: InitiatorTableRow[] = [];

  for (let i = 0; i < mtdDates.length; i++) {
    const data = dailyData[i];
    if (!data) continue;
    const v = viewFromData(data);
    if (!v) continue;
    const ci = v.consumerInitiated;
    const ai = v.agentInitiated;
    dailyConsumerSlices.push(consumerSlice(ci));
    dailyClientRows.push(initiatorRow(ci));
    dailyAgentRows.push(initiatorRow(ai));
  }

  const consumerMtd: ConsumerBotCoverageSlice =
    dailyConsumerSlices.length > 0
      ? averageConsumerBotCoverageMtd(dailyConsumerSlices)
      : {
          totalChats: 0,
          botCoverageCount: 0,
          botCoveragePct: 0,
          fullyBotCount: 0,
          fullyBotPct: 0,
          atLeastOneAgentCount: 0,
          atLeastOneAgentPct: 0,
        };

  return {
    /** Days in MTD window with saved chat analysis (used for footnotes). */
    mtdDaysWithChatData: dailyConsumerSlices.length,
    consumerBotCoverageToday: consumerSlice(todayView.consumerInitiated),
    consumerBotCoverageMtd: consumerMtd,
    clientInitiatedToday: initiatorRow(todayView.consumerInitiated),
    clientInitiatedMtd:
      dailyClientRows.length > 0 ? averageInitiatorRowsMtd(dailyClientRows) : emptyInitiatorRow(),
    agentInitiatedToday: initiatorRow(todayView.agentInitiated),
    agentInitiatedMtd:
      dailyAgentRows.length > 0 ? averageInitiatorRowsMtd(dailyAgentRows) : emptyInitiatorRow(),
  };
}
