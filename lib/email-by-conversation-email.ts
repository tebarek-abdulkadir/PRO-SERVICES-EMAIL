import { enrichChatAnalysisData } from '@/lib/chat-analysis-enrich';
import { createEmptyByConversationViewData } from '@/lib/chat-by-conversation-metrics';
import { getByConversationMtdSnapshot } from '@/lib/chat-by-conversation-mtd-storage';
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
  const enriched = enrichChatAnalysisData(data);
  return enriched.byConversationView ?? data.byConversationView ?? null;
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
  /** MTD window days that had chat analysis saved (missing calendar days are skipped). */
  mtdDaysWithChatData: number;
  /** Days in MTD where client-initiated total chats &gt; 0 (By Initiator + Bot Coverage MTD base). */
  mtdClientInitiatorDaysWithChats: number;
  /** Days in MTD where agent-initiated total chats &gt; 0. */
  mtdAgentInitiatorDaysWithChats: number;
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

/** Mean of nullable metrics per day; only null/NaN omit a day (independent of total-chat days). */
function eligibleNullableMean(values: (number | null | undefined)[]): number | null {
  const nums = values.filter(
    (x): x is number => x != null && typeof x === 'number' && !Number.isNaN(x)
  );
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1000) / 1000;
}

function meanDailyPct(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000;
}

/**
 * By-initiator MTD (client or agent row):
 * - Total chats & count columns: sum over days where that row's totalChats &gt; 0.
 * - Percent columns: unweighted mean of daily % on those same days.
 * - Agent score & avg response: mean over days where the value is non-null only (separate day set).
 */
function initiatorRowMtd(dailies: InitiatorTableRow[]): InitiatorTableRow {
  const withChats = dailies.filter((d) => d.totalChats > 0);
  const sum = (pick: (d: InitiatorTableRow) => number) =>
    withChats.reduce((acc, d) => acc + pick(d), 0);
  return {
    totalChats: sum((d) => d.totalChats),
    frustratedByBotCount: sum((d) => d.frustratedByBotCount),
    frustratedByBotPct: meanDailyPct(withChats.map((d) => d.frustratedByBotPct)),
    frustratedByAgentCount: sum((d) => d.frustratedByAgentCount),
    frustratedByAgentPct: meanDailyPct(withChats.map((d) => d.frustratedByAgentPct)),
    confusedByBotCount: sum((d) => d.confusedByBotCount),
    confusedByBotPct: meanDailyPct(withChats.map((d) => d.confusedByBotPct)),
    confusedByAgentCount: sum((d) => d.confusedByAgentCount),
    confusedByAgentPct: meanDailyPct(withChats.map((d) => d.confusedByAgentPct)),
    agentScoreAvg: eligibleNullableMean(dailies.map((d) => d.agentScoreAvg)),
    averageAgentResponseTimeSeconds: eligibleNullableMean(dailies.map((d) => d.averageAgentResponseTimeSeconds)),
  };
}

/**
 * Bot coverage (consumer-initiated) MTD: same calendar days for totals, counts, and % —
 * only days where consumer totalChats &gt; 0. Total chats and counts are sums; percentages are daily means on those days.
 */
function consumerBotCoverageMtd(slices: ConsumerBotCoverageSlice[]): ConsumerBotCoverageSlice {
  const withChats = slices.filter((s) => s.totalChats > 0);
  const sum = (pick: (s: ConsumerBotCoverageSlice) => number) =>
    withChats.reduce((acc, s) => acc + pick(s), 0);
  return {
    totalChats: sum((s) => s.totalChats),
    botCoverageCount: sum((s) => s.botCoverageCount),
    botCoveragePct: meanDailyPct(withChats.map((s) => s.botCoveragePct)),
    fullyBotCount: sum((s) => s.fullyBotCount),
    fullyBotPct: meanDailyPct(withChats.map((s) => s.fullyBotPct)),
    atLeastOneAgentCount: sum((s) => s.atLeastOneAgentCount),
    atLeastOneAgentPct: meanDailyPct(withChats.map((s) => s.atLeastOneAgentPct)),
  };
}

/**
 * Section 3 email: By Conversation — today from report date; MTD sums/means per product rules (see initiatorRowMtd / consumerBotCoverageMtd).
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

  const snap = await getByConversationMtdSnapshot(reportDate);
  if (snap?.mtd) {
    return {
      mtdDaysWithChatData: snap.mtd.mtdDaysWithChatData,
      mtdClientInitiatorDaysWithChats: snap.mtd.mtdClientInitiatorDaysWithChats,
      mtdAgentInitiatorDaysWithChats: snap.mtd.mtdAgentInitiatorDaysWithChats,
      consumerBotCoverageToday: consumerSlice(todayView.consumerInitiated),
      consumerBotCoverageMtd: snap.mtd.consumerBotCoverageMtd,
      clientInitiatedToday: initiatorRow(todayView.consumerInitiated),
      clientInitiatedMtd: snap.mtd.clientInitiatedMtd,
      agentInitiatedToday: initiatorRow(todayView.agentInitiated),
      agentInitiatedMtd: snap.mtd.agentInitiatedMtd,
    };
  }

  // Fallback: compute MTD by scanning daily blobs (may hit Blob rate limits).
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

  const emptyConsumer: ConsumerBotCoverageSlice = {
    totalChats: 0,
    botCoverageCount: 0,
    botCoveragePct: 0,
    fullyBotCount: 0,
    fullyBotPct: 0,
    atLeastOneAgentCount: 0,
    atLeastOneAgentPct: 0,
  };

  const consumerMtd: ConsumerBotCoverageSlice =
    dailyConsumerSlices.length > 0 ? consumerBotCoverageMtd(dailyConsumerSlices) : emptyConsumer;

  const clientWithChats = dailyClientRows.filter((d) => d.totalChats > 0).length;
  const agentWithChats = dailyAgentRows.filter((d) => d.totalChats > 0).length;

  return {
    mtdDaysWithChatData: dailyConsumerSlices.length,
    mtdClientInitiatorDaysWithChats: clientWithChats,
    mtdAgentInitiatorDaysWithChats: agentWithChats,
    consumerBotCoverageToday: consumerSlice(todayView.consumerInitiated),
    consumerBotCoverageMtd: consumerMtd,
    clientInitiatedToday: initiatorRow(todayView.consumerInitiated),
    clientInitiatedMtd: dailyClientRows.length > 0 ? initiatorRowMtd(dailyClientRows) : emptyInitiatorRow(),
    agentInitiatedToday: initiatorRow(todayView.agentInitiated),
    agentInitiatedMtd: dailyAgentRows.length > 0 ? initiatorRowMtd(dailyAgentRows) : emptyInitiatorRow(),
  };
}
