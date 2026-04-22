import { NextResponse } from 'next/server';
import { getDailyEvalsData, getLatestEvalsData, saveDailyEvalsData, type EvalsDayDocument } from '@/lib/evals-storage';
import { attachEvalsSummaryIfMissing, computeEvalsSummary } from '@/lib/evals-summary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function verifyApiKey(request: Request): boolean {
  const validKey = process.env.INGEST_API_KEY;
  if (!validKey) {
    console.warn('[Evals] INGEST_API_KEY not set, rejecting ingest requests');
    return false;
  }
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  return token === validKey;
}

/**
 * POST /api/evals — store arbitrary JSON for a day (n8n / automation).
 *
 * Body: any JSON object. Optional top-level fields:
 *   - evalDate or analysisDate: YYYY-MM-DD (defaults to UTC calendar day of request)
 *
 * Stored document always includes:
 *   - lastUpdated: ISO timestamp
 *   - evalDate: YYYY-MM-DD (blob path evals/daily/{evalDate}.json)
 *
 * Header: Authorization: Bearer <INGEST_API_KEY>
 *
 * GET /api/evals?date=YYYY-MM-DD — fetch day (omit date for latest)
 */
export async function POST(request: Request) {
  try {
    if (!verifyApiKey(request)) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid request', error: 'Body must be JSON' },
        { status: 400 }
      );
    }

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: 'Invalid request', error: 'Body must be a JSON object' },
        { status: 400 }
      );
    }

    const rawDate = body.evalDate ?? body.analysisDate;
    const evalDate =
      typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : new Date().toISOString().split('T')[0];

    if (typeof rawDate === 'string' && rawDate !== evalDate) {
      return NextResponse.json(
        { success: false, message: 'Invalid request', error: 'evalDate / analysisDate must be YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const { evalDate: _ed, analysisDate: _ad, lastUpdated: _lu, summary: _clientSummary, ...rest } = body;
    const lastUpdated = new Date().toISOString();
    let doc: EvalsDayDocument = {
      ...rest,
      lastUpdated,
      evalDate,
    };

    if (Array.isArray(doc.conversations)) {
      doc = {
        ...doc,
        summary: computeEvalsSummary(doc.conversations as unknown[]),
      };
    }

    await saveDailyEvalsData(doc);

    return NextResponse.json({
      success: true,
      message: 'Evals data saved successfully',
      data: { evalDate, blobPath: `evals/daily/${evalDate}.json` },
    });
  } catch (error) {
    console.error('[Evals API] POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    let data: EvalsDayDocument | null;
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
      data = await getDailyEvalsData(date);
    } else {
      data = await getLatestEvalsData();
    }

    const payload = data
      ? (attachEvalsSummaryIfMissing(data as Record<string, unknown>) as EvalsDayDocument)
      : null;

    return NextResponse.json(
      { success: true, data: payload as EvalsDayDocument | null },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('[Evals API] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch evals data' }, { status: 500 });
  }
}
