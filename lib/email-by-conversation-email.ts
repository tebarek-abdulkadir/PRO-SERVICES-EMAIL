import {
  applyAgentsMtdDelaySecondsToSnapshot,
  getAgentsMtdAverageAndTodaySeconds,
} from '@/lib/agent-delay-mtd';
import { enrichChatAnalysisData } from '@/lib/chat-analysis-enrich';
import { createEmptyByConversationViewData } from '@/lib/chat-by-conversation-metrics';
import { getByConversationMtdSnapshot } from '@/lib/chat-by-conversation-mtd-storage';
import { getDailyChatAnalysisData } from '@/lib/chat-storage';
import type { ChatAnalysisData, ConversationSectionMetrics } from '@/lib/chat-types';

/** Same as GET /api/chat-analysis: enrich blob then read `byConversationView` (never stale vs dashboard). */
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

function emptyConsumerMtd(): ConsumerBotCoverageSlice {
  return {
    totalChats: 0,
    botCoverageCount: 0,
    botCoveragePct: 0,
    fullyBotCount: 0,
    fullyBotPct: 0,
    atLeastOneAgentCount: 0,
    atLeastOneAgentPct: 0,
  };
}

function emptyInitiatorMtd(): InitiatorTableRow {
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

/**
 * Section 3 email: By Conversation — today from daily chat blob; MTD from stored By Conversation snapshot
 * when present (same as Chats → By Conversation → MTD). Avg agent response uses Agent Performance delay-time
 * data (sequential Blob reads to avoid rate limits). If the snapshot is missing, MTD chat totals are zero but
 * the email still sends; delay columns still use delay-time when available.
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

  const delay = await getAgentsMtdAverageAndTodaySeconds(reportDate);
  const rawSnap = await getByConversationMtdSnapshot(reportDate);

  const clientToday = {
    ...initiatorRow(todayView.consumerInitiated),
    averageAgentResponseTimeSeconds: delay.todaySeconds,
  };
  const agentToday = {
    ...initiatorRow(todayView.agentInitiated),
    averageAgentResponseTimeSeconds: delay.todaySeconds,
  };

  if (!rawSnap?.mtd) {
    console.warn(
      `[Email] No By Conversation MTD snapshot for ${reportDate}; MTD chat metrics default to zero. Build snapshot via ingest or POST /api/chat-analysis/by-conversation-mtd.`
    );
    const mtdRt = delay.mtdAverage;
    return {
      mtdDaysWithChatData: 0,
      mtdClientInitiatorDaysWithChats: 0,
      mtdAgentInitiatorDaysWithChats: 0,
      consumerBotCoverageToday: consumerSlice(todayView.consumerInitiated),
      consumerBotCoverageMtd: emptyConsumerMtd(),
      clientInitiatedToday: clientToday,
      clientInitiatedMtd: { ...emptyInitiatorMtd(), averageAgentResponseTimeSeconds: mtdRt },
      agentInitiatedToday: agentToday,
      agentInitiatedMtd: { ...emptyInitiatorMtd(), averageAgentResponseTimeSeconds: mtdRt },
    };
  }

  const snap = applyAgentsMtdDelaySecondsToSnapshot(rawSnap, delay.mtdAverage);
  const mtd = snap.mtd;

  return {
    mtdDaysWithChatData: mtd.mtdDaysWithChatData,
    mtdClientInitiatorDaysWithChats: mtd.mtdClientInitiatorDaysWithChats,
    mtdAgentInitiatorDaysWithChats: mtd.mtdAgentInitiatorDaysWithChats,
    consumerBotCoverageToday: consumerSlice(todayView.consumerInitiated),
    consumerBotCoverageMtd: mtd.consumerBotCoverageMtd,
    clientInitiatedToday: clientToday,
    clientInitiatedMtd: mtd.clientInitiatedMtd,
    agentInitiatedToday: agentToday,
    agentInitiatedMtd: mtd.agentInitiatedMtd,
  };
}
