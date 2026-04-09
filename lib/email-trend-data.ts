import { getDailyChatAnalysisData } from '@/lib/chat-storage';
import type { ServiceOverviewRow } from '@/lib/email-report-layout';
import { tryLoadServiceOverviewForDate } from '@/lib/email-report-periods';

function rowSalesTotal(r: ServiceOverviewRow): number {
  return r.salesCc + r.salesMv;
}

/**
 * Load daily conversions per service line and chat rates for each date.
 * Missing prospect days → null for all products that day; missing chat → null for rates.
 */
export async function loadEmailTrendSeries(dates: string[]): Promise<{
  labels: string[];
  conversionByLabel: Map<string, (number | null)[]>;
  frustration: (number | null)[];
  confusion: (number | null)[];
}> {
  if (dates.length === 0) {
    return {
      labels: [],
      conversionByLabel: new Map(),
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

  const conversionByLabel = new Map<string, (number | null)[]>();
  for (const lb of labels) {
    conversionByLabel.set(lb, []);
  }

  const frustration: (number | null)[] = [];
  const confusion: (number | null)[] = [];

  for (let i = 0; i < snapshots.length; i++) {
    const { rows, chat } = snapshots[i];

    if (!rows) {
      for (const lb of labels) {
        conversionByLabel.get(lb)!.push(null);
      }
    } else {
      const byL = new Map(rows.map((r) => [r.label, r] as const));
      for (const lb of labels) {
        const r = byL.get(lb);
        conversionByLabel.get(lb)!.push(r ? rowSalesTotal(r) : null);
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

  return { labels, conversionByLabel, frustration, confusion };
}
