import * as fs from 'fs';
import * as path from 'path';
import { put } from '@vercel/blob';
import { PUBLIC_JSON_PUT_OPTIONS, resolveBlobReadUrl } from '@/lib/vercel-blob-json';
import type { 
  PnLComplaint, 
  PnLComplaintSale, 
  PnLServiceSales,
  PnLComplaintsData,
  PnLServiceKey,
} from './pnl-complaints-types';
import { 
  getServiceKeyFromComplaintType, 
  getSaleGroupKey, 
  isWithinThreeMonths,
  createEmptyComplaintsData,
  createEmptyServiceSales,
  ALL_SERVICE_KEYS,
} from './pnl-complaints-types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PNL_COMPLAINTS_FILE = path.join(DATA_DIR, 'pnl-complaints.json');
const PNL_COMPLAINTS_BLOB_PATH = 'pnl-complaints.json';

// Check if we're in Vercel environment (use Blob) or local (use file system)
function isVercelEnvironment(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Parse date string to ISO format
// Handles: "2026-01-29 21:00:35.000" format from CSV
export function parseComplaintDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  // If already ISO format
  if (dateStr.includes('T')) return dateStr;
  
  // Parse "YYYY-MM-DD HH:MM:SS.mmm" format
  const [datePart, timePart] = dateStr.split(' ');
  if (!datePart) return new Date().toISOString();
  
  const [year, month, day] = datePart.split('-').map(Number);
  const timeClean = (timePart || '0:0:0').split('.')[0];
  const [hour, minute, second] = timeClean.split(':').map(Number);
  
  return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0).toISOString();
}

// Get month key from ISO date (e.g., "2026-01")
function getMonthKey(isoDate: string): string {
  return isoDate.substring(0, 7);
}

interface GroupedComplaint {
  key: string;
  serviceKey: PnLServiceKey;
  contractId: string;
  clientId: string;
  housemaidId: string;
  complaints: PnLComplaint[];
}

/**
 * Process complaints and apply deduplication logic:
 * - Filter to only tracked service types
 * - Group by service + contract_id + client_id + housemaid_id
 * - If complaints are < 3 months apart, count as ONE sale
 * - If a new complaint is > 3 months from the previous, it's a NEW sale
 */
export function processPnLComplaints(complaints: PnLComplaint[]): PnLComplaintsData {
  const result = createEmptyComplaintsData();
  result.rawComplaintsCount = complaints.length;
  
  // Step 1: Filter and map complaints to services
  const validComplaints: PnLComplaint[] = [];
  
  for (const complaint of complaints) {
    const serviceKey = getServiceKeyFromComplaintType(complaint.complaintType);
    if (serviceKey) {
      validComplaints.push({
        ...complaint,
        serviceKey,
        creationDate: parseComplaintDate(complaint.creationDate),
      });
    }
  }
  
  // Step 2: Group complaints by sale key (service + contract + client + housemaid)
  const groupedMap = new Map<string, GroupedComplaint>();
  
  for (const complaint of validComplaints) {
    const key = getSaleGroupKey(complaint);
    
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        key,
        serviceKey: complaint.serviceKey!,
        contractId: complaint.contractId,
        clientId: complaint.clientId,
        housemaidId: complaint.housemaidId,
        complaints: [],
      });
    }
    
    groupedMap.get(key)!.complaints.push(complaint);
  }
  
  // Step 3: For each group, apply 3-month deduplication
  const allClients = new Set<string>();
  const allContracts = new Set<string>();
  
  for (const [, group] of groupedMap) {
    const serviceKey = group.serviceKey;
    const serviceSales = result.services[serviceKey];
    
    // Track clients and contracts for this service
    if (group.clientId) {
      allClients.add(group.clientId);
    }
    if (group.contractId) {
      allContracts.add(group.contractId);
    }
    
    // Sort complaints by date (earliest first)
    const sortedComplaints = [...group.complaints].sort((a, b) => {
      const dateA = new Date(a.creationDate);
      const dateB = new Date(b.creationDate);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Apply 3-month windowing to count distinct sales
    const salePeriods: { startDate: string; endDate: string; dates: string[] }[] = [];
    
    for (const complaint of sortedComplaints) {
      if (!complaint.creationDate) continue;
      
      // Find if this complaint falls within an existing sale period
      let addedToExisting = false;
      
      for (const period of salePeriods) {
        // Check if this complaint is within 3 months of the start of this period
        if (isWithinThreeMonths(period.startDate, complaint.creationDate)) {
          // Add to existing period, extend end date if needed
          period.dates.push(complaint.creationDate);
          if (new Date(complaint.creationDate) > new Date(period.endDate)) {
            period.endDate = complaint.creationDate;
          }
          addedToExisting = true;
          break;
        }
      }
      
      if (!addedToExisting) {
        // Start a new sale period
        salePeriods.push({
          startDate: complaint.creationDate,
          endDate: complaint.creationDate,
          dates: [complaint.creationDate],
        });
      }
    }
    
    // Each period = one deduplicated sale
    serviceSales.totalComplaints += group.complaints.length;
    serviceSales.uniqueSales += salePeriods.length;
    
    // Track unique clients and contracts for this service
    const serviceClients = new Set<string>();
    const serviceContracts = new Set<string>();
    if (group.clientId) serviceClients.add(group.clientId);
    if (group.contractId) serviceContracts.add(group.contractId);
    
    // Track sales by month (using first occurrence of each period)
    for (const period of salePeriods) {
      const monthKey = getMonthKey(period.startDate);
      if (monthKey && monthKey.length === 7) {
        serviceSales.byMonth[monthKey] = (serviceSales.byMonth[monthKey] || 0) + 1;
      }
      
      // Create the sale record
      const sale: PnLComplaintSale = {
        id: `sale_${group.key}_${period.startDate.substring(0, 10)}`,
        serviceKey,
        contractId: group.contractId,
        clientId: group.clientId,
        housemaidId: group.housemaidId,
        firstSaleDate: period.startDate,
        lastSaleDate: period.endDate,
        occurrenceCount: period.dates.length,
        complaintDates: period.dates,
      };
      
      serviceSales.sales.push(sale);
    }
    
    // Update unique counts
    serviceSales.uniqueClients = new Set(
      serviceSales.sales.map(s => s.clientId).filter(Boolean)
    ).size;
    serviceSales.uniqueContracts = new Set(
      serviceSales.sales.map(s => s.contractId).filter(Boolean)
    ).size;
  }
  
  // Calculate summary totals
  result.summary.totalUniqueSales = ALL_SERVICE_KEYS.reduce(
    (sum, key) => sum + result.services[key].uniqueSales, 
    0
  );
  result.summary.totalUniqueClients = allClients.size;
  result.summary.totalUniqueContracts = allContracts.size;
  result.lastUpdated = new Date().toISOString();
  
  return result;
}

/**
 * Filter complaints by date range
 */
export function filterComplaintsByDateRange(
  data: PnLComplaintsData,
  startDate?: string,
  endDate?: string
): PnLComplaintsData {
  if (!startDate && !endDate) {
    return data;
  }
  
  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date('9999-12-31');
  
  // Collect all complaints from all sales that fall within the date range
  const complaintsToKeep: PnLComplaint[] = [];
  
  for (const serviceKey of ALL_SERVICE_KEYS) {
    const service = data.services[serviceKey];
    
    for (const sale of service.sales) {
      for (const dateStr of sale.complaintDates) {
        const date = new Date(dateStr);
        
        // KEEP complaints that are OUTSIDE the range (we're deleting the range)
        if (date < start || date > end) {
          complaintsToKeep.push({
            contractId: sale.contractId,
            housemaidId: sale.housemaidId,
            clientId: sale.clientId,
            complaintType: service.serviceName,
            creationDate: dateStr,
            serviceKey,
          });
        }
      }
    }
  }
  
  // Reprocess the remaining complaints
  return processPnLComplaints(complaintsToKeep);
}

/**
 * Blob Storage functions (for Vercel deployment)
 */
async function readBlobData(): Promise<PnLComplaintsData | null> {
  try {
    const url = await resolveBlobReadUrl(PNL_COMPLAINTS_BLOB_PATH);
    if (!url) return null;

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    
    return await response.json();
  } catch (error) {
    console.error('[P&L Complaints] Error reading blob:', error);
    return null;
  }
}

async function writeBlobData(data: PnLComplaintsData): Promise<void> {
  try {
    // Use allowOverwrite to handle concurrent requests without conflicts
    await put(PNL_COMPLAINTS_BLOB_PATH, JSON.stringify(data, null, 2), PUBLIC_JSON_PUT_OPTIONS);
  } catch (error) {
    console.error('[P&L Complaints] Error writing blob:', error);
    throw error;
  }
}

/**
 * Local file storage functions
 */
function readLocalData(): PnLComplaintsData | null {
  ensureDataDir();
  if (!fs.existsSync(PNL_COMPLAINTS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PNL_COMPLAINTS_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function writeLocalData(data: PnLComplaintsData): void {
  ensureDataDir();
  fs.writeFileSync(PNL_COMPLAINTS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Unified storage functions (auto-detect environment)
 */
export async function getPnLComplaintsDataAsync(): Promise<PnLComplaintsData | null> {
  if (isVercelEnvironment()) {
    return await readBlobData();
  }
  return readLocalData();
}

export async function savePnLComplaintsDataAsync(data: PnLComplaintsData): Promise<void> {
  if (isVercelEnvironment()) {
    await writeBlobData(data);
  } else {
    writeLocalData(data);
  }
}

// Sync versions for backwards compatibility (local only)
export function getPnLComplaintsData(): PnLComplaintsData | null {
  // For sync access, only use local storage
  // In production, use async versions
  return readLocalData();
}

export function savePnLComplaintsData(data: PnLComplaintsData): void {
  writeLocalData(data);
}

/**
 * Process and save complaints (replaces all existing data) - ASYNC version
 */
export async function processAndSavePnLComplaintsAsync(complaints: PnLComplaint[]): Promise<PnLComplaintsData> {
  const data = processPnLComplaints(complaints);
  await savePnLComplaintsDataAsync(data);
  return data;
}

// Sync version for local development
export function processAndSavePnLComplaints(complaints: PnLComplaint[]): PnLComplaintsData {
  const data = processPnLComplaints(complaints);
  savePnLComplaintsData(data);
  return data;
}

/**
 * Extract raw complaints from existing data structure
 * Used when appending new complaints to existing data
 */
function extractRawComplaints(data: PnLComplaintsData): PnLComplaint[] {
  const complaints: PnLComplaint[] = [];
  
  for (const serviceKey of ALL_SERVICE_KEYS) {
    const service = data.services[serviceKey];
    
    for (const sale of service.sales) {
      // Each sale can have multiple complaint dates
      for (const dateStr of sale.complaintDates) {
        complaints.push({
          contractId: sale.contractId,
          housemaidId: sale.housemaidId,
          clientId: sale.clientId,
          complaintType: service.serviceName,
          creationDate: dateStr,
          serviceKey,
        });
      }
    }
  }
  
  return complaints;
}

/**
 * Append new complaints to existing data and reprocess - ASYNC version
 * Used for batched uploads and incremental updates
 */
export async function appendAndSavePnLComplaintsAsync(newComplaints: PnLComplaint[]): Promise<PnLComplaintsData> {
  // Get existing data
  const existingData = await getPnLComplaintsDataAsync();
  
  // If no existing data, just process the new complaints
  if (!existingData) {
    return processAndSavePnLComplaintsAsync(newComplaints);
  }
  
  // Extract existing complaints from the data structure
  const existingComplaints = extractRawComplaints(existingData);
  
  // Combine and reprocess all complaints
  const allComplaints = [...existingComplaints, ...newComplaints];
  const data = processPnLComplaints(allComplaints);
  
  await savePnLComplaintsDataAsync(data);
  return data;
}

// Sync version for local development
export function appendAndSavePnLComplaints(newComplaints: PnLComplaint[]): PnLComplaintsData {
  const existingData = getPnLComplaintsData();
  
  if (!existingData) {
    return processAndSavePnLComplaints(newComplaints);
  }
  
  const existingComplaints = extractRawComplaints(existingData);
  const allComplaints = [...existingComplaints, ...newComplaints];
  const data = processPnLComplaints(allComplaints);
  
  savePnLComplaintsData(data);
  return data;
}

/**
 * Clear complaints by date range and save - ASYNC version
 */
export async function clearComplaintsByDateRangeAsync(
  startDate?: string,
  endDate?: string
): Promise<PnLComplaintsData> {
  const existing = await getPnLComplaintsDataAsync();
  
  if (!existing) {
    return createEmptyComplaintsData();
  }
  
  const filtered = filterComplaintsByDateRange(existing, startDate, endDate);
  await savePnLComplaintsDataAsync(filtered);
  return filtered;
}

// Sync version for local development
export function clearComplaintsByDateRange(
  startDate?: string,
  endDate?: string
): PnLComplaintsData {
  const existing = getPnLComplaintsData();
  
  if (!existing) {
    return createEmptyComplaintsData();
  }
  
  const filtered = filterComplaintsByDateRange(existing, startDate, endDate);
  savePnLComplaintsData(filtered);
  return filtered;
}

/**
 * Get service volumes for P&L calculation - ASYNC version
 */
export async function getServiceVolumesAsync(): Promise<Record<PnLServiceKey, number>> {
  const data = await getPnLComplaintsDataAsync();
  
  const volumes: Record<PnLServiceKey, number> = {
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
  
  if (!data) return volumes;
  
  for (const key of ALL_SERVICE_KEYS) {
    volumes[key] = data.services[key].uniqueSales;
  }
  
  return volumes;
}

// Sync version for local development
export function getServiceVolumes(): Record<PnLServiceKey, number> {
  const data = getPnLComplaintsData();
  
  const volumes: Record<PnLServiceKey, number> = {
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
  
  if (!data) return volumes;
  
  for (const key of ALL_SERVICE_KEYS) {
    volumes[key] = data.services[key].uniqueSales;
  }
  
  return volumes;
}

/**
 * Get sales by month for a specific service
 */
export function getServiceSalesByMonth(serviceKey: PnLServiceKey): Record<string, number> {
  const data = getPnLComplaintsData();
  if (!data) return {};
  return data.services[serviceKey].byMonth;
}

/**
 * Get summary statistics - ASYNC version
 */
export async function getPnLComplaintsSummaryAsync(): Promise<{
  totalSales: number;
  totalComplaints: number;
  salesByService: Record<PnLServiceKey, number>;
  lastUpdated: string | null;
}> {
  const data = await getPnLComplaintsDataAsync();
  
  if (!data) {
    return {
      totalSales: 0,
      totalComplaints: 0,
      salesByService: {
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
      },
      lastUpdated: null,
    };
  }
  
  const salesByService: Record<PnLServiceKey, number> = {} as Record<PnLServiceKey, number>;
  
  for (const key of ALL_SERVICE_KEYS) {
    salesByService[key] = data.services[key].uniqueSales;
  }
  
  return {
    totalSales: data.summary.totalUniqueSales,
    totalComplaints: data.rawComplaintsCount,
    salesByService,
    lastUpdated: data.lastUpdated,
  };
}

// Sync version for backwards compatibility
export function getPnLComplaintsSummary(): {
  totalSales: number;
  totalComplaints: number;
  salesByService: Record<PnLServiceKey, number>;
  lastUpdated: string | null;
} {
  const data = getPnLComplaintsData();
  
  if (!data) {
    return {
      totalSales: 0,
      totalComplaints: 0,
      salesByService: {
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
      },
      lastUpdated: null,
    };
  }
  
  const salesByService: Record<PnLServiceKey, number> = {} as Record<PnLServiceKey, number>;
  
  for (const key of ALL_SERVICE_KEYS) {
    salesByService[key] = data.services[key].uniqueSales;
  }
  
  return {
    totalSales: data.summary.totalUniqueSales,
    totalComplaints: data.rawComplaintsCount,
    salesByService,
    lastUpdated: data.lastUpdated,
  };
}

