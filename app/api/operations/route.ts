import { NextResponse } from 'next/server';
import { storeDailyOperations, getDailyOperations } from '@/lib/operations-storage';
import type { OperationsData, OperationsResponse } from '@/lib/operations-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function verifyIngestApiKey(request: Request): boolean {
  const validKey = process.env.INGEST_API_KEY;
  if (!validKey) {
    console.warn('[Operations API] INGEST_API_KEY not set, rejecting ingest requests');
    return false;
  }
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  return token === validKey;
}

/**
 * POST /api/operations — ingest daily operations metrics into blob `operations/{YYYY-MM-DD}.json`
 * (same payload as POST /api/ingest/operations). Requires Authorization: Bearer <INGEST_API_KEY>.
 *
 * GET /api/operations?date=YYYY-MM-DD — read stored operations JSON for that day (no ingest key in handler;
 * use dashboard session or Bearer INGEST via middleware bypass).
 */
export async function POST(request: Request) {
  try {
    if (!verifyIngestApiKey(request)) {
      const response: OperationsResponse = {
        success: false,
        message: 'Unauthorized',
        error: 'Invalid or missing API key',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const body = await request.json();

    if (!body.analysisDate) {
      const response: OperationsResponse = {
        success: false,
        message: 'Missing required field: analysisDate',
        error: 'analysisDate is required in YYYY-MM-DD format',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.analysisDate)) {
      const response: OperationsResponse = {
        success: false,
        message: 'Invalid date format',
        error: 'analysisDate must be in YYYY-MM-DD format',
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!Array.isArray(body.operations)) {
      const response: OperationsResponse = {
        success: false,
        message: 'Invalid data format',
        error: 'operations must be an array',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const operationsData: OperationsData = {
      lastUpdated: new Date().toISOString(),
      analysisDate: body.analysisDate,
      operations: body.operations,
    };

    const storeResult = await storeDailyOperations(body.analysisDate, operationsData);

    if (!storeResult.success) {
      const response: OperationsResponse = {
        success: false,
        message: storeResult.message,
        error: storeResult.error,
      };
      return NextResponse.json(response, { status: 500 });
    }

    const response: OperationsResponse = {
      success: true,
      message: 'Operations data ingested successfully',
      data: operationsData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Operations API] POST error:', error);
    const response: OperationsResponse = {
      success: false,
      message: 'Failed to ingest operations data',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        {
          success: false,
          error: 'date query parameter is required (YYYY-MM-DD)',
        },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const result = await getDailyOperations(date);
    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('[Operations API] GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
