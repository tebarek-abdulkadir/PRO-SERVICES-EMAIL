import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { parsePnLFile, aggregatePnLData } from '@/lib/pnl-parser';
import { aggregateDailyComplaints } from '@/lib/daily-complaints-storage';
import { ALL_SERVICE_KEYS } from '@/lib/pnl-complaints-types';
import type { PnLServiceKey } from '@/lib/pnl-complaints-types';
import type { ServicePnL, AggregatedPnL } from '@/lib/pnl-types';

// Force Node.js runtime for filesystem access (required for fs operations)
export const runtime = 'nodejs';
// Disable caching for P&L data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PNL_DIR = path.join(process.cwd(), 'P&L');

// Price change effective date
const PRICE_CHANGE_DATE = '2026-02-22';

// Old prices (before February 22, 2026)
const OLD_SERVICE_COSTS: Record<PnLServiceKey, number> = {
  oec: 61.5,
  owwa: 92,
  ttl: 400,
  ttlSingle: 425,
  ttlDouble: 565,
  ttlMultiple: 745,
  tte: 400,
  tteSingle: 370,    // Old price
  tteDouble: 520,
  tteMultiple: 470,  // Old price
  ttj: 320,          // Old price
  visaSaudi: 320,
  schengen: 0,
  gcc: 220,
  ethiopianPP: 1330,
  filipinaPP: 0,
};

const OLD_SERVICE_FEES: Record<PnLServiceKey, number> = {
  oec: 0,
  owwa: 0,
  ttl: 0,
  ttlSingle: 0,
  ttlDouble: 0,
  ttlMultiple: 0,
  tte: 0,
  tteSingle: 0,
  tteDouble: 0,
  tteMultiple: 0,
  ttj: 0,
  visaSaudi: 0,
  schengen: 0,
  gcc: 0,
  ethiopianPP: 0,
  filipinaPP: 0,
};

// New prices (from February 22, 2026 onwards)
const NEW_SERVICE_COSTS: Record<PnLServiceKey, number> = {
  oec: 61.5,
  owwa: 92,
  ttl: 400,
  ttlSingle: 425,
  ttlDouble: 565,
  ttlMultiple: 745,
  tte: 400,
  tteSingle: 370,    // Updated Feb 22
  tteDouble: 520,
  tteMultiple: 470,  // Updated Feb 22
  ttj: 320,          // Updated Feb 22
  visaSaudi: 320,
  schengen: 0,
  gcc: 220,
  ethiopianPP: 1330,
  filipinaPP: 0,
};

const NEW_SERVICE_FEES: Record<PnLServiceKey, number> = {
  oec: 0,
  owwa: 0,
  ttl: 0,
  ttlSingle: 100,    // Updated Feb 22
  ttlDouble: 100,    // Updated Feb 22
  ttlMultiple: 100,  // Updated Feb 22
  tte: 100,
  tteSingle: 100,    // Updated Feb 22
  tteDouble: 0,
  tteMultiple: 100,  // Updated Feb 22
  ttj: 100,          // Updated Feb 22
  visaSaudi: 100,
  schengen: 100,
  gcc: 0,
  ethiopianPP: 120,  // Updated Feb 22
  filipinaPP: 0,
};

// Get prices based on date
function getServiceCosts(date: string): Record<PnLServiceKey, number> {
  return date >= PRICE_CHANGE_DATE ? NEW_SERVICE_COSTS : OLD_SERVICE_COSTS;
}

function getServiceFees(date: string): Record<PnLServiceKey, number> {
  return date >= PRICE_CHANGE_DATE ? NEW_SERVICE_FEES : OLD_SERVICE_FEES;
}

// Fixed monthly costs
const MONTHLY_FIXED_COSTS = {
  laborCost: 55000,
  llm: 3650,
  proTransportation: 2070,
};

// Create service P&L from volume and config
// Formula: Revenue = (serviceFee + actualCost) × volume
//          Gross Profit = Revenue - Cost = serviceFee × volume
function createServiceFromVolume(
  name: string, 
  volume: number, 
  actualCost: number,    // The actual cost per unit to the company
  serviceFee: number     // Service fee (markup) per unit
): ServicePnL {
  const totalCost = volume * actualCost;
  const totalRevenue = volume * (serviceFee + actualCost);
  const grossProfit = totalRevenue - totalCost; // = serviceFee × volume
  
  return {
    name,
    volume,
    price: serviceFee + actualCost,  // Price per unit (what customer pays)
    serviceFees: serviceFee,          // Service fee per unit
    totalRevenue,
    totalCost,
    grossProfit,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'auto'; // 'auto', 'complaints', 'excel'
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const viewMode = searchParams.get('viewMode') || 'monthly'; // 'daily', 'monthly'
    
    console.log('[P&L] GET request - startDate:', startDate, 'endDate:', endDate, 'viewMode:', viewMode);
    
    // Try daily complaints data FIRST (primary source)
    const dailyComplaintsResult = await aggregateDailyComplaints(startDate, endDate);
    const hasDailyData = dailyComplaintsResult.success && dailyComplaintsResult.data;
    
    console.log('[P&L] Daily complaints result:', { 
      success: dailyComplaintsResult.success, 
      hasDailyData,
      error: dailyComplaintsResult.error 
    });
    
    // Check if P&L Excel files exist (wrapped for serverless safety)
    let hasExcelFiles = false;
    try {
      hasExcelFiles = fs.existsSync(PNL_DIR) && 
        fs.readdirSync(PNL_DIR).some(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    } catch {
      // fs operations may fail in serverless
    }
    
    // Determine which source to use (daily complaints takes priority)
    const useComplaints = source === 'complaints' || 
      (source === 'auto' && hasDailyData);
    const useExcel = source === 'excel' || 
      (source === 'auto' && !hasDailyData && hasExcelFiles);
    
    // If using daily complaints data (PRIMARY SOURCE)
    if (useComplaints && hasDailyData && dailyComplaintsResult.data) {
      console.log('[P&L] Using daily complaints data');
      
      const dailyData = dailyComplaintsResult.data;
      
      const services: AggregatedPnL['services'] = {} as AggregatedPnL['services'];
      
      const serviceNames = {
        oec: 'OEC',
        owwa: 'OWWA',
        ttl: 'Travel to Lebanon',
        ttlSingle: 'Tourist Visa to Lebanon – Single Entry',
        ttlDouble: 'Tourist Visa to Lebanon – Double Entry',
        ttlMultiple: 'Tourist Visa to Lebanon – Multiple Entry',
        tte: 'Travel to Egypt',
        tteSingle: 'Tourist Visa to Egypt – Single Entry',
        tteDouble: 'Tourist Visa to Egypt – Double Entry',
        tteMultiple: 'Tourist Visa to Egypt – Multiple Entry',
        ttj: 'Travel to Jordan',
        visaSaudi: 'Visa Saudi',
        schengen: 'Schengen Countries',
        gcc: 'GCC',
        ethiopianPP: 'Ethiopian Passport Renewal',
        filipinaPP: 'Filipina Passport Renewal',
      };
      
      // Process complaints individually to apply date-aware pricing
      // Group sales by their first sale date to determine which pricing to use
      const salesByDate = new Map<string, Array<{ serviceKey: PnLServiceKey }>>();
      
      // Process complaintsByService to group by first sale date
      Object.entries(dailyData.complaintsByService).forEach(([serviceKey, complaints]) => {
        if (!complaints || complaints.length === 0) return;
        
        // Group complaints by sale (contract + client + housemaid) with 3-month dedup
        const salesMap = new Map<string, { firstSaleDate: string }>();
        
        complaints.forEach(complaint => {
          const saleKey = `${complaint.contractId}_${complaint.clientId}_${complaint.housemaidId}`;
          const complaintDate = complaint.creationDate.split(/[T ]/)[0]; // Extract YYYY-MM-DD
          
          const existing = salesMap.get(saleKey);
          if (!existing) {
            salesMap.set(saleKey, { firstSaleDate: complaintDate });
          } else {
            // Check if within 3 months
            const existingDate = new Date(existing.firstSaleDate);
            const newDate = new Date(complaintDate);
            const monthsDiff = Math.abs(
              (newDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
            );
            
            if (monthsDiff > 3) {
              // More than 3 months apart - new sale, keep more recent
              if (newDate > existingDate) {
                salesMap.set(saleKey, { firstSaleDate: complaintDate });
              }
            } else if (complaintDate < existing.firstSaleDate) {
              // Within 3 months but earlier - update first sale date
              salesMap.set(saleKey, { firstSaleDate: complaintDate });
            }
          }
        });
        
        // Group sales by their first sale date
        salesMap.forEach(({ firstSaleDate }) => {
          if (!salesByDate.has(firstSaleDate)) {
            salesByDate.set(firstSaleDate, []);
          }
          salesByDate.get(firstSaleDate)!.push({ serviceKey: serviceKey as PnLServiceKey });
        });
      });
      
      // Initialize services
      ALL_SERVICE_KEYS.forEach(key => {
        services[key] = createServiceFromVolume(serviceNames[key], 0, 0, 0);
      });
      
      // Process each date group with appropriate pricing
      for (const [firstSaleDate, sales] of salesByDate) {
        // Get prices for this date
        const dateCosts = getServiceCosts(firstSaleDate);
        const dateFees = getServiceFees(firstSaleDate);
        
        // Count volumes per service for this date group
        const dateVolumes: Record<PnLServiceKey, number> = {} as Record<PnLServiceKey, number>;
        ALL_SERVICE_KEYS.forEach(key => {
          dateVolumes[key] = 0;
        });
        
        sales.forEach(({ serviceKey }) => {
          dateVolumes[serviceKey] = (dateVolumes[serviceKey] || 0) + 1;
        });
        
        // Calculate P&L for this date group and add to totals
        ALL_SERVICE_KEYS.forEach(key => {
          const volume = dateVolumes[key] || 0;
          const unitCost = dateCosts[key];
          const serviceFee = dateFees[key];
          
          const dateServicePnL = createServiceFromVolume(
            serviceNames[key],
            volume,
            unitCost,
            serviceFee
          );
          
          // Add to aggregated totals
          services[key].volume += dateServicePnL.volume;
          services[key].totalRevenue += dateServicePnL.totalRevenue;
          services[key].totalCost += dateServicePnL.totalCost;
          services[key].grossProfit += dateServicePnL.grossProfit;
        });
      }
      
      // Recalculate average prices and fees
      ALL_SERVICE_KEYS.forEach(key => {
        if (services[key].volume > 0) {
          services[key].price = services[key].totalRevenue / services[key].volume;
          services[key].serviceFees = services[key].grossProfit / services[key].volume;
        }
      });
      
      const totalRevenue = Object.values(services).reduce((sum, s) => sum + s.totalRevenue, 0);
      const totalCost = Object.values(services).reduce((sum, s) => sum + s.totalCost, 0);
      const totalGrossProfit = Object.values(services).reduce((sum, s) => sum + s.grossProfit, 0);
      
      // Calculate number of months in the date range
      let numberOfMonths = 1;
      if (dailyData.dateRange.start && dailyData.dateRange.end) {
        const start = new Date(dailyData.dateRange.start);
        const end = new Date(dailyData.dateRange.end);
        const yearDiff = end.getFullYear() - start.getFullYear();
        const monthDiff = end.getMonth() - start.getMonth();
        numberOfMonths = yearDiff * 12 + monthDiff + 1;
      }
      
      // Fixed costs multiplied by number of months
      const fixedCosts = {
        laborCost: MONTHLY_FIXED_COSTS.laborCost * numberOfMonths,
        llm: MONTHLY_FIXED_COSTS.llm * numberOfMonths,
        proTransportation: MONTHLY_FIXED_COSTS.proTransportation * numberOfMonths,
        total: (MONTHLY_FIXED_COSTS.laborCost + MONTHLY_FIXED_COSTS.llm + MONTHLY_FIXED_COSTS.proTransportation) * numberOfMonths,
      };
      
      const aggregated: AggregatedPnL = {
        files: ['daily-complaints-data'],
        services,
        summary: {
          totalRevenue,
          totalCost,
          totalGrossProfit,
          fixedCosts,
          netProfit: totalGrossProfit - fixedCosts.total,
        },
      };
      
      // Build daily complaints info for display
      const complaintsInfo = {
        totalComplaints: dailyData.totalComplaints,
        dateRange: dailyData.dateRange,
        source: 'Daily Complaints (Date-based)',
        serviceBreakdown: {} as Record<string, { uniqueSales: number }>,
      };
      
      // Add service breakdown
      ALL_SERVICE_KEYS.forEach(key => {
        complaintsInfo.serviceBreakdown[key] = {
          uniqueSales: dailyData.volumes[key],
        };
      });

      // Get available dates for date picker
      const { getAvailableDailyComplaintsDates } = await import('@/lib/daily-complaints-storage');
      const datesResult = await getAvailableDailyComplaintsDates();
      const availableDates = datesResult.success && datesResult.dates ? datesResult.dates : [];
      
      // Convert dates to months for the picker (YYYY-MM format)
      const availableMonths = [...new Set(availableDates.map(d => d.substring(0, 7)))].sort();

      return NextResponse.json({
        source: 'complaints',
        aggregated,
        dateFilter: startDate || endDate ? { startDate, endDate } : null,
        viewMode,
        availableMonths,
        availableDates, // Include individual dates for daily view
        complaintsData: complaintsInfo,
        files: null,
        fileCount: 0,
        monthsInRange: numberOfMonths,
      });
    }
    
    // Fall back to Excel files
    if (useExcel && hasExcelFiles) {
      // Get all Excel files in the P&L directory
      const files = fs.readdirSync(PNL_DIR)
        .filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'))
        .map(file => path.join(PNL_DIR, file));

      if (files.length === 0) {
        return NextResponse.json({ 
          error: 'No P&L files found',
          source: 'excel',
        }, { status: 404 });
      }

      // Parse all P&L files
      const pnlDataList = files.map(file => {
        try {
          return parsePnLFile(file);
        } catch (err) {
          console.error(`Error parsing ${file}:`, err);
          return null;
        }
      }).filter(Boolean);

      if (pnlDataList.length === 0) {
        return NextResponse.json({ 
          error: 'Failed to parse P&L files',
          source: 'excel',
        }, { status: 500 });
      }

      // Aggregate all P&L data
      const aggregated = aggregatePnLData(pnlDataList as ReturnType<typeof parsePnLFile>[]);

      // Also return individual file data for detailed view
      return NextResponse.json({
        source: 'excel',
        aggregated,
        files: pnlDataList,
        fileCount: pnlDataList.length,
        complaintsData: null,
      });
    }
    
    // No data available
    return NextResponse.json({
      error: 'No P&L data available. Upload complaints via /api/complaints-daily or add Excel files to P&L directory.',
      source: 'none',
      hasComplaintsData: false,
      hasExcelFiles: false,
    }, { status: 404 });
    
  } catch (error) {
    console.error('Error fetching P&L data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch P&L data',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
