import { computeByConversationViewFromResults } from '@/lib/chat-by-conversation-metrics';
import { getDailyChatAnalysisData } from '@/lib/chat-storage';
import type { ChatAnalysisData } from '@/lib/chat-types';
import { SERVICE_OVERVIEW_PRODUCT_LABELS, type ServiceOverviewRow } from '@/lib/email-report-layout';
import { tryLoadServiceOverviewForDate } from '@/lib/email-report-periods';

/** sales / prospects × 100; when prospects are 0, conversion is defined as 0% (no division by zero). */
function rowConversionRatePercent(r: ServiceOverviewRow): number {
  const prospects = r.prospectCc + r.prospectMv;
  const sales = r.salesCc + r.salesMv;
  if (prospects <= 0) {
    return 0;
  }
  return (100 * sales) / prospects;
}

function byConversationViewFrom(chat: ChatAnalysisData | null) {
  if (!chat) return null;
  if (chat.byConversationView) return chat.byConversationView;
  if (chat.conversationResults?.length) {
    return computeByConversationViewFromResults(chat.conversationResults);
  }
  return null;
}

/** Per-day % of chats in section (By Conversation); null when section has no chats that day. */
export interface EmailChatBreakdownTrends {
  frustrationClientByAgent: (number | null)[];
  frustrationClientByBot: (number | null)[];
  frustrationAgentInitByAgent: (number | null)[];
  frustrationAgentInitByBot: (number | null)[];
  confusionClientByAgent: (number | null)[];
  confusionClientByBot: (number | null)[];
  confusionAgentInitByAgent: (number | null)[];
  confusionAgentInitByBot: (number | null)[];
}

const emptyChatBreakdown = (): EmailChatBreakdownTrends => ({
  frustrationClientByAgent: [],
  frustrationClientByBot: [],
  frustrationAgentInitByAgent: [],
  frustrationAgentInitByBot: [],
  confusionClientByAgent: [],
  confusionClientByBot: [],
  confusionAgentInitByAgent: [],
  confusionAgentInitByBot: [],
});

/**
 * Load conversion trend (per product) and chat breakdown trend on separate date ranges.
 * First chart: `conversionDates` (e.g. from Apr 6). Second chart: `chatDates` (e.g. from Apr 13).
 */
export async function loadEmailTrendSeries(
  conversionDates: string[],
  chatDates: string[]
): Promise<{
  labels: string[];
  conversionRatePctByLabel: Map<string, (number | null)[]>;
  chatBreakdown: EmailChatBreakdownTrends;
}> {
  const labels: string[] = [...SERVICE_OVERVIEW_PRODUCT_LABELS];

  const conversionRatePctByLabel = new Map<string, (number | null)[]>();
  for (const lb of labels) {
    conversionRatePctByLabel.set(lb, []);
  }

  if (conversionDates.length > 0) {
    const conversionSnapshots = await Promise.all(
      conversionDates.map((d) => tryLoadServiceOverviewForDate(d))
    );
    for (const rows of conversionSnapshots) {
      if (!rows) {
        for (const lb of labels) {
          conversionRatePctByLabel.get(lb)!.push(null);
        }
      } else {
        const byL = new Map(rows.map((r) => [r.label, r] as const));
        for (const lb of labels) {
          const r = byL.get(lb);
          conversionRatePctByLabel.get(lb)!.push(r !== undefined ? rowConversionRatePercent(r) : null);
        }
      }
    }
  }

  const chatBreakdown = emptyChatBreakdown();
  const pushChatNulls = () => {
    chatBreakdown.frustrationClientByAgent.push(null);
    chatBreakdown.frustrationClientByBot.push(null);
    chatBreakdown.frustrationAgentInitByAgent.push(null);
    chatBreakdown.frustrationAgentInitByBot.push(null);
    chatBreakdown.confusionClientByAgent.push(null);
    chatBreakdown.confusionClientByBot.push(null);
    chatBreakdown.confusionAgentInitByAgent.push(null);
    chatBreakdown.confusionAgentInitByBot.push(null);
  };

  if (chatDates.length === 0) {
    return { labels, conversionRatePctByLabel, chatBreakdown };
  }

  const chatSnapshots = await Promise.all(chatDates.map((d) => getDailyChatAnalysisData(d)));
  for (const chat of chatSnapshots) {
    const v = chat ? byConversationViewFrom(chat) : null;
    if (!v) {
      pushChatNulls();
      continue;
    }

    const ci = v.consumerInitiated;
    const ai = v.agentInitiated;

    chatBreakdown.frustrationClientByAgent.push(
      ci.totalChats > 0 ? ci.frustrationByAgentPct : null
    );
    chatBreakdown.frustrationClientByBot.push(
      ci.totalChats > 0 ? ci.frustrationByBotOrSystemPct : null
    );
    chatBreakdown.frustrationAgentInitByAgent.push(
      ai.totalChats > 0 ? ai.frustrationByAgentPct : null
    );
    chatBreakdown.frustrationAgentInitByBot.push(
      ai.totalChats > 0 ? ai.frustrationByBotOrSystemPct : null
    );

    chatBreakdown.confusionClientByAgent.push(
      ci.totalChats > 0 ? ci.confusionByAgentPct : null
    );
    chatBreakdown.confusionClientByBot.push(
      ci.totalChats > 0 ? ci.confusionByBotOrSystemPct : null
    );
    chatBreakdown.confusionAgentInitByAgent.push(
      ai.totalChats > 0 ? ai.confusionByAgentPct : null
    );
    chatBreakdown.confusionAgentInitByBot.push(
      ai.totalChats > 0 ? ai.confusionByBotOrSystemPct : null
    );
  }

  return { labels, conversionRatePctByLabel, chatBreakdown };
}
