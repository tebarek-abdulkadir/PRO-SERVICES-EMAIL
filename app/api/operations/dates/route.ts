import { NextResponse } from 'next/server';
import { getAvailableOperationsDates } from '@/lib/operations-storage';

export const runtime = 'nodejs';

/**
 * GET /api/operations/dates — list YYYY-MM-DD keys that have operations/{date}.json in blob storage.
 */
export async function GET() {
  const result = await getAvailableOperationsDates();
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || 'Failed to list dates', dates: [] },
      { status: 500 }
    );
  }
  return NextResponse.json({
    success: true,
    dates: result.dates ?? [],
    count: result.dates?.length ?? 0,
  });
}
