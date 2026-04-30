import { head, list } from '@vercel/blob';

/** Stable JSON blobs: fixed pathname, safe overwrites, short public cache. */
export const PUBLIC_JSON_PUT_OPTIONS = {
  access: 'public' as const,
  contentType: 'application/json',
  addRandomSuffix: false,
  allowOverwrite: true,
  cacheControlMaxAge: 120,
};

/**
 * Public read URL for an exact pathname: try head(), else list exact pathname matches (newest first).
 * Avoids relying on list() order when multiple keys share a prefix.
 */
export async function resolveBlobReadUrl(pathname: string): Promise<string | null> {
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
