import { getDailyComplaints, type DailyComplaintsData } from './daily-complaints-storage';
import { getServiceKeyFromComplaintType, type PnLServiceKey } from './pnl-complaints-types';
import type { ProcessedConversation } from './storage';

export interface ComplaintCheckResult {
  hasComplaint: boolean;
  complaintTypes: string[];
  complaintDates: string[];
}

export interface ConversionWithComplaintCheck {
  contractId: string;
  services: {
    oec: { converted: boolean; hasComplaint: boolean; complaintTypes: string[] };
    owwa: { converted: boolean; hasComplaint: boolean; complaintTypes: string[] };
    ttl: { converted: boolean; hasComplaint: boolean; complaintTypes: string[] };
    tte: { converted: boolean; hasComplaint: boolean; complaintTypes: string[] };
    travelVisa: { converted: boolean; hasComplaint: boolean; complaintTypes: string[] };
    filipinaPassportRenewal: { converted: boolean; hasComplaint: boolean; complaintTypes: string[] };
    ethiopianPassportRenewal: { converted: boolean; hasComplaint: boolean; complaintTypes: string[] };
  };
  paymentDates: {
    oec?: string[];
    owwa?: string[];
    ttl?: string[];
    tte?: string[];
    travelVisa?: string[];
    filipinaPassportRenewal?: string[];
    ethiopianPassportRenewal?: string[];
  };
}

/**
 * Service key mapping for complaints to prospect services
 */
const COMPLAINT_SERVICE_MAP: Record<PnLServiceKey, keyof ConversionWithComplaintCheck['services']> = {
  oec: 'oec',
  owwa: 'owwa',
  ttl: 'ttl',
  ttlSingle: 'ttl',
  ttlDouble: 'ttl',
  ttlMultiple: 'ttl',
  tte: 'tte', 
  tteSingle: 'tte',
  tteDouble: 'tte',
  tteMultiple: 'tte',
  ttj: 'travelVisa',
  visaSaudi: 'travelVisa',
  schengen: 'travelVisa',
  gcc: 'travelVisa',
  filipinaPP: 'filipinaPassportRenewal',
  ethiopianPP: 'ethiopianPassportRenewal',
};

/**
 * Check if a prospect has complaints for specific services on a given date
 * Links by contract ID, maid ID, or client ID
 */
export async function checkComplaintsForProspect(
  prospect: { contractId?: string; maidId?: string; clientId?: string },
  date: string,
  services: PnLServiceKey[]
): Promise<Record<PnLServiceKey, ComplaintCheckResult>> {
  const result: Record<PnLServiceKey, ComplaintCheckResult> = {} as any;
  
  // Initialize all services as no complaints
  services.forEach(service => {
    result[service] = {
      hasComplaint: false,
      complaintTypes: [],
      complaintDates: []
    };
  });

  try {
    // Get all available complaints and filter by creationDate matching the prospect date
    // This ensures we match complaints even if they were stored on a different date
    const { getAvailableDailyComplaintsDates, getDailyComplaints } = await import('./daily-complaints-storage');
    const datesResult = await getAvailableDailyComplaintsDates();
    
    if (!datesResult.success || !datesResult.dates || datesResult.dates.length === 0) {
      return result; // No complaints data available
    }

    // Fetch all complaints from all dates
    const allComplaintsResults = await Promise.all(
      datesResult.dates.map(d => getDailyComplaints(d))
    );
    
    // Combine all complaints and filter by creationDate matching the prospect date
    const allComplaints = allComplaintsResults
      .filter(r => r.success && r.data)
      .flatMap(r => r.data!.complaints)
      .filter(complaint => {
        // Match complaints where creationDate matches the prospect date
        if (!complaint.creationDate) return false;
        // Handle both ISO format (2026-02-22T14:35:48.000) and space format (2026-02-22 14:35:48.000)
        const complaintDate = complaint.creationDate.split(/[T ]/)[0]; // Extract YYYY-MM-DD
        return complaintDate === date;
      });

    // Filter complaints for this prospect by contract ID, maid ID, or client ID
    const prospectComplaints = allComplaints.filter(complaint => {
      return (
        (prospect.contractId && complaint.contractId === prospect.contractId) ||
        (prospect.maidId && complaint.housemaidId === prospect.maidId) ||
        (prospect.clientId && complaint.clientId === prospect.clientId)
      );
    });

    if (prospectComplaints.length === 0) {
      return result; // No complaints for this prospect
    }

    // Check each service
    services.forEach(serviceKey => {
      const serviceComplaints = prospectComplaints.filter(complaint => {
        const complaintServiceKey = getServiceKeyFromComplaintType(complaint.complaintType);
        return complaintServiceKey === serviceKey;
      });

      if (serviceComplaints.length > 0) {
        result[serviceKey] = {
          hasComplaint: true,
          complaintTypes: serviceComplaints.map(c => c.complaintType),
          complaintDates: serviceComplaints.map(c => c.creationDate)
        };
      }
    });

    return result;
  } catch (error) {
    console.error('Error checking complaints for contract:', error);
    return result; // Return no complaints on error
  }
}

/**
 * Get all complaints before a given date (batch operation to avoid rate limiting)
 * This fetches complaints once and can be reused for multiple prospect checks
 */
export async function getAllComplaintsBeforeDate(beforeDate: string): Promise<import('./pnl-complaints-types').PnLComplaint[]> {
  try {
    // Get all available complaints
    const { getAvailableDailyComplaintsDates, getDailyComplaints } = await import('./daily-complaints-storage');
    const datesResult = await getAvailableDailyComplaintsDates();
    
    if (!datesResult.success || !datesResult.dates || datesResult.dates.length === 0) {
      return []; // No complaints data available
    }

    // Fetch all complaints from all dates (batch operation)
    const allComplaintsResults = await Promise.all(
      datesResult.dates.map(d => getDailyComplaints(d))
    );
    
    // Combine all complaints and filter by creationDate BEFORE the date
    const allComplaints = allComplaintsResults
      .filter(r => r.success && r.data)
      .flatMap(r => r.data!.complaints)
      .filter(complaint => {
        // Match complaints where creationDate is BEFORE the date
        if (!complaint.creationDate) return false;
        // Handle both ISO format (2026-02-22T14:35:48.000) and space format (2026-02-22 14:35:48.000)
        const complaintDate = complaint.creationDate.split(/[T ]/)[0]; // Extract YYYY-MM-DD
        return complaintDate < beforeDate;
      });

    return allComplaints;
  } catch (error) {
    console.error('Error fetching complaints before date:', error);
    return []; // Return empty array on error
  }
}

/**
 * Filter prospects to exclude those with complaints before a given date (batch operation)
 * This is more efficient than checking each prospect individually
 */
export function filterProspectsWithoutPreviousComplaints(
  prospects: Array<{ contractId?: string; maidId?: string; clientId?: string }>,
  complaintsBeforeDate: import('./pnl-complaints-types').PnLComplaint[]
): Array<{ contractId?: string; maidId?: string; clientId?: string }> {
  // Create a Set of prospect identifiers that have complaints
  const prospectsWithComplaints = new Set<string>();
  
  // Build set of prospect identifiers from complaints
  complaintsBeforeDate.forEach(complaint => {
    if (complaint.contractId) {
      prospectsWithComplaints.add(`contract:${complaint.contractId}`);
    }
    if (complaint.housemaidId) {
      prospectsWithComplaints.add(`maid:${complaint.housemaidId}`);
    }
    if (complaint.clientId) {
      prospectsWithComplaints.add(`client:${complaint.clientId}`);
    }
  });
  
  // Filter prospects that don't have previous complaints
  return prospects.filter(prospect => {
    const hasComplaint = 
      (prospect.contractId && prospectsWithComplaints.has(`contract:${prospect.contractId}`)) ||
      (prospect.maidId && prospectsWithComplaints.has(`maid:${prospect.maidId}`)) ||
      (prospect.clientId && prospectsWithComplaints.has(`client:${prospect.clientId}`));
    
    return !hasComplaint;
  });
}

/**
 * Check if a prospect has complaints BEFORE a given date
 * Links by contract ID, maid ID, or client ID
 * This is used to exclude prospects that already have open complaints
 * NOTE: For batch operations, use getAllComplaintsBeforeDate + filterProspectsWithoutPreviousComplaints instead
 */
export async function checkProspectHasPreviousComplaints(
  prospect: { contractId?: string; maidId?: string; clientId?: string },
  beforeDate: string
): Promise<boolean> {
  try {
    const complaints = await getAllComplaintsBeforeDate(beforeDate);
    
    // Filter complaints for this prospect by contract ID, maid ID, or client ID
    const prospectComplaints = complaints.filter(complaint => {
      return (
        (prospect.contractId && complaint.contractId === prospect.contractId) ||
        (prospect.maidId && complaint.housemaidId === prospect.maidId) ||
        (prospect.clientId && complaint.clientId === prospect.clientId)
      );
    });

    return prospectComplaints.length > 0;
  } catch (error) {
    console.error('Error checking previous complaints for prospect:', error);
    return false; // Return false on error (don't exclude prospect)
  }
}

/**
 * Check if a prospect has complaints for a specific service on a given date
 * Links by contract ID, maid ID, or client ID
 */
export async function checkProspectHasComplaints(
  prospect: ProcessedConversation,
  date: string,
  service: 'oec' | 'owwa' | 'ttl' | 'tte' | 'travelVisa' | 'filipinaPassportRenewal' | 'ethiopianPassportRenewal'
): Promise<boolean> {
  // Map prospect service to complaint service keys
  let serviceKeysToCheck: PnLServiceKey[] = [];
  
  switch (service) {
    case 'oec':
      serviceKeysToCheck = ['oec'];
      break;
    case 'owwa':
      serviceKeysToCheck = ['owwa'];
      break;
    case 'ttl':
      serviceKeysToCheck = ['ttl', 'ttlSingle', 'ttlDouble', 'ttlMultiple'];
      break;
    case 'tte':
      serviceKeysToCheck = ['tte', 'tteSingle', 'tteDouble', 'tteMultiple'];
      break;
    case 'travelVisa':
      serviceKeysToCheck = ['ttj', 'visaSaudi', 'schengen', 'gcc'];
      break;
    case 'filipinaPassportRenewal':
      serviceKeysToCheck = ['filipinaPP'];
      break;
    case 'ethiopianPassportRenewal':
      serviceKeysToCheck = ['ethiopianPP'];
      break;
  }

  const complaintChecks = await checkComplaintsForProspect(
    {
      contractId: prospect.contractId,
      maidId: prospect.maidId,
      clientId: prospect.clientId
    },
    date,
    serviceKeysToCheck
  );

  // Check if any of the relevant services have complaints
  return serviceKeysToCheck.some(serviceKey => complaintChecks[serviceKey]?.hasComplaint);
}

/**
 * Get conversion data with complaint information for a specific date
 */
export async function getConversionsWithComplaintCheck(
  prospects: ProcessedConversation[],
  date: string,
  paymentMap: Map<string, Set<'oec' | 'owwa' | 'ttl' | 'tte' | 'travel_visa' | 'filipina_pp' | 'ethiopian_pp'>>,
  paymentDatesMap: Map<string, Map<'oec' | 'owwa' | 'ttl' | 'tte' | 'travel_visa' | 'filipina_pp' | 'ethiopian_pp', string[]>>
): Promise<ConversionWithComplaintCheck[]> {
  const conversions: ConversionWithComplaintCheck[] = [];

  // Filter prospects first - fetch complaints once (batch operation to avoid rate limiting)
  const complaintsBeforeDate = await getAllComplaintsBeforeDate(date);
  
  // Filter out prospects with previous complaints using batch operation
  const prospectsToProcess = filterProspectsWithoutPreviousComplaints(
    prospects.map(p => ({
      contractId: p.contractId,
      maidId: p.maidId,
      clientId: p.clientId
    })),
    complaintsBeforeDate
  ).map(filtered => {
    // Find the original prospect object to preserve all fields
    return prospects.find(p => 
      (p.contractId && p.contractId === filtered.contractId) ||
      (p.maidId && p.maidId === filtered.maidId) ||
      (p.clientId && p.clientId === filtered.clientId)
    );
  }).filter((p): p is NonNullable<typeof p> => p !== undefined);

  for (const prospect of prospectsToProcess) {
    if (!prospect.contractId) continue;
    
    const isProspect = prospect.isOECProspect || prospect.isOWWAProspect || prospect.isTravelVisaProspect || 
                       prospect.isFilipinaPassportRenewalProspect || prospect.isEthiopianPassportRenewalProspect;
    if (!isProspect) continue;

    const paidServices = paymentMap.get(prospect.contractId);
    const contractDates = paymentDatesMap.get(prospect.contractId);

    // Check complaints for all relevant services
    const servicesToCheck: PnLServiceKey[] = [];
    if (prospect.isOECProspect) servicesToCheck.push('oec');
    if (prospect.isOWWAProspect) servicesToCheck.push('owwa');
    if (prospect.isTravelVisaProspect) {
      // Check specific travel visa countries for targeted service matching
      if (prospect.travelVisaCountries?.includes('Lebanon')) {
        servicesToCheck.push('ttl', 'ttlSingle', 'ttlDouble', 'ttlMultiple');
      }
      if (prospect.travelVisaCountries?.includes('Egypt')) {
        servicesToCheck.push('tte', 'tteSingle', 'tteDouble', 'tteMultiple');
      }
      if (prospect.travelVisaCountries?.includes('Jordan')) {
        servicesToCheck.push('ttj');
      }
      // For other countries or general travel visa prospects
      if (!prospect.travelVisaCountries || prospect.travelVisaCountries.length === 0 || 
          prospect.travelVisaCountries.some(country => !['Lebanon', 'Egypt', 'Jordan'].includes(country))) {
        servicesToCheck.push('visaSaudi', 'schengen', 'gcc');
      }
    }
    if (prospect.isFilipinaPassportRenewalProspect) servicesToCheck.push('filipinaPP');
    if (prospect.isEthiopianPassportRenewalProspect) servicesToCheck.push('ethiopianPP');

    const complaintChecks = await checkComplaintsForProspect(
      {
        contractId: prospect.contractId,
        maidId: prospect.maidId,
        clientId: prospect.clientId
      },
      date,
      servicesToCheck
    );

    const conversion: ConversionWithComplaintCheck = {
      contractId: prospect.contractId,
      services: {
        oec: { 
          converted: false, 
          hasComplaint: complaintChecks.oec?.hasComplaint || false,
          complaintTypes: complaintChecks.oec?.complaintTypes || []
        },
        owwa: { 
          converted: false, 
          hasComplaint: complaintChecks.owwa?.hasComplaint || false,
          complaintTypes: complaintChecks.owwa?.complaintTypes || []
        },
        ttl: { 
          converted: false, 
          hasComplaint: ['ttl', 'ttlSingle', 'ttlDouble', 'ttlMultiple'].some(key => 
            complaintChecks[key as PnLServiceKey]?.hasComplaint
          ),
          complaintTypes: ['ttl', 'ttlSingle', 'ttlDouble', 'ttlMultiple'].flatMap(key => 
            complaintChecks[key as PnLServiceKey]?.complaintTypes || []
          )
        },
        tte: { 
          converted: false, 
          hasComplaint: ['tte', 'tteSingle', 'tteDouble', 'tteMultiple'].some(key => 
            complaintChecks[key as PnLServiceKey]?.hasComplaint
          ),
          complaintTypes: ['tte', 'tteSingle', 'tteDouble', 'tteMultiple'].flatMap(key => 
            complaintChecks[key as PnLServiceKey]?.complaintTypes || []
          )
        },
        travelVisa: { 
          converted: false, 
          hasComplaint: ['ttj', 'visaSaudi', 'schengen', 'gcc'].some(key => 
            complaintChecks[key as PnLServiceKey]?.hasComplaint
          ),
          complaintTypes: ['ttj', 'visaSaudi', 'schengen', 'gcc'].flatMap(key => 
            complaintChecks[key as PnLServiceKey]?.complaintTypes || []
          )
        },
        filipinaPassportRenewal: { 
          converted: false, 
          hasComplaint: complaintChecks.filipinaPP?.hasComplaint || false,
          complaintTypes: complaintChecks.filipinaPP?.complaintTypes || []
        },
        ethiopianPassportRenewal: { 
          converted: false, 
          hasComplaint: complaintChecks.ethiopianPP?.hasComplaint || false,
          complaintTypes: complaintChecks.ethiopianPP?.complaintTypes || []
        },
      },
      paymentDates: {},
    };

    // Check conversions (payments) only if there are paid services
    if (paidServices && paidServices.size > 0 && contractDates) {
      // Check OEC conversion
      if (prospect.isOECProspect && paidServices.has('oec')) {
        conversion.services.oec.converted = true;
        conversion.paymentDates.oec = contractDates.get('oec') || [];
      }

      // Check OWWA conversion
      if (prospect.isOWWAProspect && paidServices.has('owwa')) {
        conversion.services.owwa.converted = true;
        conversion.paymentDates.owwa = contractDates.get('owwa') || [];
      }

      // Check TTL conversion (Lebanon travel visa)
      if (prospect.isTravelVisaProspect && prospect.travelVisaCountries?.includes('Lebanon') && paidServices.has('ttl')) {
        conversion.services.ttl.converted = true;
        conversion.paymentDates.ttl = contractDates.get('ttl') || [];
      }

      // Check TTE conversion (Egypt travel visa)
      if (prospect.isTravelVisaProspect && prospect.travelVisaCountries?.includes('Egypt') && paidServices.has('tte')) {
        conversion.services.tte.converted = true;
        conversion.paymentDates.tte = contractDates.get('tte') || [];
      }

      // Check Travel Visa conversion (other countries)
      if (prospect.isTravelVisaProspect && paidServices.has('travel_visa')) {
        conversion.services.travelVisa.converted = true;
        conversion.paymentDates.travelVisa = contractDates.get('travel_visa') || [];
      }

      // Check Filipina Passport Renewal conversion
      if (prospect.isFilipinaPassportRenewalProspect && paidServices.has('filipina_pp')) {
        conversion.services.filipinaPassportRenewal.converted = true;
        conversion.paymentDates.filipinaPassportRenewal = contractDates.get('filipina_pp') || [];
      }

      // Check Ethiopian Passport Renewal conversion
      if (prospect.isEthiopianPassportRenewalProspect && paidServices.has('ethiopian_pp')) {
        conversion.services.ethiopianPassportRenewal.converted = true;
        conversion.paymentDates.ethiopianPassportRenewal = contractDates.get('ethiopian_pp') || [];
      }
    }

    // Add to results if it's a prospect (regardless of conversion status)
    conversions.push(conversion);
  }

  return conversions;
}

/**
 * Calculate conversion rates excluding prospects with complaints
 */
export function calculateCleanConversionRates(conversions: ConversionWithComplaintCheck[]) {
  const stats = {
    oec: { prospects: 0, conversions: 0, withComplaints: 0, cleanConversions: 0 },
    owwa: { prospects: 0, conversions: 0, withComplaints: 0, cleanConversions: 0 },
    travelVisa: { prospects: 0, conversions: 0, withComplaints: 0, cleanConversions: 0 },
    filipinaPassportRenewal: { prospects: 0, conversions: 0, withComplaints: 0, cleanConversions: 0 },
    ethiopianPassportRenewal: { prospects: 0, conversions: 0, withComplaints: 0, cleanConversions: 0 },
  };

  conversions.forEach(conversion => {
    Object.keys(stats).forEach(service => {
      const serviceKey = service as keyof typeof stats;
      const serviceData = conversion.services[serviceKey];
      
      if (serviceData) {
        stats[serviceKey].prospects++;
        
        if (serviceData.converted) {
          stats[serviceKey].conversions++;
          
          // Only count as clean conversion if no complaint
          if (!serviceData.hasComplaint) {
            stats[serviceKey].cleanConversions++;
          }
        }
        
        if (serviceData.hasComplaint) {
          stats[serviceKey].withComplaints++;
        }
      }
    });
  });

  return {
    stats,
    rates: {
      oec: {
        overall: stats.oec.prospects > 0 ? (stats.oec.conversions / stats.oec.prospects * 100) : 0,
        clean: stats.oec.prospects > 0 ? (stats.oec.cleanConversions / stats.oec.prospects * 100) : 0,
      },
      owwa: {
        overall: stats.owwa.prospects > 0 ? (stats.owwa.conversions / stats.owwa.prospects * 100) : 0,
        clean: stats.owwa.prospects > 0 ? (stats.owwa.cleanConversions / stats.owwa.prospects * 100) : 0,
      },
      travelVisa: {
        overall: stats.travelVisa.prospects > 0 ? (stats.travelVisa.conversions / stats.travelVisa.prospects * 100) : 0,
        clean: stats.travelVisa.prospects > 0 ? (stats.travelVisa.cleanConversions / stats.travelVisa.prospects * 100) : 0,
      },
      filipinaPassportRenewal: {
        overall: stats.filipinaPassportRenewal.prospects > 0 ? (stats.filipinaPassportRenewal.conversions / stats.filipinaPassportRenewal.prospects * 100) : 0,
        clean: stats.filipinaPassportRenewal.prospects > 0 ? (stats.filipinaPassportRenewal.cleanConversions / stats.filipinaPassportRenewal.prospects * 100) : 0,
      },
      ethiopianPassportRenewal: {
        overall: stats.ethiopianPassportRenewal.prospects > 0 ? (stats.ethiopianPassportRenewal.conversions / stats.ethiopianPassportRenewal.prospects * 100) : 0,
        clean: stats.ethiopianPassportRenewal.prospects > 0 ? (stats.ethiopianPassportRenewal.cleanConversions / stats.ethiopianPassportRenewal.prospects * 100) : 0,
      },
    }
  };
}
