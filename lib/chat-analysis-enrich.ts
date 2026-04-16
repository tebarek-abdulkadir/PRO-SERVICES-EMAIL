import { computeByChatsViewMetrics } from '@/lib/chat-by-chats-metrics';
import { computeByConversationViewFromResults } from '@/lib/chat-by-conversation-metrics';
import type { ChatAnalysisData } from '@/lib/chat-types';

/**
 * Same enrichment as GET /api/chat-analysis: older blobs may omit views; always recompute
 * `byConversationView` from `conversationResults` so initiator rules match the dashboard.
 * Email and trend loaders must call this on raw blob data — they do not go through the API.
 */
export function enrichChatAnalysisData(data: ChatAnalysisData): ChatAnalysisData {
  let next = data;
  if (data.byChatsView == null) {
    const rows =
      data.conversationResults
        ?.filter((r) => r.joinedSkills?.trim())
        .map((r) => ({
          conversationId: r.conversationId,
          frustrated: r.frustrated,
          confused: r.confused,
          joinedSkills: r.joinedSkills!,
        })) ?? [];
    if (rows.length > 0) {
      next = { ...next, byChatsView: computeByChatsViewMetrics(rows) };
    }
  }
  if (next.conversationResults?.length) {
    next = {
      ...next,
      byConversationView: computeByConversationViewFromResults(next.conversationResults),
    };
  } else if (next.byConversationView == null && data.byConversationView != null) {
    /** Blobs saved with precomputed view only (no or empty conversationResults) — keep dashboard/email aligned */
    next = { ...next, byConversationView: data.byConversationView };
  }
  return next;
}
