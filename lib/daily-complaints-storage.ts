import { head, list, put } from '@vercel/blob';
import type { ComplaintsDailySummaryRow } from './complaints-daily-summary';
import type { PnLComplaint, PnLServiceKey } from './pnl-complaints-types';
import { getServiceKeyFromComplaintType } from './pnl-complaints-types';

const BLOB_PREFIX = 'complaints-daily/';

/** Drop empty rows (e.g. trailing CSV blanks) so they do not merge under one dedupe key. */
export function isValidPnLComplaint(c: PnLComplaint): boolean {
  if (!c.creationDate || !String(c.creationDate).trim()) return false;
  if (!c.complaintType || !String(c.complaintType).trim()) return false;
  const hasId =
    Boolean(c.housemaidId && String(c.housemaidId).trim()) ||
    Boolean(c.contractId && String(c.contractId).trim()) ||
    Boolean(c.clientId && String(c.clientId).trim());
  return hasId;
}

export interface DailyComplaintsData {
  date: string; // YYYY-MM-DD
  lastUpdated: string;
  complaints: PnLComplaint[];
  totalComplaints: number;
  /** Optional aggregates (YESTERDAY / THIS_MONTH / LAST_MONTH per complaint type). */
  summary?: ComplaintsDailySummaryRow[];
}

/**
 * Store daily complaints data in Vercel Blob Storage
 */
export async function storeDailyComplaints(
  date: string,
  complaints: PnLComplaint[],
  mergeWithExisting: boolean = true,
  summary?: ComplaintsDailySummaryRow[] | null
): Promise<{
  success: boolean;
  message: string;
  data?: {
    date: string;
    complaintsCount: number;
    summaryCount?: number;
    pathname: string;
  };
  error?: string;
}> {
  try {
    if (!date) {
      return {
        success: false,
        error: 'date is required (format: YYYY-MM-DD)',
        message: 'Failed to store complaints data',
      };
    }

    const complaintsInput = (Array.isArray(complaints) ? complaints : []).filter(isValidPnLComplaint);
    let existingData: DailyComplaintsData | null = null;
    if (mergeWithExisting) {
      try {
        const existing = await getDailyComplaints(date);
        if (existing.success && existing.data) {
          existingData = {
            ...existing.data,
            complaints: (existing.data.complaints || []).filter(isValidPnLComplaint),
          };
        }
      } catch {
        console.log(`No existing blob for ${date}`);
      }
    }

    const summaryProvided = summary !== undefined && summary !== null;
    const hasIncomingComplaints = complaintsInput.length > 0;
    if (!hasIncomingComplaints && !summaryProvided && !existingData) {
      return {
        success: false,
        error: 'Provide complaints and/or summary, or merge with an existing blob',
        message: 'Failed to store complaints data',
      };
    }

    let finalComplaints: PnLComplaint[];
    let finalSummary: ComplaintsDailySummaryRow[] | undefined;

    if (!mergeWithExisting) {
      finalComplaints = complaintsInput;
      finalSummary = summaryProvided && Array.isArray(summary) ? summary : undefined;
    } else {
      finalComplaints = complaintsInput;
      finalSummary = undefined;
      if (existingData) {
        if (complaintsInput.length === 0) {
          finalComplaints = existingData.complaints || [];
        } else if ((existingData.complaints || []).length > 0) {
          const existingMap = new Map<string, PnLComplaint>();
          (existingData.complaints || []).forEach((c) => {
            const key = `${c.contractId}_${c.housemaidId}_${c.clientId}_${c.complaintType}_${c.creationDate}`;
            existingMap.set(key, c);
          });
          complaintsInput.forEach((c) => {
            const key = `${c.contractId}_${c.housemaidId}_${c.clientId}_${c.complaintType}_${c.creationDate}`;
            existingMap.set(key, c);
          });
          finalComplaints = Array.from(existingMap.values());
        }
      }
      if (summaryProvided && Array.isArray(summary)) {
        finalSummary = summary;
      } else if (existingData?.summary) {
        finalSummary = existingData.summary;
      }
    }

    const dailyData: DailyComplaintsData = {
      date,
      lastUpdated: new Date().toISOString(),
      complaints: finalComplaints,
      totalComplaints: finalComplaints.length,
    };
    if (finalSummary !== undefined) {
      dailyData.summary = finalSummary;
    }

    // Store in blob with date-based key
    const blobKey = `${BLOB_PREFIX}${date}.json`;
    const blob = await put(blobKey, JSON.stringify(dailyData), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      /** Min allowed by Vercel Blob; reduces stale CDN reads of public JSON. */
      cacheControlMaxAge: 120,
    });

    console.log(`✅ Stored complaints for ${date}:`, {
      totalComplaints: finalComplaints.length,
      summaryRows: finalSummary?.length ?? 0,
      blobUrl: blob.url,
    });

    return {
      success: true,
      message: `Successfully stored data for ${date}`,
      data: {
        date,
        complaintsCount: finalComplaints.length,
        summaryCount: finalSummary?.length ?? 0,
        pathname: blobKey,
      },
    };
  } catch (error) {
    console.error('❌ Error storing daily complaints:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to store complaints data',
    };
  }
}

/**
 * Retrieve complaints data for a specific date
 */
export async function getDailyComplaints(date: string): Promise<{
  success: boolean;
  data?: DailyComplaintsData;
  error?: string;
}> {
  try {
    const blobKey = `${BLOB_PREFIX}${date}.json`;

    let blobUrl: string | undefined;
    try {
      const meta = await head(blobKey);
      blobUrl = meta.url;
    } catch {
      const { blobs } = await list({ prefix: blobKey, limit: 50 });
      const exact = blobs.filter((b) => b.pathname === blobKey);
      if (exact.length === 0) {
        return {
          success: false,
          error: `No complaints data found for date: ${date}`,
        };
      }
      exact.sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
      blobUrl = exact[0].url;
    }

    const response = await fetch(blobUrl, { cache: 'no-store' });
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch complaints data: ${response.statusText}`,
      };
    }

    const raw = await response.json();
    const data: DailyComplaintsData = {
      ...raw,
      complaints: Array.isArray(raw.complaints) ? raw.complaints : [],
      totalComplaints: typeof raw.totalComplaints === 'number' ? raw.totalComplaints : (raw.complaints?.length ?? 0),
      summary: Array.isArray(raw.summary) ? raw.summary : undefined,
    };

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error retrieving daily complaints:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all available dates with complaints data
 */
export async function getAvailableDailyComplaintsDates(): Promise<{
  success: boolean;
  dates?: string[];
  error?: string;
}> {
  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    
    const dates = blobs
      .map(blob => {
        const match = blob.pathname.match(/(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
      })
      .filter((date): date is string => date !== null)
      .sort((a, b) => a.localeCompare(b)); // Sort chronologically

    return {
      success: true,
      dates,
    };
  } catch (error) {
    console.error('❌ Error listing complaints dates:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Aggregate complaints data across a date range
 * Returns deduplicated sales volumes by service
 */
export async function aggregateDailyComplaints(
  startDate?: string,
  endDate?: string
): Promise<{
  success: boolean;
  data?: {
    totalComplaints: number;
    dateRange: { start: string; end: string };
    volumes: Record<PnLServiceKey, number>;
    complaintsByService: Record<PnLServiceKey, PnLComplaint[]>;
  };
  error?: string;
}> {
  try {
    // Get all available dates
    const datesResult = await getAvailableDailyComplaintsDates();
    if (!datesResult.success || !datesResult.dates) {
      return {
        success: false,
        error: 'No complaints data available',
      };
    }

    // Filter dates by range
    let datesToFetch = datesResult.dates;
    if (startDate) {
      datesToFetch = datesToFetch.filter(d => d >= startDate);
    }
    if (endDate) {
      datesToFetch = datesToFetch.filter(d => d <= endDate);
    }

    if (datesToFetch.length === 0) {
      return {
        success: false,
        error: 'No data found in specified date range',
      };
    }

    // Fetch all daily data
    const dailyDataPromises = datesToFetch.map(date => getDailyComplaints(date));
    const dailyResults = await Promise.all(dailyDataPromises);

    // Combine all complaints
    const allComplaints: PnLComplaint[] = [];
    dailyResults.forEach(result => {
      if (result.success && result.data) {
        allComplaints.push(...result.data.complaints);
      }
    });

    // Group complaints by sale (contract + client + housemaid + service)
    // Apply 3-month deduplication logic
    const salesMap = new Map<string, { complaint: PnLComplaint; date: Date }>();
    
    allComplaints.forEach(complaint => {
      const serviceKey = complaint.serviceKey || getServiceKeyFromComplaintType(complaint.complaintType);
      if (!serviceKey) return;

      const saleKey = `${serviceKey}_${complaint.contractId}_${complaint.clientId}_${complaint.housemaidId}`;
      const complaintDate = new Date(complaint.creationDate);

      if (!salesMap.has(saleKey)) {
        // First time seeing this sale
        salesMap.set(saleKey, { complaint: { ...complaint, serviceKey }, date: complaintDate });
      } else {
        // Check if this is within 3 months of the existing one
        const existing = salesMap.get(saleKey)!;
        const monthsDiff = Math.abs(
          (complaintDate.getTime() - existing.date.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );

        if (monthsDiff > 3) {
          // More than 3 months apart, this is a NEW sale
          // Keep the more recent one
          if (complaintDate > existing.date) {
            salesMap.set(saleKey, { complaint: { ...complaint, serviceKey }, date: complaintDate });
          }
        }
        // If within 3 months, keep the existing (already in map)
      }
    });

    // Count volumes by service
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

    const complaintsByService: Record<PnLServiceKey, PnLComplaint[]> = {
      oec: [],
      owwa: [],
      ttl: [],
      ttlSingle: [],
      ttlDouble: [],
      ttlMultiple: [],
      tte: [],
      tteSingle: [],
      tteDouble: [],
      tteMultiple: [],
      ttj: [],
      visaSaudi: [],
      schengen: [],
      gcc: [],
      ethiopianPP: [],
      filipinaPP: [],
    };

    salesMap.forEach(({ complaint }) => {
      if (complaint.serviceKey) {
        volumes[complaint.serviceKey]++;
        complaintsByService[complaint.serviceKey].push(complaint);
      }
    });

    return {
      success: true,
      data: {
        totalComplaints: allComplaints.length,
        dateRange: {
          start: datesToFetch[0],
          end: datesToFetch[datesToFetch.length - 1],
        },
        volumes,
        complaintsByService,
      },
    };
  } catch (error) {
    console.error('❌ Error aggregating daily complaints:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

