import { put, list, del } from '@vercel/blob';
import type { ByConversationMtdSnapshot } from '@/lib/chat-by-conversation-mtd';

const PREFIX = 'chat-analysis/by-conversation-mtd';

function keyForDate(date: string): string {
  return `${PREFIX}/${date}.json`;
}

export async function getByConversationMtdSnapshot(date: string): Promise<ByConversationMtdSnapshot | null> {
  try {
    const { blobs } = await list({ prefix: keyForDate(date), limit: 1 });
    if (blobs.length === 0) return null;
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ByConversationMtdSnapshot;
  } catch (error) {
    console.error(`[ByConversation MTD] Error reading ${date}:`, error);
    return null;
  }
}

export async function saveByConversationMtdSnapshot(snapshot: ByConversationMtdSnapshot): Promise<void> {
  const blobKey = keyForDate(snapshot.date);
  try {
    const { blobs } = await list({ prefix: blobKey, limit: 1 });
    if (blobs.length > 0) {
      await del(blobs[0].url);
    }
  } catch {
    // ignore
  }
  await put(blobKey, JSON.stringify(snapshot), { access: 'public', contentType: 'application/json' });
}

