import { put, list } from '@vercel/blob';
import { PUBLIC_JSON_PUT_OPTIONS, resolveBlobReadUrl } from '@/lib/vercel-blob-json';
import type { AgentHoursData, AgentHoursRequest, AgentHoursRecord } from './chat-types';

const BLOB_PREFIX = 'agent-hours/';

/**
 * Store agent hours data in Vercel Blob Storage
 */
export async function storeAgentHours(request: AgentHoursRequest): Promise<{
  success: boolean;
  message: string;
  data?: {
    analysisId: string;
    processedRecords: number;
    analysisDate: string;
  };
  error?: string;
}> {
  try {
    const { analysisDate, agents } = request;

    if (!analysisDate) {
      return {
        success: false,
        error: 'analysisDate is required',
        message: 'Failed to store agent hours data',
      };
    }

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      return {
        success: false,
        error: 'agents array is required and must not be empty',
        message: 'Failed to store agent hours data',
      };
    }

    // Calculate aggregated metrics
    const totalAgents = agents.length;
    const totalHoursLogged = agents.reduce((sum, agent) => sum + (agent.HOURS_LOGGED || 0), 0);
    const averageHoursPerAgent = totalAgents > 0 ? totalHoursLogged / totalAgents : 0;

    const agentHoursData: AgentHoursData = {
      lastUpdated: new Date().toISOString(),
      analysisDate,
      totalAgents,
      totalHoursLogged,
      averageHoursPerAgent,
      agents: agents.map(agent => ({
        FULL_NAME: agent.FULL_NAME,
        HOURS_LOGGED: agent.HOURS_LOGGED || 0,
        FIRST_LOGIN: agent.FIRST_LOGIN || '',
        LAST_LOGOUT: agent.LAST_LOGOUT || '',
      })),
    };

    // Store in blob with date-based key
    const blobKey = `${BLOB_PREFIX}${analysisDate}.json`;
    const blob = await put(blobKey, JSON.stringify(agentHoursData), PUBLIC_JSON_PUT_OPTIONS);

    console.log(`✅ Stored agent hours data for ${analysisDate}:`, {
      totalAgents,
      totalHoursLogged,
      averageHoursPerAgent: averageHoursPerAgent.toFixed(2),
      blobUrl: blob.url,
    });

    return {
      success: true,
      message: `Successfully stored agent hours data for ${analysisDate}`,
      data: {
        analysisId: blobKey,
        processedRecords: agents.length,
        analysisDate,
      },
    };
  } catch (error) {
    console.error('❌ Error storing agent hours data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to store agent hours data',
    };
  }
}

/**
 * Retrieve agent hours data for a specific date
 */
export async function getAgentHours(date: string): Promise<{
  success: boolean;
  data?: AgentHoursData;
  error?: string;
}> {
  try {
    const blobKey = `${BLOB_PREFIX}${date}.json`;
    const blobUrl = await resolveBlobReadUrl(blobKey);
    if (!blobUrl) {
      return {
        success: false,
        error: `No agent hours data found for date: ${date}`,
      };
    }

    const response = await fetch(blobUrl, { cache: 'no-store' });
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch agent hours data: ${response.statusText}`,
      };
    }

    const data: AgentHoursData = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error retrieving agent hours data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all available dates with agent hours data
 */
export async function getAvailableAgentHoursDates(): Promise<{
  success: boolean;
  dates?: string[];
  error?: string;
}> {
  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    
    const dates = blobs
      .map(blob => {
        const match = blob.pathname.match(/agent-hours\/(\d{4}-\d{2}-\d{2})\.json/);
        return match ? match[1] : null;
      })
      .filter((date): date is string => date !== null)
      .sort((a, b) => a.localeCompare(b)); // Sort chronologically

    return {
      success: true,
      dates,
    };
  } catch (error) {
    console.error('❌ Error listing agent hours dates:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

