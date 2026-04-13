import { NextResponse } from 'next/server';
import { saveDailyChatAnalysisData, aggregateDailyChatAnalysisResults, getLatestChatAnalysisData, getDailyChatAnalysisData } from '@/lib/chat-storage';
import { computeByChatsViewMetrics } from '@/lib/chat-by-chats-metrics';
import { computeByConversationViewFromResults } from '@/lib/chat-by-conversation-metrics';
import {
  buildJoinedSkillsLookupMap,
  mergeJoinedSkillsFields,
  resolveJoinedSkillsForMergedIds,
} from '@/lib/chat-joined-skills';
import {
  buildChatMetaLookupMap,
  resolveChatMetaForMergedIds,
  type RawChatMetaRow,
} from '@/lib/chat-conversation-meta-ingest';
import type { ChatAnalysisData, ChatAnalysisRequest, ChatAnalysisResponse, ChatAnalysisResult, ChatDataResponse } from '@/lib/chat-types';

type RawIngestRow = {
  conversationId: string;
  frustrated: boolean;
  confused: boolean;
  joinedSkills?: string;
  initiator?: string;
  frustratedBy?: string;
  confusedBy?: string;
  agentScore?: number | null;
};

function parseAgentScore(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * After aggregation, re-apply joinedSkills, conversation meta, byChatsView, byConversationView from POST body.
 */
function applyChatAnalysisFromRawIngest(
  data: ChatAnalysisData,
  rawRows: RawIngestRow[]
): ChatAnalysisData {
  const joinedLookup = buildJoinedSkillsLookupMap(
    rawRows.map((r) => ({ conversationId: String(r.conversationId), joinedSkills: r.joinedSkills }))
  );

  const metaLookup = buildChatMetaLookupMap(
    rawRows.map(
      (r): RawChatMetaRow => ({
        conversationId: String(r.conversationId),
        frustrated: r.frustrated,
        initiator: r.initiator,
        frustratedBy: r.frustratedBy,
        confusedBy: r.confusedBy,
        agentScore: r.agentScore,
      })
    )
  );

  const conversationResults: ChatAnalysisResult[] = data.conversationResults.map((r) => {
    const idCsv = String(r.conversationId);
    const fromRawJoined = resolveJoinedSkillsForMergedIds(idCsv, joinedLookup);
    const joinedSkills = mergeJoinedSkillsFields(r.joinedSkills, fromRawJoined).trim();
    const meta = resolveChatMetaForMergedIds(idCsv, metaLookup);
    return {
      ...r,
      ...(joinedSkills ? { joinedSkills } : {}),
      ...(meta.initiator ? { initiator: meta.initiator } : {}),
      ...(meta.frustratedBy ? { frustratedBy: meta.frustratedBy } : {}),
      ...(meta.confusedBy ? { confusedBy: meta.confusedBy } : {}),
      ...(meta.agentScore != null ? { agentScore: meta.agentScore } : {}),
    };
  });

  const byChatsView = computeByChatsViewMetrics(
    rawRows.map((c) => ({
      conversationId: String(c.conversationId),
      frustrated: c.frustrated,
      confused: c.confused,
      joinedSkills: c.joinedSkills,
    }))
  );

  const byConversationView = computeByConversationViewFromResults(conversationResults);

  return {
    ...data,
    conversationResults,
    byChatsView,
    byConversationView,
  };
}

/** Never cache chat blobs — avoids stale JSON after POST. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Older blobs may omit byChatsView / byConversationView; compute on read when possible. */
function enrichChatDataForGet(data: ChatAnalysisData): ChatAnalysisData {
  let next = data;
  if (data.byChatsView == null) {
    const rows =
      data.conversationResults
        ?.filter((r) => r.joinedSkills?.trim())
        .map((r) => ({
          conversationId: r.conversationId,
          frustrated: r.frustrated,
          confused: r.confused,
          joinedSkills: r.joinedSkills!,
        })) ?? [];
    if (rows.length > 0) {
      next = { ...next, byChatsView: computeByChatsViewMetrics(rows) };
    }
  }
  if (next.byConversationView == null && next.conversationResults?.length) {
    next = {
      ...next,
      byConversationView: computeByConversationViewFromResults(next.conversationResults),
    };
  }
  return next;
}

/**
 * API Endpoint: /api/chat-analysis
 * 
 * POST - Submit chat analysis results
 * GET - Retrieve latest chat analysis data for dashboard
 * 
 * Authentication:
 *   Header: Authorization: Bearer <your-api-key>
 */

// Verify API key from Authorization header
function verifyApiKey(request: Request): boolean {
  const validKey = process.env.INGEST_API_KEY;
  if (!validKey) {
    console.warn('[Chat Analysis] Warning: INGEST_API_KEY not set, rejecting all requests for security');
    return false;
  }
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return false;
  }
  
  // Support both "Bearer <token>" and plain "<token>" formats
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
  
  return token === validKey;
}

/**
 * POST - Submit chat analysis results
 * 
 * Expected body:
 * {
 *   "analysisDate": "2026-02-13",
 *   "conversations": [
 *     {
 *       "conversationId": "conv_001",
 *       "contractType": "CC",
 *       "frustrated": true,
 *       "confused": true,
 *       "mainIssues": ["Long wait time"],
 *       "keyPhrases": ["waiting too long", "confusing steps"]
 *     }
 *   ]
 * }
 */
export async function POST(request: Request): Promise<NextResponse<ChatAnalysisResponse>> {
  try {
    // Verify API key
    if (!verifyApiKey(request)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Unauthorized',
          error: 'Invalid or missing API key' 
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.conversations || !Array.isArray(body.conversations)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid request',
          error: 'Missing or invalid conversations array' 
        },
        { status: 400 }
      );
    }

    // Validate analysis date
    const analysisDate = body.analysisDate || new Date().toISOString().split('T')[0];
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(analysisDate)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid request',
          error: 'analysisDate must be in YYYY-MM-DD format' 
        },
        { status: 400 }
      );
    }

    // Validate each conversation
    const conversations = body.conversations.map((conv: any, index: number) => {
      if (!conv.conversationId || typeof conv.frustrated !== 'boolean' || typeof conv.confused !== 'boolean') {
        throw new Error(`Invalid conversation at index ${index}: missing required fields (conversationId, frustrated, confused)`);
      }
      
      // Log first conversation to verify service/skill are being received
      if (index === 0) {
        console.log('[Chat Analysis API] Sample conversation data:', {
          conversationId: conv.conversationId,
          service: conv.service,
          skill: conv.skill,
          joinedSkillsLen: typeof conv.joinedSkills === 'string' ? conv.joinedSkills.length : 0,
        });
      }
      
      const joinedSkillsRaw =
        conv.joinedSkills ??
        conv.JOINED_SKILLS ??
        (conv as Record<string, unknown>).joined_skills ??
        (conv as Record<string, unknown>).JoinedSkills;
      const joinedSkills =
        typeof joinedSkillsRaw === 'string'
          ? joinedSkillsRaw
          : joinedSkillsRaw != null
            ? String(joinedSkillsRaw)
            : undefined;

      const rec = conv as Record<string, unknown>;
      const str = (k: string) => {
        const v = rec[k] ?? rec[k.toLowerCase()];
        if (v == null || v === '') return undefined;
        return String(v).trim();
      };

      return {
        conversationId: String(conv.conversationId),
        chatStartDateTime: conv.chatStartDateTime || new Date().toISOString(),
        frustrated: Boolean(conv.frustrated),
        confused: Boolean(conv.confused),
        mainIssues: Array.isArray(conv.mainIssues) ? conv.mainIssues : [],
        keyPhrases: Array.isArray(conv.keyPhrases) ? conv.keyPhrases : [],
        service: conv.service,
        skill: conv.skill,
        joinedSkills,
        maidId: conv.maidId,
        clientId: conv.clientId,
        contractId: conv.contractId,
        maidName: conv.maidName,
        clientName: conv.clientName,
        contractType: conv.contractType,
        initiator: str('initiator') ?? str('Initiator'),
        frustratedBy: str('frustratedBy') ?? str('frustrated_by') ?? str('FrustratedBy'),
        confusedBy: str('confusedBy') ?? str('confused_by') ?? str('ConfusedBy'),
        agentScore: parseAgentScore(rec.agentScore ?? rec.AgentScore ?? rec.agent_score),
      };
    });

    // Aggregate the individual conversation scores into daily dashboard data
    const aggregatedData = await aggregateDailyChatAnalysisResults(conversations, analysisDate);

    const toSave = applyChatAnalysisFromRawIngest(aggregatedData, conversations);

    console.log('[Chat Analysis API] Pre-save snapshot:', {
      resultRows: toSave.conversationResults.length,
      firstJoinedSkillsLen: toSave.conversationResults[0]?.joinedSkills?.length ?? 0,
      byChatsTotalChats: toSave.byChatsView?.totalChats ?? 0,
      byConvConsumer: toSave.byConversationView?.consumerInitiated.totalChats ?? 0,
    });

    // Save to blob storage
    await saveDailyChatAnalysisData(toSave);

    return NextResponse.json({
      success: true,
      message: 'Chat analysis data saved successfully',
      data: {
        analysisId: `analysis_${Date.now()}`,
        processedConversations: conversations.length,
        analysisDate: analysisDate,
      },
    });

  } catch (error) {
    console.error('[Chat Analysis API] POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: String(error) 
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Retrieve chat analysis data for dashboard
 * Query params: ?date=YYYY-MM-DD (optional, defaults to latest)
 */
export async function GET(request: Request): Promise<NextResponse<ChatDataResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    let data;
    
    if (date) {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid date format. Use YYYY-MM-DD' 
          },
          { status: 400 }
        );
      }
      
      data = await getDailyChatAnalysisData(date);
    } else {
      data = await getLatestChatAnalysisData();
    }
    
    if (!data) {
      return NextResponse.json({
        success: true,
        data: {
          lastUpdated: new Date().toISOString(),
          analysisDate: date || new Date().toISOString().split('T')[0],
          overallMetrics: {
            frustratedCount: 0,
            frustrationPercentage: 0,
            confusedCount: 0,
            confusionPercentage: 0,
            totalConversations: 0,
            analysedConversations: 0,
          },
          trends: {
            frustration: { current: 0, previous: 0, direction: 'stable' as const },
            confusion: { current: 0, previous: 0, direction: 'stable' as const },
          },
          trendData: [],
          insights: {
            frustration: {
              mainIssue: {
                title: 'No Data Available',
                description: 'No conversation data has been analyzed yet. Upload chat analysis results to see insights.',
                impact: 0,
                trending: 'stable' as const,
              },
              topDrivers: [],
            },
            confusion: {
              mainIssue: {
                title: 'No Data Available',
                description: 'No conversation data has been analyzed yet. Upload chat analysis results to see insights.',
                impact: 0,
                trending: 'stable' as const,
              },
              topDrivers: [],
            },
          },
          conversationResults: [],
        },
      });
    }

    const payload = enrichChatDataForGet(data);

    return NextResponse.json(
      { success: true, data: payload },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );

  } catch (error) {
    console.error('[Chat Analysis API] GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch chat analysis data' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Clear all chat analysis data
 */
export async function DELETE(request: Request): Promise<NextResponse<ChatAnalysisResponse>> {
  try {
    // Verify API key
    if (!verifyApiKey(request)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Unauthorized',
          error: 'Invalid or missing API key' 
        },
        { status: 401 }
      );
    }

    // Clear data would be implemented here
    // await clearChatAnalysisData();

    return NextResponse.json({
      success: true,
      message: 'Chat analysis data cleared successfully',
    });

  } catch (error) {
    console.error('[Chat Analysis API] DELETE error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: String(error) 
      },
      { status: 500 }
    );
  }
}
