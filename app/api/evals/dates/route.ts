import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * GET /api/evals/dates — list YYYY-MM-DD keys that have evals/daily/{date}.json in blob (or local data/evals in dev).
 */
export async function GET() {
  try {
    const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

    if (hasBlobToken) {
      const { blobs } = await list({ prefix: 'evals/' });
      const dates = blobs
        .filter((b) => b.pathname.includes('/daily/'))
        .map((b) => {
          const m = b.pathname.match(/evals\/daily\/(\d{4}-\d{2}-\d{2})\.json$/);
          return m ? m[1] : null;
        })
        .filter((d): d is string => d !== null)
        .sort();

      return NextResponse.json({
        success: true,
        dates,
        count: dates.length,
        environment: 'production',
      });
    }

    const localDataPath = join(process.cwd(), 'data', 'evals');
    let dates: string[] = [];
    if (existsSync(localDataPath)) {
      try {
        dates = readdirSync(localDataPath)
          .filter((f) => f.endsWith('.json'))
          .map((f) => f.replace('.json', ''))
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
          .sort();
      } catch (err) {
        console.error('[Evals Dates] local read:', err);
      }
    }

    return NextResponse.json({
      success: true,
      dates,
      count: dates.length,
      environment: 'development',
      message:
        'No BLOB_READ_WRITE_TOKEN: listing local data/evals only. Deploy with blob token for production paths.',
    });
  } catch (error) {
    console.error('[Evals Dates API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch available dates',
        dates: [],
        errorDetails: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
