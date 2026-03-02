'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import CollapsibleSection from '@/components/CollapsibleSection';

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
  [key: string]: string; // For matched_phrases columns
}

interface ProcessedChat {
  conversationId: string;
  contractId: string;
  clientId: string;
  clientName: string;
  chatStartDateTime: string;
  phrases: string[];
  mergedChat: string;
  isMvServiceClient: boolean;
}

export default function StudiesDashboard() {
  const [data, setData] = useState<FlowRow[]>([]);
  const [mvServiceClientIds, setMvServiceClientIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch MV Service client IDs
        try {
          const mvResponse = await fetch('/api/studies/mv-service-clients');
          if (mvResponse.ok) {
            const mvData = await mvResponse.json();
            if (mvData.success && mvData.clientIds) {
              setMvServiceClientIds(new Set(mvData.clientIds.map((id: string) => String(id))));
            }
          }
        } catch (err) {
          console.warn('Failed to load MV Service clients, using fallback:', err);
          // Use fallback IDs
          const fallbackIds = ['161098', '163125', '175281', '227085', '231246', '235838', '283486', '298205', '299868', '350028', '414198', '441393', '443648', '447522'];
          setMvServiceClientIds(new Set(fallbackIds));
        }
        
        // Fetch the CSV file
        const response = await fetch('/api/studies/flow-csv');
        if (!response.ok) {
          throw new Error('Failed to fetch CSV file');
        }
        
        const text = await response.text();
        
        // Parse CSV
        Papa.parse<FlowRow>(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setData(results.data);
            setIsLoading(false);
          },
          error: (error: any) => {
            setError(error?.message || 'Failed to parse CSV');
            setIsLoading(false);
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load CSV');
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter for is_pro_services_related = TRUE
  const proServicesRelated = data.filter(
    (row) => row.is_pro_services_related?.toUpperCase() === 'TRUE'
  );

  // Process chats: extract matched phrases and merge them
  const processChats = (): ProcessedChat[] => {
    return proServicesRelated.map((row) => {
      // Extract all matched_phrases columns
      const phrases: string[] = [];
      Object.keys(row).forEach((key) => {
        if (key.startsWith('matched_phrases/')) {
          const phrase = row[key]?.trim();
          if (phrase) {
            phrases.push(phrase);
          }
        }
      });

      // Merge phrases into a clear chat format
      const mergedChat = phrases
        .map((phrase, index) => `${index + 1}. ${phrase}`)
        .join('\n\n');

      const clientId = row.clientId?.trim() || '';
      const isMvServiceClient = mvServiceClientIds.has(clientId);

      return {
        conversationId: row.conversationId || 'N/A',
        contractId: row.contractId || 'N/A',
        clientId,
        clientName: row.clientName || 'N/A',
        chatStartDateTime: row.chatStartDateTime || 'N/A',
        phrases,
        mergedChat,
        isMvServiceClient,
      };
    });
  };

  const processedChats = processChats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading studies data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-red-800">Error Loading Data</h3>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate MV Service conversion stats
  const mvServiceClients = 14;
  const totalClients = 43;
  const mvServicePercentage = totalClients > 0 ? ((mvServiceClients / totalClients) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Studies Dashboard</h1>
        <p className="text-sm text-slate-600">Analytics for PRO Services Related Conversations</p>
      </div>

      {/* MV Service Conversion Card */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-600 mb-1">Client Bought MV Service</p>
            <div className="flex items-baseline gap-3">
              <p className="text-4xl font-bold text-green-800">{mvServiceClients}</p>
              <p className="text-lg font-semibold text-green-700">({mvServicePercentage}%)</p>
            </div>
            <p className="text-xs text-green-600 mt-2">out of {totalClients} total clients</p>
          </div>
          <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600 mb-1">Total PRO Services Related Cases</p>
            <p className="text-4xl font-bold text-blue-800">{proServicesRelated.length}</p>
          </div>
          <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Merged Phrases Section */}
      <CollapsibleSection
        title="All PRO Services Related Chats (Merged Phrases)"
        count={processedChats.length}
        defaultExpanded={true}
      >
        <div className="max-h-[600px] overflow-y-auto p-5">
          <div className="space-y-4">
            {processedChats.map((chat, index) => (
              <div
                key={`${chat.conversationId}-${index}`}
                className={`rounded-lg border p-5 hover:shadow-md transition-shadow ${
                  chat.isMvServiceClient
                    ? 'bg-green-50 border-green-300 ring-2 ring-green-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {chat.isMvServiceClient && (
                        <span className="text-xs font-semibold text-white bg-green-600 px-2 py-1 rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          MV Service Client
                        </span>
                      )}
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        Contract ID: {chat.contractId}
                      </span>
                      <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-2 py-1 rounded">
                        Chat ID: {chat.conversationId}
                      </span>
                      {chat.clientId && (
                        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                          Client ID: {chat.clientId}
                        </span>
                      )}
                    </div>
                    {chat.clientName !== 'N/A' && (
                      <p className="text-sm font-medium text-slate-700">{chat.clientName}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {chat.chatStartDateTime !== 'N/A' && new Date(chat.chatStartDateTime).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {chat.mergedChat ? (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                      {chat.mergedChat}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No phrases available</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

    </div>
  );
}

