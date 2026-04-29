import { NextResponse } from 'next/server';
import { getDailyDataBlob } from '@/lib/blob-storage';
import { getPaymentData, filterPaymentsByDate } from '@/lib/payment-processor';
import { 
  getConversionsWithComplaintCheck, 
  calculateCleanConversionRates,
  type ConversionWithComplaintCheck 
} from '@/lib/complaints-conversion-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ComplaintsAwareConversionResponse {
  date: string;
  totalProspects: number;
  totalConversions: number;
  totalCleanConversions: number;
  
  // Service-specific data
  services: {
    oec: {
      prospects: number;
      conversions: number;
      cleanConversions: number;
      withComplaints: number;
      conversionRate: number;
      cleanConversionRate: number;
    };
    owwa: {
      prospects: number;
      conversions: number;
      cleanConversions: number;
      withComplaints: number;
      conversionRate: number;
      cleanConversionRate: number;
    };
    travelVisa: {
      prospects: number;
      conversions: number;
      cleanConversions: number;
      withComplaints: number;
      conversionRate: number;
      cleanConversionRate: number;
    };
    filipinaPassportRenewal: {
      prospects: number;
      conversions: number;
      cleanConversions: number;
      withComplaints: number;
      conversionRate: number;
      cleanConversionRate: number;
    };
    ethiopianPassportRenewal: {
      prospects: number;
      conversions: number;
      cleanConversions: number;
      withComplaints: number;
      conversionRate: number;
      cleanConversionRate: number;
    };
  };
  
  // Detailed conversion records
  conversions: ConversionWithComplaintCheck[];
}

/**
 * GET /api/conversions-with-complaints/[date]
 * 
 * Returns conversion data with complaints analysis for a specific date.
 * This endpoint is specifically designed for the sales screen to show
 * clean conversion rates excluding prospects with complaints.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await context.params;
    
    // Get daily conversation data
    const dailyData = await getDailyDataBlob(date);
    if (!dailyData) {
      return NextResponse.json({ error: 'No data for this date' }, { status: 404 });
    }
    
    // Get payment data
    const paymentData = await getPaymentData();
    if (!paymentData) {
      return NextResponse.json({ 
        error: 'No payment data available',
        date,
        totalProspects: 0,
        totalConversions: 0,
        totalCleanConversions: 0,
        services: {
          oec: { prospects: 0, conversions: 0, cleanConversions: 0, withComplaints: 0, conversionRate: 0, cleanConversionRate: 0 },
          owwa: { prospects: 0, conversions: 0, cleanConversions: 0, withComplaints: 0, conversionRate: 0, cleanConversionRate: 0 },
          travelVisa: { prospects: 0, conversions: 0, cleanConversions: 0, withComplaints: 0, conversionRate: 0, cleanConversionRate: 0 },
          filipinaPassportRenewal: { prospects: 0, conversions: 0, cleanConversions: 0, withComplaints: 0, conversionRate: 0, cleanConversionRate: 0 },
          ethiopianPassportRenewal: { prospects: 0, conversions: 0, cleanConversions: 0, withComplaints: 0, conversionRate: 0, cleanConversionRate: 0 },
        },
        conversions: []
      });
    }
    
    // Filter payments for this specific date (only RECEIVED payments)
    const datePayments = filterPaymentsByDate(paymentData.payments, date, 'received');
    
    // Create payment lookup maps
    const paymentMap = new Map<string, Set<'oec' | 'owwa' | 'ttl' | 'tte' | 'travel_visa' | 'filipina_pp' | 'ethiopian_pp'>>();
    const paymentDatesMap = new Map<string, Map<'oec' | 'owwa' | 'ttl' | 'tte' | 'travel_visa' | 'filipina_pp' | 'ethiopian_pp', string[]>>();
    
    datePayments.forEach(payment => {
      if (!paymentMap.has(payment.contractId)) {
        paymentMap.set(payment.contractId, new Set());
        paymentDatesMap.set(payment.contractId, new Map());
      }
      
      const services = paymentMap.get(payment.contractId)!;
      const dates = paymentDatesMap.get(payment.contractId)!;
      
      // Map payment services to prospect service types
      let prospectService: 'oec' | 'owwa' | 'ttl' | 'tte' | 'travel_visa' | 'filipina_pp' | 'ethiopian_pp' | null = null;
      
      if (payment.service === 'oec') {
        prospectService = 'oec';
      } else if (payment.service === 'owwa') {
        prospectService = 'owwa';
      } else if (payment.service === 'ttl' || payment.service === 'ttlSingle' || payment.service === 'ttlDouble' || payment.service === 'ttlMultiple') {
        prospectService = 'ttl';
      } else if (payment.service === 'tte' || payment.service === 'tteSingle' || payment.service === 'tteDouble' || payment.service === 'tteMultiple') {
        prospectService = 'tte';
      } else if (payment.service === 'ttj' || payment.service === 'visaSaudi' || payment.service === 'schengen' || payment.service === 'gcc') {
        prospectService = 'travel_visa';
      } else if (payment.service === 'filipina_pp') {
        prospectService = 'filipina_pp';
      } else if (payment.service === 'ethiopian_pp') {
        prospectService = 'ethiopian_pp';
      }
      
      if (prospectService) {
        services.add(prospectService);
        
        if (!dates.has(prospectService)) {
          dates.set(prospectService, []);
        }
        dates.get(prospectService)!.push(payment.dateOfPayment);
      }
    });
    
    // Get conversions with complaint analysis
    const conversionsWithComplaints = await getConversionsWithComplaintCheck(
      dailyData.results,
      date,
      paymentMap,
      paymentDatesMap
    );
    
    const cleanConversionStats = calculateCleanConversionRates(conversionsWithComplaints);
    
    // Calculate totals
    const totalProspects = Object.values(cleanConversionStats.stats).reduce((sum, stat) => sum + stat.prospects, 0);
    const totalConversions = Object.values(cleanConversionStats.stats).reduce((sum, stat) => sum + stat.conversions, 0);
    const totalCleanConversions = Object.values(cleanConversionStats.stats).reduce((sum, stat) => sum + stat.cleanConversions, 0);
    
    const response: ComplaintsAwareConversionResponse = {
      date,
      totalProspects,
      totalConversions,
      totalCleanConversions,
      services: {
        oec: {
          prospects: cleanConversionStats.stats.oec.prospects,
          conversions: cleanConversionStats.stats.oec.conversions,
          cleanConversions: cleanConversionStats.stats.oec.cleanConversions,
          withComplaints: cleanConversionStats.stats.oec.withComplaints,
          conversionRate: Math.round(cleanConversionStats.rates.oec.overall * 100) / 100,
          cleanConversionRate: Math.round(cleanConversionStats.rates.oec.clean * 100) / 100,
        },
        owwa: {
          prospects: cleanConversionStats.stats.owwa.prospects,
          conversions: cleanConversionStats.stats.owwa.conversions,
          cleanConversions: cleanConversionStats.stats.owwa.cleanConversions,
          withComplaints: cleanConversionStats.stats.owwa.withComplaints,
          conversionRate: Math.round(cleanConversionStats.rates.owwa.overall * 100) / 100,
          cleanConversionRate: Math.round(cleanConversionStats.rates.owwa.clean * 100) / 100,
        },
        travelVisa: {
          prospects: cleanConversionStats.stats.travelVisa.prospects,
          conversions: cleanConversionStats.stats.travelVisa.conversions,
          cleanConversions: cleanConversionStats.stats.travelVisa.cleanConversions,
          withComplaints: cleanConversionStats.stats.travelVisa.withComplaints,
          conversionRate: Math.round(cleanConversionStats.rates.travelVisa.overall * 100) / 100,
          cleanConversionRate: Math.round(cleanConversionStats.rates.travelVisa.clean * 100) / 100,
        },
        filipinaPassportRenewal: {
          prospects: cleanConversionStats.stats.filipinaPassportRenewal.prospects,
          conversions: cleanConversionStats.stats.filipinaPassportRenewal.conversions,
          cleanConversions: cleanConversionStats.stats.filipinaPassportRenewal.cleanConversions,
          withComplaints: cleanConversionStats.stats.filipinaPassportRenewal.withComplaints,
          conversionRate: Math.round(cleanConversionStats.rates.filipinaPassportRenewal.overall * 100) / 100,
          cleanConversionRate: Math.round(cleanConversionStats.rates.filipinaPassportRenewal.clean * 100) / 100,
        },
        ethiopianPassportRenewal: {
          prospects: cleanConversionStats.stats.ethiopianPassportRenewal.prospects,
          conversions: cleanConversionStats.stats.ethiopianPassportRenewal.conversions,
          cleanConversions: cleanConversionStats.stats.ethiopianPassportRenewal.cleanConversions,
          withComplaints: cleanConversionStats.stats.ethiopianPassportRenewal.withComplaints,
          conversionRate: Math.round(cleanConversionStats.rates.ethiopianPassportRenewal.overall * 100) / 100,
          cleanConversionRate: Math.round(cleanConversionStats.rates.ethiopianPassportRenewal.clean * 100) / 100,
        },
      },
      conversions: conversionsWithComplaints,
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error calculating conversions with complaints:', error);
    return NextResponse.json({ error: 'Failed to calculate conversions with complaints' }, { status: 500 });
  }
}
