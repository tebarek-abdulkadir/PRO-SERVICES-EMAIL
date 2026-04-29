import { NextRequest, NextResponse } from 'next/server';
import { storeDailyComplaints, getDailyComplaints } from '@/lib/daily-complaints-storage';
import type { PnLComplaint } from '@/lib/pnl-complaints-types';

interface ComplaintRequest {
  date: string; // YYYY-MM-DD
  summary?: Array<{
    COMPLAINT_TYPE?: string;
    complaint_type?: string;
    YESTERDAY?: number;
    THIS_MONTH?: number;
    LAST_MONTH?: number;
  }>;
  complaints: Array<{
    contractId?: string;
    CONTRACT_ID?: string;
    housemaidId?: string;
    HOUSEMAID_ID?: string;
    clientId?: string;
    CLIENT_ID?: string;
    complaintType?: string;
    COMPLAINT_TYPE?: string;
    creationDate?: string;
    CREATION_DATE?: string;
  }>;
}

// Normalize complaint field names
function normalizeComplaint(raw: ComplaintRequest['complaints'][0]): PnLComplaint {
  return {
    contractId: raw.contractId || raw.CONTRACT_ID || '',
    housemaidId: raw.housemaidId || raw.HOUSEMAID_ID || '',
    clientId: raw.clientId || raw.CLIENT_ID || '',
    complaintType: raw.complaintType || raw.COMPLAINT_TYPE || '',
    creationDate: raw.creationDate || raw.CREATION_DATE || '',
  };
}

/**
 * POST /api/complaints-daily
 * Store complaints data for a specific date
 */
export async function POST(request: NextRequest) {
  try {
    const body: ComplaintRequest = await request.json();
    
    if (!body.date) {
      return NextResponse.json(
        {
          success: false,
          error: 'date is required (format: YYYY-MM-DD)',
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.complaints)) {
      return NextResponse.json(
        {
          success: false,
          error: 'complaints must be an array (use [] when sending summary-only)',
        },
        { status: 400 }
      );
    }

    // Normalize all complaints
    const complaints = body.complaints.map(normalizeComplaint);
    const summary = 'summary' in body ? body.summary : undefined;

    const result = await storeDailyComplaints(body.date, complaints, true, summary);
    
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error('Error in complaints-daily POST:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to process request',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/complaints-daily?date=YYYY-MM-DD
 * Retrieve complaints data for a specific date
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        {
          success: false,
          error: 'date parameter is required (format: YYYY-MM-DD)',
        },
        { status: 400 }
      );
    }

    const result = await getDailyComplaints(date);
    
    return NextResponse.json(result, {
      status: result.success ? 200 : 404,
    });
  } catch (error) {
    console.error('Error in complaints-daily GET:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

