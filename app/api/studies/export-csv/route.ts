import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import Papa from 'papaparse';

interface FlowRow {
  conversationId: string;
  chatStartDateTime: string;
  clientId: string;
  contractId: string;
  maidName: string;
  clientName: string;
  contractType: string;
  is_pro_services_related: string;
  is_asking_if_maids_provides_it: string;
  processingStatus: string;
  processedAt: string;
  [key: string]: string;
}

export async function GET() {
  try {
    // Read the CSV file
    const csvPath = join(process.cwd(), 'lib', 'flow.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const parsed = Papa.parse<FlowRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
    });
    
    // Get MV Service client IDs
    let mvServiceClientIds = new Set<string>();
    try {
      const mvCsvPath = '/Users/saharsabbagh/Downloads/Untitled 26_2026-02-27-1354.csv';
      const mvCsvContent = readFileSync(mvCsvPath, 'utf-8');
      const mvParsed = Papa.parse(mvCsvContent, {
        header: true,
        skipEmptyLines: true,
      });
      mvParsed.data.forEach((row: any) => {
        if (row.ID?.trim()) {
          mvServiceClientIds.add(String(row.ID.trim()));
        }
      });
    } catch (err) {
      // Fallback to hardcoded IDs
      const fallbackIds = ['161098', '163125', '175281', '227085', '231246', '235838', '283486', '298205', '299868', '350028', '414198', '441393', '443648', '447522'];
      mvServiceClientIds = new Set(fallbackIds);
    }
    
    // Filter for is_pro_services_related = TRUE
    const proServicesRelated = parsed.data.filter(
      (row) => row.is_pro_services_related?.toUpperCase() === 'TRUE'
    );
    
    // Process data for export
    const exportData = proServicesRelated.map((row) => {
      // Extract all matched phrases
      const phrases: string[] = [];
      Object.keys(row).forEach((key) => {
        if (key.startsWith('matched_phrases/')) {
          const phrase = row[key]?.trim();
          if (phrase) {
            phrases.push(phrase);
          }
        }
      });
      
      const mergedChat = phrases
        .map((phrase, index) => `${index + 1}. ${phrase}`)
        .join('\n\n');
      
      const clientId = row.clientId?.trim() || '';
      const isMvServiceClient = mvServiceClientIds.has(clientId);
      
      return {
        conversationId: row.conversationId || '',
        chatStartDateTime: row.chatStartDateTime || '',
        clientId: clientId,
        contractId: row.contractId || '',
        clientName: row.clientName || '',
        contractType: row.contractType || '',
        isMvServiceClient: isMvServiceClient ? 'Yes' : 'No',
        mergedPhrases: mergedChat,
        phraseCount: phrases.length,
        ...phrases.reduce((acc, phrase, index) => {
          acc[`phrase_${index + 1}`] = phrase;
          return acc;
        }, {} as Record<string, string>),
      };
    });
    
    // Convert to CSV
    const csv = Papa.unparse(exportData, {
      header: true,
    });
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="studies-dashboard-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return NextResponse.json(
      { error: 'Failed to export CSV', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}






