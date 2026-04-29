'use client';

import { useState } from 'react';
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts';
import type { AggregatedPnL } from '@/lib/pnl-types';

interface PnLServiceChartProps {
  data: AggregatedPnL | null;
}

type ViewMode = 'revenue' | 'volume';

// Distinct colors for each service
const SERVICE_COLORS = {
  oec: '#3b82f6',      // blue-500
  owwa: '#10b981',     // emerald-500
  ttl: '#f59e0b',      // amber-500
  ttlSingle: '#3b82f6',   // blue-500 (lighter blue for single entry)
  ttlDouble: '#1d4ed8',   // blue-700 (darker blue for double entry)
  ttlMultiple: '#1e40af', // blue-800 (darkest blue for multiple entry)
  tte: '#ef4444',      // red-500
  ttj: '#8b5cf6',      // violet-500
  visaSaudi: '#c2410c',
  schengen: '#06b6d4', // cyan-500
  gcc: '#84cc16',      // lime-500
  ethiopianPP: '#f97316', // orange-500
  filipinaPP: '#ec4899',  // pink-500
};

export default function PnLServiceChart({ data }: PnLServiceChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('revenue');

  if (!data) return null;

  const serviceLabels: Record<string, string> = {
    oec: 'OEC',
    owwa: 'OWWA',
    ttl: 'Lebanon',
    tte: 'Egypt',
    ttj: 'Jordan',
    visaSaudi: 'Saudi',
    schengen: 'Schengen',
    gcc: 'GCC',
    ethiopianPP: 'Ethiopian PP',
    filipinaPP: 'Filipina PP',
  };

  // Build chart data - combine all Lebanon entries and all Egypt entries into single entries
  const chartData: Array<{
    key: string;
    name: string;
    revenue: number;
    cost: number;
    profit: number;
    volume: number;
    color: string;
  }> = [];

  // Add all services except Lebanon and Egypt entry types
  Object.entries(data.services).forEach(([key, service]) => {
    // Exclude individual entry types (they'll be combined under Lebanon/Egypt)
    if (!['ttl', 'ttlSingle', 'ttlDouble', 'ttlMultiple', 'tte', 'tteSingle', 'tteDouble', 'tteMultiple'].includes(key)) {
      const value = viewMode === 'revenue' ? service.totalRevenue : service.volume;
      if (value > 0) {
        chartData.push({
          key,
          name: serviceLabels[key] || key,
          revenue: service.totalRevenue,
          cost: service.totalCost,
          profit: service.grossProfit,
          volume: service.volume,
          color: SERVICE_COLORS[key as keyof typeof SERVICE_COLORS] || '#64748b',
        });
      }
    }
  });

  // Add combined Lebanon entry
  const lebanonSingle = data.services.ttlSingle || { totalRevenue: 0, volume: 0 };
  const lebanonDouble = data.services.ttlDouble || { totalRevenue: 0, volume: 0 };
  const lebanonMultiple = data.services.ttlMultiple || { totalRevenue: 0, volume: 0 };
  const lebanonGeneral = data.services.ttl || { totalRevenue: 0, volume: 0, totalCost: 0, grossProfit: 0 };
  const lebanonTotalRevenue = lebanonGeneral.totalRevenue + lebanonSingle.totalRevenue + lebanonDouble.totalRevenue + lebanonMultiple.totalRevenue;
  const lebanonTotalVolume = lebanonGeneral.volume + lebanonSingle.volume + lebanonDouble.volume + lebanonMultiple.volume;
  
  const lebanonValue = viewMode === 'revenue' ? lebanonTotalRevenue : lebanonTotalVolume;
  if (lebanonValue > 0) {
    chartData.push({
      key: 'ttl',
      name: 'Lebanon',
      revenue: lebanonTotalRevenue,
      cost: lebanonGeneral.totalCost || 0,
      profit: lebanonGeneral.grossProfit || 0,
      volume: lebanonTotalVolume,
      color: SERVICE_COLORS.ttl || '#f59e0b',
    });
  }

  // Add combined Egypt entry
  const egyptSingle = data.services.tteSingle || { totalRevenue: 0, volume: 0 };
  const egyptDouble = data.services.tteDouble || { totalRevenue: 0, volume: 0 };
  const egyptMultiple = data.services.tteMultiple || { totalRevenue: 0, volume: 0 };
  const egyptGeneral = data.services.tte || { totalRevenue: 0, volume: 0, totalCost: 0, grossProfit: 0 };
  const egyptTotalRevenue = egyptGeneral.totalRevenue + egyptSingle.totalRevenue + egyptDouble.totalRevenue + egyptMultiple.totalRevenue;
  const egyptTotalVolume = egyptGeneral.volume + egyptSingle.volume + egyptDouble.volume + egyptMultiple.volume;
  
  const egyptValue = viewMode === 'revenue' ? egyptTotalRevenue : egyptTotalVolume;
  if (egyptValue > 0) {
    chartData.push({
      key: 'tte',
      name: 'Egypt',
      revenue: egyptTotalRevenue,
      cost: egyptGeneral.totalCost || 0,
      profit: egyptGeneral.grossProfit || 0,
      volume: egyptTotalVolume,
      color: SERVICE_COLORS.tte || '#ef4444',
    });
  }

  // Pie chart data based on view mode
  const pieData = chartData.map(item => ({
    name: item.name,
    value: viewMode === 'revenue' ? item.revenue : item.volume,
    color: item.color,
    percentage: 0, // Will be calculated below
  }));

  // Calculate percentages
  const total = pieData.reduce((sum, item) => sum + item.value, 0);
  pieData.forEach(item => {
    item.percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  const formatFullCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const tooltipStyle = {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontSize: '12px',
  };

  const totalRevenue = data.summary.totalRevenue;
  const totalVolume = Object.values(data.services).reduce((sum, s) => sum + s.volume, 0);

  // Custom label function to show values on pie slices - always show labels
  const renderLabel = (entry: any) => {
    if (viewMode === 'revenue') {
      return `${formatCurrency(entry.value)}`;
    } else {
      return `${entry.value}`;
    }
  };


  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-slate-800">
          {viewMode === 'revenue' ? 'Revenue Distribution' : 'Volume Distribution'}
        </h3>
        
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('revenue')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === 'revenue'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Revenue
          </button>
          <button
            onClick={() => setViewMode('volume')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === 'volume'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Volume
          </button>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-6 text-xs">
        {pieData.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-700 font-medium">{item.name}</span>
            <span className="text-slate-500">
              ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center relative">
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={true}
              label={renderLabel}
              innerRadius={80}
              outerRadius={140}
              paddingAngle={3}
              dataKey="value"
              stroke="#fff"
              strokeWidth={3}
              animationDuration={600}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => [
                viewMode === 'revenue' 
                  ? formatFullCurrency(Number(value) || 0) 
                  : `${Number(value) || 0} orders`, 
                viewMode === 'revenue' ? 'Revenue' : 'Volume'
              ]}
              contentStyle={tooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-800">
              {viewMode === 'revenue' 
                ? formatCurrency(totalRevenue)
                : totalVolume.toLocaleString()
              }
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {viewMode === 'revenue' ? 'Total Revenue' : 'Total Orders'}
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total Revenue</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{formatFullCurrency(totalRevenue)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total Orders</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{totalVolume.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
