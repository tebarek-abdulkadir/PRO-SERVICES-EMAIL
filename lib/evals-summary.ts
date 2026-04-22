/**
 * Aggregated tool/policy eval metrics for one day (stored on evals ingest + optional GET enrich).
 */

export type EvalsToolEvalSummary = {
  /** Denominator for chat-level %; matches `uniqueConversationIdCount` on parent summary */
  totalChatsAnalyzed: number;
  /** Sum of Tools[].length across all conversations */
  totalToolCalls: number;
  conversationsWithWrongToolCall: number;
  conversationsWithWrongToolCallPct: number;
  wrongToolCalls: number;
  wrongToolCallsPct: number;
  conversationsWithNegativeToolResponse: number;
  conversationsWithNegativeToolResponsePct: number;
  negativeToolResponses: number;
  negativeToolResponsesPct: number;
  conversationsWithMissedToolCall: number;
  conversationsWithMissedToolCallPct: number;
};

export type EvalsPolicyEvalSummary = {
  conversationsWithWrongPolicy: number;
  conversationsWithWrongPolicyPct: number;
  conversationsWithMissedPolicy: number;
  conversationsWithMissedPolicyPct: number;
  conversationsWithUnclearPolicy: number;
  conversationsWithUnclearPolicyPct: number;
};

export type EvalsDaySummary = {
  /** Distinct conversation IDs after splitting comma-separated `conversationId` values */
  uniqueConversationIdCount: number;
  /** Number of objects in the `conversations` array for this day */
  conversationRecordCount: number;
  toolEvals: EvalsToolEvalSummary;
  policyEvals: EvalsPolicyEvalSummary;
  computedAt: string;
};

function asRecord(x: unknown): Record<string, unknown> | null {
  if (x != null && typeof x === 'object' && !Array.isArray(x)) return x as Record<string, unknown>;
  return null;
}

function truthy(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function conversationIdTokens(conv: Record<string, unknown>): string[] {
  const id = conv.conversationId;
  if (id == null) return [];
  return String(id)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function allConversationIdSet(conversations: unknown[]): Set<string> {
  const set = new Set<string>();
  for (const c of conversations) {
    const r = asRecord(c);
    if (!r) continue;
    for (const id of conversationIdTokens(r)) set.add(id);
  }
  return set;
}

function getTools(conv: Record<string, unknown>): Record<string, unknown>[] {
  const t = conv.Tools;
  if (!Array.isArray(t)) return [];
  return t.filter((x) => x != null && typeof x === 'object') as Record<string, unknown>[];
}

function rowHasWrongTool(conv: Record<string, unknown>): boolean {
  if (truthy(conv.hasWrongToolCall)) return true;
  return getTools(conv).some((tool) => truthy(tool.Wrong_tool_call));
}

function rowHasNegativeToolResponse(conv: Record<string, unknown>): boolean {
  if (truthy(conv.hasNegativeToolResponse)) return true;
  return getTools(conv).some((tool) => truthy(tool.Negative_Tool_Response));
}

function rowHasMissedToolCall(conv: Record<string, unknown>): boolean {
  if (truthy(conv.hasMissedToolCall)) return true;
  const m = asRecord(conv.Missed_tool_call);
  if (m && truthy(m.Missed_tool_call)) return true;
  return false;
}

function policyArrayLen(conv: Record<string, unknown>, key: string): number {
  const a = conv[key];
  return Array.isArray(a) ? a.length : 0;
}

function rowHasWrongPolicy(conv: Record<string, unknown>): boolean {
  if (truthy(conv.hasWrongPolicy)) return true;
  return policyArrayLen(conv, 'Wrong_Policy') > 0;
}

function rowHasMissedPolicy(conv: Record<string, unknown>): boolean {
  if (truthy(conv.hasMissedPolicy)) return true;
  return policyArrayLen(conv, 'Missed_Policy') > 0;
}

function rowHasUnclearPolicy(conv: Record<string, unknown>): boolean {
  if (truthy(conv.hasUnclearPolicy)) return true;
  return policyArrayLen(conv, 'Unclear_Policy') > 0;
}

/** One key per eval row’s `conversationId` string (not comma-split). Avoids double-counting merged ids when comparing to per-tool counts. */
function addEvalRowConversationKey(set: Set<string>, conv: Record<string, unknown>): void {
  const key = String(conv.conversationId ?? '').trim();
  if (key) set.add(key);
}

function pct(numerator: number, denominator: number): number {
  if (!denominator || !Number.isFinite(denominator)) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * `conversations`: array of per-conversation eval rows (n8n / blob shape).
 * `uniqueConversationIdCount` / denominators: split `conversationId` on comma (underlying CH ids).
 * Tool/policy “conversations with …” counts: **distinct full `conversationId` strings** per eval row (one merged transcript = one row key).
 */
export function computeEvalsSummary(conversations: unknown[]): EvalsDaySummary {
  const allIds = allConversationIdSet(conversations);
  const uniqueConversationIdCount = allIds.size;
  const conversationRecordCount = conversations.length;
  const totalChatsAnalyzed = uniqueConversationIdCount;

  let totalToolCalls = 0;
  let wrongToolCalls = 0;
  let negativeToolResponses = 0;

  const wrongToolChatIds = new Set<string>();
  const negativeToolChatIds = new Set<string>();
  const missedToolChatIds = new Set<string>();
  const wrongPolicyChatIds = new Set<string>();
  const missedPolicyChatIds = new Set<string>();
  const unclearPolicyChatIds = new Set<string>();

  for (const c of conversations) {
    const conv = asRecord(c);
    if (!conv) continue;

    const tools = getTools(conv);
    totalToolCalls += tools.length;

    for (const tool of tools) {
      if (truthy(tool.Wrong_tool_call)) wrongToolCalls += 1;
      if (truthy(tool.Negative_Tool_Response)) negativeToolResponses += 1;
    }

    if (rowHasWrongTool(conv)) addEvalRowConversationKey(wrongToolChatIds, conv);
    if (rowHasNegativeToolResponse(conv)) addEvalRowConversationKey(negativeToolChatIds, conv);
    if (rowHasMissedToolCall(conv)) addEvalRowConversationKey(missedToolChatIds, conv);
    if (rowHasWrongPolicy(conv)) addEvalRowConversationKey(wrongPolicyChatIds, conv);
    if (rowHasMissedPolicy(conv)) addEvalRowConversationKey(missedPolicyChatIds, conv);
    if (rowHasUnclearPolicy(conv)) addEvalRowConversationKey(unclearPolicyChatIds, conv);
  }

  const toolEvals: EvalsToolEvalSummary = {
    totalChatsAnalyzed,
    totalToolCalls,
    conversationsWithWrongToolCall: wrongToolChatIds.size,
    conversationsWithWrongToolCallPct: pct(wrongToolChatIds.size, totalChatsAnalyzed),
    wrongToolCalls,
    wrongToolCallsPct: pct(wrongToolCalls, totalToolCalls),
    conversationsWithNegativeToolResponse: negativeToolChatIds.size,
    conversationsWithNegativeToolResponsePct: pct(negativeToolChatIds.size, totalChatsAnalyzed),
    negativeToolResponses,
    negativeToolResponsesPct: pct(negativeToolResponses, totalToolCalls),
    conversationsWithMissedToolCall: missedToolChatIds.size,
    conversationsWithMissedToolCallPct: pct(missedToolChatIds.size, totalChatsAnalyzed),
  };

  const policyEvals: EvalsPolicyEvalSummary = {
    conversationsWithWrongPolicy: wrongPolicyChatIds.size,
    conversationsWithWrongPolicyPct: pct(wrongPolicyChatIds.size, totalChatsAnalyzed),
    conversationsWithMissedPolicy: missedPolicyChatIds.size,
    conversationsWithMissedPolicyPct: pct(missedPolicyChatIds.size, totalChatsAnalyzed),
    conversationsWithUnclearPolicy: unclearPolicyChatIds.size,
    conversationsWithUnclearPolicyPct: pct(unclearPolicyChatIds.size, totalChatsAnalyzed),
  };

  return {
    uniqueConversationIdCount,
    conversationRecordCount,
    toolEvals,
    policyEvals,
    computedAt: new Date().toISOString(),
  };
}

export function attachEvalsSummaryIfMissing(doc: Record<string, unknown>): Record<string, unknown> {
  const convs = doc.conversations;
  if (!Array.isArray(convs)) {
    return doc;
  }
  const existing = doc.summary;
  if (existing && typeof existing === 'object' && !Array.isArray(existing) && 'computedAt' in (existing as object)) {
    return doc;
  }
  return {
    ...doc,
    summary: computeEvalsSummary(convs),
  };
}
