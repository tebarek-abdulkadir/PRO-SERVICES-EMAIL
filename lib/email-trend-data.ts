import { enrichChatAnalysisData } from '@/lib/chat-analysis-enrich';
import { getDailyChatAnalysisData } from '@/lib/chat-storage';
import { SERVICE_OVERVIEW_PRODUCT_LABELS, type ServiceOverviewRow } from '@/lib/email-report-layout';
import { tryLoadServiceOverviewForDate } from '@/lib/email-report-periods';
import type { ChatAnalysisData } from '@/lib/chat-types';

/** sales / prospects × 100; when prospects are 0, conversion is defined as 0% (no division by zero). */
function rowConversionRatePercent(r: ServiceOverviewRow): number {
  const prospects = r.prospectCc + r.prospectMv;
  const sales = r.salesCc + r.salesMv;
  if (prospects <= 0) {
    return 0;
  }
  return (100 * sales) / prospects;
}

/** Same enrichment as dashboard GET so trend charts match Chats / By Conversation. */
function viewFromData(data: ChatAnalysisData | null) {
  if (!data) return null;
  return enrichChatAnalysisData(data).byConversationView ?? null;
}

export type EmailChatBreakdown = {
  frustrationClientByAgent: (number | null)[];
  frustrationClientByBot: (number | null)[];
  frustrationAgentInitByAgent: (number | null)[];
  frustrationAgentInitByBot: (number | null)[];
  confusionClientByAgent: (number | null)[];
  confusionClientByBot: (number | null)[];
  confusionAgentInitByAgent: (number | null)[];
  confusionAgentInitByBot: (number | null)[];
};

function emptyChatBreakdownArrays(): EmailChatBreakdown {
  return {
    frustrationClientByAgent: [],
    frustrationClientByBot: [],
    frustrationAgentInitByAgent: [],
    frustrationAgentInitByBot: [],
    confusionClientByAgent: [],
    confusionClientByBot: [],
    confusionAgentInitByAgent: [],
    confusionAgentInitByBot: [],
  };
}

/**
 * Load daily conversion rate (% per product) for `conversionDates`, and By Conversation breakdown
 * series for `chatTrendDates` (often Apr 13–report date). Missing prospect/sales row → null; missing chat blob → nulls.
 */
export async function loadEmailTrendSeries(
  conversionDates: string[],
  chatTrendDates: string[]
): Promise<{
  labels: string[];
  conversionRatePctByLabel: Map<string, (number | null)[]>;
  chatBreakdown: EmailChatBreakdown;
}> {
  const labels: string[] = [...SERVICE_OVERVIEW_PRODUCT_LABELS];
  const conversionRatePctByLabel = new Map<string, (number | null)[]>();
  for (const lb of labels) {
    conversionRatePctByLabel.set(lb, []);
  }

  for (const d of conversionDates) {
    const rows = await tryLoadServiceOverviewForDate(d);
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

  const chatBreakdown = emptyChatBreakdownArrays();

  for (const d of chatTrendDates) {
    const chat = await getDailyChatAnalysisData(d);
    const v = viewFromData(chat);
    if (!v) {
      chatBreakdown.frustrationClientByAgent.push(null);
      chatBreakdown.frustrationClientByBot.push(null);
      chatBreakdown.frustrationAgentInitByAgent.push(null);
      chatBreakdown.frustrationAgentInitByBot.push(null);
      chatBreakdown.confusionClientByAgent.push(null);
      chatBreakdown.confusionClientByBot.push(null);
      chatBreakdown.confusionAgentInitByAgent.push(null);
      chatBreakdown.confusionAgentInitByBot.push(null);
      continue;
    }
    const ci = v.consumerInitiated;
    const ai = v.agentInitiated;
    chatBreakdown.frustrationClientByAgent.push(ci.frustrationByAgentPct);
    chatBreakdown.frustrationClientByBot.push(ci.frustrationByBotOrSystemPct);
    chatBreakdown.frustrationAgentInitByAgent.push(ai.frustrationByAgentPct);
    chatBreakdown.frustrationAgentInitByBot.push(ai.frustrationByBotOrSystemPct);
    chatBreakdown.confusionClientByAgent.push(ci.confusionByAgentPct);
    chatBreakdown.confusionClientByBot.push(ci.confusionByBotOrSystemPct);
    chatBreakdown.confusionAgentInitByAgent.push(ai.confusionByAgentPct);
    chatBreakdown.confusionAgentInitByBot.push(ai.confusionByBotOrSystemPct);
  }

  return { labels, conversionRatePctByLabel, chatBreakdown };
}
