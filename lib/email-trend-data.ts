import { getDailyChatAnalysisData } from '@/lib/chat-storage';
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

/**
 * Load daily conversion rate (% per product) and chat rates for each date.
 * Missing snapshot for a day → null per product that day; missing chat → null for rates.
 */
export async function loadEmailTrendSeries(dates: string[]): Promise<{
  labels: string[];
  /** Percent 0–100 per product per day (null only if no row for that product/day; 0 prospects → 0%). */
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

  const labels: string[] = [...SERVICE_OVERVIEW_PRODUCT_LABELS];

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
        conversionRatePctByLabel.get(lb)!.push(r !== undefined ? rowConversionRatePercent(r) : null);
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
