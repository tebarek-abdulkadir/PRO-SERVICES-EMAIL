import { put, list } from '@vercel/blob';
import type { PnLComplaint, PnLServiceKey } from './pnl-complaints-types';
import { getServiceKeyFromComplaintType } from './pnl-complaints-types';

const BLOB_PREFIX = 'complaints-daily/';

export interface DailyComplaintsData {
  date: string; // YYYY-MM-DD
  lastUpdated: string;
  complaints: PnLComplaint[];
  totalComplaints: number;
}

/**
 * Store daily complaints data in Vercel Blob Storage
 */
export async function storeDailyComplaints(
  date: string,
  complaints: PnLComplaint[],
  mergeWithExisting: boolean = true
): Promise<{
  success: boolean;
  message: string;
  data?: {
    date: string;
    complaintsCount: number;
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

    if (!complaints || !Array.isArray(complaints) || complaints.length === 0) {
      return {
        success: false,
        error: 'complaints array is required and must not be empty',
        message: 'Failed to store complaints data',
      };
    }

    // If merging, fetch existing complaints first
    let finalComplaints = complaints;
    if (mergeWithExisting) {
      try {
        const existing = await getDailyComplaints(date);
        if (existing.success && existing.data && existing.data.complaints.length > 0) {
          // Merge: combine existing with new, avoiding duplicates based on contractId + housemaidId + clientId + complaintType + creationDate
          const existingMap = new Map<string, PnLComplaint>();
          existing.data.complaints.forEach(c => {
            const key = `${c.contractId}_${c.housemaidId}_${c.clientId}_${c.complaintType}_${c.creationDate}`;
            existingMap.set(key, c);
          });
          
          // Add new complaints (will overwrite duplicates)
          complaints.forEach(c => {
            const key = `${c.contractId}_${c.housemaidId}_${c.clientId}_${c.complaintType}_${c.creationDate}`;
            existingMap.set(key, c);
          });
          
          finalComplaints = Array.from(existingMap.values());
        }
      } catch (error) {
        // If fetch fails (e.g., no existing data), just use new complaints
        console.log(`No existing data found for ${date}, storing new complaints only`);
      }
    }

    const dailyData: DailyComplaintsData = {
      date,
      lastUpdated: new Date().toISOString(),
      complaints: finalComplaints,
      totalComplaints: finalComplaints.length,
    };

    // Store in blob with date-based key
    const blobKey = `${BLOB_PREFIX}${date}.json`;
    const blob = await put(blobKey, JSON.stringify(dailyData), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    console.log(`✅ Stored complaints for ${date}:`, {
      totalComplaints: complaints.length,
      blobUrl: blob.url,
    });

    return {
      success: true,
      message: `Successfully stored ${complaints.length} complaints for ${date}`,
      data: {
        date,
        complaintsCount: complaints.length,
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
    
    // List blobs to check if it exists
    const { blobs } = await list({ prefix: blobKey, limit: 1 });
    
    if (blobs.length === 0) {
      return {
        success: false,
        error: `No complaints data found for date: ${date}`,
      };
    }

    // Fetch the blob data
    const response = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch complaints data: ${response.statusText}`,
      };
    }

    const data: DailyComplaintsData = await response.json();

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

