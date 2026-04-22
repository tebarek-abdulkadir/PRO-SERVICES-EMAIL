import { put, list, del } from '@vercel/blob';

const EVALS_BLOB_PREFIX = 'evals';

export type EvalsDayDocument = Record<string, unknown> & {
  lastUpdated: string;
  evalDate: string;
};

/**
 * Save one JSON document per calendar day under evals/daily/{evalDate}.json
 * and mirror to evals/latest.json (same pattern as chat-analysis / delay-time).
 */
export async function saveDailyEvalsData(doc: EvalsDayDocument): Promise<void> {
  const dateBlobName = `${EVALS_BLOB_PREFIX}/daily/${doc.evalDate}.json`;

  try {
    const { blobs } = await list({ prefix: dateBlobName });
    if (blobs.length > 0) {
      await del(blobs[0].url);
    }
  } catch {
    // ignore if missing
  }

  await put(dateBlobName, JSON.stringify(doc, null, 2), {
    access: 'public',
    contentType: 'application/json',
  });

  const latestBlobName = `${EVALS_BLOB_PREFIX}/latest.json`;
  try {
    const { blobs } = await list({ prefix: latestBlobName });
    if (blobs.length > 0) {
      await del(blobs[0].url);
    }
  } catch {
    // ignore
  }

  await put(latestBlobName, JSON.stringify(doc, null, 2), {
    access: 'public',
    contentType: 'application/json',
  });
}

export async function getLatestEvalsData(): Promise<EvalsDayDocument | null> {
  try {
    const { blobs } = await list({ prefix: `${EVALS_BLOB_PREFIX}/latest.json` });
    if (blobs.length === 0) return null;
    const response = await fetch(blobs[0].url);
    if (!response.ok) return null;
    return (await response.json()) as EvalsDayDocument;
  } catch (e) {
    console.error('[Evals Storage] getLatestEvalsData:', e);
    return null;
  }
}

export async function getDailyEvalsData(date: string): Promise<EvalsDayDocument | null> {
  try {
    const { blobs } = await list({ prefix: `${EVALS_BLOB_PREFIX}/daily/${date}.json` });
    if (blobs.length === 0) return null;
    const response = await fetch(blobs[0].url);
    if (!response.ok) return null;
    return (await response.json()) as EvalsDayDocument;
  } catch (e) {
    console.error('[Evals Storage] getDailyEvalsData:', e);
    return null;
  }
}
