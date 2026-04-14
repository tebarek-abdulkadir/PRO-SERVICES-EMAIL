/**
 * Parse and format agentResponseTime from ingest (e.g. "0 02:15:30" = days + HH:MM:SS, or "02:15:30").
 * Averages use total seconds; display uses the same string shape.
 */

export function parseAgentResponseTimeToSeconds(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const withDays = /^(\d+)\s+(\d{1,2}):(\d{2}):(\d{2})$/.exec(s);
  if (withDays) {
    const days = parseInt(withDays[1], 10);
    const h = parseInt(withDays[2], 10);
    const m = parseInt(withDays[3], 10);
    const sec = parseInt(withDays[4], 10);
    if ([days, h, m, sec].some((n) => Number.isNaN(n))) return null;
    return days * 86400 + h * 3600 + m * 60 + sec;
  }

  const timeOnly = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(s);
  if (timeOnly) {
    const h = parseInt(timeOnly[1], 10);
    const m = parseInt(timeOnly[2], 10);
    const sec = parseInt(timeOnly[3], 10);
    if ([h, m, sec].some((n) => Number.isNaN(n))) return null;
    return h * 3600 + m * 60 + sec;
  }

  return null;
}

/** Format total seconds as `D HH:MM:SS` (days + 24h time). */
export function formatSecondsAsAgentResponseTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0 00:00:00';
  const days = Math.floor(totalSeconds / 86400);
  let rem = totalSeconds % 86400;
  const h = Math.floor(rem / 3600);
  rem %= 3600;
  const m = Math.floor(rem / 60);
  const sec = Math.floor(rem % 60);
  return `${days} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatAverageAgentResponseTimeDisplay(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  return formatSecondsAsAgentResponseTime(seconds);
}

export function normalizeUnresponsive(v: unknown): 0 | 1 {
  if (v === true || v === 1 || v === '1') return 1;
  return 0;
}
