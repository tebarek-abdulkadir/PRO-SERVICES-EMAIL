import type {
  ByConversationViewData,
  ChatAnalysisResult,
  ConversationSectionMetrics,
} from './chat-types';
import { dedupeChatConversationResults } from './chat-email-metrics';
import { parseAgentResponseTimeToSeconds } from './chat-agent-response-time';
import {
  joinedSkillsIndicatesAgent,
  joinedSkillsIndicatesBot,
} from './chat-joined-skills';

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/** Consumer or Bot-initiated bucket (initiator field). */
export function isConsumerInitiatedBucket(initiator: string | undefined): boolean {
  const n = norm(initiator);
  return n === 'consumer' || n === 'bot';
}

export function isAgentInitiatedBucket(initiator: string | undefined): boolean {
  return norm(initiator) === 'agent';
}

function emptySection(): ConversationSectionMetrics {
  return {
    totalChats: 0,
    frustrationCount: 0,
    frustrationPct: 0,
    frustrationByAgentCount: 0,
    frustrationByAgentPct: 0,
    frustrationByBotOrSystemCount: 0,
    frustrationByBotOrSystemPct: 0,
    confusionCount: 0,
    confusionPct: 0,
    confusionByAgentCount: 0,
    confusionByAgentPct: 0,
    confusionByBotOrSystemCount: 0,
    confusionByBotOrSystemPct: 0,
    agentScoreAvg: null,
    chatbotCoverageCount: 0,
    chatbotCoveragePct: 0,
    fullyBotCount: 0,
    fullyBotPct: 0,
    atLeastOneAgentMessageCount: 0,
    atLeastOneAgentMessagePct: 0,
    averageAgentResponseTimeSeconds: null,
  };
}

function computeSection(
  rows: ChatAnalysisResult[],
  opts: { includeChatbotBlock: boolean }
): ConversationSectionMetrics {
  const out = emptySection();
  const total = rows.length;
  out.totalChats = total;
  if (total === 0) return out;

  let frustrationCount = 0;
  let frAgent = 0;
  let frBot = 0;
  let confusionCount = 0;
  let confAgent = 0;
  let confBot = 0;
  const scores: number[] = [];
  let cov = 0;
  let fully = 0;
  let agentMsg = 0;
  const responseSeconds: number[] = [];

  for (const r of rows) {
    if (r.frustrated) frustrationCount++;

    if (r.frustrated) {
      const fb = norm(r.frustratedBy);
      if (fb === 'agent') frAgent++;
      else if (fb === 'bot' || fb === 'system') frBot++;
    }

    if (r.confused) confusionCount++;

    if (r.confused) {
      const cb = norm(r.confusedBy);
      if (cb === 'agent') confAgent++;
      else if (cb === 'bot' || cb === 'system') confBot++;
    }

    if (r.agentScore != null && typeof r.agentScore === 'number' && Number.isFinite(r.agentScore)) {
      scores.push(r.agentScore);
    }

    const rt = parseAgentResponseTimeToSeconds(r.agentResponseTime ?? undefined);
    if (rt != null) responseSeconds.push(rt);

    if (opts.includeChatbotBlock) {
      const js = r.joinedSkills;
      const isBot = joinedSkillsIndicatesBot(js);
      const isAgent = joinedSkillsIndicatesAgent(js);
      if (isBot) cov++;
      if (isBot && !isAgent) fully++;
      if (isAgent) agentMsg++;
    }
  }

  out.frustrationCount = frustrationCount;
  out.frustrationPct = pct(frustrationCount, total);
  out.frustrationByAgentCount = frAgent;
  out.frustrationByAgentPct = pct(frAgent, total);
  out.frustrationByBotOrSystemCount = frBot;
  out.frustrationByBotOrSystemPct = pct(frBot, total);

  out.confusionCount = confusionCount;
  out.confusionPct = pct(confusionCount, total);
  out.confusionByAgentCount = confAgent;
  out.confusionByAgentPct = pct(confAgent, total);
  out.confusionByBotOrSystemCount = confBot;
  out.confusionByBotOrSystemPct = pct(confBot, total);

  if (scores.length > 0) {
    out.agentScoreAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  if (responseSeconds.length > 0) {
    out.averageAgentResponseTimeSeconds =
      responseSeconds.reduce((a, b) => a + b, 0) / responseSeconds.length;
  }

  if (opts.includeChatbotBlock) {
    out.chatbotCoverageCount = cov;
    out.chatbotCoveragePct = pct(cov, total);
    out.fullyBotCount = fully;
    out.fullyBotPct = pct(fully, total);
    out.atLeastOneAgentMessageCount = agentMsg;
    out.atLeastOneAgentMessagePct = pct(agentMsg, total);
  }

  return out;
}

/**
 * Dedupe by conversationId, split by initiator (case-insensitive).
 * Consumer Initiated = initiator consumer | bot, or missing/unknown initiator (defaults here).
 * Agent Initiated = agent only.
 */
export function computeByConversationViewFromResults(
  results: ChatAnalysisResult[]
): ByConversationViewData {
  const deduped = dedupeChatConversationResults(results);
  const consumer: ChatAnalysisResult[] = [];
  const agent: ChatAnalysisResult[] = [];

  for (const r of deduped) {
    if (isAgentInitiatedBucket(r.initiator)) {
      agent.push(r);
    } else {
      consumer.push(r);
    }
  }

  return {
    consumerInitiated: computeSection(consumer, { includeChatbotBlock: true }),
    agentInitiated: computeSection(agent, { includeChatbotBlock: false }),
    excludedNoInitiator: 0,
  };
}

export function createEmptyByConversationViewData(): ByConversationViewData {
  return {
    consumerInitiated: emptySection(),
    agentInitiated: emptySection(),
    excludedNoInitiator: 0,
  };
}
