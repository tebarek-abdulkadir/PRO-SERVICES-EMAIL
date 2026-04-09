import { getDailyChatAnalysisData } from '@/lib/chat-storage';
import type { ServiceOverviewRow } from '@/lib/email-report-layout';
import { tryLoadServiceOverviewForDate } from '@/lib/email-report-periods';

/** Same as dashboard email: sales / prospects × 100 for that product/day. */
function rowConversionRatePercent(r: ServiceOverviewRow): number | null {
  const prospects = r.prospectCc + r.prospectMv;
  const sales = r.salesCc + r.salesMv;
  if (prospects <= 0) {
    return null;
  }
  return (100 * sales) / prospects;
}

/**
 * Load daily conversion rate (% per product) and chat rates for each date.
 * Missing prospect days → null for all products that day; missing chat → null for rates.
 */
export async function loadEmailTrendSeries(dates: string[]): Promise<{
  labels: string[];
  /** Percent 0–100 per product per day (null if no data or no prospects that day). */
  conversionRatePctByLabel: Map<string, (number | null)[]>;
  frustration: (number | null)[];
  confusion: (number | null)[];
}> {
  if (dates.length === 0) {
    return {
      labels: [],
      conversionRatePctByLabel: new Map(),
      frustration: [],
      confusion: [],
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

  let labels: string[] = [];
  for (const s of snapshots) {
    if (s.rows?.length) {
      labels = s.rows.map((r) => r.label);
      break;
    }
  }

  const conversionRatePctByLabel = new Map<string, (number | null)[]>();
  for (const lb of labels) {
    conversionRatePctByLabel.set(lb, []);
  }

  const frustration: (number | null)[] = [];
  const confusion: (number | null)[] = [];

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
        conversionRatePctByLabel.get(lb)!.push(r ? rowConversionRatePercent(r) : null);
      }
    }

    if (chat?.overallMetrics) {
      frustration.push(chat.overallMetrics.frustrationPercentage ?? null);
      confusion.push(chat.overallMetrics.confusionPercentage ?? null);
    } else {
      frustration.push(null);
      confusion.push(null);
    }
  }

  return { labels, conversionRatePctByLabel, frustration, confusion };
}
