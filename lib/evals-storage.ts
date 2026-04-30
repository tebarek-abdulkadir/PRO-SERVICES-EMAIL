import { put } from '@vercel/blob';
import type { EvalsDaySummary } from './evals-summary';
import { PUBLIC_JSON_PUT_OPTIONS, resolveBlobReadUrl } from '@/lib/vercel-blob-json';

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
export async function saveDailyEvalsData(doc: EvalsDayDocument): Promise<void> {
  const dateBlobName = `${EVALS_BLOB_PREFIX}/daily/${doc.evalDate}.json`;
  const body = JSON.stringify(doc, null, 2);

  await put(dateBlobName, body, PUBLIC_JSON_PUT_OPTIONS);

  const latestBlobName = `${EVALS_BLOB_PREFIX}/latest.json`;
  await put(latestBlobName, body, PUBLIC_JSON_PUT_OPTIONS);
}

export async function getLatestEvalsData(): Promise<EvalsDayDocument | null> {
  try {
    const pathname = `${EVALS_BLOB_PREFIX}/latest.json`;
    const blobUrl = await resolveBlobReadUrl(pathname);
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
    const blobUrl = await resolveBlobReadUrl(pathname);
    if (!blobUrl) return null;
    const response = await fetch(blobUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as EvalsDayDocument;
  } catch (e) {
    console.error('[Evals Storage] getDailyEvalsData:', e);
    return null;
  }
}
