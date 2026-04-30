import { put, list, del } from '@vercel/blob';
import { PUBLIC_JSON_PUT_OPTIONS, resolveBlobReadUrl } from '@/lib/vercel-blob-json';
import type { ProcessedConversation, DailyData, RunStats } from './storage';
import type { OverseasSalesData, TodoRow } from './todo-types';
import { processOverseasSales, mergeOverseasSales } from './todo-processor';

// Blob path prefixes
const DAILY_PREFIX = 'daily/';
const OVERSEAS_SALES_PATH = 'overseas-sales.json';
const DATES_INDEX_PATH = 'dates-index.json';
const COST_LOG_PATH = 'cost-log.json';

// Helper to check if we're in development mode (use file system) or production (use blob)
export function isVercelEnvironment(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

// ============================================================
// Generic Blob Operations
// ============================================================

async function readBlob<T>(path: string): Promise<T | null> {
  try {
    const url = await resolveBlobReadUrl(path);
    if (!url) return null;

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    console.error(`[Blob] Error reading ${path}:`, error);
    return null;
  }
}

async function writeBlob<T>(path: string, data: T): Promise<void> {
  try {
    // Add metadata for version tracking
    const dataWithMeta = {
      ...data,
      _blobMeta: {
        lastModified: new Date().toISOString(),
        version: Date.now(),
      },
    };
    
    await put(path, JSON.stringify(dataWithMeta, null, 2), PUBLIC_JSON_PUT_OPTIONS);
    
    console.log(`[Blob] Successfully wrote ${path} at version ${dataWithMeta._blobMeta.version}`);
  } catch (error) {
    console.error(`[Blob] Error writing ${path}:`, error);
    throw error;
  }
}

async function deleteBlob(path: string): Promise<void> {
  try {
    await del(path);
  } catch (error) {
    console.error(`[Blob] Error deleting ${path}:`, error);
  }
}

// ============================================================
// Daily Data Operations
// ============================================================

function getDailyBlobPath(date: string): string {
  return `${DAILY_PREFIX}${date}.json`;
}

export async function getDailyDataBlob(date: string): Promise<DailyData | null> {
  return await readBlob<DailyData>(getDailyBlobPath(date));
}

export async function saveDailyDataBlob(date: string, data: DailyData): Promise<void> {
  data.summary = calculateSummary(data.results);
  await writeBlob(getDailyBlobPath(date), data);
  await addDateToIndexBlob(date);
}

export async function getAvailableDatesBlob(): Promise<string[]> {
  try {
    const { blobs } = await list({ prefix: DAILY_PREFIX });
    const dates = blobs
      .map(blob => blob.pathname.replace(DAILY_PREFIX, '').replace('.json', ''))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse();
    return dates;
  } catch (error) {
    console.error('[Blob] Error listing dates:', error);
    return [];
  }
}

async function addDateToIndexBlob(date: string): Promise<void> {
  const index = await readBlob<{ dates: string[] }>(DATES_INDEX_PATH) || { dates: [] };
  if (!index.dates.includes(date)) {
    index.dates.push(date);
    index.dates.sort().reverse();
    await writeBlob(DATES_INDEX_PATH, { dates: index.dates, lastUpdated: new Date().toISOString() });
  }
}

// ============================================================
// Overseas Sales Operations
// ============================================================

export async function getOverseasSalesDataBlob(): Promise<OverseasSalesData | null> {
  return await readBlob<OverseasSalesData>(OVERSEAS_SALES_PATH);
}

export async function saveOverseasSalesDataBlob(data: OverseasSalesData): Promise<void> {
  await writeBlob(OVERSEAS_SALES_PATH, data);
}

export async function processTodosAndSaveBlob(todos: TodoRow[]): Promise<OverseasSalesData> {
  const existing = await getOverseasSalesDataBlob();
  const updated = mergeOverseasSales(existing, todos);
  await saveOverseasSalesDataBlob(updated);
  return updated;
}

export async function reprocessAllOverseasSalesBlob(todos: TodoRow[]): Promise<OverseasSalesData> {
  const data = processOverseasSales(todos);
  await saveOverseasSalesDataBlob(data);
  return data;
}

export async function getOverseasSalesSummaryBlob(): Promise<{
  totalSales: number;
  totalRawTodos: number;
  salesByMonth: Record<string, number>;
  lastUpdated: string | null;
}> {
  const data = await getOverseasSalesDataBlob();
  if (!data) {
    return {
      totalSales: 0,
      totalRawTodos: 0,
      salesByMonth: {},
      lastUpdated: null,
    };
  }
  return {
    totalSales: data.totalDedupedSales,
    totalRawTodos: data.totalRawTodos,
    salesByMonth: data.salesByMonth,
    lastUpdated: data.lastUpdated,
  };
}

// ============================================================
// Summary Calculation (copied from storage.ts)
// ============================================================

function calculateSummary(results: ProcessedConversation[]) {
  let oec = 0, owwa = 0, travelVisa = 0, filipinaPassportRenewal = 0, ethiopianPassportRenewal = 0;
  let oecConverted = 0, owwaConverted = 0, travelVisaConverted = 0, filipinaPassportRenewalConverted = 0, ethiopianPassportRenewalConverted = 0;
  const countryCounts: Record<string, number> = {};
  const byContractType = {
    CC: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
    MV: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
  };
  
  const householdMap = new Map<string, ProcessedConversation[]>();
  
  for (const result of results) {
    const householdKey = result.contractId || `standalone_${result.id}`;
    if (!householdMap.has(householdKey)) {
      householdMap.set(householdKey, []);
    }
    householdMap.get(householdKey)!.push(result);
  }
  
  for (const [, members] of householdMap) {
    const contractType = members.find(m => m.contractType)?.contractType || '';
    
    const hasOEC = members.some(m => m.isOECProspect);
    const hasOWWA = members.some(m => m.isOWWAProspect);
    const hasTravelVisa = members.some(m => m.isTravelVisaProspect);
    const hasFilipinaPassportRenewal = members.some(m => m.isFilipinaPassportRenewalProspect);
    const hasEthiopianPassportRenewal = members.some(m => m.isEthiopianPassportRenewalProspect);
    
    const oecConv = members.some(m => m.oecConverted);
    const owwaConv = members.some(m => m.owwaConverted);
    const travelVisaConv = members.some(m => m.travelVisaConverted);
    const filipinaPassportRenewalConv = members.some(m => m.filipinaPassportRenewalConverted);
    const ethiopianPassportRenewalConv = members.some(m => m.ethiopianPassportRenewalConverted);
    
    if (hasOEC) {
      oec++;
      if (oecConv) oecConverted++;
      if (contractType === 'CC') byContractType.CC.oec++;
      else if (contractType === 'MV') byContractType.MV.oec++;
    }
    if (hasOWWA) {
      owwa++;
      if (owwaConv) owwaConverted++;
      if (contractType === 'CC') byContractType.CC.owwa++;
      else if (contractType === 'MV') byContractType.MV.owwa++;
    }
    if (hasTravelVisa) {
      travelVisa++;
      if (travelVisaConv) travelVisaConverted++;
      if (contractType === 'CC') byContractType.CC.travelVisa++;
      else if (contractType === 'MV') byContractType.MV.travelVisa++;
      
      const householdCountries = new Set<string>();
      for (const member of members) {
        if (member.isTravelVisaProspect) {
          for (const country of member.travelVisaCountries) {
            householdCountries.add(country);
          }
        }
      }
      for (const country of householdCountries) {
        countryCounts[country] = (countryCounts[country] || 0) + 1;
      }
    }
    if (hasFilipinaPassportRenewal) {
      filipinaPassportRenewal++;
      if (filipinaPassportRenewalConv) filipinaPassportRenewalConverted++;
      if (contractType === 'CC') byContractType.CC.filipinaPassportRenewal++;
      else if (contractType === 'MV') byContractType.MV.filipinaPassportRenewal++;
    }
    if (hasEthiopianPassportRenewal) {
      ethiopianPassportRenewal++;
      if (ethiopianPassportRenewalConv) ethiopianPassportRenewalConverted++;
      if (contractType === 'CC') byContractType.CC.ethiopianPassportRenewal++;
      else if (contractType === 'MV') byContractType.MV.ethiopianPassportRenewal++;
    }
  }
  
  return { 
    oec, owwa, travelVisa, filipinaPassportRenewal, ethiopianPassportRenewal,
    oecConverted, owwaConverted, travelVisaConverted, filipinaPassportRenewalConverted, ethiopianPassportRenewalConverted,
    countryCounts, byContractType 
  };
}

// ============================================================
// Run Management
// ============================================================

export async function startRunBlob(date: string): Promise<string> {
  const data = await getDailyDataBlob(date);
  if (!data) throw new Error(`No data for date ${date}`);
  
  const runId = `${date}-${Date.now()}`;
  const run: RunStats = {
    runId,
    startedAt: new Date().toISOString(),
    totalCost: 0,
    successCount: 0,
    failureCount: 0,
    conversationsProcessed: 0,
  };
  
  data.runs.push(run);
  data.isProcessing = true;
  data.currentRunId = runId;
  await saveDailyDataBlob(date, data);
  
  return runId;
}

export async function updateRunBlob(date: string, runId: string, stats: Partial<RunStats>): Promise<void> {
  const data = await getDailyDataBlob(date);
  if (!data) return;
  
  const run = data.runs.find(r => r.runId === runId);
  if (run) {
    Object.assign(run, stats);
    await saveDailyDataBlob(date, data);
  }
}

export async function completeRunBlob(date: string, runId: string): Promise<void> {
  const data = await getDailyDataBlob(date);
  if (!data) return;
  
  const run = data.runs.find(r => r.runId === runId);
  if (run) {
    run.completedAt = new Date().toISOString();
  }
  data.isProcessing = false;
  data.currentRunId = undefined;
  await saveDailyDataBlob(date, data);
}

export async function getLatestRunBlob(date: string): Promise<RunStats | null> {
  const data = await getDailyDataBlob(date);
  if (!data || data.runs.length === 0) return null;
  return data.runs[data.runs.length - 1];
}

// ============================================================
// Aggregated Results
// ============================================================

export async function getAggregatedResultsByDateBlob(date: string) {
  const data = await getDailyDataBlob(date);
  
  const defaultByContractType = {
    CC: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
    MV: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
  };
  
  if (!data) {
    return {
      date,
      totalProcessed: 0,
      totalConversations: 0,
      isProcessing: false,
      prospects: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
      conversions: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
      countryCounts: {},
      byContractType: defaultByContractType,
      latestRun: null,
    };
  }
  
  const latestRun = await getLatestRunBlob(date);
  
  return {
    date,
    fileName: data.fileName,
    totalProcessed: data.processedCount,
    totalConversations: data.totalConversations,
    isProcessing: data.isProcessing,
    prospects: {
      oec: data.summary.oec,
      owwa: data.summary.owwa,
      travelVisa: data.summary.travelVisa,
      filipinaPassportRenewal: data.summary.filipinaPassportRenewal || 0,
      ethiopianPassportRenewal: data.summary.ethiopianPassportRenewal || 0,
    },
    conversions: {
      oec: data.summary.oecConverted,
      owwa: data.summary.owwaConverted,
      travelVisa: data.summary.travelVisaConverted,
      filipinaPassportRenewal: data.summary.filipinaPassportRenewalConverted || 0,
      ethiopianPassportRenewal: data.summary.ethiopianPassportRenewalConverted || 0,
    },
    countryCounts: data.summary.countryCounts,
    byContractType: data.summary.byContractType || defaultByContractType,
    latestRun,
  };
}

// ============================================================
// Prospect Details
// ============================================================

export async function getProspectDetailsByDateBlob(date: string) {
  const data = await getDailyDataBlob(date);
  if (!data) return [];
  
  const prospects = data.results.filter(r => 
    r.isOECProspect || 
    r.isOWWAProspect || 
    r.isTravelVisaProspect || 
    r.isFilipinaPassportRenewalProspect || 
    r.isEthiopianPassportRenewalProspect
  );
  
  // Deduplicate by conversationId (keep the first occurrence)
  const seen = new Map<string, typeof prospects[0]>();
  for (const prospect of prospects) {
    if (!seen.has(prospect.conversationId)) {
      seen.set(prospect.conversationId, prospect);
    }
  }
  
  return Array.from(seen.values());
}

export interface HouseholdGroup {
  householdId: string;
  contractId: string;
  members: ProcessedConversation[];
  hasClient: boolean;
  hasMaid: boolean;
  clientName: string;
  maidNames: string[];
  isProspect: boolean;
  prospectTypes: {
    oec: boolean;
    owwa: boolean;
    travelVisa: boolean;
  };
  conversions: {
    oec: boolean;
    owwa: boolean;
    travelVisa: boolean;
  };
}

export async function getProspectsGroupedByHouseholdBlob(date: string): Promise<HouseholdGroup[]> {
  const data = await getDailyDataBlob(date);
  if (!data) return [];
  
  // Filter to only prospects
  const allProspects = data.results.filter(r => 
    r.isOECProspect || 
    r.isOWWAProspect || 
    r.isTravelVisaProspect || 
    r.isFilipinaPassportRenewalProspect || 
    r.isEthiopianPassportRenewalProspect
  );
  
  // Deduplicate by conversationId first (keep the first occurrence)
  const seen = new Map<string, ProcessedConversation>();
  for (const prospect of allProspects) {
    if (!seen.has(prospect.conversationId)) {
      seen.set(prospect.conversationId, prospect);
    }
  }
  const prospects = Array.from(seen.values());
  
  const householdMap = new Map<string, ProcessedConversation[]>();
  
  for (const prospect of prospects) {
    const householdKey = prospect.contractId || `standalone_${prospect.id}`;
    if (!householdMap.has(householdKey)) {
      householdMap.set(householdKey, []);
    }
    householdMap.get(householdKey)!.push(prospect);
  }
  
  const households: HouseholdGroup[] = [];
  
  for (const [key, members] of householdMap) {
    const isStandalone = key.startsWith('standalone_');
    const contractId = isStandalone ? '' : key;
    
    const hasClient = members.some(m => m.clientId);
    const hasMaid = members.some(m => m.maidId);
    const clientName = members.find(m => m.clientName)?.clientName || '';
    const maidNames = [...new Set(members.map(m => m.maidName).filter(Boolean))];
    
    const prospectTypes = {
      oec: members.some(m => m.isOECProspect),
      owwa: members.some(m => m.isOWWAProspect),
      travelVisa: members.some(m => m.isTravelVisaProspect),
    };
    
    const conversions = {
      oec: members.some(m => m.oecConverted),
      owwa: members.some(m => m.owwaConverted),
      travelVisa: members.some(m => m.travelVisaConverted),
    };
    
    households.push({
      householdId: key,
      contractId,
      members,
      hasClient,
      hasMaid,
      clientName,
      maidNames,
      isProspect: true,
      prospectTypes,
      conversions,
    });
  }
  
  households.sort((a, b) => {
    if (a.contractId && !b.contractId) return -1;
    if (!a.contractId && b.contractId) return 1;
    return a.householdId.localeCompare(b.householdId);
  });
  
  return households;
}

