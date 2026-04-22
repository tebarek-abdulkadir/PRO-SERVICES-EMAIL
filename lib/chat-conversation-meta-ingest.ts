/**
 * Merge initiator / frustratedBy / confusedBy / agentScore / agentResponseTime / unresponsive from raw POST into stored rows
 * (same pattern as joinedSkills + entity fields).
 */

import {
  formatSecondsAsAgentResponseTime,
  parseAgentResponseTimeToSeconds,
  normalizeUnresponsive,
} from '@/lib/chat-agent-response-time';

export type RawChatMetaRow = {
  conversationId: string;
  frustrated: boolean;
  initiator?: string;
  frustratedBy?: string;
  confusedBy?: string;
  agentScore?: number | null;
  agentResponseTime?: string;
  unresponsive?: number;
};

export type MergedChatMeta = {
  initiator?: string;
  frustratedBy?: string;
  confusedBy?: string;
  agentScores: number[];
  responseTimeSeconds: number[];
  unresponsiveMax: number;
};

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function splitIds(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeFrustratedBy(a?: string, b?: string): string | undefined {
  const na = norm(a);
  const nb = norm(b);
  if (!na) return b == null ? undefined : String(b).trim();
  if (!nb) return a == null ? undefined : String(a).trim();
  if (na === 'agent' || nb === 'agent') return na === 'agent' ? String(a).trim() : String(b).trim();
  return String(b).trim();
}

function mergeMeta(a: MergedChatMeta, b: MergedChatMeta): MergedChatMeta {
  return {
    initiator: a.initiator?.trim() || b.initiator?.trim(),
    frustratedBy: mergeFrustratedBy(a.frustratedBy, b.frustratedBy),
    confusedBy: a.confusedBy?.trim() || b.confusedBy?.trim(),
    agentScores: [...a.agentScores, ...b.agentScores],
    responseTimeSeconds: [...a.responseTimeSeconds, ...b.responseTimeSeconds],
    unresponsiveMax: Math.max(a.unresponsiveMax, b.unresponsiveMax),
  };
}

function rowToMeta(row: RawChatMetaRow): MergedChatMeta {
  const scores: number[] = [];
  if (row.agentScore != null && typeof row.agentScore === 'number' && Number.isFinite(row.agentScore)) {
    scores.push(row.agentScore);
  }
  const sec = parseAgentResponseTimeToSeconds(row.agentResponseTime);
  const responseTimeSeconds = sec != null ? [sec] : [];
  return {
    initiator: row.initiator?.trim(),
    frustratedBy: row.frustratedBy?.trim(),
    confusedBy: row.confusedBy?.trim(),
    agentScores: scores,
    responseTimeSeconds,
    unresponsiveMax: normalizeUnresponsive(row.unresponsive),
  };
}

/** One map entry per conversation id token (CHxxx). */
export function buildChatMetaLookupMap(rows: RawChatMetaRow[]): Map<string, MergedChatMeta> {
  const m = new Map<string, MergedChatMeta>();
  for (const row of rows) {
    const meta = rowToMeta(row);
    for (const id of splitIds(String(row.conversationId))) {
      const existing = m.get(id);
      m.set(
        id,
        existing
          ? mergeMeta(existing, meta)
          : {
              ...meta,
              agentScores: [...meta.agentScores],
              responseTimeSeconds: [...meta.responseTimeSeconds],
            }
      );
    }
  }
  return m;
}

export function resolveChatMetaForMergedIds(
  mergedConversationIdCsv: string,
  lookup: Map<string, MergedChatMeta>
): {
  initiator?: string;
  frustratedBy?: string;
  confusedBy?: string;
  agentScore?: number | null;
  agentResponseTime?: string | null;
  unresponsive?: number;
} {
  const ids = splitIds(mergedConversationIdCsv);
  if (ids.length === 0) return { agentScore: null, agentResponseTime: null, unresponsive: 0 };

  let acc: MergedChatMeta | undefined;
  for (const id of ids) {
    const slice = lookup.get(id);
    if (!slice) continue;
    acc = acc
      ? mergeMeta(acc, slice)
      : {
          ...slice,
          agentScores: [...slice.agentScores],
          responseTimeSeconds: [...slice.responseTimeSeconds],
        };
  }
  if (!acc) return { agentScore: null, agentResponseTime: null, unresponsive: 0 };

  let agentScore: number | null = null;
  if (acc.agentScores.length > 0) {
    const sum = acc.agentScores.reduce((a, b) => a + b, 0);
    agentScore = sum / acc.agentScores.length;
  }

  let agentResponseTime: string | null = null;
  if (acc.responseTimeSeconds.length > 0) {
    const sum = acc.responseTimeSeconds.reduce((a, b) => a + b, 0);
    agentResponseTime = formatSecondsAsAgentResponseTime(sum / acc.responseTimeSeconds.length);
  }

  return {
    initiator: acc.initiator,
    frustratedBy: acc.frustratedBy,
    confusedBy: acc.confusedBy,
    agentScore,
    agentResponseTime,
    unresponsive: acc.unresponsiveMax,
  };
}
