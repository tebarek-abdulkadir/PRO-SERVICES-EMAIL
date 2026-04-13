// Chat Analysis Types

export interface ChatAnalysisResult {
  conversationId: string;
  frustrated: boolean; // Is the customer frustrated?
  confused: boolean; // Is the customer confused?
  mainIssues: string[];
  keyPhrases: string[];
  analysisDate: string;
  service?: string; // Service type (e.g., "OEC", "travel to leb")
  skill?: string; // Skill/team (e.g., "VBC_RESOLVERS_AGENTS")
  /** Comma-separated skills from CC; used for By Chats classification (contains match). */
  joinedSkills?: string;
  /** Who started the chat: Consumer | Bot | Agent (case-insensitive in metrics). */
  initiator?: string;
  /** Attribution when frustrated (e.g. Agent, Bot, System). */
  frustratedBy?: string;
  confusedBy?: string;
  /** Average or single score from ingest; null if absent. */
  agentScore?: number | null;
}

/** Precomputed By Conversation tab: Consumer vs Agent initiated sections. */
export interface ConversationSectionMetrics {
  totalChats: number;
  frustrationCount: number;
  frustrationPct: number;
  frustrationByAgentCount: number;
  frustrationByAgentPct: number;
  frustrationByBotOrSystemCount: number;
  frustrationByBotOrSystemPct: number;
  agentScoreAvg: number | null;
  chatbotCoverageCount: number;
  chatbotCoveragePct: number;
  fullyBotCount: number;
  fullyBotPct: number;
  atLeastOneAgentMessageCount: number;
  atLeastOneAgentMessagePct: number;
}

export interface ByConversationViewData {
  consumerInitiated: ConversationSectionMetrics;
  agentInitiated: ConversationSectionMetrics;
  excludedNoInitiator: number;
}

/** Precomputed metrics for the "By Conversation" (chats) view — from joinedSkills, deduped by conversation id only. */
export interface ByChatsViewMetrics {
  totalChats: number;
  totalFrustrated: number;
  totalConfused: number;
  frustratedPctOfAllChats: number;
  confusedPctOfAllChats: number;

  totalBot: number;
  totalAgent: number;
  totalBotPctOfAllChats: number;
  totalAgentPctOfAllChats: number;

  frustratedInTotalBot: number;
  confusedInTotalBot: number;
  frustrationPctWithinTotalBot: number;
  confusionPctWithinTotalBot: number;

  frustratedInTotalAgent: number;
  confusedInTotalAgent: number;
  frustrationPctWithinTotalAgent: number;
  confusionPctWithinTotalAgent: number;

  fullyBot: number;
  fullyBotPctOfAllChats: number;
  frustratedInFullyBot: number;
  confusedInFullyBot: number;
  frustrationPctWithinFullyBot: number;
  confusionPctWithinFullyBot: number;

  botWithAgentMessage: number;
  botWithAgentPctOfTotalBot: number;
  frustratedInBotWithAgent: number;
  confusedInBotWithAgent: number;
  frustrationPctWithinBotWithAgent: number;
  confusionPctWithinBotWithAgent: number;

  fullyAgent: number;
  fullyAgentPctOfAllChats: number;
  frustratedInFullyAgent: number;
  confusedInFullyAgent: number;
  frustrationPctWithinFullyAgent: number;
  confusionPctWithinFullyAgent: number;

  agentWithBotMessage: number;
  agentWithBotPctOfTotalAgent: number;
  frustratedInAgentWithBot: number;
  confusedInAgentWithBot: number;
  frustrationPctWithinAgentWithBot: number;
  confusionPctWithinAgentWithBot: number;

  /** Defensive: conversations matching neither bot nor agent tokens in joinedSkills */
  neitherBotNorAgent: number;
}

export interface ChatTrendData {
  date: string;
  frustrationPercentage: number; // Percentage of frustrated conversations
  confusionPercentage: number; // Percentage of confused conversations
  frustratedCount: number; // Total count of frustrated people
  confusedCount: number; // Total count of confused people
  totalPeople: number; // Total unique people
}

export interface ChatDriver {
  issue: string;
  impact: number;
  frequency: number;
}

export interface ChatInsight {
  title: string;
  description: string;
  impact: number;
  trending: 'up' | 'down' | 'stable';
}

export interface ChatAnalysisData {
  lastUpdated: string;
  analysisDate: string; // The specific date this analysis is for (YYYY-MM-DD)
  overallMetrics: {
    frustratedCount: number; // Number of frustrated people (clients + maids)
    frustrationPercentage: number; // Percentage of frustrated people
    confusedCount: number; // Number of confused people (clients + maids)
    confusionPercentage: number; // Percentage of confused people
    totalConversations: number; // Total unique people - clients + maids (field name kept for compatibility)
    analysedConversations: number; // Total analyzed unique people
  };
  trends: {
    frustration: {
      current: number; // Current frustration percentage
      previous: number; // Previous frustration percentage
      direction: 'increasing' | 'decreasing' | 'stable';
    };
    confusion: {
      current: number; // Current confusion percentage
      previous: number; // Previous confusion percentage
      direction: 'increasing' | 'decreasing' | 'stable';
    };
  };
  trendData: ChatTrendData[]; // Last 30 days of data for trend visualization
  insights: {
    frustration: {
      mainIssue: ChatInsight;
      topDrivers: ChatDriver[];
    };
    confusion: {
      mainIssue: ChatInsight;
      topDrivers: ChatDriver[];
    };
  };
  conversationResults: ChatAnalysisResult[];
  /** Computed on ingest from joinedSkills; omit in older daily JSON. */
  byChatsView?: ByChatsViewMetrics;
  /** By Conversation tab: initiator-split metrics; omit in older daily JSON. */
  byConversationView?: ByConversationViewData;
}

// API Request/Response types
export interface ChatAnalysisRequest {
  analysisDate: string; // The date this analysis is for (YYYY-MM-DD)
  conversations: {
    conversationId: string;
    chatStartDateTime?: string;
    contractType?: string;
    frustrated: boolean; // Is the customer frustrated?
    confused: boolean; // Is the customer confused?
    mainIssues: string[]; // Issues identified by LLM (1 primary problem)
    keyPhrases: string[]; // Key phrases extracted by LLM
    service?: string; // Service type (e.g., "OEC", "travel to leb")
    skill?: string; // Skill/team (e.g., "VBC_RESOLVERS_AGENTS")
    maidId?: string;
    clientId?: string;
    contractId?: string;
    maidName?: string;
    clientName?: string;
    /** Comma-separated; bot/agent for By Chats uses contains on this field. */
    joinedSkills?: string;
    initiator?: string;
    frustratedBy?: string;
    confusedBy?: string;
    agentScore?: number | null;
  }[];
}

export interface ChatAnalysisResponse {
  success: boolean;
  message: string;
  data?: {
    analysisId: string;
    processedConversations: number;
    analysisDate: string;
  };
  error?: string;
}

export interface ChatDataResponse {
  success: boolean;
  data?: ChatAnalysisData;
  error?: string;
}

// Delay Time Types
export interface AgentDelayRecord {
  startDate: string;
  agentFullName: string;
  lastSkill: string;
  avgDelayDdHhMmSs: string; // Format: DD:HH:MM:SS
  endedWithConsumerNoReply: string; // "Yes" or "No"
}

// New input format for per-agent response time data
export interface AgentResponseTimeRecord {
  REPORT_DATE: string; // Format: YYYY-MM-DD
  AGENT_FULL_NAME: string; // Agent name, or "Total" for daily average
  AVG_ADJUSTED_RESPONSE_TIME: string; // Format: HH:MM:SS
}

export interface AgentDelayStats {
  agentName: string;
  avgDelaySeconds: number;
  avgDelayFormatted: string; // HH:MM:SS format
}

export interface DelayTimeData {
  lastUpdated: string;
  analysisDate: string;
  dailyAverageDelaySeconds?: number;
  dailyAverageDelayFormatted?: string; // HH:MM:SS format
  agentStats: AgentDelayStats[];
}

export interface DelayTimeRequest {
  analysisDate?: string; // Optional - can be extracted from REPORT_DATE in records
  records: AgentResponseTimeRecord[];
}

export interface DelayTimeResponse {
  success: boolean;
  message: string;
  data?: {
    analysisId: string;
    processedRecords: number;
    analysisDate: string;
  };
  error?: string;
}

// Agent Hours Types
export interface AgentHoursRecord {
  FULL_NAME: string;
  HOURS_LOGGED: number;
  FIRST_LOGIN: string; // Format: YYYY-MM-DD HH:MM:SS.mmm
  LAST_LOGOUT: string; // Format: YYYY-MM-DD HH:MM:SS.mmm
}

export interface AgentHoursData {
  lastUpdated: string;
  analysisDate: string;
  totalAgents: number;
  totalHoursLogged: number;
  averageHoursPerAgent: number;
  agents: AgentHoursRecord[];
}

export interface AgentHoursRequest {
  analysisDate: string;
  agents: AgentHoursRecord[];
}

export interface AgentHoursResponse {
  success: boolean;
  message: string;
  data?: {
    analysisId: string;
    processedRecords: number;
    analysisDate: string;
  };
  error?: string;
}
