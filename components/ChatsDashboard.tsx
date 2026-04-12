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
import {
  computeByChatsViewMetrics,
  createEmptyByChatsViewMetrics,
} from '@/lib/chat-by-chats-metrics';
import type { ChatAnalysisData, ChatTrendData } from '@/lib/chat-types';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import ChatTrendChart from '@/components/ChatTrendChart';

type ViewMode = 'people' | 'conversation';

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
  /** Prefer server `byChatsView`; if missing (old deploy/blob), recompute from stored joinedSkills on results. */
  const bc =
    data.byChatsView ??
    (() => {
      const rows = deduplicatedArray
        .filter((r) => r.joinedSkills?.trim())
        .map((r) => ({
          conversationId: r.conversationId,
          frustrated: r.frustrated,
          confused: r.confused,
          joinedSkills: r.joinedSkills,
        }));
      if (rows.length === 0) return createEmptyByChatsViewMetrics();
      return computeByChatsViewMetrics(rows);
    })();

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

      {/* Stats: By Conversation — joinedSkills pipeline (see lib/chat-joined-skills.ts) */}
      {viewMode === 'conversation' && (
        <div className="space-y-8">
          <p className="text-sm text-slate-500">
            Bot/agent uses <code className="rounded bg-slate-100 px-1 text-xs">joinedSkills</code> (contains,
            case-insensitive): bot if GPT_VBC_SALES or VBC_ROUTING_BOT; agent if VBC_SALES_AGENTS or
            VBC_RESOLVERS_AGENTS. Totals dedupe by conversation id; bot and agent segments can overlap.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-auto">
                <MessageSquare className="w-6 h-6 text-slate-600" />
              </div>
              <div className="mt-auto">
                <div className="text-3xl font-bold text-slate-900 mb-1">{bc.totalChats}</div>
                <div className="text-sm font-medium text-slate-600">Total Chats</div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-auto">
                <Frown className="w-6 h-6 text-red-600" />
                <span className="text-xl font-bold text-red-600">{bc.frustratedPctOfAllChats}%</span>
              </div>
              <div className="mt-auto">
                <div className="text-3xl font-bold text-slate-900 mb-1">{bc.totalFrustrated}</div>
                <div className="text-sm font-medium text-slate-600">Frustrated Chats</div>
                <div className="text-xs text-slate-500 mt-2">% of all chats</div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-auto">
                <HelpCircle className="w-6 h-6 text-blue-600" />
                <span className="text-xl font-bold text-blue-600">{bc.confusedPctOfAllChats}%</span>
              </div>
              <div className="mt-auto">
                <div className="text-3xl font-bold text-slate-900 mb-1">{bc.totalConfused}</div>
                <div className="text-sm font-medium text-slate-600">Confused Chats</div>
                <div className="text-xs text-slate-500 mt-2">% of all chats</div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Bot className="w-5 h-5 text-violet-600" />
              Bot-handled chats
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {bc.totalBotPctOfAllChats}% of all chats match the bot segment (can overlap with agent).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-6 border-2 border-violet-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Bot className="w-6 h-6 text-violet-600" />
                  <span className="text-lg font-bold text-violet-700">{bc.totalBotPctOfAllChats}%</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">{bc.totalBot}</div>
                <div className="text-sm font-medium text-slate-600 mt-1">Total Bot Chats</div>
                <div className="text-xs text-slate-500 mt-1">% of all chats</div>
              </div>
              <div className="bg-white rounded-xl p-6 border-2 border-red-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Frown className="w-6 h-6 text-red-600" />
                  <span className="text-lg font-bold text-red-600">{bc.frustrationPctWithinTotalBot}%</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">{bc.frustratedInTotalBot}</div>
                <div className="text-sm font-medium text-slate-600 mt-1">Frustrated (bot segment)</div>
                <div className="text-xs text-slate-500 mt-1">% within total bot chats</div>
              </div>
              <div className="bg-white rounded-xl p-6 border-2 border-blue-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <HelpCircle className="w-6 h-6 text-blue-600" />
                  <span className="text-lg font-bold text-blue-600">{bc.confusionPctWithinTotalBot}%</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">{bc.confusedInTotalBot}</div>
                <div className="text-sm font-medium text-slate-600 mt-1">Confused (bot segment)</div>
                <div className="text-xs text-slate-500 mt-1">% within total bot chats</div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-3">Fully handled by bot</h3>
            <p className="text-xs text-slate-500 mb-3">
              Bot only (not agent). Headline count as % of all chats; frustration/confusion within this slice.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 border border-violet-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">Chats</span>
                  <span className="text-base font-bold text-violet-700">{bc.fullyBotPctOfAllChats}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.fullyBot}</div>
                <div className="text-xs text-slate-500 mt-1">% of all chats</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-red-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Frown className="w-5 h-5 text-red-600" />
                  <span className="text-base font-bold text-red-600">{bc.frustrationPctWithinFullyBot}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.frustratedInFullyBot}</div>
                <div className="text-xs text-slate-500 mt-1">Frustrated · within fully bot</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-bold text-blue-600">{bc.confusionPctWithinFullyBot}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.confusedInFullyBot}</div>
                <div className="text-xs text-slate-500 mt-1">Confused · within fully bot</div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-3">Bot chats with at least one agent segment</h3>
            <p className="text-xs text-slate-500 mb-3">Bot ∩ agent overlap. Frustration/confusion within this overlap slice.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 border border-violet-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">Chats</span>
                  <span className="text-base font-bold text-violet-700">{bc.botWithAgentPctOfTotalBot}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.botWithAgentMessage}</div>
                <div className="text-xs text-slate-500 mt-1">% of total bot chats</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-red-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Frown className="w-5 h-5 text-red-600" />
                  <span className="text-base font-bold text-red-600">{bc.frustrationPctWithinBotWithAgent}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.frustratedInBotWithAgent}</div>
                <div className="text-xs text-slate-500 mt-1">Frustrated · within overlap</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-bold text-blue-600">{bc.confusionPctWithinBotWithAgent}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.confusedInBotWithAgent}</div>
                <div className="text-xs text-slate-500 mt-1">Confused · within overlap</div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <Headphones className="w-5 h-5 text-emerald-600" />
              Agent-handled chats
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {bc.totalAgentPctOfAllChats}% of all chats match the agent segment (can overlap with bot).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-6 border-2 border-emerald-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Headphones className="w-6 h-6 text-emerald-600" />
                  <span className="text-lg font-bold text-emerald-700">{bc.totalAgentPctOfAllChats}%</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">{bc.totalAgent}</div>
                <div className="text-sm font-medium text-slate-600 mt-1">Total Agent Chats</div>
                <div className="text-xs text-slate-500 mt-1">% of all chats</div>
              </div>
              <div className="bg-white rounded-xl p-6 border-2 border-red-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Frown className="w-6 h-6 text-red-600" />
                  <span className="text-lg font-bold text-red-600">{bc.frustrationPctWithinTotalAgent}%</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">{bc.frustratedInTotalAgent}</div>
                <div className="text-sm font-medium text-slate-600 mt-1">Frustrated (agent segment)</div>
                <div className="text-xs text-slate-500 mt-1">% within total agent chats</div>
              </div>
              <div className="bg-white rounded-xl p-6 border-2 border-blue-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <HelpCircle className="w-6 h-6 text-blue-600" />
                  <span className="text-lg font-bold text-blue-600">{bc.confusionPctWithinTotalAgent}%</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">{bc.confusedInTotalAgent}</div>
                <div className="text-sm font-medium text-slate-600 mt-1">Confused (agent segment)</div>
                <div className="text-xs text-slate-500 mt-1">% within total agent chats</div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-3">Fully handled by agent</h3>
            <p className="text-xs text-slate-500 mb-3">
              Agent only (not bot). Headline count as % of all chats; frustration/confusion within this slice.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 border border-emerald-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">Chats</span>
                  <span className="text-base font-bold text-emerald-700">{bc.fullyAgentPctOfAllChats}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.fullyAgent}</div>
                <div className="text-xs text-slate-500 mt-1">% of all chats</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-red-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Frown className="w-5 h-5 text-red-600" />
                  <span className="text-base font-bold text-red-600">{bc.frustrationPctWithinFullyAgent}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.frustratedInFullyAgent}</div>
                <div className="text-xs text-slate-500 mt-1">Frustrated · within fully agent</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-bold text-blue-600">{bc.confusionPctWithinFullyAgent}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.confusedInFullyAgent}</div>
                <div className="text-xs text-slate-500 mt-1">Confused · within fully agent</div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-3">Agent chats with at least one bot segment</h3>
            <p className="text-xs text-slate-500 mb-3">Same overlap as bot ∩ agent. Frustration/confusion within this slice.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 border border-emerald-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">Chats</span>
                  <span className="text-base font-bold text-emerald-700">{bc.agentWithBotPctOfTotalAgent}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.agentWithBotMessage}</div>
                <div className="text-xs text-slate-500 mt-1">% of total agent chats</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-red-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Frown className="w-5 h-5 text-red-600" />
                  <span className="text-base font-bold text-red-600">{bc.frustrationPctWithinAgentWithBot}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.frustratedInAgentWithBot}</div>
                <div className="text-xs text-slate-500 mt-1">Frustrated · within overlap</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-bold text-blue-600">{bc.confusionPctWithinAgentWithBot}%</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{bc.confusedInAgentWithBot}</div>
                <div className="text-xs text-slate-500 mt-1">Confused · within overlap</div>
              </div>
            </div>
          </div>

          {bc.neitherBotNorAgent > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="font-semibold">{bc.neitherBotNorAgent} chat(s)</span> did not match bot or agent tokens
              in <code className="rounded bg-amber-100 px-1">joinedSkills</code> (
              <code className="rounded bg-amber-100 px-1">lib/chat-joined-skills.ts</code>).
            </div>
          )}

          {!data.byChatsView &&
            !deduplicatedArray.some((r) => r.joinedSkills?.trim()) && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                By Chats metrics are not on file and <code className="rounded bg-white px-1">joinedSkills</code> is
                missing from conversation rows. Deploy the latest API and re-ingest with{' '}
                <code className="rounded bg-white px-1">joinedSkills</code>.
              </div>
            )}
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
