import type { ByChatsViewMetrics } from './chat-types';
import {
  joinedSkillsIndicatesAgent,
  joinedSkillsIndicatesBot,
  mergeJoinedSkillsFields,
} from './chat-joined-skills';

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export type RawChatIngestRow = {
  conversationId: string;
  frustrated: boolean;
  confused: boolean;
  joinedSkills?: string;
};

/**
 * Dedupe by conversationId (no entity merge). Duplicate rows: OR flags, union joinedSkills tokens.
 * Then classify bot/agent via joinedSkills contains rules; compute By Chats dashboard metrics.
 */
export function computeByChatsViewMetrics(rows: RawChatIngestRow[]): ByChatsViewMetrics {
  const empty: ByChatsViewMetrics = createEmptyByChatsViewMetrics();

  if (!rows.length) {
    return empty;
  }

  const byId = new Map<string, RawChatIngestRow>();
  for (const row of rows) {
    const id = String(row.conversationId ?? '').trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, {
        conversationId: id,
        frustrated: Boolean(row.frustrated),
        confused: Boolean(row.confused),
        joinedSkills: row.joinedSkills,
      });
    } else {
      byId.set(id, {
        conversationId: id,
        frustrated: existing.frustrated || Boolean(row.frustrated),
        confused: existing.confused || Boolean(row.confused),
        joinedSkills: mergeJoinedSkillsFields(existing.joinedSkills, row.joinedSkills),
      });
    }
  }

  const deduped = Array.from(byId.values());
  const totalChats = deduped.length;

  const enriched = deduped.map((r) => {
    const js = r.joinedSkills;
    const isBot = joinedSkillsIndicatesBot(js);
    const isAgent = joinedSkillsIndicatesAgent(js);
    return { ...r, isBot, isAgent };
  });

  let totalFrustrated = 0;
  let totalConfused = 0;
  let neither = 0;

  for (const r of enriched) {
    if (r.frustrated) totalFrustrated++;
    if (r.confused) totalConfused++;
    if (!r.isBot && !r.isAgent) neither++;
  }

  const totalBotRows = enriched.filter((r) => r.isBot);
  const totalAgentRows = enriched.filter((r) => r.isAgent);
  const fullyBotRows = enriched.filter((r) => r.isBot && !r.isAgent);
  const fullyAgentRows = enriched.filter((r) => r.isAgent && !r.isBot);
  const overlapRows = enriched.filter((r) => r.isBot && r.isAgent);

  const totalBot = totalBotRows.length;
  const totalAgent = totalAgentRows.length;
  const fullyBot = fullyBotRows.length;
  const fullyAgent = fullyAgentRows.length;
  const overlap = overlapRows.length;

  const countFr = (arr: typeof enriched) => arr.filter((x) => x.frustrated).length;
  const countCf = (arr: typeof enriched) => arr.filter((x) => x.confused).length;

  return {
    totalChats,
    totalFrustrated,
    totalConfused,
    frustratedPctOfAllChats: pct(totalFrustrated, totalChats),
    confusedPctOfAllChats: pct(totalConfused, totalChats),

    totalBot,
    totalAgent,
    totalBotPctOfAllChats: pct(totalBot, totalChats),
    totalAgentPctOfAllChats: pct(totalAgent, totalChats),

    frustratedInTotalBot: countFr(totalBotRows),
    confusedInTotalBot: countCf(totalBotRows),
    frustrationPctWithinTotalBot: pct(countFr(totalBotRows), totalBot),
    confusionPctWithinTotalBot: pct(countCf(totalBotRows), totalBot),

    frustratedInTotalAgent: countFr(totalAgentRows),
    confusedInTotalAgent: countCf(totalAgentRows),
    frustrationPctWithinTotalAgent: pct(countFr(totalAgentRows), totalAgent),
    confusionPctWithinTotalAgent: pct(countCf(totalAgentRows), totalAgent),

    fullyBot,
    fullyBotPctOfAllChats: pct(fullyBot, totalChats),
    frustratedInFullyBot: countFr(fullyBotRows),
    confusedInFullyBot: countCf(fullyBotRows),
    frustrationPctWithinFullyBot: pct(countFr(fullyBotRows), fullyBot),
    confusionPctWithinFullyBot: pct(countCf(fullyBotRows), fullyBot),

    botWithAgentMessage: overlap,
    botWithAgentPctOfTotalBot: pct(overlap, totalBot),
    frustratedInBotWithAgent: countFr(overlapRows),
    confusedInBotWithAgent: countCf(overlapRows),
    frustrationPctWithinBotWithAgent: pct(countFr(overlapRows), overlap),
    confusionPctWithinBotWithAgent: pct(countCf(overlapRows), overlap),

    fullyAgent,
    fullyAgentPctOfAllChats: pct(fullyAgent, totalChats),
    frustratedInFullyAgent: countFr(fullyAgentRows),
    confusedInFullyAgent: countCf(fullyAgentRows),
    frustrationPctWithinFullyAgent: pct(countFr(fullyAgentRows), fullyAgent),
    confusionPctWithinFullyAgent: pct(countCf(fullyAgentRows), fullyAgent),

    agentWithBotMessage: overlap,
    agentWithBotPctOfTotalAgent: pct(overlap, totalAgent),
    frustratedInAgentWithBot: countFr(overlapRows),
    confusedInAgentWithBot: countCf(overlapRows),
    frustrationPctWithinAgentWithBot: pct(countFr(overlapRows), overlap),
    confusionPctWithinAgentWithBot: pct(countCf(overlapRows), overlap),

    neitherBotNorAgent: neither,
  };
}

export function createEmptyByChatsViewMetrics(): ByChatsViewMetrics {
  return {
    totalChats: 0,
    totalFrustrated: 0,
    totalConfused: 0,
    frustratedPctOfAllChats: 0,
    confusedPctOfAllChats: 0,
    totalBot: 0,
    totalAgent: 0,
    totalBotPctOfAllChats: 0,
    totalAgentPctOfAllChats: 0,
    frustratedInTotalBot: 0,
    confusedInTotalBot: 0,
    frustrationPctWithinTotalBot: 0,
    confusionPctWithinTotalBot: 0,
    frustratedInTotalAgent: 0,
    confusedInTotalAgent: 0,
    frustrationPctWithinTotalAgent: 0,
    confusionPctWithinTotalAgent: 0,
    fullyBot: 0,
    fullyBotPctOfAllChats: 0,
    frustratedInFullyBot: 0,
    confusedInFullyBot: 0,
    frustrationPctWithinFullyBot: 0,
    confusionPctWithinFullyBot: 0,
    botWithAgentMessage: 0,
    botWithAgentPctOfTotalBot: 0,
    frustratedInBotWithAgent: 0,
    confusedInBotWithAgent: 0,
    frustrationPctWithinBotWithAgent: 0,
    confusionPctWithinBotWithAgent: 0,
    fullyAgent: 0,
    fullyAgentPctOfAllChats: 0,
    frustratedInFullyAgent: 0,
    confusedInFullyAgent: 0,
    frustrationPctWithinFullyAgent: 0,
    confusionPctWithinFullyAgent: 0,
    agentWithBotMessage: 0,
    agentWithBotPctOfTotalAgent: 0,
    frustratedInAgentWithBot: 0,
    confusedInAgentWithBot: 0,
    frustrationPctWithinAgentWithBot: 0,
    confusionPctWithinAgentWithBot: 0,
    neitherBotNorAgent: 0,
  };
}
