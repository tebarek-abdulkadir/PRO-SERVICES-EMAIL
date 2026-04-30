/**
 * Bot vs agent classification from joinedSkills (comma-separated, contains match, case-insensitive).
 */
const BOT_TOKENS = ['GPT_VBC_SALES', 'GPT_PRO_SERVICES', 'VBC_ROUTING_BOT'] as const;
const AGENT_TOKENS = ['VBC_SALES_AGENTS', 'PRO_SERVICES_AGENTS', 'VBC_RESOLVERS_AGENTS'] as const;

function normalizeJoinedSkills(s: string | undefined): string {
  return (s ?? '').toUpperCase();
}

export function joinedSkillsIndicatesBot(joinedSkills?: string): boolean {
  const u = normalizeJoinedSkills(joinedSkills);
  return BOT_TOKENS.some((t) => u.includes(t));
}

export function joinedSkillsIndicatesAgent(joinedSkills?: string): boolean {
  const u = normalizeJoinedSkills(joinedSkills);
  return AGENT_TOKENS.some((t) => u.includes(t));
}

export function mergeJoinedSkillsFields(a?: string, b?: string): string {
  const parts = new Set<string>();
  for (const raw of [a, b]) {
    if (!raw?.trim()) continue;
    for (const p of raw.split(',')) {
      const t = p.trim();
      if (t) parts.add(t);
    }
  }
  return Array.from(parts).join(', ');
}

/**
 * Reconstruct joinedSkills for a stored row from the original ingest rows (handles comma-separated ids).
 * Use when merge steps drop `joinedSkills` on `conv` but POST body had it.
 */
export function mergeJoinedSkillsFromRawForMergedIds(
  mergedConversationIdCsv: string,
  rawRows: ReadonlyArray<{ conversationId: string; joinedSkills?: string }>
): string {
  const targetIds = new Set(
    mergedConversationIdCsv.split(',').map((s) => s.trim()).filter(Boolean)
  );
  let acc: string | undefined;
  for (const row of rawRows) {
    if (!row.joinedSkills?.trim()) continue;
    const rowIds = String(row.conversationId)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!rowIds.some((id) => targetIds.has(id))) continue;
    acc = mergeJoinedSkillsFields(acc, row.joinedSkills);
  }
  return acc ?? '';
}

/**
 * Built once from the raw POST `conversations` array before any merge. Keys are normalized
 * conversation ids so lookup survives string/number quirks and comma-separated ids in POST rows.
 */
export function buildJoinedSkillsLookupMap(
  raw: ReadonlyArray<{ conversationId: string; joinedSkills?: string }>
): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of raw) {
    if (!c.joinedSkills?.trim()) continue;
    for (const id of String(c.conversationId).split(',').map((s) => s.trim()).filter(Boolean)) {
      m.set(id, mergeJoinedSkillsFields(m.get(id), c.joinedSkills));
    }
  }
  return m;
}

/** Resolve joinedSkills for a stored row (possibly comma-separated ids) using the lookup map. */
export function resolveJoinedSkillsForMergedIds(
  mergedConversationIdCsv: string,
  lookup: Map<string, string>
): string {
  let acc: string | undefined;
  for (const id of mergedConversationIdCsv.split(',').map((s) => s.trim()).filter(Boolean)) {
    const j = lookup.get(id);
    if (j) acc = mergeJoinedSkillsFields(acc, j);
  }
  return acc ?? '';
}
