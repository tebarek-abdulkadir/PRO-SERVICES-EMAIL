import { NextResponse } from 'next/server';
import { getChatTrendData } from '@/lib/chat-storage';
import type { ChatTrendData } from '@/lib/chat-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/chat-analysis/trends
 * Query params: 
 *   - endDate: YYYY-MM-DD (optional, defaults to today)
 *   - days: number (optional, will be calculated from 1st of current month if not provided)
 * 
 * Returns trend data for frustration and confusion over time
 * Date range goes back to max 1st of the current month
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const endDateParam = searchParams.get('endDate');
    const daysParam = searchParams.get('days');
    
    // Default to today if no endDate provided
    const endDate = endDateParam || new Date().toISOString().split('T')[0];
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      }, { status: 400 });
    }
    
    // Parse days parameter if provided (for backward compatibility)
    const days = daysParam ? parseInt(daysParam, 10) : undefined;
    
    if (daysParam && (isNaN(days!) || days! < 1 || days! > 90)) {
      return NextResponse.json({
        success: false,
        error: 'Days must be a number between 1 and 90'
      }, { status: 400 });
    }
    
    // Fetch trend data (will automatically calculate from 1st of current month if days not provided)
    const trendData = await getChatTrendData(endDate, days);
    
    return NextResponse.json({
      success: true,
      data: trendData,
      count: trendData.length,
      endDate,
      days: days || 'auto (from 1st of current month)'
    });
    
  } catch (error) {
    console.error('[Chat Trends API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

