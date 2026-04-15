'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, TrendingUp, Users, Award, LogIn, LogOut, Timer } from 'lucide-react';
import type { DelayTimeData, AgentHoursData } from '@/lib/chat-types';
import DatePickerCalendar from '@/components/DatePickerCalendar';

export default function AgentsDashboard() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [delayData, setDelayData] = useState<DelayTimeData | null>(null);
  const [agentHoursData, setAgentHoursData] = useState<AgentHoursData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available dates
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const res = await fetch('/api/delay-time/dates');
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

  // Fetch delay data based on selected date
  useEffect(() => {
    if (!selectedDate) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch delay data
        const delayResponse = await fetch(`/api/delay-time?date=${selectedDate}`);
        const delayResult = await delayResponse.json();
        
        if (delayResult.success && delayResult.data) {
          setDelayData(delayResult.data);
        } else {
          setError('No delay data available for this date');
        }

        // Fetch agent hours data
        const hoursResponse = await fetch(`/api/agent-hours?date=${selectedDate}`);
        const hoursResult = await hoursResponse.json();
        
        if (hoursResult.success && hoursResult.data) {
          setAgentHoursData(hoursResult.data);
        } else {
          // It's okay if agent hours data is not available
          setAgentHoursData(null);
        }
      } catch (err) {
        setError('Network error occurred');
        console.error('Error fetching agent data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  // Handle date selection from calendar
  const handleDateSelect = (startDate: string | null, endDate?: string | null) => {
    setSelectedDate(startDate);
    setSelectedEndDate(endDate || null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading agent performance data...</p>
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
            <h1 className="text-3xl font-bold text-slate-900">Agent Performance</h1>
            <p className="text-slate-500 mt-2">Monitor agent response times and performance metrics</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
          <Clock className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-700 mb-2">Please Select a Date</h3>
          <p className="text-slate-500">Choose a date from the selector above to view agent performance data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Selector */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Agent Performance</h1>
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
        </div>
        
        {/* Advanced Date Picker */}
        <DatePickerCalendar
          availableDates={availableDates}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      {delayData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Total Agents */}
          <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-6 h-6 text-slate-600" />
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{delayData.agentStats.length}</div>
            <div className="text-sm font-medium text-slate-600">Active Agents</div>
          </div>

          {/* Daily Average Delay */}
          {delayData.dailyAverageDelayFormatted && (
            <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{delayData.dailyAverageDelayFormatted}</div>
              <div className="text-sm font-medium text-slate-600">Daily Avg Response Time</div>
            </div>
          )}
        </div>
      )}

      {/* Agent Hours Summary Cards */}
      {agentHoursData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Total Hours Logged */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <Timer className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-blue-900 mb-1">{agentHoursData.totalHoursLogged.toFixed(1)}h</div>
            <div className="text-sm font-medium text-blue-700">Total Hours Logged</div>
          </div>

          {/* Average Hours Per Agent */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-900 mb-1">{agentHoursData.averageHoursPerAgent.toFixed(1)}h</div>
            <div className="text-sm font-medium text-green-700">Avg Hours/Agent</div>
          </div>
        </div>
      )}

      {/* Agent Performance Table */}
      {delayData && delayData.agentStats && delayData.agentStats.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Agent Rankings</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Response time breakdown by agent
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">
                  {delayData.agentStats.length} Agents
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Agent Name
                  </th>
                  <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Avg Response Time
                  </th>
                  {agentHoursData && (
                    <>
                      <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        First Login
                      </th>
                      <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Last Logout
                      </th>
                      <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Hours Logged
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {delayData.agentStats
                  .sort((a, b) => {
                    const ax = a.avgDelaySeconds ?? Number.POSITIVE_INFINITY;
                    const bx = b.avgDelaySeconds ?? Number.POSITIVE_INFINITY;
                    return ax - bx;
                  })
                  .map((agent, index) => {
                    const isTopPerformer =
                      index < 3 && agent.avgDelaySeconds != null;
                    
                    
                    // Find matching agent hours data
                    const agentHours = agentHoursData?.agents.find(
                      a => a.FULL_NAME.toLowerCase() === agent.agentName.toLowerCase()
                    );
                    
                    // Format time function
                    const formatTime = (timeStr: string) => {
                      if (!timeStr) return '—';
                      try {
                        const date = new Date(timeStr);
                        return date.toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        });
                      } catch {
                        return '—';
                      }
                    };
                    
                    return (
                      <tr key={agent.agentName} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                            index === 0 
                              ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' 
                              : index === 1 
                              ? 'bg-slate-100 text-slate-700 border border-slate-200' 
                              : index === 2
                              ? 'bg-orange-100 text-orange-700 border border-orange-200'
                              : 'bg-slate-50 text-slate-600'
                          }`}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                              isTopPerformer 
                                ? 'bg-green-100 text-green-700 border border-green-200' 
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {agent.agentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-900 text-sm">
                              {agent.agentName}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100">
                            <Clock className="w-4 h-4 text-slate-500" />
                            <span className="font-bold text-slate-900 text-sm">{agent.avgDelayFormatted}</span>
                          </div>
                        </td>
                        {agentHoursData && (
                          <>
                            <td className="py-4 px-6 text-center">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium">
                                <LogIn className="w-3.5 h-3.5" />
                                {agentHours ? formatTime(agentHours.FIRST_LOGIN) : '—'}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                                <LogOut className="w-3.5 h-3.5" />
                                {agentHours ? formatTime(agentHours.LAST_LOGOUT) : '—'}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 font-bold text-sm">
                                {agentHours ? `${agentHours.HOURS_LOGGED.toFixed(1)}h` : '—'}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

