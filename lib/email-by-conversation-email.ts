import {
  computeByConversationViewFromResults,
  createEmptyByConversationViewData,
} from '@/lib/chat-by-conversation-metrics';
import { getDailyChatAnalysisData } from '@/lib/chat-storage';
import { mtdDateRange } from '@/lib/email-report-periods';
import type { ChatAnalysisData, ConversationSectionMetrics } from '@/lib/chat-types';

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 10000) / 100;
}

/** Prefer deriving from `conversationResults` so email MTD matches current rules (same as chat-analysis GET enrichment). */
function viewFromData(data: ChatAnalysisData | null) {
  if (!data) return null;
  if (data.conversationResults?.length) {
    return computeByConversationViewFromResults(data.conversationResults);
  }
  if (data.byConversationView) return data.byConversationView;
  return null;
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

function poolInitiatorSections(sections: ConversationSectionMetrics[]): InitiatorTableRow {
  let tot = 0;
  let frB = 0;
  let frA = 0;
  let coB = 0;
  let coA = 0;
  const scoreAvgs: number[] = [];
  const responseTimeAvgs: number[] = [];

  for (const s of sections) {
    tot += s.totalChats;
    frB += s.frustrationByBotOrSystemCount;
    frA += s.frustrationByAgentCount;
    coB += s.confusionByBotOrSystemCount;
    coA += s.confusionByAgentCount;
    if (s.agentScoreAvg != null && !Number.isNaN(s.agentScoreAvg)) {
      scoreAvgs.push(s.agentScoreAvg);
    }
    if (s.averageAgentResponseTimeSeconds != null && !Number.isNaN(s.averageAgentResponseTimeSeconds)) {
      responseTimeAvgs.push(s.averageAgentResponseTimeSeconds);
    }
  }

  return {
    totalChats: tot,
    frustratedByBotCount: frB,
    frustratedByBotPct: pct(frB, tot),
    frustratedByAgentCount: frA,
    frustratedByAgentPct: pct(frA, tot),
    confusedByBotCount: coB,
    confusedByBotPct: pct(coB, tot),
    confusedByAgentCount: coA,
    confusedByAgentPct: pct(coA, tot),
    agentScoreAvg: scoreAvgs.length ? scoreAvgs.reduce((a, b) => a + b, 0) / scoreAvgs.length : null,
    averageAgentResponseTimeSeconds: responseTimeAvgs.length
      ? responseTimeAvgs.reduce((a, b) => a + b, 0) / responseTimeAvgs.length
      : null,
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

  const consumerSections: ConversationSectionMetrics[] = [];
  const clientSections: ConversationSectionMetrics[] = [];
  const agentSections: ConversationSectionMetrics[] = [];

  for (let i = 0; i < mtdDates.length; i++) {
    const data = dailyData[i];
    if (!data) continue;
    const v = viewFromData(data);
    if (!v) continue;
    const ci = v.consumerInitiated;
    const ai = v.agentInitiated;
    /** MTD: skip missing blobs and days where a section has zero chats (excluded from sums and daily averages). */
    if (ci.totalChats > 0) {
      consumerSections.push(ci);
      clientSections.push(ci);
    }
    if (ai.totalChats > 0) {
      agentSections.push(ai);
    }
  }

  const tot = consumerSections.reduce((s, c) => s + c.totalChats, 0);
  const cov = consumerSections.reduce((s, c) => s + c.chatbotCoverageCount, 0);
  const full = consumerSections.reduce((s, c) => s + c.fullyBotCount, 0);
  const agCt = consumerSections.reduce((s, c) => s + c.atLeastOneAgentMessageCount, 0);

  const dailyCovPcts = consumerSections.filter((c) => c.totalChats > 0).map((c) => c.chatbotCoveragePct);
  const mtdCoveragePctAvg =
    dailyCovPcts.length > 0
      ? Math.round((dailyCovPcts.reduce((a, b) => a + b, 0) / dailyCovPcts.length) * 10) / 10
      : tot > 0
        ? pct(cov, tot)
        : 0;

  const consumerMtd: ConsumerBotCoverageSlice = {
    totalChats: tot,
    botCoverageCount: cov,
    botCoveragePct: mtdCoveragePctAvg,
    fullyBotCount: full,
    fullyBotPct: tot > 0 ? pct(full, tot) : 0,
    atLeastOneAgentCount: agCt,
    atLeastOneAgentPct: tot > 0 ? pct(agCt, tot) : 0,
  };

  return {
    /** Days in MTD with ≥1 client-initiated chat (used for Bot Coverage pooled MTD). */
    mtdDaysWithChatData: consumerSections.length,
    consumerBotCoverageToday: consumerSlice(todayView.consumerInitiated),
    consumerBotCoverageMtd: consumerMtd,
    clientInitiatedToday: initiatorRow(todayView.consumerInitiated),
    clientInitiatedMtd: poolInitiatorSections(clientSections),
    agentInitiatedToday: initiatorRow(todayView.agentInitiated),
    agentInitiatedMtd: poolInitiatorSections(agentSections),
  };
}
