import type { ChatAnalysisData, ChatAnalysisResult } from '@/lib/chat-types';

/**
 * Same conversationId dedupe as ChatsDashboard — keeps the row with richer issues/phrases,
 * then prefers a row with both frustrated+confused when tie-breaker.
 */
export function dedupeChatConversationResults(results: ChatAnalysisResult[]): ChatAnalysisResult[] {
  const deduplicated = results.reduce((acc, conv) => {
    const existing = acc.get(conv.conversationId);

    if (!existing) {
      acc.set(conv.conversationId, conv);
    } else {
      const existingHasData = (existing.mainIssues?.length || 0) + (existing.keyPhrases?.length || 0);
      const currentHasData = (conv.mainIssues?.length || 0) + (conv.keyPhrases?.length || 0);

      if (currentHasData > existingHasData) {
        acc.set(conv.conversationId, conv);
      } else if (currentHasData === existingHasData) {
        const existingBothFlags = existing.frustrated && existing.confused;
        const currentBothFlags = conv.frustrated && conv.confused;
        if (currentBothFlags && !existingBothFlags) {
          acc.set(conv.conversationId, conv);
        }
      }
    }

    return acc;
  }, new Map<string, ChatAnalysisResult>());

  return Array.from(deduplicated.values());
}

/** Metrics for the daily email chat table — aligned with Chats page (same API + same dedupe). */
export function getChatEmailTableMetrics(data: ChatAnalysisData): {
  totalChats: number;
  frustratedClients: number;
  frustratedChats: number;
  confusedClients: number;
  confusedChats: number;
} {
  const deduped = dedupeChatConversationResults(data.conversationResults);
  const m = data.overallMetrics;

  return {
    totalChats: deduped.length,
    frustratedClients: m.frustratedCount,
    frustratedChats: deduped.filter((c) => c.frustrated).length,
    confusedClients: m.confusedCount,
    confusedChats: deduped.filter((c) => c.confused).length,
  };
}
