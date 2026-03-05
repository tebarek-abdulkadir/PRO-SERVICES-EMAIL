'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import type { AggregatedPnL, ServicePnL, EntryType, CostBreakdown } from '@/lib/pnl-types';

type PnLServiceFilter = 'oec' | 'owwa' | 'ttl' | 'tte' | 'ttj' | 'schengen' | 'gcc' | 'ethiopianPP' | 'filipinaPP' | 'travel' | 'passport';

interface PnLServiceDetailProps {
  data: AggregatedPnL | null;
  filter: PnLServiceFilter;
}

// Muted, sophisticated colors matching main dashboard vibe
const SERVICE_COLORS = {
  oec: '#b45309',      // amber-700 (matches main dashboard OEC)
  owwa: '#7c3aed',     // violet-600 (matches main dashboard OWWA)
  ttl: '#2563eb',      // blue-600 (matches main dashboard travel)
  ttlSingle: '#3b82f6',   // blue-500 (distinct blue for single entry)
  ttlDouble: '#ef4444',   // red-500 (distinct red for double entry)
  ttlMultiple: '#10b981', // emerald-500 (distinct green for multiple entry)
  tte: '#6db39f',      // soft sage green
  tteSingle: '#10b981',   // emerald-500 (lighter green for single entry)
  tteDouble: '#dc2626',   // red-600 (distinct red for double entry)
  tteMultiple: '#7c3aed', // violet-600 (distinct purple for multiple entry)
  ttj: '#e5a855',      // warm amber
  schengen: '#8ecae6', // soft sky blue
  gcc: '#e5c07b',      // soft golden
  ethiopianPP: '#a78bfa', // violet-400
  filipinaPP: '#d97706',  // amber-600
};

const SERVICE_LABELS: Record<string, string> = {
  oec: 'OEC',
  owwa: 'OWWA',
  ttl: 'Travel to Lebanon (General)',
  ttlSingle: 'TTL - Single Entry',
  ttlDouble: 'TTL - Double Entry',
  ttlMultiple: 'TTL - Multiple Entry',
  tte: 'Travel to Egypt (General)',
  tteSingle: 'TTE - Single Entry',
  tteDouble: 'TTE - Double Entry',
  tteMultiple: 'TTE - Multiple Entry',
  ttj: 'Travel to Jordan',
  schengen: 'Schengen Countries',
  gcc: 'GCC',
  ethiopianPP: 'Ethiopian Passport Renewal',
  filipinaPP: 'Filipina Passport Renewal',
};

export default function PnLServiceDetail({ data, filter }: PnLServiceDetailProps) {
  if (!data) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get services based on filter - each service has its own tab now
  const getFilteredServices = (): { key: string; service: ServicePnL }[] => {
    switch (filter) {
      case 'oec':
        return [{ key: 'oec', service: data.services.oec }];
      case 'owwa':
        return [{ key: 'owwa', service: data.services.owwa }];
      case 'ttl':
        // Show TTL breakdown with specific entry types if they have volume
        const ttlServices = [{ key: 'ttl', service: data.services.ttl }];
        if (data.services.ttlSingle?.volume > 0) {
          ttlServices.push({ key: 'ttlSingle', service: data.services.ttlSingle });
        }
        if (data.services.ttlDouble?.volume > 0) {
          ttlServices.push({ key: 'ttlDouble', service: data.services.ttlDouble });
        }
        if (data.services.ttlMultiple?.volume > 0) {
          ttlServices.push({ key: 'ttlMultiple', service: data.services.ttlMultiple });
        }
        return ttlServices;
      case 'tte':
        // Show TTE breakdown with specific entry types if they have volume
        const tteServices = [{ key: 'tte', service: data.services.tte }];
        if (data.services.tteSingle?.volume > 0) {
          tteServices.push({ key: 'tteSingle', service: data.services.tteSingle });
        }
        if (data.services.tteDouble?.volume > 0) {
          tteServices.push({ key: 'tteDouble', service: data.services.tteDouble });
        }
        if (data.services.tteMultiple?.volume > 0) {
          tteServices.push({ key: 'tteMultiple', service: data.services.tteMultiple });
        }
        return tteServices;
      case 'ttj':
        return [{ key: 'ttj', service: data.services.ttj }];
      case 'schengen':
        return [{ key: 'schengen', service: data.services.schengen }];
      case 'gcc':
        return [{ key: 'gcc', service: data.services.gcc }];
      case 'ethiopianPP':
        return [{ key: 'ethiopianPP', service: data.services.ethiopianPP }];
      case 'filipinaPP':
        return [{ key: 'filipinaPP', service: data.services.filipinaPP }];
      // Legacy grouped filters
      case 'travel':
        const travelServices = [
          { key: 'ttl', service: data.services.ttl },
          { key: 'tte', service: data.services.tte },
          { key: 'ttj', service: data.services.ttj },
          { key: 'schengen', service: data.services.schengen },
          { key: 'gcc', service: data.services.gcc },
        ];
        // Add specific visa entry types if they have volume
        if (data.services.ttlSingle?.volume > 0) {
          travelServices.push({ key: 'ttlSingle', service: data.services.ttlSingle });
        }
        if (data.services.ttlDouble?.volume > 0) {
          travelServices.push({ key: 'ttlDouble', service: data.services.ttlDouble });
        }
        if (data.services.ttlMultiple?.volume > 0) {
          travelServices.push({ key: 'ttlMultiple', service: data.services.ttlMultiple });
        }
        if (data.services.tteSingle?.volume > 0) {
          travelServices.push({ key: 'tteSingle', service: data.services.tteSingle });
        }
        if (data.services.tteDouble?.volume > 0) {
          travelServices.push({ key: 'tteDouble', service: data.services.tteDouble });
        }
        if (data.services.tteMultiple?.volume > 0) {
          travelServices.push({ key: 'tteMultiple', service: data.services.tteMultiple });
        }
        return travelServices;
      case 'passport':
        return [
          { key: 'ethiopianPP', service: data.services.ethiopianPP },
          { key: 'filipinaPP', service: data.services.filipinaPP },
        ];
      default:
        return [];
    }
  };

  const services = getFilteredServices();
  
  // Calculate totals for this filter
  const totals = services.reduce(
    (acc, { service }) => ({
      volume: acc.volume + service.volume,
      revenue: acc.revenue + service.totalRevenue,
      cost: acc.cost + service.totalCost,
      grossProfit: acc.grossProfit + service.grossProfit,
      serviceFees: acc.serviceFees + service.serviceFees,
    }),
    { volume: 0, revenue: 0, cost: 0, grossProfit: 0, serviceFees: 0 }
  );
  
  // Calculate per-order service fee:
  // - For single service: use that service's fee directly
  // - For multiple services: calculate weighted average (total gross profit / total volume)
  const perOrderServiceFee = services.length === 1 
    ? services[0].service.serviceFees 
    : totals.volume > 0 
      ? totals.grossProfit / totals.volume 
      : 0;

  // Chart data
  const chartData = services.map(({ key, service }) => ({
    name: SERVICE_LABELS[key] || key,
    revenue: service.totalRevenue,
    cost: service.totalCost,
    volume: service.volume,
    color: SERVICE_COLORS[key as keyof typeof SERVICE_COLORS] || '#94a3b8',
  }));

  const pieData = chartData
    .filter(d => d.revenue > 0)
    .map(d => ({ name: d.name, value: d.revenue, color: d.color, percentage: 0 }));

  // Calculate percentages
  const total = pieData.reduce((sum, item) => sum + item.value, 0);
  pieData.forEach(item => {
    item.percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
  });

  const tooltipStyle = {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontSize: '12px',
  };

  const formatCurrencyShort = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  // Custom label function to show values on pie slices - always show labels
  const renderCustomizedLabel = (entry: any) => {
    return `${formatCurrencyShort(entry.value)}`;
  };

  const filterLabels: Record<PnLServiceFilter, string> = {
    oec: 'OEC',
    owwa: 'OWWA',
    ttl: 'Travel to Lebanon',
    tte: 'Travel to Egypt',
    ttj: 'Travel to Jordan',
    schengen: 'Schengen Countries',
    gcc: 'GCC',
    ethiopianPP: 'Ethiopian Passport Renewal',
    filipinaPP: 'Filipina Passport Renewal',
    travel: 'Travel Visas',
    passport: 'Passport Renewals',
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Total Revenue</p>
          <p className="text-3xl font-bold mt-2 text-slate-800">
            {formatCurrency(totals.revenue)}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {totals.volume} orders{perOrderServiceFee > 0 && ' + fees'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Total Cost</p>
          <p className="text-3xl font-bold mt-2 text-slate-800">
            {formatCurrency(totals.cost)}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Direct costs
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-600">
            Gross Profit
          </p>
          <p className={`text-3xl font-bold mt-2 ${totals.grossProfit >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
            {formatCurrency(totals.grossProfit)}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {totals.revenue > 0 ? `${((totals.grossProfit / totals.revenue) * 100).toFixed(1)}% margin` : '—'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Service Fee</p>
          <p className="text-3xl font-bold mt-2 text-slate-800">
            {formatCurrency(perOrderServiceFee)}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Per order
          </p>
        </div>
      </div>

      {/* Charts - only show for multi-service filters, but for TTL/TTE show only pie chart */}
      {services.length > 1 && filter !== 'ttl' && filter !== 'tte' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">
              {filterLabels[filter]} Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={chartData} 
                margin={{ top: 20, right: 30, left: 10, bottom: 80 }}
                barCategoryGap="15%"
              >
                <defs>
                  {chartData.map((entry, index) => (
                    <linearGradient key={`gradient-${index}`} id={`detail-gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                      <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis 
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toString()}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip 
                  formatter={(value) => formatCurrency(Number(value) || 0)}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                />
                <Bar dataKey="revenue" name="Revenue" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#detail-gradient-${index})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-6">Revenue Distribution</h3>
            
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

            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={renderCustomizedLabel}
                    outerRadius={140}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={2}
                    animationDuration={400}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [formatCurrency(Number(value) || 0), 'Revenue']}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Summary */}
            <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total Revenue</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(totals.revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total Orders</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{totals.volume.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* For TTL and TTE, show only pie chart (revenue distribution) */}
      {(filter === 'ttl' || filter === 'tte') && services.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-6">Revenue Distribution</h3>
          
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

          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={renderCustomizedLabel}
                  outerRadius={140}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="#fff"
                  strokeWidth={2}
                  animationDuration={400}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [formatCurrency(Number(value) || 0), 'Revenue']}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Summary */}
          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Total Revenue</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(totals.revenue)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Total Orders</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{totals.volume.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Service Details Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">{filterLabels[filter]} Details</h3>
          <p className="text-xs text-slate-500 mt-1">Complete breakdown of revenue and costs</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Volume</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Service Fee</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Cost</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Gross Profit</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map(({ key, service }) => {
                const margin = service.totalRevenue > 0 ? ((service.grossProfit / service.totalRevenue) * 100) : 0;
                return (
                  <tr key={key} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full shadow-sm" 
                          style={{ backgroundColor: SERVICE_COLORS[key as keyof typeof SERVICE_COLORS] }}
                        />
                        {SERVICE_LABELS[key]}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                        {service.volume}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-slate-600">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md font-medium ${
                        service.serviceFees > 0 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'bg-slate-50 text-slate-500'
                      }`}>
                        {formatCurrency(service.serviceFees)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span className="text-slate-800 font-semibold">{formatCurrency(service.totalRevenue)}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-slate-600">{formatCurrency(service.totalCost)}</td>
                    <td className={`px-6 py-4 text-sm text-right font-bold ${service.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(service.grossProfit)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md font-medium ${
                        margin >= 50 ? 'bg-green-100 text-green-700' :
                        margin >= 25 ? 'bg-yellow-100 text-yellow-700' :
                        margin >= 0 ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {services.length > 1 && (
              <tfoot className="bg-slate-100 border-t-2 border-slate-200 font-semibold">
                <tr>
                  <td className="px-6 py-4 text-sm text-slate-800">Total</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-200 text-slate-800 font-bold">
                      {totals.volume}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-slate-500">—</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-800 font-bold">{formatCurrency(totals.revenue)}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-600 font-bold">{formatCurrency(totals.cost)}</td>
                  <td className={`px-6 py-4 text-sm text-right font-bold ${totals.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totals.grossProfit)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md font-bold ${
                      totals.revenue > 0 && ((totals.grossProfit / totals.revenue) * 100) >= 50 ? 'bg-green-200 text-green-800' :
                      totals.revenue > 0 && ((totals.grossProfit / totals.revenue) * 100) >= 25 ? 'bg-yellow-200 text-yellow-800' :
                      totals.revenue > 0 && ((totals.grossProfit / totals.revenue) * 100) >= 0 ? 'bg-orange-200 text-orange-800' :
                      'bg-red-200 text-red-800'
                    }`}>
                      {totals.revenue > 0 ? ((totals.grossProfit / totals.revenue) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Entry Types Breakdown - for travel visas with single/double/multiple entry types */}
      {services.some(({ service }) => service.entryTypes && service.entryTypes.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
            <h3 className="text-lg font-semibold text-slate-800">Entry Types Breakdown</h3>
            <p className="text-xs text-slate-500 mt-1">Detailed breakdown by visa entry type</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Entry Type</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Volume</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Embassy Fee</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map(({ key, service }) => 
                  service.entryTypes?.map((entry, idx) => (
                    <tr key={`${key}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">
                        {idx === 0 && (
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: SERVICE_COLORS[key as keyof typeof SERVICE_COLORS] }}
                            />
                            {SERVICE_LABELS[key]}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-medium">{entry.type}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">{entry.volume}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">{formatCurrency(entry.price)}</td>
                      <td className="px-6 py-4 text-sm text-right">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-50 text-amber-700 font-medium">
                          {formatCurrency(entry.embassyFee)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-slate-800 font-semibold">{formatCurrency(entry.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

