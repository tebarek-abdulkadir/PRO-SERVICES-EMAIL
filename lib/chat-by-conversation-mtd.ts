import type { ConversationSectionMetrics } from '@/lib/chat-types';
import type {
  ConsumerBotCoverageSlice,
  InitiatorTableRow,
} from '@/lib/email-by-conversation-email';

export type ByConversationMtdSnapshot = {
  /** Calendar day the snapshot represents (inclusive MTD through this day). */
  date: string; // YYYY-MM-DD
  /** Calendar month key for safety (YYYY-MM). */
  month: string; // YYYY-MM
  createdAt: string; // ISO
  /** The daily chat blob's lastUpdated (if available) used to build this snapshot. */
  sourceLastUpdated?: string;

  /** Accumulators for incremental updates (so we never rescan the month). */
  acc: {
    consumerBotCoverage: ConsumerBotCoverageAcc;
    clientInitiated: InitiatorAcc;
    agentInitiated: InitiatorAcc;
  };

  /** Values rendered in email/dashboard for MTD. */
  mtd: {
    mtdDaysWithChatData: number;
    mtdClientInitiatorDaysWithChats: number;
    mtdAgentInitiatorDaysWithChats: number;
    consumerBotCoverageMtd: ConsumerBotCoverageSlice;
    clientInitiatedMtd: InitiatorTableRow;
    agentInitiatedMtd: InitiatorTableRow;
  };
};

type InitiatorAcc = {
  /** Days where totalChats > 0 (day set for totals, counts, and % columns). */
  daysWithChats: number;
  sumTotalChats: number;

  sumFrustratedByBotCount: number;
  sumFrustratedByAgentCount: number;
  sumConfusedByBotCount: number;
  sumConfusedByAgentCount: number;

  /** Sum of daily % values (unweighted mean uses sum/daysWithChats). */
  sumFrustratedByBotPct: number;
  sumFrustratedByAgentPct: number;
  sumConfusedByBotPct: number;
  sumConfusedByAgentPct: number;

  /** Independent day sets for nullable metrics. */
  agentScoreDays: number;
  agentScoreSum: number;
  responseDays: number;
  responseSumSeconds: number;
};

type ConsumerBotCoverageAcc = {
  daysWithChats: number;
  sumTotalChats: number;
  sumBotCoverageCount: number;
  sumFullyBotCount: number;
  sumAtLeastOneAgentCount: number;
  sumBotCoveragePct: number;
  sumFullyBotPct: number;
  sumAtLeastOneAgentPct: number;
};

function yyyymm(date: string): string {
  return date.slice(0, 7);
}

function emptyInitiatorAcc(): InitiatorAcc {
  return {
    daysWithChats: 0,
    sumTotalChats: 0,
    sumFrustratedByBotCount: 0,
    sumFrustratedByAgentCount: 0,
    sumConfusedByBotCount: 0,
    sumConfusedByAgentCount: 0,
    sumFrustratedByBotPct: 0,
    sumFrustratedByAgentPct: 0,
    sumConfusedByBotPct: 0,
    sumConfusedByAgentPct: 0,
    agentScoreDays: 0,
    agentScoreSum: 0,
    responseDays: 0,
    responseSumSeconds: 0,
  };
}

function emptyConsumerAcc(): ConsumerBotCoverageAcc {
  return {
    daysWithChats: 0,
    sumTotalChats: 0,
    sumBotCoverageCount: 0,
    sumFullyBotCount: 0,
    sumAtLeastOneAgentCount: 0,
    sumBotCoveragePct: 0,
    sumFullyBotPct: 0,
    sumAtLeastOneAgentPct: 0,
  };
}

export function createEmptyByConversationMtdSnapshot(date: string): ByConversationMtdSnapshot {
  const month = yyyymm(date);
  const acc = {
    consumerBotCoverage: emptyConsumerAcc(),
    clientInitiated: emptyInitiatorAcc(),
    agentInitiated: emptyInitiatorAcc(),
  };
  return {
    date,
    month,
    createdAt: new Date().toISOString(),
    acc,
    mtd: {
      mtdDaysWithChatData: 0,
      mtdClientInitiatorDaysWithChats: 0,
      mtdAgentInitiatorDaysWithChats: 0,
      consumerBotCoverageMtd: {
        totalChats: 0,
        botCoverageCount: 0,
        botCoveragePct: 0,
        fullyBotCount: 0,
        fullyBotPct: 0,
        atLeastOneAgentCount: 0,
        atLeastOneAgentPct: 0,
      },
      clientInitiatedMtd: {
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
      },
      agentInitiatedMtd: {
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
      },
    },
  };
}

function mean(sum: number, n: number): number {
  if (n <= 0) return 0;
  return Math.round((sum / n) * 1000) / 1000;
}

function nullableMean(sum: number, n: number): number | null {
  if (n <= 0) return null;
  return Math.round((sum / n) * 1000) / 1000;
}

function applyInitiatorDaily(acc: InitiatorAcc, d: InitiatorTableRow): InitiatorAcc {
  const next: InitiatorAcc = { ...acc };
  if (d.totalChats > 0) {
    next.daysWithChats += 1;
    next.sumTotalChats += d.totalChats;
    next.sumFrustratedByBotCount += d.frustratedByBotCount;
    next.sumFrustratedByAgentCount += d.frustratedByAgentCount;
    next.sumConfusedByBotCount += d.confusedByBotCount;
    next.sumConfusedByAgentCount += d.confusedByAgentCount;
    next.sumFrustratedByBotPct += d.frustratedByBotPct;
    next.sumFrustratedByAgentPct += d.frustratedByAgentPct;
    next.sumConfusedByBotPct += d.confusedByBotPct;
    next.sumConfusedByAgentPct += d.confusedByAgentPct;
  }
  if (d.agentScoreAvg != null && typeof d.agentScoreAvg === 'number' && Number.isFinite(d.agentScoreAvg)) {
    next.agentScoreDays += 1;
    next.agentScoreSum += d.agentScoreAvg;
  }
  if (
    d.averageAgentResponseTimeSeconds != null &&
    typeof d.averageAgentResponseTimeSeconds === 'number' &&
    Number.isFinite(d.averageAgentResponseTimeSeconds)
  ) {
    next.responseDays += 1;
    next.responseSumSeconds += d.averageAgentResponseTimeSeconds;
  }
  return next;
}

function applyConsumerDaily(acc: ConsumerBotCoverageAcc, s: ConsumerBotCoverageSlice): ConsumerBotCoverageAcc {
  const next: ConsumerBotCoverageAcc = { ...acc };
  if (s.totalChats > 0) {
    next.daysWithChats += 1;
    next.sumTotalChats += s.totalChats;
    next.sumBotCoverageCount += s.botCoverageCount;
    next.sumFullyBotCount += s.fullyBotCount;
    next.sumAtLeastOneAgentCount += s.atLeastOneAgentCount;
    next.sumBotCoveragePct += s.botCoveragePct;
    next.sumFullyBotPct += s.fullyBotPct;
    next.sumAtLeastOneAgentPct += s.atLeastOneAgentPct;
  }
  return next;
}

function mtdFromInitiatorAcc(acc: InitiatorAcc): InitiatorTableRow {
  return {
    totalChats: acc.sumTotalChats,
    frustratedByBotCount: acc.sumFrustratedByBotCount,
    frustratedByBotPct: mean(acc.sumFrustratedByBotPct, acc.daysWithChats),
    frustratedByAgentCount: acc.sumFrustratedByAgentCount,
    frustratedByAgentPct: mean(acc.sumFrustratedByAgentPct, acc.daysWithChats),
    confusedByBotCount: acc.sumConfusedByBotCount,
    confusedByBotPct: mean(acc.sumConfusedByBotPct, acc.daysWithChats),
    confusedByAgentCount: acc.sumConfusedByAgentCount,
    confusedByAgentPct: mean(acc.sumConfusedByAgentPct, acc.daysWithChats),
    agentScoreAvg: nullableMean(acc.agentScoreSum, acc.agentScoreDays),
    averageAgentResponseTimeSeconds: nullableMean(acc.responseSumSeconds, acc.responseDays),
  };
}

function mtdFromConsumerAcc(acc: ConsumerBotCoverageAcc): ConsumerBotCoverageSlice {
  return {
    totalChats: acc.sumTotalChats,
    botCoverageCount: acc.sumBotCoverageCount,
    botCoveragePct: mean(acc.sumBotCoveragePct, acc.daysWithChats),
    fullyBotCount: acc.sumFullyBotCount,
    fullyBotPct: mean(acc.sumFullyBotPct, acc.daysWithChats),
    atLeastOneAgentCount: acc.sumAtLeastOneAgentCount,
    atLeastOneAgentPct: mean(acc.sumAtLeastOneAgentPct, acc.daysWithChats),
  };
}

export function consumerSliceFromMetrics(s: ConversationSectionMetrics): ConsumerBotCoverageSlice {
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

export function initiatorRowFromMetrics(s: ConversationSectionMetrics): InitiatorTableRow {
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

/**
 * Build today's MTD snapshot from yesterday's snapshot plus today's daily metrics.
 * The caller is responsible for choosing `prev` (typically date-1) and ensuring the month chain is correct.
 */
export function buildNextByConversationMtdSnapshot(args: {
  date: string;
  prev: ByConversationMtdSnapshot | null;
  consumerDaily: ConsumerBotCoverageSlice;
  clientDaily: InitiatorTableRow;
  agentDaily: InitiatorTableRow;
  sourceLastUpdated?: string;
}): ByConversationMtdSnapshot {
  const month = yyyymm(args.date);
  const base = args.prev && args.prev.month === month ? args.prev : createEmptyByConversationMtdSnapshot(args.date);

  const acc = {
    consumerBotCoverage: applyConsumerDaily(base.acc.consumerBotCoverage, args.consumerDaily),
    clientInitiated: applyInitiatorDaily(base.acc.clientInitiated, args.clientDaily),
    agentInitiated: applyInitiatorDaily(base.acc.agentInitiated, args.agentDaily),
  };

  const mtdDaysWithChatData =
    (args.prev && args.prev.month === month ? args.prev.mtd.mtdDaysWithChatData : 0) + 1;

  return {
    date: args.date,
    month,
    createdAt: new Date().toISOString(),
    sourceLastUpdated: args.sourceLastUpdated,
    acc,
    mtd: {
      mtdDaysWithChatData,
      mtdClientInitiatorDaysWithChats: acc.clientInitiated.daysWithChats,
      mtdAgentInitiatorDaysWithChats: acc.agentInitiated.daysWithChats,
      consumerBotCoverageMtd: mtdFromConsumerAcc(acc.consumerBotCoverage),
      clientInitiatedMtd: mtdFromInitiatorAcc(acc.clientInitiated),
      agentInitiatedMtd: mtdFromInitiatorAcc(acc.agentInitiated),
    },
  };
}

