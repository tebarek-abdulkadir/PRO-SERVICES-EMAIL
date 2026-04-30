import { put, list } from '@vercel/blob';
import { PUBLIC_JSON_PUT_OPTIONS } from '@/lib/vercel-blob-json';
import { parse } from 'date-fns';
import type { NPSRawData, NPSDayData } from './nps-types';

const NPS_BLOB_PREFIX = 'nps/daily/';

/**
 * Parse date from "Feb 9" format to ISO date string (YYYY-MM-DD)
 * NPS data is from 2026, so we parse with 2026 as the year
 */
function parseNPSDateToISO(dateStr: string): string | null {
  try {
    const year = 2026;
    const parsed = parse(`${dateStr} ${year}`, 'MMM d yyyy', new Date());
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return null;
  } catch (error) {
    console.error(`[NPS Storage] Error parsing date "${dateStr}":`, error);
    return null;
  }
}

/**
 * Convert ISO date (YYYY-MM-DD) back to NPS date format (MMM d)
 */
function isoDateToNPSDate(isoDate: string): string | null {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) {
      return null;
    }
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  } catch (error) {
    console.error(`[NPS Storage] Error converting ISO date "${isoDate}":`, error);
    return null;
  }
}

/**
 * Store NPS data in Vercel Blob Storage
 * Stores each day separately in nps/daily/{date}.json format
 */
export async function storeNPSData(npsData: NPSRawData): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    const storedDates: string[] = [];
    const errors: string[] = [];

    // Process each date in the NPS data
    for (const [dateKey, dayData] of Object.entries(npsData)) {
      // Convert NPS date format (e.g., "Feb 9") to ISO format (e.g., "2026-02-09")
      const isoDate = parseNPSDateToISO(dateKey);
      
      if (!isoDate) {
        console.warn(`[NPS Storage] Skipping invalid date key: ${dateKey}`);
        errors.push(`Invalid date format: ${dateKey}`);
        continue;
      }

      // Store each day separately
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        // Fallback to filesystem in development
        const fs = await import('fs');
        const path = await import('path');
        const dataDir = path.join(process.cwd(), 'data', 'nps', 'daily');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        const filePath = path.join(dataDir, `${isoDate}.json`);
        fs.writeFileSync(filePath, JSON.stringify(dayData, null, 2), 'utf-8');
        storedDates.push(isoDate);
      } else {
        // Store in blob storage
        const blobKey = `${NPS_BLOB_PREFIX}${isoDate}.json`;
        await put(blobKey, JSON.stringify(dayData, null, 2), PUBLIC_JSON_PUT_OPTIONS);
        storedDates.push(isoDate);
      }
    }

    if (storedDates.length === 0) {
      return {
        success: false,
        message: 'Failed to store NPS data',
        error: errors.length > 0 ? errors.join('; ') : 'No valid dates found',
      };
    }

    const message = `Stored ${storedDates.length} date(s)${errors.length > 0 ? ` (${errors.length} error(s))` : ''}`;
    console.log(`[NPS Storage] ${message}:`, storedDates);

    return {
      success: true,
      message,
    };
  } catch (error) {
    console.error('[NPS Storage] Error storing data:', error);
    return {
      success: false,
      message: 'Failed to store NPS data',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Migrate old format data (nps_data.json) to new daily format
 * This is called automatically when old format is detected
 */
async function migrateOldFormatData(oldData: NPSRawData): Promise<void> {
  console.log('[NPS Storage] Migrating old format data to new daily structure...');
  const migrationResult = await storeNPSData(oldData);
  if (migrationResult.success) {
    console.log('[NPS Storage] ✅ Migration successful:', migrationResult.message);
  } else {
    console.error('[NPS Storage] ❌ Migration failed:', migrationResult.error);
  }
}

/**
 * Retrieve NPS data from Vercel Blob Storage or filesystem
 * Aggregates all daily files back into NPSRawData format
 * Automatically migrates old format data if found
 */
export async function getNPSData(): Promise<{
  success: boolean;
  data?: NPSRawData;
  error?: string;
}> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      // Fallback to filesystem in development
      const fs = await import('fs');
      const path = await import('path');
      const dataDir = path.join(process.cwd(), 'data', 'nps', 'daily');
      const oldFilePath = path.join(process.cwd(), 'data', 'nps_data.json');
      
      // Check for old format file first
      if (fs.existsSync(oldFilePath)) {
        console.log('[NPS Storage] Found old format file, migrating to new structure...');
        const oldFileContent = fs.readFileSync(oldFilePath, 'utf-8');
        const oldData = JSON.parse(oldFileContent) as NPSRawData;
        
        // Migrate to new format
        await migrateOldFormatData(oldData);
        
        // Optionally backup or delete old file (keeping it for safety)
        const backupPath = path.join(process.cwd(), 'data', 'nps_data.json.backup');
        if (!fs.existsSync(backupPath)) {
          fs.copyFileSync(oldFilePath, backupPath);
          console.log('[NPS Storage] Created backup of old file:', backupPath);
        }
      }
      
      if (!fs.existsSync(dataDir)) {
        return {
          success: false,
          error: 'NPS data directory not found',
        };
      }

      const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
      
      if (files.length === 0) {
        return {
          success: false,
          error: 'No NPS data files found',
        };
      }

      const npsData: NPSRawData = {};
      
      for (const file of files) {
        const isoDate = file.replace('.json', '');
        const filePath = path.join(dataDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const dayData = JSON.parse(fileContent) as NPSDayData;
        
        // Convert ISO date back to NPS date format for the key
        const npsDateKey = isoDateToNPSDate(isoDate);
        if (npsDateKey) {
          npsData[npsDateKey] = dayData;
        }
      }
      
      return {
        success: true,
        data: npsData,
      };
    }

    // Read from blob storage
    // First check for old format blob
    const oldBlobPath = 'nps_data.json';
    const { blobs: oldBlobs } = await list({ prefix: oldBlobPath });
    const oldBlob = oldBlobs.find(b => b.pathname === oldBlobPath);
    
    if (oldBlob) {
      console.log('[NPS Storage] Found old format blob, migrating to new structure...');
      try {
        const response = await fetch(oldBlob.url, { cache: 'no-store' });
        if (response.ok) {
          const oldData = await response.json() as NPSRawData;
          await migrateOldFormatData(oldData);
          console.log('[NPS Storage] Migration complete. Old blob will remain but new structure will be used.');
        }
      } catch (error) {
        console.error('[NPS Storage] Error migrating old blob:', error);
      }
    }

    // Now read from new format
    const { blobs } = await list({ prefix: NPS_BLOB_PREFIX });
    
    if (blobs.length === 0) {
      return {
        success: false,
        error: 'NPS data not found in blob storage',
      };
    }

    const npsData: NPSRawData = {};
    
    // Fetch all daily files and aggregate them
    for (const blob of blobs) {
      // Extract ISO date from blob pathname: nps/daily/2026-02-09.json -> 2026-02-09
      const match = blob.pathname.match(/nps\/daily\/(\d{4}-\d{2}-\d{2})\.json$/);
      if (!match) continue;
      
      const isoDate = match[1];
      
      try {
        const response = await fetch(blob.url, { cache: 'no-store' });
        if (!response.ok) {
          console.warn(`[NPS Storage] Failed to fetch ${blob.pathname}: ${response.statusText}`);
          continue;
        }
        
        const dayData = await response.json() as NPSDayData;
        
        // Convert ISO date back to NPS date format for the key
        const npsDateKey = isoDateToNPSDate(isoDate);
        if (npsDateKey) {
          npsData[npsDateKey] = dayData;
        }
      } catch (error) {
        console.error(`[NPS Storage] Error fetching ${blob.pathname}:`, error);
        continue;
      }
    }

    if (Object.keys(npsData).length === 0) {
      return {
        success: false,
        error: 'No valid NPS data found in blob storage',
      };
    }
    
    return {
      success: true,
      data: npsData,
    };
  } catch (error) {
    console.error('[NPS Storage] Error retrieving data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all available dates with NPS data
 * Returns ISO dates (YYYY-MM-DD format)
 * Also checks for old format and migrates if found
 */
export async function getAvailableNPSDates(): Promise<{
  success: boolean;
  dates?: string[];
  error?: string;
}> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      // Fallback to filesystem in development
      const fs = await import('fs');
      const path = await import('path');
      const dataDir = path.join(process.cwd(), 'data', 'nps', 'daily');
      const oldFilePath = path.join(process.cwd(), 'data', 'nps_data.json');
      
      // Check for old format and migrate if found
      if (fs.existsSync(oldFilePath)) {
        console.log('[NPS Storage] Found old format file, migrating...');
        const oldFileContent = fs.readFileSync(oldFilePath, 'utf-8');
        const oldData = JSON.parse(oldFileContent) as NPSRawData;
        await migrateOldFormatData(oldData);
      }
      
      if (!fs.existsSync(dataDir)) {
        return {
          success: true,
          dates: [],
        };
      }

      const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
      const dates = files
        .map(file => file.replace('.json', ''))
        .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort();
      
      return {
        success: true,
        dates,
      };
    }

    // List blobs from blob storage
    // Check for old format first
    const oldBlobPath = 'nps_data.json';
    const { blobs: oldBlobs } = await list({ prefix: oldBlobPath });
    const oldBlob = oldBlobs.find(b => b.pathname === oldBlobPath);
    
    if (oldBlob) {
      console.log('[NPS Storage] Found old format blob, migrating...');
      try {
        const response = await fetch(oldBlob.url, { cache: 'no-store' });
        if (response.ok) {
          const oldData = await response.json() as NPSRawData;
          await migrateOldFormatData(oldData);
        }
      } catch (error) {
        console.error('[NPS Storage] Error migrating old blob:', error);
      }
    }

    // Now list new format blobs
    const { blobs } = await list({ prefix: NPS_BLOB_PREFIX });
    
    const dates = blobs
      .map(blob => {
        // Extract ISO date from blob pathname: nps/daily/2026-02-09.json -> 2026-02-09
        const match = blob.pathname.match(/nps\/daily\/(\d{4}-\d{2}-\d{2})\.json$/);
        return match ? match[1] : null;
      })
      .filter((date): date is string => date !== null)
      .sort();

    return {
      success: true,
      dates,
    };
  } catch (error) {
    console.error('[NPS Storage] Error fetching available dates:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

