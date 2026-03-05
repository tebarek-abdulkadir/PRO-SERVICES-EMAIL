'use client';

import { useState } from 'react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { ProspectDetail, HouseholdGroup, ByContractType, ServiceFilter } from '@/lib/types';
import { CHART_COLORS, SERVICE_LABELS } from '@/lib/types';

interface ServiceBreakdownChartProps {
  prospectDetails?: ProspectDetail[];
  households?: HouseholdGroup[];
  byContractType?: ByContractType;
  serviceFilter?: ServiceFilter;
}

type ViewMode = 'asking' | 'contract';

interface AskingMetrics {
  maid: number;
  client: number;
  household: number;
}

export default function ServiceBreakdownChart({ 
  prospectDetails, 
  households, 
  byContractType,
  serviceFilter 
}: ServiceBreakdownChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('asking');

  // Calculate "Who is Asking" metrics
  const calculateAskingMetrics = (): Record<ServiceFilter, AskingMetrics> => {
    const emptyMetrics = { maid: 0, client: 0, household: 0 };
    if (!prospectDetails || prospectDetails.length === 0) {
      return { 
        oec: emptyMetrics, 
        owwa: emptyMetrics, 
        travelVisa: emptyMetrics,
        filipinaPassportRenewal: emptyMetrics,
        ethiopianPassportRenewal: emptyMetrics,
      };
    }

    const householdContractIds = new Set<string>();
    if (households) {
      households.forEach(h => {
        if (h.hasClient && h.hasMaid) {
          householdContractIds.add(h.contractId);
        }
      });
    }

    const metrics: Record<ServiceFilter, AskingMetrics> = {
      oec: { maid: 0, client: 0, household: 0 },
      owwa: { maid: 0, client: 0, household: 0 },
      travelVisa: { maid: 0, client: 0, household: 0 },
      filipinaPassportRenewal: { maid: 0, client: 0, household: 0 },
      ethiopianPassportRenewal: { maid: 0, client: 0, household: 0 },
    };

    const countedHouseholds: Record<ServiceFilter, Set<string>> = {
      oec: new Set(),
      owwa: new Set(),
      travelVisa: new Set(),
      filipinaPassportRenewal: new Set(),
      ethiopianPassportRenewal: new Set(),
    };

    prospectDetails.forEach(prospect => {
      const contractId = prospect.contractId;
      const isPartOfHousehold = contractId && householdContractIds.has(contractId);
      const isMaidAsking = prospect.maidId && !prospect.clientId;
      const isClientAsking = prospect.clientId && !prospect.maidId;

      const processService = (service: ServiceFilter, isProspect: boolean) => {
        if (!isProspect) return;
        
        if (isPartOfHousehold && contractId) {
          if (!countedHouseholds[service].has(contractId)) {
            metrics[service].household++;
            countedHouseholds[service].add(contractId);
          }
        } else if (isMaidAsking) {
          metrics[service].maid++;
        } else if (isClientAsking) {
          metrics[service].client++;
        }
      };

      processService('oec', prospect.isOECProspect);
      processService('owwa', prospect.isOWWAProspect);
      processService('travelVisa', prospect.isTravelVisaProspect);
      processService('filipinaPassportRenewal', prospect.isFilipinaPassportRenewalProspect || false);
      processService('ethiopianPassportRenewal', prospect.isEthiopianPassportRenewalProspect || false);
    });

    return metrics;
  };

  const askingMetrics = calculateAskingMetrics();

  // Build chart data
  const buildChartData = () => {
    const allData = [
      {
        name: 'OEC',
        key: 'oec' as const,
        Maid: askingMetrics.oec.maid,
        Client: askingMetrics.oec.client,
        Household: askingMetrics.oec.household,
        CC: byContractType?.CC?.oec || 0,
        MV: byContractType?.MV?.oec || 0,
      },
      {
        name: 'OWWA',
        key: 'owwa' as const,
        Maid: askingMetrics.owwa.maid,
        Client: askingMetrics.owwa.client,
        Household: askingMetrics.owwa.household,
        CC: byContractType?.CC?.owwa || 0,
        MV: byContractType?.MV?.owwa || 0,
      },
      {
        name: 'Travel Visa',
        key: 'travelVisa' as const,
        Maid: askingMetrics.travelVisa.maid,
        Client: askingMetrics.travelVisa.client,
        Household: askingMetrics.travelVisa.household,
        CC: byContractType?.CC?.travelVisa || 0,
        MV: byContractType?.MV?.travelVisa || 0,
      },
      {
        name: 'Filipina PP',
        key: 'filipinaPassportRenewal' as const,
        Maid: askingMetrics.filipinaPassportRenewal.maid,
        Client: askingMetrics.filipinaPassportRenewal.client,
        Household: askingMetrics.filipinaPassportRenewal.household,
        CC: byContractType?.CC?.filipinaPassportRenewal || 0,
        MV: byContractType?.MV?.filipinaPassportRenewal || 0,
      },
      {
        name: 'Ethiopian PP',
        key: 'ethiopianPassportRenewal' as const,
        Maid: askingMetrics.ethiopianPassportRenewal.maid,
        Client: askingMetrics.ethiopianPassportRenewal.client,
        Household: askingMetrics.ethiopianPassportRenewal.household,
        CC: byContractType?.CC?.ethiopianPassportRenewal || 0,
        MV: byContractType?.MV?.ethiopianPassportRenewal || 0,
      },
    ];

    return serviceFilter ? allData.filter(d => d.key === serviceFilter) : allData;
  };

  const data = buildChartData();

  const askingTotal = data.reduce((sum, m) => sum + m.Maid + m.Client + m.Household, 0);
  const contractTotal = data.reduce((sum, d) => sum + d.CC + d.MV, 0);
  const hasAskingData = askingTotal > 0;
  const hasContractData = contractTotal > 0;

  if (!hasAskingData && !hasContractData) {
    return (
      <div className="flex items-center justify-center h-80 bg-white rounded-xl border border-slate-200">
        <p className="text-slate-400">No data available</p>
      </div>
    );
  }

  const chartTitle = viewMode === 'asking'
    ? serviceFilter ? `${SERVICE_LABELS[serviceFilter]}: Who is Asking` : 'Who is Asking about the Services'
    : serviceFilter ? `${SERVICE_LABELS[serviceFilter]}: By Contract Type` : 'By Contract Type';

  const tooltipStyle = {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontSize: '12px',
  };

  const pieProps = {
    cx: '50%',
    cy: '50%',
    innerRadius: 45,
    outerRadius: 95,
    paddingAngle: 6,
    cornerRadius: 10,
    dataKey: 'value',
    stroke: 'none',
    animationDuration: 400,
    labelLine: true,
    label: ({ name, value }: any) => `${name}\n${value}`,
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">{chartTitle}</h3>
        
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('asking')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === 'asking'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            By Entity
          </button>
          <button
            onClick={() => setViewMode('contract')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === 'contract'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            By Contract Type
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs mb-4">
        {viewMode === 'asking' ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.entity.maid }} />
              <span className="text-slate-600">Maid</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.entity.client }} />
              <span className="text-slate-600">Client</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.entity.household }} />
              <span className="text-slate-600">Household</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.contract.cc }} />
              <span className="text-slate-600">CC</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.contract.mv }} />
              <span className="text-slate-600">MV</span>
            </div>
          </>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={viewMode === 'asking' 
              ? [
                  { name: 'Maid', value: data.reduce((sum, d) => sum + d.Maid, 0), color: CHART_COLORS.entity.maid },
                  { name: 'Client', value: data.reduce((sum, d) => sum + d.Client, 0), color: CHART_COLORS.entity.client },
                  { name: 'Household', value: data.reduce((sum, d) => sum + d.Household, 0), color: CHART_COLORS.entity.household },
                ].filter(d => d.value > 0)
              : [
                  { name: 'CC', value: data.reduce((sum, d) => sum + d.CC, 0), color: CHART_COLORS.contract.cc },
                  { name: 'MV', value: data.reduce((sum, d) => sum + d.MV, 0), color: CHART_COLORS.contract.mv },
                ].filter(d => d.value > 0)
            }
            {...pieProps}
          >
            {(viewMode === 'asking' 
              ? [
                  { color: CHART_COLORS.entity.maid, value: data.reduce((sum, d) => sum + d.Maid, 0) },
                  { color: CHART_COLORS.entity.client, value: data.reduce((sum, d) => sum + d.Client, 0) },
                  { color: CHART_COLORS.entity.household, value: data.reduce((sum, d) => sum + d.Household, 0) },
                ]
              : [
                  { color: CHART_COLORS.contract.cc, value: data.reduce((sum, d) => sum + d.CC, 0) },
                  { color: CHART_COLORS.contract.mv, value: data.reduce((sum, d) => sum + d.MV, 0) },
                ]
            ).filter(d => d.value > 0).map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [`${value} prospects`]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Summary Grid */}
      <div className={`mt-4 pt-4 border-t border-slate-100 grid gap-4 text-center ${serviceFilter ? 'grid-cols-1' : 'grid-cols-3'}`}>
        {data.map((item) => (
          <div key={item.name} className="space-y-2">
            <p className="text-xs font-medium text-slate-700">{item.name}</p>
            {viewMode === 'asking' ? (
              <div className="flex justify-center gap-2 text-xs flex-wrap">
                <span className="font-semibold" style={{ color: CHART_COLORS.entity.maid }}>M: {item.Maid}</span>
                <span className="font-semibold" style={{ color: CHART_COLORS.entity.client }}>C: {item.Client}</span>
                <span className="font-semibold" style={{ color: CHART_COLORS.entity.household }}>H: {item.Household}</span>
              </div>
            ) : (
              <div className="flex justify-center gap-3 text-xs">
                <span className="font-semibold" style={{ color: CHART_COLORS.contract.cc }}>CC: {item.CC}</span>
                <span className="font-semibold" style={{ color: CHART_COLORS.contract.mv }}>MV: {item.MV}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
