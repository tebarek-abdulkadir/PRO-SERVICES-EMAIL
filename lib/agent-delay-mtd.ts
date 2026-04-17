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

/** MTD average of daily Agents delay seconds (month start through report date); omits days with no delay blob. */
export async function getAgentsMtdAverageDelaySeconds(reportDate: string): Promise<number | null> {
  const dates = mtdDateRange(reportDate);
  const values = await Promise.all(dates.map((dt) => getAgentsDailyAverageDelaySecondsForDate(dt)));
  const nums = values.filter((x): x is number => x != null && !Number.isNaN(x));
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1000) / 1000;
}

/**
 * MTD snapshot rows store chat-derived Avg Agent RT; for display/email we replace with
 * Agent Performance (delay-time) metrics so Chats MTD matches the Agents tab.
 */
export async function withAgentsDelayResponseTimeOnMtd(
  snap: ByConversationMtdSnapshot,
  reportDate: string
): Promise<ByConversationMtdSnapshot> {
  const mtdSec = await getAgentsMtdAverageDelaySeconds(reportDate);
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
