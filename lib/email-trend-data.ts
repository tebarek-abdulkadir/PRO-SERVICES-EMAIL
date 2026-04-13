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

/**
 * Load daily conversion rate (% per product) and By Conversation frustration/confusion breakdown per date.
 * Missing snapshot for a day → null per product that day; missing chat → null for all chat series.
 */
export async function loadEmailTrendSeries(dates: string[]): Promise<{
  labels: string[];
  /** Percent 0–100 per product per day (null only if no row for that product/day; 0 prospects → 0%). */
  conversionRatePctByLabel: Map<string, (number | null)[]>;
  chatBreakdown: EmailChatBreakdownTrends;
}> {
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

  if (dates.length === 0) {
    return {
      labels: [],
      conversionRatePctByLabel: new Map(),
      chatBreakdown: emptyChatBreakdown(),
    };
  }

  const snapshots = await Promise.all(
    dates.map(async (d) => {
      const [rows, chat] = await Promise.all([
        tryLoadServiceOverviewForDate(d),
        getDailyChatAnalysisData(d),
      ]);
      return { d, rows, chat };
    })
  );

  const labels: string[] = [...SERVICE_OVERVIEW_PRODUCT_LABELS];

  const conversionRatePctByLabel = new Map<string, (number | null)[]>();
  for (const lb of labels) {
    conversionRatePctByLabel.set(lb, []);
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

  for (let i = 0; i < snapshots.length; i++) {
    const { rows, chat } = snapshots[i];

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
