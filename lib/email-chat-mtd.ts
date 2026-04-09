import { getDailyChatAnalysisData } from '@/lib/chat-storage';

export interface ChatMtdAverages {
  frustrationPercentMtdAvg: number;
  confusionPercentMtdAvg: number;
  chatMtdDaysCounted: number;
}

/** Mean frustration/confusion % over days in range that have chat analysis (missing days skipped). */
export async function averageChatRatesForDateRange(dates: string[]): Promise<ChatMtdAverages> {
  if (dates.length === 0) {
    return { frustrationPercentMtdAvg: 0, confusionPercentMtdAvg: 0, chatMtdDaysCounted: 0 };
  }

  const results = await Promise.all(dates.map((d) => getDailyChatAnalysisData(d)));
  const fr: number[] = [];
  const cf: number[] = [];

  for (const c of results) {
    if (c?.overallMetrics) {
      fr.push(c.overallMetrics.frustrationPercentage || 0);
      cf.push(c.overallMetrics.confusionPercentage || 0);
    }
  }

  const n = fr.length;
  return {
    frustrationPercentMtdAvg: n ? Math.round((fr.reduce((a, b) => a + b, 0) / n) * 10) / 10 : 0,
    confusionPercentMtdAvg: n ? Math.round((cf.reduce((a, b) => a + b, 0) / n) * 10) / 10 : 0,
    chatMtdDaysCounted: n,
  };
}
