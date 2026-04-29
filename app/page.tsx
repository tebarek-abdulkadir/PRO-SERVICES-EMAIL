'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import ProspectCards from '@/components/ProspectCards';
import CountryBreakdown from '@/components/CountryBreakdown';
import ServiceBreakdownChart from '@/components/ServiceBreakdownChart';
import ProspectTable from '@/components/ProspectTable';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import CollapsibleSection from '@/components/CollapsibleSection';
import ServiceSummaryCards from '@/components/ServiceSummaryCards';
import ServiceProspectTable from '@/components/ServiceProspectTable';
import PassportRenewalSummaryCards from '@/components/PassportRenewalSummaryCards';
import PnLSummaryCards from '@/components/PnLSummaryCards';
import PnLServiceChart from '@/components/PnLServiceChart';
import PnLTable from '@/components/PnLTable';
import PnLServiceDetail from '@/components/PnLServiceDetail';
import PnLDatePicker from '@/components/PnLDatePicker';
import ChatsDashboard from '@/components/ChatsDashboard';
import AgentsDashboard from '@/components/AgentsDashboard';
import OperationsDashboard from '@/components/OperationsDashboard';
import NPSDashboard from '@/components/NPSDashboard';
import EvalsDashboard from '@/components/EvalsDashboard';
import type { Results, ServiceFilter, ProspectDetail, HouseholdGroup } from '@/lib/types';
import type { AggregatedPnL } from '@/lib/pnl-types';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardSubTab, setDashboardSubTab] = useState<'overview' | 'oec' | 'owwa' | 'travelVisa' | 'passportRenewal'>('overview');
  const [pnlSubTab, setPnlSubTab] = useState<
    'overview' | 'oec' | 'owwa' | 'ttl' | 'tte' | 'ttj' | 'visaSaudi' | 'schengen' | 'gcc' | 'ethiopianPP' | 'filipinaPP'
  >('overview');
  const [results, setResults] = useState<Results | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pnlData, setPnlData] = useState<AggregatedPnL | null>(null);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [pnlSource, setPnlSource] = useState<'complaints' | 'excel' | 'none'>('none');
  const [pnlSelectedDate, setPnlSelectedDate] = useState<string | null>(null);
  const [pnlSelectedEndDate, setPnlSelectedEndDate] = useState<string | null>(null);
  const [pnlAvailableDates, setPnlAvailableDates] = useState<string[]>([]);
  const [pnlAvailableMonths, setPnlAvailableMonths] = useState<string[]>([]);
  const [pnlViewMode, setPnlViewMode] = useState<'daily' | 'monthly'>('monthly');
  
  // Use ref to avoid useCallback dependency issues
  const availableDatesRef = useRef<string[]>([]);
  availableDatesRef.current = availableDates;

  const fetchDates = useCallback(async () => {
    try {
      const res = await fetch('/api/dates');
      const data = await res.json();
      setAvailableDates(data.dates || []);
    } catch (err) {
      console.error('Failed to fetch dates:', err);
    }
  }, []);

  const fetchResults = useCallback(async (startDate?: string | null, endDate?: string | null) => {
    // Don't fetch if no date is selected
    if (!startDate) {
      setResults(null);
      return;
    }

    try {
      // If we have a date range, fetch all dates and aggregate
      if (startDate && endDate && startDate !== endDate) {
        const datesToFetch = availableDatesRef.current.filter(d => d >= startDate && d <= endDate);
        
        if (datesToFetch.length === 0) {
          setResults(null);
          return;
        }

        const allData = await Promise.all(
          datesToFetch.map(async (date) => {
            const res = await fetch(`/api/dates/${date}`);
            return res.json();
          })
        );

        // Aggregate the data
        const aggregated: Results = {
          totalProcessed: 0,
          totalConversations: 0,
          isProcessing: false,
          prospects: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
          conversions: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
          countryCounts: {},
          byContractType: {
            CC: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
            MV: { oec: 0, owwa: 0, travelVisa: 0, filipinaPassportRenewal: 0, ethiopianPassportRenewal: 0 },
          },
          prospectDetails: [],
          households: [],
        };

        allData.forEach((data) => {
          if (!data || data.error) return;
          
          aggregated.totalProcessed += data.totalProcessed || 0;
          aggregated.totalConversations += data.totalConversations || 0;
          aggregated.prospects.oec += data.prospects?.oec || 0;
          aggregated.prospects.owwa += data.prospects?.owwa || 0;
          aggregated.prospects.travelVisa += data.prospects?.travelVisa || 0;
          aggregated.prospects.filipinaPassportRenewal += data.prospects?.filipinaPassportRenewal || 0;
          aggregated.prospects.ethiopianPassportRenewal += data.prospects?.ethiopianPassportRenewal || 0;
          
          if (data.conversions) {
            aggregated.conversions!.oec += data.conversions.oec || 0;
            aggregated.conversions!.owwa += data.conversions.owwa || 0;
            aggregated.conversions!.travelVisa += data.conversions.travelVisa || 0;
            aggregated.conversions!.filipinaPassportRenewal += data.conversions.filipinaPassportRenewal || 0;
            aggregated.conversions!.ethiopianPassportRenewal += data.conversions.ethiopianPassportRenewal || 0;
          }
          
          if (data.byContractType) {
            aggregated.byContractType!.CC.oec += data.byContractType.CC?.oec || 0;
            aggregated.byContractType!.CC.owwa += data.byContractType.CC?.owwa || 0;
            aggregated.byContractType!.CC.travelVisa += data.byContractType.CC?.travelVisa || 0;
            aggregated.byContractType!.CC.filipinaPassportRenewal += data.byContractType.CC?.filipinaPassportRenewal || 0;
            aggregated.byContractType!.CC.ethiopianPassportRenewal += data.byContractType.CC?.ethiopianPassportRenewal || 0;
            aggregated.byContractType!.MV.oec += data.byContractType.MV?.oec || 0;
            aggregated.byContractType!.MV.owwa += data.byContractType.MV?.owwa || 0;
            aggregated.byContractType!.MV.travelVisa += data.byContractType.MV?.travelVisa || 0;
            aggregated.byContractType!.MV.filipinaPassportRenewal += data.byContractType.MV?.filipinaPassportRenewal || 0;
            aggregated.byContractType!.MV.ethiopianPassportRenewal += data.byContractType.MV?.ethiopianPassportRenewal || 0;
          }
          
          // Merge country counts
          if (data.countryCounts) {
            Object.entries(data.countryCounts).forEach(([country, count]) => {
              aggregated.countryCounts[country] = (aggregated.countryCounts[country] || 0) + (count as number);
            });
          }
          
          // Merge prospect details (deduplicate by conversationId)
          if (data.prospects?.details) {
            const existingIds = new Set((aggregated.prospectDetails || []).map((p: ProspectDetail) => p.conversationId));
            const newProspects = data.prospects.details.filter((p: ProspectDetail) => !existingIds.has(p.conversationId));
            aggregated.prospectDetails = [...(aggregated.prospectDetails || []), ...newProspects];
          }
          
          // Merge households (deduplicate by householdId)
          if (data.households) {
            const existingHouseholdIds = new Set((aggregated.households || []).map((h: HouseholdGroup) => h.householdId));
            const newHouseholds = data.households.filter((h: HouseholdGroup) => !existingHouseholdIds.has(h.householdId));
            aggregated.households = [...(aggregated.households || []), ...newHouseholds];
          }
        });

        setResults(aggregated);
        return;
      }

      // Single date
      const res = await fetch(`/api/dates/${startDate}`);
      const data = await res.json();
      
      if (data.prospects?.details) {
        setResults({
          totalProcessed: data.totalProcessed,
          totalConversations: data.totalConversations,
          isProcessing: data.isProcessing,
          prospects: {
            oec: data.prospects.oec,
            owwa: data.prospects.owwa,
            travelVisa: data.prospects.travelVisa,
            filipinaPassportRenewal: data.prospects.filipinaPassportRenewal,
            ethiopianPassportRenewal: data.prospects.ethiopianPassportRenewal,
          },
          conversions: data.conversions,
          countryCounts: data.countryCounts || {},
          byContractType: data.byContractType,
          lastUpdated: data.lastUpdated,
          date: data.date,
          fileName: data.fileName,
          latestRun: data.latestRun,
          prospectDetails: data.prospects.details,
          households: data.households,
        });
      } else {
        setResults(data);
      }
    } catch (err) {
      console.error('Failed to fetch results:', err);
    }
  }, []);

  // Fetch P&L data with date range support
  const fetchPnLData = useCallback(async (startDate?: string | null, endDate?: string | null, viewMode: 'daily' | 'monthly' = 'monthly') => {
    if (!startDate) {
      setPnlData(null);
      return;
    }
    setPnlLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      if (endDate) {
        params.append('endDate', endDate);
      }
      params.append('viewMode', viewMode);
      
      const res = await fetch(`/api/pnl?${params.toString()}`);
      const data = await res.json();
      if (data.aggregated) {
        setPnlData(data.aggregated);
        setPnlSource(data.source || 'none');
        // Update available dates/months from response
        if (data.availableDates) {
          setPnlAvailableDates(data.availableDates);
        }
        if (data.availableMonths) {
          setPnlAvailableMonths(data.availableMonths);
        }
      } else {
        setPnlData(null);
        setPnlSource('none');
      }
    } catch (err) {
      console.error('Failed to fetch P&L data:', err);
      setPnlData(null);
    } finally {
      setPnlLoading(false);
    }
  }, []);

  // Fetch dates when component mounts
  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  // Fetch P&L available dates from complaints-daily when switching to P&L tab
  useEffect(() => {
    if (activeTab === 'pnl') {
      const fetchPnLDates = async () => {
        try {
          const res = await fetch('/api/complaints-daily/dates');
          const result = await res.json();
          if (result.success && result.dates) {
            setPnlAvailableDates(result.dates);
            // Convert dates to months for monthly view
            const months = [...new Set((result.dates as string[]).map((d: string) => d.substring(0, 7)))].sort();
            setPnlAvailableMonths(months);
            
            // Auto-select the most recent month for monthly view
            if (months.length > 0 && !pnlSelectedDate) {
              const latestMonth = months[months.length - 1];
              setPnlSelectedDate(`${latestMonth}-01`);
              // Set end date to last day of the month
              const monthEnd = new Date(latestMonth + '-01');
              monthEnd.setMonth(monthEnd.getMonth() + 1);
              monthEnd.setDate(0);
              setPnlSelectedEndDate(monthEnd.toISOString().split('T')[0]);
            }
          }
        } catch (err) {
          console.error('Failed to fetch P&L dates:', err);
        }
      };
      fetchPnLDates();
    }
  }, [activeTab]);

  // Fetch P&L data when the selected P&L date changes
  useEffect(() => {
    if (activeTab === 'pnl' && pnlSelectedDate) {
      fetchPnLData(pnlSelectedDate, pnlSelectedEndDate, pnlViewMode);
    }
  }, [activeTab, pnlSelectedDate, pnlSelectedEndDate, pnlViewMode, fetchPnLData]);

  // Fetch results only when a date is selected
  useEffect(() => {
    if (selectedDate) {
      setIsLoading(true);
    fetchResults(selectedDate, selectedEndDate).then(() => setIsLoading(false));
    }
  }, [fetchResults, selectedDate, selectedEndDate]);

  const handleDateSelect = (date: string | null, endDate?: string | null) => {
    setSelectedDate(date);
    setSelectedEndDate(endDate || null);
    if (date) {
    setIsLoading(true);
    fetchResults(date, endDate).then(() => setIsLoading(false));
    } else {
      setResults(null);
    }
  };

  const handlePnLDateSelect = (startDate: string | null, endDate?: string | null) => {
    setPnlSelectedDate(startDate);
    setPnlSelectedEndDate(endDate || null);
  };

  // Helper to get prospect count by service
  const getProspectCount = (service: ServiceFilter): number => {
    return results?.prospects?.[service] || 0;
  };

  // Helper to get filtered prospects count
  const getFilteredProspectCount = (service: ServiceFilter): number => {
    if (!results?.prospectDetails) return 0;
    switch (service) {
      case 'oec':
        return results.prospectDetails.filter(p => p.isOECProspect).length;
      case 'owwa':
        return results.prospectDetails.filter(p => p.isOWWAProspect).length;
      case 'travelVisa':
        return results.prospectDetails.filter(p => p.isTravelVisaProspect).length;
      case 'filipinaPassportRenewal':
        return results.prospectDetails.filter(p => p.isFilipinaPassportRenewalProspect).length;
      case 'ethiopianPassportRenewal':
        return results.prospectDetails.filter(p => p.isEthiopianPassportRenewalProspect).length;
      default:
        return 0;
    }
  };

  // "Please select a date" placeholder
  const DateSelectionPrompt = () => (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
      <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">Please Select a Date</h3>
      <p className="text-sm text-slate-500 text-center max-w-sm">
        Use the date picker above to select a date or date range to view prospect data.
      </p>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 p-6">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Sub-tabs Navigation */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { id: 'overview', label: 'Overview', icon: '◉' },
                  { id: 'oec', label: 'OEC', icon: '◈' },
                  { id: 'owwa', label: 'OWWA', icon: '◇' },
                  { id: 'travelVisa', label: 'Travel Visa', icon: '✈' },
                  { id: 'passportRenewal', label: 'Passport Renewals', icon: '📘' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDashboardSubTab(tab.id as typeof dashboardSubTab)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      dashboardSubTab === tab.id
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
              <DatePickerCalendar
                availableDates={availableDates}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
              />
            </div>

            {/* Show prompt if no date selected */}
            {!selectedDate ? (
              <DateSelectionPrompt />
            ) : (
              <>
                {/* Overview Sub-tab */}
                {dashboardSubTab === 'overview' && (
              <>
            <ProspectCards
                  oecCount={results?.prospects?.oec || 0}
                  owwaCount={results?.prospects?.owwa || 0}
                  travelVisaCount={results?.prospects?.travelVisa || 0}
                  filipinaPassportRenewalCount={results?.prospects?.filipinaPassportRenewal || 0}
                  ethiopianPassportRenewalCount={results?.prospects?.ethiopianPassportRenewal || 0}
              totalProcessed={results?.totalProcessed || 0}
              conversions={results?.conversions}
              byContractType={results?.byContractType}
              prospectDetails={results?.prospectDetails}
              isLoading={isLoading}
            />

            <ServiceBreakdownChart 
              prospectDetails={results?.prospectDetails} 
              households={results?.households}
              byContractType={results?.byContractType}
            />

            <CountryBreakdown countryCounts={results?.countryCounts || {}} />

                <CollapsibleSection
                  title="Prospect Records"
                  count={results?.prospectDetails?.length || 0}
                >
                  <ProspectTable 
                    prospects={results?.prospectDetails || []} 
                    households={results?.households}
                  />
                </CollapsibleSection>
                  </>
                )}

                {/* OEC Sub-tab */}
                {dashboardSubTab === 'oec' && (
                  <>
                    <ServiceSummaryCards
                      service="oec"
                      prospectCount={getProspectCount('oec')}
                      conversions={results?.conversions}
                      byContractType={results?.byContractType}
                      prospectDetails={results?.prospectDetails}
                    />

                    <ServiceBreakdownChart 
                      prospectDetails={results?.prospectDetails} 
                      households={results?.households}
                      byContractType={results?.byContractType}
                      serviceFilter="oec"
                    />

                    <CollapsibleSection
                      title="OEC Prospect Details"
                      count={getFilteredProspectCount('oec')}
                    >
                      <ServiceProspectTable
                        prospects={results?.prospectDetails || []}
                        service="oec"
                      />
                    </CollapsibleSection>
                  </>
                )}

                {/* OWWA Sub-tab */}
                {dashboardSubTab === 'owwa' && (
                  <>
                    <ServiceSummaryCards
                      service="owwa"
                      prospectCount={getProspectCount('owwa')}
                      conversions={results?.conversions}
                      byContractType={results?.byContractType}
                      prospectDetails={results?.prospectDetails}
                    />

                    <ServiceBreakdownChart 
                      prospectDetails={results?.prospectDetails} 
                      households={results?.households}
                      byContractType={results?.byContractType}
                      serviceFilter="owwa"
                    />

                    <CollapsibleSection
                      title="OWWA Prospect Details"
                      count={getFilteredProspectCount('owwa')}
                    >
                      <ServiceProspectTable
                        prospects={results?.prospectDetails || []}
                        service="owwa"
                      />
                    </CollapsibleSection>
                  </>
                )}

                {/* Travel Visa Sub-tab */}
                {dashboardSubTab === 'travelVisa' && (
                  <>
                    <ServiceSummaryCards
                      service="travelVisa"
                      prospectCount={getProspectCount('travelVisa')}
                      conversions={results?.conversions}
                      byContractType={results?.byContractType}
                      prospectDetails={results?.prospectDetails}
                    />

                    <CountryBreakdown countryCounts={results?.countryCounts || {}} />

                    <ServiceBreakdownChart 
                      prospectDetails={results?.prospectDetails} 
                      households={results?.households}
                      byContractType={results?.byContractType}
                      serviceFilter="travelVisa"
                    />

                    <CollapsibleSection
                      title="Travel Visa Prospect Details"
                      count={getFilteredProspectCount('travelVisa')}
                    >
                      <ServiceProspectTable
                        prospects={results?.prospectDetails || []}
                        service="travelVisa"
                      />
                    </CollapsibleSection>
                  </>
                )}

                {/* Passport Renewals Sub-tab (Combined Filipina and Ethiopian) */}
                {dashboardSubTab === 'passportRenewal' && (
                  <>
                    <PassportRenewalSummaryCards
                      filipinaCount={getProspectCount('filipinaPassportRenewal')}
                      ethiopianCount={getProspectCount('ethiopianPassportRenewal')}
                      conversions={results?.conversions}
                      byContractType={results?.byContractType}
                      prospectDetails={results?.prospectDetails}
                    />

                    <ServiceBreakdownChart 
                      prospectDetails={results?.prospectDetails} 
                      households={results?.households}
                      byContractType={results?.byContractType}
                      serviceFilter="filipinaPassportRenewal"
                    />

                    <ServiceBreakdownChart 
                      prospectDetails={results?.prospectDetails} 
                      households={results?.households}
                      byContractType={results?.byContractType}
                      serviceFilter="ethiopianPassportRenewal"
                    />

                    <CollapsibleSection
                      title="Filipina Passport Renewal Prospect Details"
                      count={getFilteredProspectCount('filipinaPassportRenewal')}
                    >
                      <ServiceProspectTable
                        prospects={results?.prospectDetails || []}
                        service="filipinaPassportRenewal"
                      />
                    </CollapsibleSection>

                    <CollapsibleSection
                      title="Ethiopian Passport Renewal Prospect Details"
                      count={getFilteredProspectCount('ethiopianPassportRenewal')}
                    >
                      <ServiceProspectTable
                        prospects={results?.prospectDetails || []}
                        service="ethiopianPassportRenewal"
                      />
                    </CollapsibleSection>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* NPS Dashboard Tab */}
        {activeTab === 'nps' && (
          <NPSDashboard />
        )}

        {/* P&L Tab */}
        {activeTab === 'pnl' && (
          <div className="space-y-6">
            {/* Sub-tabs Navigation */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg flex-wrap">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'oec', label: 'OEC' },
                    { id: 'owwa', label: 'OWWA' },
                    { id: 'ttl', label: 'TTL' },
                    { id: 'tte', label: 'TTE' },
                    { id: 'ttj', label: 'TTJ' },
                    { id: 'visaSaudi', label: 'Visa Saudi' },
                    { id: 'schengen', label: 'Schengen' },
                    { id: 'gcc', label: 'GCC' },
                    { id: 'ethiopianPP', label: 'Ethiopian PP' },
                    { id: 'filipinaPP', label: 'Filipina PP' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setPnlSubTab(tab.id as typeof pnlSubTab)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        pnlSubTab === tab.id
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              <div className="flex items-center gap-3">
                {/* Advanced date picker with daily/monthly modes - moved to right */}
                <PnLDatePicker
                  availableMonths={pnlAvailableMonths}
                  availableDates={pnlAvailableDates}
                  selectedStartDate={pnlSelectedDate}
                  selectedEndDate={pnlSelectedEndDate}
                  onDateSelect={handlePnLDateSelect}
                  viewMode={pnlViewMode}
                  onViewModeChange={setPnlViewMode}
                />
                <button
                  onClick={() => fetchPnLData(pnlSelectedDate, pnlSelectedEndDate, pnlViewMode)}
                  disabled={pnlLoading}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  {pnlLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            {(pnlSource === 'complaints' || pnlSource === 'excel') && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">
                      {pnlSource === 'complaints' 
                        ? 'Daily Complaints Data (Live)' 
                        : 'Excel File Data'}
                    </p>
                    <p className="text-xs text-blue-600">
                      {pnlSource === 'complaints' 
                        ? 'Reading from daily complaints API • One file per day with 3-month deduplication'
                        : 'Reading from P&L Excel files • Use API to upload live complaints data'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Overview Sub-tab */}
            {pnlSubTab === 'overview' && (
              <>
                <PnLSummaryCards data={pnlData} isLoading={pnlLoading} viewMode={pnlViewMode} />
                <PnLServiceChart data={pnlData} />

                <CollapsibleSection
                  title="Detailed Breakdown"
                  count={pnlData ? Object.keys(pnlData.services).length : 0}
                  defaultExpanded={true}
                >
                  <PnLTable data={pnlData} />
                </CollapsibleSection>
              </>
            )}

            {/* Individual Service Sub-tabs */}
            {pnlSubTab === 'oec' && (
              <PnLServiceDetail data={pnlData} filter="oec" />
            )}
            {pnlSubTab === 'owwa' && (
              <PnLServiceDetail data={pnlData} filter="owwa" />
            )}
            {pnlSubTab === 'ttl' && (
              <PnLServiceDetail data={pnlData} filter="ttl" />
            )}
            {pnlSubTab === 'tte' && (
              <PnLServiceDetail data={pnlData} filter="tte" />
            )}
            {pnlSubTab === 'ttj' && (
              <PnLServiceDetail data={pnlData} filter="ttj" />
            )}
            {pnlSubTab === 'visaSaudi' && (
              <PnLServiceDetail data={pnlData} filter="visaSaudi" />
            )}
            {pnlSubTab === 'schengen' && (
              <PnLServiceDetail data={pnlData} filter="schengen" />
            )}
            {pnlSubTab === 'gcc' && (
              <PnLServiceDetail data={pnlData} filter="gcc" />
            )}
            {pnlSubTab === 'ethiopianPP' && (
              <PnLServiceDetail data={pnlData} filter="ethiopianPP" />
            )}
            {pnlSubTab === 'filipinaPP' && (
              <PnLServiceDetail data={pnlData} filter="filipinaPP" />
            )}
          </div>
        )}

        {/* Chats Dashboard Tab */}
        {activeTab === 'chats' && (
          <ChatsDashboard />
        )}

        {activeTab === 'evals' && (
          <EvalsDashboard />
        )}

        {/* Operations Dashboard Tab */}
        {activeTab === 'operations' && (
          <OperationsDashboard />
        )}

        {/* Agents Dashboard Tab */}
        {activeTab === 'agents' && (
          <AgentsDashboard />
        )}

      </main>
    </div>
  );
}
