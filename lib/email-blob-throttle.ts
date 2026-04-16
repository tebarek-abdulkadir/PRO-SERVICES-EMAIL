/**
 * Spaces Vercel Blob operations during the daily email build so list/fetch bursts
 * stay under rate limits. Tune with env (milliseconds; 0 = no pause).
 */

const DEFAULT_EMAIL_GAP_MS = 400;
const DEFAULT_COMPLAINTS_GAP_MS = 120;

function parseGapMs(envVal: string | undefined, fallback: number): number {
  if (envVal === undefined || envVal === '') return fallback;
  const n = Number(envVal);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Pause after each Blob-backed step while building the email (default 400ms). */
export async function pauseForEmailBlobThrottle(): Promise<void> {
  const ms = parseGapMs(process.env.BLOB_EMAIL_GAP_MS, DEFAULT_EMAIL_GAP_MS);
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

/** Pause between sequential complaint daily fetches (default 120ms). */
export async function pauseBetweenComplaintBlobFetches(): Promise<void> {
  const ms = parseGapMs(process.env.BLOB_COMPLAINTS_GAP_MS, DEFAULT_COMPLAINTS_GAP_MS);
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}
