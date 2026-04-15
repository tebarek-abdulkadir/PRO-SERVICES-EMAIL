import { NextResponse } from 'next/server';
import { processDelayTimeRecords, processAgentResponseTimeRecords, saveDelayTimeData, getLatestDelayTimeData, dedupeAgentStatsForDay } from '@/lib/chat-storage';
import type { DelayTimeRequest, DelayTimeResponse } from '@/lib/chat-types';
import { list } from '@vercel/blob';

/**
 * API Endpoint: /api/delay-time
 * POST: Ingest daily agent delay time data
 * GET: Retrieve latest delay time data
 */

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json();
    let body: DelayTimeRequest;

    if (Array.isArray(raw)) {
      if (raw.length === 0 || raw[0] == null || typeof raw[0] !== 'object') {
        return NextResponse.json<DelayTimeResponse>(
          {
            success: false,
            message: 'Invalid request format',
            error: 'When sending an array, provide a single object with analysisDate and records',
          },
          { status: 400 }
        );
      }
      body = raw[0] as DelayTimeRequest;
    } else if (raw && typeof raw === 'object') {
      body = raw as DelayTimeRequest;
    } else {
      return NextResponse.json<DelayTimeResponse>(
        {
          success: false,
          message: 'Invalid request format',
          error: 'Request body must be a JSON object or a one-element array',
        },
        { status: 400 }
      );
    }

    // Validate request
    if (!body.records || !Array.isArray(body.records)) {
      return NextResponse.json<DelayTimeResponse>({
        success: false,
        message: 'Invalid request format',
        error: 'records array is required',
      }, { status: 400 });
    }

    let analysisDate = body.analysisDate;

    // Validate that records have the expected format (new format with REPORT_DATE, AGENT_FULL_NAME, AVG_ADJUSTED_RESPONSE_TIME)
    if (body.records.length > 0) {
      const firstRecord = body.records[0];
      if ('REPORT_DATE' in firstRecord && 'AGENT_FULL_NAME' in firstRecord && 'AVG_ADJUSTED_RESPONSE_TIME' in firstRecord) {
        // New format: per-agent response time data
        // Extract analysisDate from REPORT_DATE if not provided
        if (!analysisDate && firstRecord.REPORT_DATE) {
          analysisDate = firstRecord.REPORT_DATE;
        }
        
        if (!analysisDate) {
          return NextResponse.json<DelayTimeResponse>({
            success: false,
            message: 'Invalid request format',
            error: 'analysisDate is required (can be provided in body or extracted from REPORT_DATE)',
          }, { status: 400 });
        }

        const delayTimeData = processAgentResponseTimeRecords(body.records, analysisDate);
        await saveDelayTimeData(delayTimeData);
      } else if ('agentFullName' in firstRecord && 'avgDelayDdHhMmSs' in firstRecord) {
        // Legacy format: delay time records
        if (!analysisDate) {
          return NextResponse.json<DelayTimeResponse>({
            success: false,
            message: 'Invalid request format',
            error: 'analysisDate is required for legacy format',
          }, { status: 400 });
        }
        const delayTimeData = processDelayTimeRecords(body.records as any, analysisDate);
        await saveDelayTimeData(delayTimeData);
      } else {
        return NextResponse.json<DelayTimeResponse>({
          success: false,
          message: 'Invalid request format',
          error: 'Records must have REPORT_DATE, AGENT_FULL_NAME, and AVG_ADJUSTED_RESPONSE_TIME fields',
        }, { status: 400 });
      }
    } else {
      return NextResponse.json<DelayTimeResponse>({
        success: false,
        message: 'Invalid request format',
        error: 'Records array cannot be empty',
      }, { status: 400 });
    }
    
    return NextResponse.json<DelayTimeResponse>({
      success: true,
      message: 'Delay time data ingested successfully',
      data: {
        analysisId: `delay-${analysisDate}`,
        processedRecords: body.records.length,
        analysisDate: analysisDate!,
      },
    });
  } catch (error) {
    console.error('Error processing delay time data:', error);
    return NextResponse.json<DelayTimeResponse>({
      success: false,
      message: 'Failed to process delay time data',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    let delayData;
    
    if (date) {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid date format. Use YYYY-MM-DD' 
          },
          { status: 400 }
        );
      }
      
      // Fetch specific date using list + fetch pattern
      try {
        const { blobs } = await list({
          prefix: `delay-time/daily/${date}.json`,
        });

        if (blobs.length === 0) {
          delayData = null;
        } else {
          const response = await fetch(blobs[0].url);
          if (response.ok) {
            delayData = await response.json();
          } else {
            delayData = null;
          }
        }
      } catch (error) {
        console.error(`Error fetching delay time data for ${date}:`, error);
        delayData = null;
      }
    } else {
      delayData = await getLatestDelayTimeData();
    }
    
    if (!delayData) {
      return NextResponse.json({
        success: true,
        data: null,
        message: date ? `No delay time data available for ${date}` : 'No delay time data available yet',
      });
    }

    if (delayData.agentStats?.length) {
      delayData = {
        ...delayData,
        agentStats: dedupeAgentStatsForDay(delayData.agentStats),
      };
    }

    return NextResponse.json({
      success: true,
      data: delayData,
    });
  } catch (error) {
    console.error('Error fetching delay time data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch delay time data',
    }, { status: 500 });
  }
}

