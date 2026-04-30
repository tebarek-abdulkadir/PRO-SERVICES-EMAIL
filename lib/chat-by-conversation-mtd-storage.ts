import { put } from '@vercel/blob';
import type { ByConversationMtdSnapshot } from '@/lib/chat-by-conversation-mtd';
import { PUBLIC_JSON_PUT_OPTIONS, resolveBlobReadUrl } from '@/lib/vercel-blob-json';

const PREFIX = 'chat-analysis/by-conversation-mtd';

function keyForDate(date: string): string {
  return `${PREFIX}/${date}.json`;
}

export async function getByConversationMtdSnapshot(date: string): Promise<ByConversationMtdSnapshot | null> {
  try {
    const pathname = keyForDate(date);
    const url = await resolveBlobReadUrl(pathname);
    if (!url) return null;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ByConversationMtdSnapshot;
  } catch (error) {
    console.error(`[ByConversation MTD] Error reading ${date}:`, error);
    return null;
  }
}

export async function saveByConversationMtdSnapshot(snapshot: ByConversationMtdSnapshot): Promise<void> {
  const blobKey = keyForDate(snapshot.date);
  await put(blobKey, JSON.stringify(snapshot), PUBLIC_JSON_PUT_OPTIONS);
}
