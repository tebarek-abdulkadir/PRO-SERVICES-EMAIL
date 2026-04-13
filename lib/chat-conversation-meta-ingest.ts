/**
 * Merge initiator / frustratedBy / confusedBy / agentScore from raw POST into stored rows
 * (same pattern as joinedSkills + entity fields).
 */

export type RawChatMetaRow = {
  conversationId: string;
  frustrated: boolean;
  initiator?: string;
  frustratedBy?: string;
  confusedBy?: string;
  agentScore?: number | null;
};

export type MergedChatMeta = {
  initiator?: string;
  frustratedBy?: string;
  confusedBy?: string;
  agentScores: number[];
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
  if (!na) return b?.trim();
  if (!nb) return a?.trim();
  if (na === 'agent' || nb === 'agent') return na === 'agent' ? a!.trim() : b!.trim();
  return b!.trim();
}

function mergeMeta(a: MergedChatMeta, b: MergedChatMeta): MergedChatMeta {
  return {
    initiator: a.initiator?.trim() || b.initiator?.trim(),
    frustratedBy: mergeFrustratedBy(a.frustratedBy, b.frustratedBy),
    confusedBy: a.confusedBy?.trim() || b.confusedBy?.trim(),
    agentScores: [...a.agentScores, ...b.agentScores],
  };
}

function rowToMeta(row: RawChatMetaRow): MergedChatMeta {
  const scores: number[] = [];
  if (row.agentScore != null && typeof row.agentScore === 'number' && Number.isFinite(row.agentScore)) {
    scores.push(row.agentScore);
  }
  return {
    initiator: row.initiator?.trim(),
    frustratedBy: row.frustratedBy?.trim(),
    confusedBy: row.confusedBy?.trim(),
    agentScores: scores,
  };
}

/** One map entry per conversation id token (CHxxx). */
export function buildChatMetaLookupMap(rows: RawChatMetaRow[]): Map<string, MergedChatMeta> {
  const m = new Map<string, MergedChatMeta>();
  for (const row of rows) {
    const meta = rowToMeta(row);
    for (const id of splitIds(String(row.conversationId))) {
      const existing = m.get(id);
      m.set(id, existing ? mergeMeta(existing, meta) : meta);
    }
  }
  return m;
}

export function resolveChatMetaForMergedIds(
  mergedConversationIdCsv: string,
  lookup: Map<string, MergedChatMeta>
): { initiator?: string; frustratedBy?: string; confusedBy?: string; agentScore?: number | null } {
  const ids = splitIds(mergedConversationIdCsv);
  if (ids.length === 0) return { agentScore: null };

  let acc: MergedChatMeta | undefined;
  for (const id of ids) {
    const slice = lookup.get(id);
    if (!slice) continue;
    acc = acc ? mergeMeta(acc, slice) : { ...slice, agentScores: [...slice.agentScores] };
  }
  if (!acc) return { agentScore: null };

  let agentScore: number | null = null;
  if (acc.agentScores.length > 0) {
    const sum = acc.agentScores.reduce((a, b) => a + b, 0);
    agentScore = sum / acc.agentScores.length;
  }

  return {
    initiator: acc.initiator,
    frustratedBy: acc.frustratedBy,
    confusedBy: acc.confusedBy,
    agentScore,
  };
}
