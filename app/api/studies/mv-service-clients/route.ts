import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import Papa from 'papaparse';

export async function GET() {
  try {
    // Read the Untitled CSV file
    const csvPath = '/Users/saharsabbagh/Downloads/Untitled 26_2026-02-27-1354.csv';
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });
    
    // Extract client IDs
    const clientIds = parsed.data
      .map((row: any) => row.ID?.trim())
      .filter((id: string) => id);
    
    return NextResponse.json({
      success: true,
      clientIds,
      count: clientIds.length,
    });
  } catch (error) {
    console.error('Error reading MV Service clients CSV:', error);
    // Fallback to hardcoded list if file read fails
    const fallbackIds = ['161098', '163125', '175281', '227085', '231246', '235838', '283486', '298205', '299868', '350028', '414198', '441393', '443648', '447522'];
    return NextResponse.json({
      success: true,
      clientIds: fallbackIds,
      count: fallbackIds.length,
    });
  }
}

