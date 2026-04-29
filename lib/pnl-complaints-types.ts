// Types for P&L Complaints data ingestion and processing

import { SCHENGEN_ALLOWED_COUNTRY_ALIAS_TOKENS } from '@/lib/eu-member-countries';

// Service keys that map to P&L services
export type PnLServiceKey = 
  | 'oec' 
  | 'owwa' 
  | 'ttl' 
  | 'ttlSingle'    // Tourist Visa to Lebanon – Single Entry
  | 'ttlDouble'    // Tourist Visa to Lebanon – Double Entry
  | 'ttlMultiple'  // Tourist Visa to Lebanon – Multiple Entry
  | 'tte' 
  | 'tteSingle'    // Tourist Visa to Egypt – Single Entry
  | 'tteDouble'    // Tourist Visa to Egypt – Double Entry
  | 'tteMultiple'  // Tourist Visa to Egypt – Multiple Entry
  | 'ttj' 
  | 'visaSaudi'
  | 'schengen' 
  | 'gcc' 
  | 'ethiopianPP' 
  | 'filipinaPP';

// Individual complaint record from CSV/API
export interface PnLComplaint {
  contractId: string;
  housemaidId: string;
  clientId: string;
  complaintType: string;
  creationDate: string; // ISO date string
  // Derived field
  serviceKey?: PnLServiceKey;
}

// Deduplicated sale record (after 3-month rule applied)
export interface PnLComplaintSale {
  id: string;
  serviceKey: PnLServiceKey;
  contractId: string;
  clientId: string;
  housemaidId: string;
  firstSaleDate: string;
  lastSaleDate: string;
  occurrenceCount: number; // Total complaints before dedup
  // Used for tracking which complaints contributed to this sale
  complaintDates: string[];
}

// Service-level aggregated data
export interface PnLServiceSales {
  serviceKey: PnLServiceKey;
  serviceName: string;
  uniqueSales: number;
  uniqueClients: number;
  uniqueContracts: number;
  totalComplaints: number; // Before dedup
  byMonth: Record<string, number>; // "2026-01": 5
  sales: PnLComplaintSale[];
}

// Full storage structure
export interface PnLComplaintsData {
  lastUpdated: string;
  rawComplaintsCount: number;
  services: Record<PnLServiceKey, PnLServiceSales>;
  // Summary across all services
  summary: {
    totalUniqueSales: number;
    totalUniqueClients: number;
    totalUniqueContracts: number;
  };
}

// Mapping from complaint types to service keys
export const COMPLAINT_TYPE_MAP: Record<string, PnLServiceKey> = {
  // OEC - Overseas Employment Certificate
  'overseas employment certificate': 'oec',
  'overseas': 'oec',
  'oec': 'oec',
  'contract verification': 'oec',
  'client contract verification': 'oec',
  'maid contract verification': 'oec',
  
  // OWWA
  'client owwa registration': 'owwa',
  'owwa registration': 'owwa',
  'owwa': 'owwa',
  
  // Travel visas - Lebanon (specific entry types)
  'tourist visa to lebanon – single entry': 'ttlSingle',
  'tourist visa to lebanon - single entry': 'ttlSingle',
  'tourist visa to lebanon single entry': 'ttlSingle',
  'tourist visa to lebanon – double entry': 'ttlDouble',
  'tourist visa to lebanon - double entry': 'ttlDouble',
  'tourist visa to lebanon double entry': 'ttlDouble',
  'tourist visa to lebanon – multiple entry': 'ttlMultiple',
  'tourist visa to lebanon - multiple entry': 'ttlMultiple',
  'tourist visa to lebanon multiple entry': 'ttlMultiple',
  
  // Travel visas - Lebanon (fallback)
  'tourist visa to lebanon': 'ttl',
  'travel to lebanon': 'ttl',
  'ttl': 'ttl',
  'lebanon': 'ttl',
  
  // Travel visas - Egypt (specific entry types)
  'tourist visa to egypt – single entry': 'tteSingle',
  'tourist visa to egypt - single entry': 'tteSingle',
  'tourist visa to egypt single entry': 'tteSingle',
  'tourist visa to egypt – double entry': 'tteDouble',
  'tourist visa to egypt - double entry': 'tteDouble',
  'tourist visa to egypt double entry': 'tteDouble',
  'tourist visa to egypt – multiple entry': 'tteMultiple',
  'tourist visa to egypt - multiple entry': 'tteMultiple',
  'tourist visa to egypt multiple entry': 'tteMultiple',
  
  // Travel visas - Egypt (fallback)
  'tourist visa to egypt': 'tte',
  'travel to egypt': 'tte',
  'tte': 'tte',
  'egypt': 'tte',
  
  // Travel visas - Jordan
  'tourist visa to jordan': 'ttj',
  'travel to jordan': 'ttj',
  'ttj': 'ttj',
  'jordan': 'ttj',
  'tourist to jordan': 'ttj',
  
  // Passport renewals - Ethiopian
  'ethiopian passport renewal': 'ethiopianPP',
  'ethiopian pp': 'ethiopianPP',
  'ethiopian pp renewal': 'ethiopianPP',
  
  // Passport renewals - Filipina
  'filipina passport renewal': 'filipinaPP',
  'filipina pp': 'filipinaPP',
  'filipina pp renewal': 'filipinaPP',
  
  // GCC
  'gcc travel': 'gcc',
  'gcc': 'gcc',
  'good conduct certificate': 'gcc',
  'good conduct': 'gcc',
  
  // Schengen — only allowed destinations (see SCHENGEN_ALLOWED_COUNTRY_ALIAS_TOKENS)
  'schengen visa to france': 'schengen',
  'schengen visa to germany': 'schengen',
  'schengen visa to italy': 'schengen',
  'schengen visa to spain': 'schengen',
  'schengen visa to switzerland': 'schengen',
  'schengen visa to croatia': 'schengen',
  'schengen visa to greece': 'schengen',
  'schengen visa to portugal': 'schengen',
  'schengen visa to bulgaria': 'schengen',
  'schengen visa to latvia': 'schengen',
  // Saudi travel visas
  'tourist visa to saudi': 'visaSaudi',
  'tourist visa to saudi arabia': 'visaSaudi',
  'visa to saudi': 'visaSaudi',
  'visa to saudi arabia': 'visaSaudi',
};

// Service display names
export const SERVICE_NAMES: Record<PnLServiceKey, string> = {
  oec: 'Overseas Employment Certificate',
  owwa: 'OWWA Registration',
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

// All service keys for iteration
export const ALL_SERVICE_KEYS: PnLServiceKey[] = [
  'oec',
  'owwa',
  'ttl',
  'ttlSingle',
  'ttlDouble',
  'ttlMultiple',
  'tte',
  'tteSingle',
  'tteDouble',
  'tteMultiple',
  'ttj',
  'visaSaudi',
  'schengen',
  'gcc',
  'ethiopianPP',
  'filipinaPP',
];

// Get service key from complaint type (returns undefined if not a tracked service)
export function getServiceKeyFromComplaintType(complaintType: string): PnLServiceKey | undefined {
  const normalized = complaintType.toLowerCase().trim();
  
  // First try exact match
  if (COMPLAINT_TYPE_MAP[normalized]) {
    return COMPLAINT_TYPE_MAP[normalized];
  }
  
  // Then try partial/contains matching for flexibility
  // Order matters - check more specific patterns first
  
  // OEC: Contract Verification OR anything with "overseas"
  if (normalized.includes('contract verification') || 
      normalized.includes('contract verif') ||
      normalized.includes('client contract verification')) {
    return 'oec'; // All contract verification counts as OEC
  }
  if (normalized.includes('overseas')) {
    return 'oec'; // Anything with "overseas" is OEC
  }
  if (normalized.includes('oec')) {
    return 'oec';
  }
  
  // OWWA
  if (normalized.includes('owwa')) {
    return 'owwa';
  }
  
  // Saudi travel (before GCC / generic schengen)
  if (
    (normalized.includes('saudi') || normalized.includes('ksa')) &&
    (normalized.includes('visa') || normalized.includes('tourist') || normalized.includes('travel'))
  ) {
    return 'visaSaudi';
  }

  // Schengen — only listed destinations (not Netherlands, Turkey, etc.)
  if (normalized.includes('schengen')) {
    if (SCHENGEN_ALLOWED_COUNTRY_ALIAS_TOKENS.some((t) => normalized.includes(t))) {
      return 'schengen';
    }
    return undefined;
  }
  
  // Travel Visas - Lebanon (check specific entry types first)
  if (normalized.includes('lebanon')) {
    if (normalized.includes('single entry') || normalized.includes('single-entry')) {
      return 'ttlSingle';
    }
    if (normalized.includes('double entry') || normalized.includes('double-entry')) {
      return 'ttlDouble';
    }
    if (normalized.includes('multiple entry') || normalized.includes('multiple-entry')) {
      return 'ttlMultiple';
    }
    return 'ttl'; // Generic Lebanon visa
  }
  
  // Travel Visas - Egypt (check specific entry types first)
  if (normalized.includes('egypt')) {
    if (normalized.includes('single entry') || normalized.includes('single-entry')) {
      return 'tteSingle';
    }
    if (normalized.includes('double entry') || normalized.includes('double-entry')) {
      return 'tteDouble';
    }
    if (normalized.includes('multiple entry') || normalized.includes('multiple-entry')) {
      return 'tteMultiple';
    }
    return 'tte'; // Generic Egypt visa
  }
  if (normalized.includes('jordan')) {
    return 'ttj';
  }
  
  // Passport Renewals
  if (normalized.includes('ethiopian') && normalized.includes('passport')) {
    return 'ethiopianPP';
  }
  if (normalized.includes('filipina') && normalized.includes('passport')) {
    return 'filipinaPP';
  }
  
  // GCC
  if (normalized.includes('gcc') || normalized.includes('good conduct')) {
    return 'gcc';
  }
  
  return undefined;
}

// Generate a unique key for deduplication (service + contract + client + housemaid)
export function getSaleGroupKey(complaint: PnLComplaint): string {
  const serviceKey = complaint.serviceKey || getServiceKeyFromComplaintType(complaint.complaintType);
  return `${serviceKey || 'unknown'}_${complaint.contractId || 'no-contract'}_${complaint.clientId || 'no-client'}_${complaint.housemaidId || 'no-housemaid'}`;
}

// Check if two dates are within 3 months of each other
export function isWithinThreeMonths(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    return false;
  }
  
  // Calculate difference in months
  const monthsDiff = Math.abs(
    (d2.getFullYear() - d1.getFullYear()) * 12 + 
    (d2.getMonth() - d1.getMonth())
  );
  
  // If less than 3 full months
  if (monthsDiff < 3) {
    return true;
  }
  
  // If exactly 3 months, compare the day of month
  if (monthsDiff === 3) {
    const laterDate = d1 > d2 ? d1 : d2;
    const earlierDate = d1 > d2 ? d2 : d1;
    
    // Calculate exact 3 months from earlier date
    const threeMonthsLater = new Date(earlierDate);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    
    return laterDate < threeMonthsLater;
  }
  
  return false;
}

// Create empty service sales structure
export function createEmptyServiceSales(serviceKey: PnLServiceKey): PnLServiceSales {
  return {
    serviceKey,
    serviceName: SERVICE_NAMES[serviceKey],
    uniqueSales: 0,
    uniqueClients: 0,
    uniqueContracts: 0,
    totalComplaints: 0,
    byMonth: {},
    sales: [],
  };
}

// Create empty complaints data structure
export function createEmptyComplaintsData(): PnLComplaintsData {
  const services: Record<PnLServiceKey, PnLServiceSales> = {} as Record<PnLServiceKey, PnLServiceSales>;
  
  for (const key of ALL_SERVICE_KEYS) {
    services[key] = createEmptyServiceSales(key);
  }
  
  return {
    lastUpdated: new Date().toISOString(),
    rawComplaintsCount: 0,
    services,
    summary: {
      totalUniqueSales: 0,
      totalUniqueClients: 0,
      totalUniqueContracts: 0,
    },
  };
}

