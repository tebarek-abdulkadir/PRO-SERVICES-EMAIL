import { NextResponse } from 'next/server';
import { withAgentsDelayResponseTimeOnMtd } from '@/lib/agent-delay-mtd';
import { enrichChatAnalysisData } from '@/lib/chat-analysis-enrich';
import { createEmptyByConversationViewData } from '@/lib/chat-by-conversation-metrics';
import { getDailyChatAnalysisData } from '@/lib/chat-storage';
import { getByConversationMtdSnapshot, saveByConversationMtdSnapshot } from '@/lib/chat-by-conversation-mtd-storage';
import type { ByConversationMtdSnapshot } from '@/lib/chat-by-conversation-mtd';
import {
  buildNextByConversationMtdSnapshot,
  consumerSliceFromMetrics,
  initiatorRowFromMetrics,
} from '@/lib/chat-by-conversation-mtd';

function isValidDate(d: string | null | undefined): d is string {
  return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function previousDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

async function buildForDate(date: string): Promise<{ snapshot: unknown } | { error: string; status: number }> {
  const chat = await getDailyChatAnalysisData(date);
  if (!chat) return { error: `No daily chat analysis for ${date}`, status: 404 };
  const enriched = enrichChatAnalysisData(chat);
  const byConv = enriched.byConversationView ?? chat.byConversationView ?? createEmptyByConversationViewData();

  const prev = await getByConversationMtdSnapshot(previousDate(date));
  const snap = buildNextByConversationMtdSnapshot({
    date,
    prev,
    consumerDaily: consumerSliceFromMetrics(byConv.consumerInitiated),
    clientDaily: initiatorRowFromMetrics(byConv.consumerInitiated),
    agentDaily: initiatorRowFromMetrics(byConv.agentInitiated),
    sourceLastUpdated: (chat as any).lastUpdated,
  });
  await saveByConversationMtdSnapshot(snap);
  return { snapshot: snap };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!isValidDate(date)) {
    return NextResponse.json({ success: false, error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }
  const raw = await getByConversationMtdSnapshot(date);
  const snap = raw ? await withAgentsDelayResponseTimeOnMtd(raw, date) : null;
  return NextResponse.json({ success: true, snapshot: snap });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    date?: string;
    startDate?: string;
    endDate?: string;
  };

  const date = body.date;
  const startDate = body.startDate;
  const endDate = body.endDate;

  if (isValidDate(date)) {
    const r = await buildForDate(date);
    if ('error' in r) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
    const snapshot = await withAgentsDelayResponseTimeOnMtd(r.snapshot as ByConversationMtdSnapshot, date);
    return NextResponse.json({ success: true, snapshot });
  }

  if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
    return NextResponse.json(
      { success: false, error: 'Provide either {date} or {startDate,endDate} (YYYY-MM-DD), startDate <= endDate' },
      { status: 400 }
    );
  }

  const snapshots: unknown[] = [];
  for (let cur = startDate; cur <= endDate; ) {
    const r = await buildForDate(cur);
    if ('error' in r) {
      return NextResponse.json({ success: false, error: r.error, failedDate: cur }, { status: r.status });
    }
    snapshots.push(await withAgentsDelayResponseTimeOnMtd(r.snapshot as ByConversationMtdSnapshot, cur));
    // next day
    const [y, m, d] = cur.split('-').map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d));
    utc.setUTCDate(utc.getUTCDate() + 1);
    cur = utc.toISOString().slice(0, 10);
  }

  return NextResponse.json({ success: true, snapshotsCount: snapshots.length });
}

