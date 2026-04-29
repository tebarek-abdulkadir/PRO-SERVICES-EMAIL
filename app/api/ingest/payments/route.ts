import { NextRequest, NextResponse } from 'next/server';
import { processPayments, savePaymentData } from '@/lib/payment-processor';
import { RawPayment } from '@/lib/payment-types';

/**
 * POST /api/ingest/payments
 * Accepts payment data and stores it in blob storage
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.payments || !Array.isArray(body.payments)) {
      return NextResponse.json(
        { success: false, message: 'Invalid request: payments array is required' },
        { status: 400 }
      );
    }
    
    const rawPayments: RawPayment[] = body.payments;
    
    if (rawPayments.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No payments provided' },
        { status: 400 }
      );
    }
    
    console.log(`Processing ${rawPayments.length} raw payments...`);
    
    // Process and deduplicate payments
    const processedPayments = processPayments(rawPayments);
    
    console.log(`Processed ${processedPayments.length} unique payments`);
    
    // Save to blob storage
    await savePaymentData(processedPayments);
    
    // Breakdown by service
    const breakdown = {
      oec: processedPayments.filter(p => p.service === 'oec' && p.status === 'received').length,
      owwa: processedPayments.filter(p => p.service === 'owwa' && p.status === 'received').length,
      ttl: processedPayments.filter(p => p.service === 'ttl' && p.status === 'received').length,
      tte: processedPayments.filter(p => p.service === 'tte' && p.status === 'received').length,
      ttj: processedPayments.filter(p => p.service === 'ttj' && p.status === 'received').length,
      visaSaudi: processedPayments.filter(p => p.service === 'visaSaudi' && p.status === 'received').length,
      schengen: processedPayments.filter(p => p.service === 'schengen' && p.status === 'received').length,
      gcc: processedPayments.filter(p => p.service === 'gcc' && p.status === 'received').length,
      filipina_pp: processedPayments.filter(p => p.service === 'filipina_pp' && p.status === 'received').length,
      ethiopian_pp: processedPayments.filter(p => p.service === 'ethiopian_pp' && p.status === 'received').length,
      other: processedPayments.filter(p => p.service === 'other').length,
      received: processedPayments.filter(p => p.status === 'received').length,
      total: processedPayments.length,
    };
    
    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedPayments.length} payments`,
      data: {
        totalPayments: processedPayments.length,
        breakdown,
      },
    });
  } catch (error) {
    console.error('Error processing payments:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process payment data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ingest/payments
 * Returns summary of stored payment data
 */
export async function GET() {
  try {
    const { getPaymentData } = await import('@/lib/payment-processor');
    const paymentData = await getPaymentData();
    
    if (!paymentData) {
      return NextResponse.json({
        success: true,
        message: 'No payment data available',
        data: {
          totalPayments: 0,
          receivedPayments: 0,
          uploadDate: null,
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        totalPayments: paymentData.totalPayments,
        receivedPayments: paymentData.receivedPayments,
        uploadDate: paymentData.uploadDate,
        breakdown: {
          oec: paymentData.payments.filter(p => p.service === 'oec' && p.status === 'received').length,
          owwa: paymentData.payments.filter(p => p.service === 'owwa' && p.status === 'received').length,
          ttl: paymentData.payments.filter(p => p.service === 'ttl' && p.status === 'received').length,
          tte: paymentData.payments.filter(p => p.service === 'tte' && p.status === 'received').length,
          ttj: paymentData.payments.filter(p => p.service === 'ttj' && p.status === 'received').length,
          visaSaudi: paymentData.payments.filter(p => p.service === 'visaSaudi' && p.status === 'received').length,
          schengen: paymentData.payments.filter(p => p.service === 'schengen' && p.status === 'received').length,
          gcc: paymentData.payments.filter(p => p.service === 'gcc' && p.status === 'received').length,
          filipina_pp: paymentData.payments.filter(p => p.service === 'filipina_pp' && p.status === 'received').length,
          ethiopian_pp: paymentData.payments.filter(p => p.service === 'ethiopian_pp' && p.status === 'received').length,
          other: paymentData.payments.filter(p => p.service === 'other').length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching payment data:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch payment data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

