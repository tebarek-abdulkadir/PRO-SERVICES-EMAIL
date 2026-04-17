import { getDailyDelayTimeData } from '@/lib/chat-storage';
import { mtdDateRange } from '@/lib/email-report-periods';
import type { ByConversationMtdSnapshot } from '@/lib/chat-by-conversation-mtd';

/** Same source as Agents dashboard → Daily Avg Response Time (`delay-time` daily blob). */
export async function getAgentsDailyAverageDelaySecondsForDate(date: string): Promise<number | null> {
  const d = await getDailyDelayTimeData(date);
  const s = d?.dailyAverageDelaySeconds;
  if (s == null || typeof s !== 'number' || Number.isNaN(s)) return null;
  return s;
}

/**
 * MTD average of daily Agents delay seconds (month start through report date).
 * Reads are **sequential** (not Promise.all) to avoid Vercel Blob "too many concurrent requests" errors.
 */
export async function getAgentsMtdAverageDelaySeconds(reportDate: string): Promise<number | null> {
  const { mtdAverage } = await getAgentsMtdAverageAndTodaySeconds(reportDate);
  return mtdAverage;
}

/**
 * One sequential pass over the MTD date range: computes MTD mean delay and today's delay
 * (avoids duplicate fetch for `reportDate` and avoids concurrent Blob storms).
 */
export async function getAgentsMtdAverageAndTodaySeconds(
  reportDate: string
): Promise<{ mtdAverage: number | null; todaySeconds: number | null }> {
  const dates = mtdDateRange(reportDate);
  const values: number[] = [];
  let todaySeconds: number | null = null;

  for (const dt of dates) {
    const sec = await getAgentsDailyAverageDelaySecondsForDate(dt);
    if (dt === reportDate) todaySeconds = sec;
    if (sec != null && !Number.isNaN(sec)) values.push(sec);
  }

  if (values.length === 0) {
    return { mtdAverage: null, todaySeconds };
  }
  const mtdAverage =
    Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000;
  return { mtdAverage, todaySeconds };
}

export function applyAgentsMtdDelaySecondsToSnapshot(
  snap: ByConversationMtdSnapshot,
  mtdSec: number | null
): ByConversationMtdSnapshot {
  if (!snap.mtd) return snap;
  return {
    ...snap,
    mtd: {
      ...snap.mtd,
      clientInitiatedMtd: {
        ...snap.mtd.clientInitiatedMtd,
        averageAgentResponseTimeSeconds: mtdSec,
      },
      agentInitiatedMtd: {
        ...snap.mtd.agentInitiatedMtd,
        averageAgentResponseTimeSeconds: mtdSec,
      },
    },
  };
}

/**
 * MTD snapshot rows store chat-derived Avg Agent RT; for display/email we replace with
 * Agent Performance (delay-time) metrics so Chats MTD matches the Agents tab.
 */
export async function withAgentsDelayResponseTimeOnMtd(
  snap: ByConversationMtdSnapshot,
  reportDate: string
): Promise<ByConversationMtdSnapshot> {
  const { mtdAverage } = await getAgentsMtdAverageAndTodaySeconds(reportDate);
  return applyAgentsMtdDelaySecondsToSnapshot(snap, mtdAverage);
}
