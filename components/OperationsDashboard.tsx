'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, AlertTriangle, FileText, MessageSquare } from 'lucide-react';
import type { OperationsData, ProspectMetric, OperationMetric, SalesMetric, OperationsTrendData } from '@/lib/operations-types';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import OperationsTrendChart from '@/components/OperationsTrendChart';
import ServicePerformanceComparison from '@/components/ServicePerformanceComparison';

export default function OperationsDashboard() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [data, setData] = useState<OperationsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mtdData, setMtdData] = useState<Record<string, number>>({});
  const [selectedNotes, setSelectedNotes] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<OperationsTrendData[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  // Fetch available dates
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const res = await fetch('/api/operations/dates');
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

  // Fetch data based on selected date
  useEffect(() => {
    if (!selectedDate) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        let url = `/api/operations?startDate=${selectedDate}`;
        if (selectedEndDate) {
          url += `&endDate=${selectedEndDate}`;
        } else {
          url += `&endDate=${selectedDate}`;
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success && result.data) {
          // Handle both single day and date range responses
          if (Array.isArray(result.data)) {
            // Multiple days - aggregate the data
            const aggregatedData = aggregateOperationsData(result.data);
            setData(aggregatedData);
          } else {
            // Single day
            setData(result.data);
          }
        } else {
          setError(result.error || 'Failed to fetch data');
        }
      } catch (err) {
        setError('Network error occurred');
        console.error('Error fetching operations data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedDate, selectedEndDate]);

  // Aggregate multiple days of operations data
  const aggregateOperationsData = (dataArray: OperationsData[]): OperationsData => {
    if (dataArray.length === 0) {
      return {
        lastUpdated: new Date().toISOString(),
        analysisDate: selectedDate || '',
        operations: []
      };
    }

    if (dataArray.length === 1) {
      return dataArray[0];
    }

    // Create a map to aggregate operations by service type
    const serviceMap: Record<string, OperationMetric> = {};

    dataArray.forEach(dayData => {
      dayData.operations.forEach(op => {
        if (!serviceMap[op.serviceType]) {
          serviceMap[op.serviceType] = {
            serviceType: op.serviceType,
            pendingUs: 0,
            pendingClient: 0,
            pendingProVisit: 0,
            pendingGov: 0,
            doneToday: 0,
            casesDelayed: 0,
            delayedNotes: op.delayedNotes
          };
        }

        // For range data, sum up the daily values
        serviceMap[op.serviceType].pendingUs += op.pendingUs;
        serviceMap[op.serviceType].pendingClient += op.pendingClient;
        serviceMap[op.serviceType].pendingProVisit += op.pendingProVisit;
        serviceMap[op.serviceType].pendingGov += op.pendingGov;
        serviceMap[op.serviceType].doneToday += op.doneToday;
        serviceMap[op.serviceType].casesDelayed += op.casesDelayed;

        // Combine notes if multiple days have notes
        if (op.delayedNotes && serviceMap[op.serviceType].delayedNotes !== op.delayedNotes) {
          if (serviceMap[op.serviceType].delayedNotes) {
            serviceMap[op.serviceType].delayedNotes += ` | ${op.delayedNotes}`;
          } else {
            serviceMap[op.serviceType].delayedNotes = op.delayedNotes;
          }
        }
      });
    });

    return {
      lastUpdated: new Date().toISOString(),
      analysisDate: selectedEndDate 
        ? `${selectedDate} to ${selectedEndDate}` 
        : selectedDate || '',
      operations: Object.values(serviceMap)
    };
  };

  // Fetch MTD data
  useEffect(() => {
    const fetchMTDData = async () => {
      try {
        // MTD should be from start of month to the selected date (not entire month)
        const referenceDate = selectedDate ? new Date(selectedDate) : new Date();
        const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        const startDate = startOfMonth.toISOString().split('T')[0];
        const endDate = selectedDate || new Date().toISOString().split('T')[0];

        console.log(`[MTD] Fetching MTD data from ${startDate} to ${endDate} (selected date: ${selectedDate})`);
        console.log(`[MTD] Reference date: ${referenceDate.toISOString()}`);
        
        const response = await fetch(`/api/operations?startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) throw new Error('Failed to fetch MTD data');

        const result = await response.json();
        console.log('[MTD] API Response:', result);
        
        if (!result.success) {
          console.error('[MTD] API Error:', result.error);
          return;
        }

        if (!result.data) {
          console.warn('[MTD] No data returned from API');
          return;
        }
        
        const mtdTotals: Record<string, number> = {};
        
        // Ensure we always work with an array
        const dataArray = Array.isArray(result.data) ? result.data : [result.data];
        
        // Filter and process only days from start of month to selected date
        dataArray
          .filter((dayData: OperationsData) => dayData.analysisDate <= endDate)
          .forEach((dayData: OperationsData, dayIndex: number) => {
            console.log(`[MTD] Processing day ${dayIndex + 1}: ${dayData.analysisDate}`);
            
            dayData.operations.forEach(op => {
              if (!mtdTotals[op.serviceType]) {
                mtdTotals[op.serviceType] = 0;
              }
              const prevTotal = mtdTotals[op.serviceType];
              mtdTotals[op.serviceType] += op.doneToday;
              console.log(`[MTD] ${op.serviceType}: ${prevTotal} + ${op.doneToday} = ${mtdTotals[op.serviceType]}`);
            });
          });
        
        console.log('[MTD] Final totals:', mtdTotals);
        setMtdData(mtdTotals);
      } catch (err) {
        console.error('Error fetching MTD data:', err);
      }
    };

    fetchMTDData();
  }, [selectedDate]); // Recalculate MTD when selected date changes

  // Fetch trend data when date is selected
  useEffect(() => {
    if (!selectedDate) {
      setTrendData([]);
      return;
    }

    const fetchTrendData = async () => {
      try {
        setIsLoadingTrends(true);
        const response = await fetch(`/api/operations/trends?endDate=${selectedDate}&days=14`);
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

  // Calculate summary totals from raw data
  const calculateSummary = (data: OperationsData) => {
    const totalPendingUs = data.operations.reduce((sum, o) => sum + o.pendingUs, 0);
    const totalPendingClient = data.operations.reduce((sum, o) => sum + o.pendingClient, 0);
    const totalPendingProVisit = data.operations.reduce((sum, o) => sum + o.pendingProVisit, 0);
    const totalPendingGov = data.operations.reduce((sum, o) => sum + o.pendingGov, 0);
    const totalDoneToday = data.operations.reduce((sum, o) => sum + o.doneToday, 0);
    const totalCasesDelayed = data.operations.reduce((sum, o) => sum + o.casesDelayed, 0);
    
    // Calculate total MTD across all services
    const totalMTD = Object.values(mtdData).reduce((sum, value) => sum + value, 0);

    return {
      totalPendingUs,
      totalPendingClient,
      totalPendingProVisit,
      totalPendingGov,
      totalDoneToday,
      totalCasesDelayed,
      totalMTD
    };
  };

  const summary = data ? calculateSummary(data) : null;

  // Calculate column totals for the table
  const columnTotals = data ? {
    totalPendingUs: data.operations.reduce((sum, o) => sum + o.pendingUs, 0),
    totalPendingClient: data.operations.reduce((sum, o) => sum + o.pendingClient, 0),
    totalPendingProVisit: data.operations.reduce((sum, o) => sum + o.pendingProVisit, 0),
    totalPendingGov: data.operations.reduce((sum, o) => sum + o.pendingGov, 0),
    totalDoneToday: data.operations.reduce((sum, o) => sum + o.doneToday, 0),
    totalMTD: Object.values(mtdData).reduce((sum, value) => sum + value, 0),
    totalCasesDelayed: data.operations.reduce((sum, o) => sum + o.casesDelayed, 0)
  } : null;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Operations Dashboard</h1>
            <p className="text-slate-500 mt-2">Monitor daily operations, prospects, and performance metrics</p>
          </div>
          <DatePickerCalendar
            availableDates={availableDates}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading operations data...</p>
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
            <h1 className="text-3xl font-bold text-slate-900">Operations Dashboard</h1>
            <p className="text-slate-500 mt-2">Monitor daily operations, prospects, and performance metrics</p>
          </div>
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
            Use the date picker above to select a date to view operations data.
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
            <h1 className="text-3xl font-bold text-slate-900">Operations Dashboard</h1>
            <p className="text-slate-500 mt-2">Monitor daily operations, prospects, and performance metrics</p>
          </div>
          <DatePickerCalendar
            availableDates={availableDates}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-4" />
            <p className="text-slate-700 font-medium">No operations data available</p>
            <p className="text-slate-500 text-sm mt-1">{error || 'Please select a different date'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Operations Dashboard</h1>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Pending Cases */}
        <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-6 h-6 text-orange-600" />
          </div>
          <div className="text-4xl font-bold text-slate-900 mb-1">
            {summary ? summary.totalPendingUs + summary.totalPendingProVisit : 0}
          </div>
          <div className="text-sm font-medium text-slate-600">Total Pending</div>
        </div>

        {/* Completed Today */}
        <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div className="text-4xl font-bold text-slate-900 mb-1">{summary?.totalDoneToday || 0}</div>
          <div className="text-sm font-medium text-slate-600">Completed Today</div>
        </div>

        {/* Cases Delayed */}
        <div className="bg-slate-800 rounded-xl p-6 border-2 border-slate-700 shadow-sm text-white">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-6 h-6 text-slate-300" />
          </div>
          <div className="text-4xl font-bold text-white mb-1">{summary?.totalCasesDelayed || 0}</div>
          <div className="text-sm font-medium text-slate-300">Cases Delayed</div>
        </div>

        {/* MTD Completed */}
        <div className="bg-blue-600 rounded-xl p-6 border-2 border-blue-500 shadow-sm text-white">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-6 h-6 text-blue-200" />
          </div>
          <div className="text-4xl font-bold text-white mb-1">{summary?.totalMTD || 0}</div>
          <div className="text-sm font-medium text-blue-200">MTD Completed</div>
        </div>
      </div>


      {/* Trend Analysis Chart */}
      <OperationsTrendChart data={trendData} isLoading={isLoadingTrends} />

      {/* Service Performance Comparison */}
      {data && data.operations.length > 0 && (
        <ServicePerformanceComparison 
          operations={data.operations} 
          mtdData={mtdData}
        />
      )}

      {/* Operations Section */}
      <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Operations Status</h3>
              <p className="text-sm text-slate-600 mt-1">Service processing status and completion metrics</p>
            </div>
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">Service Type</th>
                <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">Pending Us</th>
                <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">Pending Client</th>
                <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">Pending PRO</th>
                <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">Pending Gov</th>
                <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">Done Today</th>
                <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">MTD</th>
                <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">Cases Delayed</th>
                <th className="text-center py-3 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.operations.map((operation, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6">
                    <span className="font-semibold text-slate-900 text-sm">{operation.serviceType}</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-black text-sm">
                      {operation.pendingUs}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-black text-sm">
                      {operation.pendingClient}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-black text-sm">
                      {operation.pendingProVisit}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-black text-sm">
                      {operation.pendingGov}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-black text-sm">
                      {operation.doneToday}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-black text-sm">
                      {mtdData[operation.serviceType] || 0}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-black text-sm">
                      {operation.casesDelayed}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {operation.delayedNotes ? (
                      <button
                        onClick={() => setSelectedNotes(operation.delayedNotes || null)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                        title="View delay notes"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))}
              
              {/* Totals Row */}
              {columnTotals && (
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-semibold">
                  <td className="py-4 px-6">
                    <span className="font-bold text-slate-900 text-sm">TOTAL</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded text-sm font-bold bg-orange-100 text-orange-800">
                      {columnTotals.totalPendingUs}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded text-sm font-bold bg-blue-100 text-blue-800">
                      {columnTotals.totalPendingClient}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded text-sm font-bold bg-purple-100 text-purple-800">
                      {columnTotals.totalPendingProVisit}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded text-sm font-bold bg-red-100 text-red-800">
                      {columnTotals.totalPendingGov}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded text-sm font-bold bg-green-100 text-green-800">
                      {columnTotals.totalDoneToday}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded text-sm font-bold bg-blue-100 text-blue-800">
                      {columnTotals.totalMTD}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded text-sm font-bold bg-red-100 text-red-800">
                      {columnTotals.totalCasesDelayed}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-slate-400 text-sm">—</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delayed Notes Popup */}
      {selectedNotes && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <div className="bg-white rounded-lg border border-slate-200 shadow-lg max-w-sm w-80 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-900">Delay Notes</h3>
                </div>
                <button
                  onClick={() => setSelectedNotes(null)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <p className="text-slate-700 text-xs leading-relaxed">{selectedNotes}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
