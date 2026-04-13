'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  AlertTriangle,
  MessageSquare,
  Frown,
  HelpCircle,
  Clock,
  Bot,
  Headphones,
} from 'lucide-react';
import { dedupeChatConversationResults } from '@/lib/chat-email-metrics';
import { createEmptyByConversationViewData } from '@/lib/chat-by-conversation-metrics';
import type {
  ChatAnalysisData,
  ChatAnalysisResult,
  ChatTrendData,
  ConversationSectionMetrics,
} from '@/lib/chat-types';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import ChatTrendChart from '@/components/ChatTrendChart';

type ViewMode = 'people' | 'conversation';

function ConversationInitiatorBlock({
  title,
  subtitle,
  m,
  showChatbot,
  pct,
  formatAvg,
}: {
  title: string;
  subtitle: string;
  m: ConversationSectionMetrics;
  showChatbot: boolean;
  pct: (part: number, whole: number) => number;
  formatAvg: (n: number | null) => string;
}) {
  const t = m.totalChats;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-auto">
            <MessageSquare className="w-6 h-6 text-slate-600" />
          </div>
          <div className="mt-auto">
            <div className="text-3xl font-bold text-slate-900 mb-1">{m.totalChats}</div>
            <div className="text-sm font-medium text-slate-600">Total Chats</div>
            <div className="text-xs text-slate-500 mt-2">Deduped by conversation id</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-auto">
            <Frown className="w-6 h-6 text-red-600" />
            <span className="text-xl font-bold text-red-600">{m.frustrationPct}%</span>
          </div>
          <div className="mt-auto">
            <div className="text-3xl font-bold text-slate-900 mb-1">{m.frustrationCount}</div>
            <div className="text-sm font-medium text-slate-600">Frustration</div>
            <div className="text-xs text-slate-500 mt-2">of chats in this section</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-auto">
            <Headphones className="w-6 h-6 text-amber-700" />
            <span className="text-xl font-bold text-amber-700">{m.frustrationByAgentPct}%</span>
          </div>
          <div className="mt-auto">
            <div className="text-3xl font-bold text-slate-900 mb-1">{m.frustrationByAgentCount}</div>
            <div className="text-sm font-medium text-slate-600">Frustration caused by Agent</div>
            <div className="text-xs text-slate-500 mt-2">frustrated + frustratedBy agent</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-auto">
            <Bot className="w-6 h-6 text-violet-600" />
            <span className="text-xl font-bold text-violet-700">{m.frustrationByBotOrSystemPct}%</span>
          </div>
          <div className="mt-auto">
            <div className="text-3xl font-bold text-slate-900 mb-1">{m.frustrationByBotOrSystemCount}</div>
            <div className="text-sm font-medium text-slate-600">Frustration caused by Bot / System</div>
            <div className="text-xs text-slate-500 mt-2">frustrated + frustratedBy bot or system</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-auto">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg</span>
          </div>
          <div className="mt-auto">
            <div className="text-3xl font-bold text-slate-900 mb-1">{formatAvg(m.agentScoreAvg)}</div>
            <div className="text-sm font-medium text-slate-600">Agent score</div>
            <div className="text-xs text-slate-500 mt-2">Non-null scores only</div>
          </div>
        </div>

        <div className="hidden md:block" aria-hidden />
      </div>

      {showChatbot && (
        <div className="space-y-3 pt-2">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-600" />
            Chatbot & routing (joinedSkills)
          </h3>
          <p className="text-sm text-slate-500">
            Same bot/agent token rules as the By People tab (e.g. GPT_VBC_SALES / VBC_SALES_AGENTS).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-6 border-2 border-violet-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Bot className="w-6 h-6 text-violet-600" />
                <span className="text-lg font-bold text-violet-700">{pct(m.chatbotCoverageCount, t)}%</span>
              </div>
              <div className="text-3xl font-bold text-slate-900">{m.chatbotCoverageCount}</div>
              <div className="text-sm font-medium text-slate-600 mt-1">Chatbot coverage</div>
              <div className="text-xs text-slate-500 mt-1">Bot skills in joinedSkills</div>
            </div>
            <div className="bg-white rounded-xl p-6 border-2 border-violet-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Bot className="w-6 h-6 text-violet-600" />
                <span className="text-lg font-bold text-violet-700">{pct(m.fullyBotCount, t)}%</span>
              </div>
              <div className="text-3xl font-bold text-slate-900">{m.fullyBotCount}</div>
              <div className="text-sm font-medium text-slate-600 mt-1">Chats fully handled by bot</div>
              <div className="text-xs text-slate-500 mt-1">Bot tokens, no agent tokens</div>
            </div>
            <div className="bg-white rounded-xl p-6 border-2 border-emerald-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Headphones className="w-6 h-6 text-emerald-600" />
                <span className="text-lg font-bold text-emerald-700">{pct(m.atLeastOneAgentMessageCount, t)}%</span>
              </div>
              <div className="text-3xl font-bold text-slate-900">{m.atLeastOneAgentMessageCount}</div>
              <div className="text-sm font-medium text-slate-600 mt-1">Chats with ≥1 agent message</div>
              <div className="text-xs text-slate-500 mt-1">Agent skill tokens in joinedSkills</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatsDashboard() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [data, setData] = useState<ChatAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'frustrated' | 'confused' | 'both'>('frustrated');
  const [trendData, setTrendData] = useState<ChatTrendData[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('people');

  // Fetch available dates
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const res = await fetch('/api/chat-analysis/dates');
        const result = await res.json();
        if (result.success && result.dates) {
          setAvailableDates(result.dates);
          // Auto-select the most recent date
          if (result.dates.length > 0 && !selectedDate) {
            setSelectedDate(result.dates[result.dates.length - 1]);
          }
        }
      } catch (err) {
        console.error('Error fetching available dates:', err);
      }
    };

    fetchDates();
  }, []);

  // Fetch data from API based on selected date
  useEffect(() => {
    if (!selectedDate) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const chatResponse = await fetch(`/api/chat-analysis?date=${selectedDate}`);
        const chatResult = await chatResponse.json();
        
        if (chatResult.success && chatResult.data) {
          setData(chatResult.data);
        } else {
          setError(chatResult.error || 'Failed to fetch data');
        }
      } catch (err) {
        setError('Network error occurred');
        console.error('Error fetching chat data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  // Fetch trend data when date is selected
  useEffect(() => {
    if (!selectedDate) {
      setTrendData([]);
      return;
    }

    const fetchTrendData = async () => {
      try {
        setIsLoadingTrends(true);
        // API will automatically calculate from 1st of current month (max)
        const response = await fetch(`/api/chat-analysis/trends?endDate=${selectedDate}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          setTrendData(result.data);
        } else {
          console.error('Failed to fetch trend data:', result.error);
          setTrendData([]);
        }
      } catch (err) {
        console.error('Error fetching trend data:', err);
        setTrendData([]);
      } finally {
        setIsLoadingTrends(false);
      }
    };

    fetchTrendData();
  }, [selectedDate]);

  // Handle date selection from calendar
  const handleDateSelect = (startDate: string | null, endDate?: string | null) => {
    setSelectedDate(startDate);
    setSelectedEndDate(endDate || null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Chats Dashboard</h1>
            <p className="text-slate-600 mt-1">Monitor frustration and confusion levels (based on unique people - clients & maids)</p>
          </div>
          {/* Advanced Date Picker */}
          <DatePickerCalendar
            availableDates={availableDates}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading chat analysis data...</p>
          </div>
        </div>
      </div>
    );
  }

  // No date selected state
  if (!selectedDate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Chats Dashboard</h1>
            <p className="text-slate-600 mt-1">Monitor frustration and confusion levels (based on unique people - clients & maids)</p>
          </div>
          {/* Advanced Date Picker */}
          <DatePickerCalendar
            availableDates={availableDates}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </div>
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
          <Calendar className="w-16 h-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Please Select a Date</h3>
          <p className="text-sm text-slate-500 text-center max-w-sm">
            Use the date picker above to select a date to view chat analysis data.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Chats Dashboard</h1>
            <p className="text-slate-600 mt-1">Monitor frustration and confusion levels (based on unique people - clients & maids)</p>
          </div>
          {/* Advanced Date Picker */}
          <DatePickerCalendar
            availableDates={availableDates}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-4" />
            <p className="text-slate-600 mb-2">Unable to load chat data</p>
            <p className="text-sm text-slate-500">{error || 'No data available for this date'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Use backend-calculated metrics (now based on unique people - clients + maids)
  const totalPeople = data.overallMetrics.totalConversations; // Backend now counts unique people
  const totalFrustrated = data.overallMetrics.frustratedCount; // Frustrated people count
  const totalConfused = data.overallMetrics.confusedCount; // Confused people count
  const frustrationPercentage = data.overallMetrics.frustrationPercentage;
  const confusionPercentage = data.overallMetrics.confusionPercentage;
  
  const deduplicatedArray = dedupeChatConversationResults(data.conversationResults);
  const byConv = data.byConversationView ?? createEmptyByConversationViewData();

  function pct(part: number, whole: number): number {
    if (whole <= 0) return 0;
    return Math.round((part / whole) * 100);
  }

  function formatAvg(n: number | null): string {
    if (n == null || Number.isNaN(n)) return '—';
    return n.toFixed(2);
  }

  // Calculate additional metrics for display
  const bothFrustratedAndConfused = deduplicatedArray.filter(c => c.frustrated && c.confused).length;
  const onlyFrustrated = deduplicatedArray.filter(c => c.frustrated && !c.confused).length;
  const onlyConfused = deduplicatedArray.filter(c => c.confused && !c.frustrated).length;

  // Filter conversations based on selected filter
  const filteredConversations = deduplicatedArray.filter(conv => {
    // Only show frustrated or confused conversations (exclude neutral ones)
    const hasIssue = conv.frustrated || conv.confused;
    if (!hasIssue) return false;
    
    // Filter by status
    if (filterStatus === 'frustrated' && !(conv.frustrated && !conv.confused)) return false;
    if (filterStatus === 'confused' && !(conv.confused && !conv.frustrated)) return false;
    if (filterStatus === 'both' && !(conv.frustrated && conv.confused)) return false;
    
    return true;
  });

  // Helper function to check if array has valid content
  const hasValidContent = (arr: string[] | undefined): boolean => {
    return !!(arr && arr.length > 0 && arr.some(item => item && item.trim() !== ''));
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Selector */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Chat Analysis</h1>
          {selectedDate && (
            <p className="text-slate-500 mt-2 text-sm">
              Showing data for {selectedEndDate && selectedEndDate !== selectedDate 
                ? `${new Date(selectedDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })} - ${new Date(selectedEndDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}`
                : new Date(selectedDate).toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })
              }
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-600">View:</span>
            <div
              className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 shadow-sm"
              role="group"
              aria-label="View by people or by conversation"
            >
              <button
                type="button"
                onClick={() => setViewMode('people')}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'people'
                    ? 'bg-white text-slate-900 shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By People
              </button>
              <button
                type="button"
                onClick={() => setViewMode('conversation')}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'conversation'
                    ? 'bg-white text-slate-900 shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By Conversation
              </button>
            </div>
          </div>
      </div>

        {/* Date Selector */}
        {/* Advanced Date Picker */}
        <DatePickerCalendar
          availableDates={availableDates}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />
      </div>

      {/* Stats: By People */}
      {viewMode === 'people' && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-auto">
            <MessageSquare className="w-6 h-6 text-slate-600" />
          </div>
          <div className="mt-auto">
            <div className="text-3xl font-bold text-slate-900 mb-1">{totalPeople}</div>
            <div className="text-sm font-medium text-slate-600">Total People</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-auto">
            <Frown className="w-6 h-6 text-red-600" />
            <span className="text-xl font-bold text-red-600">{frustrationPercentage}%</span>
          </div>
          <div className="mt-auto">
            <div className="text-3xl font-bold text-slate-900 mb-1">{totalFrustrated}</div>
            <div className="text-sm font-medium text-slate-600">Frustrated People</div>
            {bothFrustratedAndConfused > 0 && (
              <div className="text-xs text-slate-500 mt-2">({bothFrustratedAndConfused} also confused)</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-auto">
            <HelpCircle className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-bold text-blue-600">{confusionPercentage}%</span>
          </div>
          <div className="mt-auto">
            <div className="text-3xl font-bold text-slate-900 mb-1">{totalConfused}</div>
            <div className="text-sm font-medium text-slate-600">Confused People</div>
            {bothFrustratedAndConfused > 0 && (
              <div className="text-xs text-slate-500 mt-2">({bothFrustratedAndConfused} also frustrated)</div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Stats: By Conversation — initiator split (same card grid style as By People) */}
      {viewMode === 'conversation' && (
        <div className="space-y-10">
          {byConv.excludedNoInitiator > 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              {byConv.excludedNoInitiator} conversation(s) excluded (missing or unknown{' '}
              <code className="text-xs bg-amber-100 px-1 rounded">initiator</code>).
            </p>
          )}

          <ConversationInitiatorBlock
            title="Consumer Initiated"
            subtitle="Initiator is Consumer or Bot (case-insensitive)."
            m={byConv.consumerInitiated}
            showChatbot
            pct={pct}
            formatAvg={formatAvg}
          />

          <ConversationInitiatorBlock
            title="Agent Initiated"
            subtitle="Initiator is Agent (case-insensitive)."
            m={byConv.agentInitiated}
            showChatbot={false}
            pct={pct}
            formatAvg={formatAvg}
          />
        </div>
      )}

      {/* Trend Analysis Chart — people-based series */}
      {viewMode === 'people' && (
        <ChatTrendChart data={trendData} isLoading={isLoadingTrends} />
      )}

      {/* Conversations Section */}
      <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
        {/* Header with Filters */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Problem Conversations</h3>
              <p className="text-sm text-slate-600 mt-1">
                {filteredConversations.length} conversations
              </p>
          </div>
          
            {/* Filter Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('frustrated')}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  filterStatus === 'frustrated'
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                Frustrated ({onlyFrustrated})
              </button>
              <button
                onClick={() => setFilterStatus('confused')}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  filterStatus === 'confused'
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                Confused ({onlyConfused})
              </button>
              <button
                onClick={() => setFilterStatus('both')}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  filterStatus === 'both'
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                Both ({bothFrustratedAndConfused})
              </button>
          </div>
        </div>
      </div>

        {/* Conversations List */}
        <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">No conversations found</p>
              <p className="text-slate-400 text-sm">All clear! 🎉</p>
            </div>
          ) : (
            filteredConversations.map((conversation, index) => {
              const hasIssues = hasValidContent(conversation.mainIssues);
              const hasPhrases = hasValidContent(conversation.keyPhrases);
              
              return (
                <div
                  key={conversation.conversationId}
                  className="p-6 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  <div className="space-y-4">
                    {/* Header Section */}
                    <div className="flex items-start gap-4">
                      {/* Status Badge */}
                      <div className="flex-shrink-0">
                        {conversation.frustrated && conversation.confused ? (
                          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center border-2 border-orange-200 shadow-sm">
                            <AlertTriangle className="w-6 h-6 text-orange-600" />
                          </div>
                        ) : conversation.frustrated ? (
                          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center border-2 border-red-200 shadow-sm">
                            <Frown className="w-6 h-6 text-red-600" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center border-2 border-blue-200 shadow-sm">
                            <HelpCircle className="w-6 h-6 text-blue-600" />
                          </div>
                        )}
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        {/* Top Row: ID and Date */}
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold text-slate-900">
                              {conversation.conversationId}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(conversation.analysisDate).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          
                          {/* Status Pills */}
                          <div className="flex gap-2 flex-wrap">
                            {conversation.frustrated && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                Frustrated
                              </span>
                            )}
                            {conversation.confused && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                                Confused
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Metadata Row */}
                        {(conversation.service || conversation.skill) && (
                          <div className="flex gap-2 mb-4 flex-wrap">
                            {conversation.service && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {conversation.service}
                              </span>
                            )}
                            {conversation.skill && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                                {conversation.skill}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Content Sections */}
                        <div className="space-y-4">
                          {/* Main Issues */}
                          {hasIssues && (
                            <div>
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2.5">Main Issues</p>
                              <div className="space-y-2">
                                {conversation.mainIssues!.filter(issue => issue && issue.trim() !== '').map((issue, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-3 px-4 py-3 rounded-lg bg-orange-50 border border-orange-200"
                                  >
                                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm text-slate-800 leading-relaxed">
                                      {issue}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Key Phrases */}
                          {hasPhrases && (
                            <div>
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2.5">Key Phrases</p>
                              <div className="space-y-2">
                                {conversation.keyPhrases!.filter(phrase => phrase && phrase.trim() !== '').map((phrase, idx) => (
                                    <div
                                    key={idx}
                                    className="flex items-start gap-2 pl-4 py-2 border-l-2 border-slate-300 bg-slate-50 rounded-r-lg"
                                  >
                                    <span className="text-slate-400 text-lg leading-none">"</span>
                                    <p className="text-sm text-slate-700 italic leading-relaxed flex-1">
                                      {phrase}
                                    </p>
                                    <span className="text-slate-400 text-lg leading-none">"</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* No data message */}
                          {!hasIssues && !hasPhrases && (
                            <div className="text-center py-4">
                              <p className="text-sm text-slate-400 italic">No details recorded</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
