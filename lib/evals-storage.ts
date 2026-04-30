import { head, list, put } from '@vercel/blob';
import type { EvalsDaySummary } from './evals-summary';

const EVALS_BLOB_PREFIX = 'evals';

export type EvalsDayDocument = Record<string, unknown> & {
  lastUpdated: string;
  evalDate: string;
  summary?: EvalsDaySummary;
};

/**
 * Save one JSON document per calendar day under evals/daily/{evalDate}.json
 * and mirror to evals/latest.json (same pattern as chat-analysis / delay-time).
 */
const putJsonOpts = {
  access: 'public' as const,
  contentType: 'application/json',
  addRandomSuffix: false,
  allowOverwrite: true,
  /** Min allowed by Vercel Blob; reduces stale CDN reads of public JSON. */
  cacheControlMaxAge: 120,
};

export async function saveDailyEvalsData(doc: EvalsDayDocument): Promise<void> {
  const dateBlobName = `${EVALS_BLOB_PREFIX}/daily/${doc.evalDate}.json`;
  const body = JSON.stringify(doc, null, 2);

  await put(dateBlobName, body, putJsonOpts);

  const latestBlobName = `${EVALS_BLOB_PREFIX}/latest.json`;
  await put(latestBlobName, body, putJsonOpts);
}

async function resolveBlobUrl(pathname: string): Promise<string | null> {
  try {
    const meta = await head(pathname);
    return meta.url;
  } catch {
    const { blobs } = await list({ prefix: pathname, limit: 50 });
    const exact = blobs.filter((b) => b.pathname === pathname);
    if (exact.length === 0) return null;
    exact.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return exact[0].url;
  }
}

export async function getLatestEvalsData(): Promise<EvalsDayDocument | null> {
  try {
    const pathname = `${EVALS_BLOB_PREFIX}/latest.json`;
    const blobUrl = await resolveBlobUrl(pathname);
    if (!blobUrl) return null;
    const response = await fetch(blobUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as EvalsDayDocument;
  } catch (e) {
    console.error('[Evals Storage] getLatestEvalsData:', e);
    return null;
  }
}

export async function getDailyEvalsData(date: string): Promise<EvalsDayDocument | null> {
  try {
    const pathname = `${EVALS_BLOB_PREFIX}/daily/${date}.json`;
    const blobUrl = await resolveBlobUrl(pathname);
    if (!blobUrl) return null;
    const response = await fetch(blobUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as EvalsDayDocument;
  } catch (e) {
    console.error('[Evals Storage] getDailyEvalsData:', e);
    return null;
  }
}
