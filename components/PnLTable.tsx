'use client';

import type { AggregatedPnL } from '@/lib/pnl-types';

interface PnLTableProps {
  data: AggregatedPnL | null;
}

// Service colors matching PnLServiceDetail
const SERVICE_COLORS: Record<string, string> = {
  oec: '#b45309',      // amber-700
  owwa: '#7c3aed',     // violet-600
  ttl: '#2563eb',      // blue-600
  tte: '#6db39f',      // soft sage green
  ttj: '#e5a855',      // warm amber
  visaSaudi: '#c2410c', // orange-700
  schengen: '#8ecae6', // soft sky blue
  gcc: '#e5c07b',      // soft golden
  ethiopianPP: '#a78bfa', // violet-400
  filipinaPP: '#d97706',  // amber-600
};

export default function PnLTable({ data }: PnLTableProps) {
  if (!data) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const serviceLabels: Record<string, string> = {
    oec: 'OEC',
    owwa: 'OWWA',
    ttl: 'Travel to Lebanon',
    tte: 'Travel to Egypt',
    ttj: 'Travel to Jordan',
    visaSaudi: 'Visa Saudi',
    schengen: 'Schengen Countries',
    gcc: 'GCC',
    ethiopianPP: 'Ethiopian Passport Renewal',
    filipinaPP: 'Filipina Passport Renewal',
  };

  const services = Object.entries(data.services).map(([key, service]) => ({
    ...service,
    key,
    name: serviceLabels[key] || key,
  }));

  // Calculate totals (service fees are per-order, don't sum them)
  const totals = {
    volume: services.reduce((sum, s) => sum + s.volume, 0),
    totalRevenue: services.reduce((sum, s) => sum + s.totalRevenue, 0),
    totalCost: services.reduce((sum, s) => sum + s.totalCost, 0),
    grossProfit: services.reduce((sum, s) => sum + s.grossProfit, 0),
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b-2 border-slate-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Service
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Volume
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Revenue
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Cost
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Service Fee
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Gross Profit
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Margin %
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {services.map((service) => {
            const margin = service.totalRevenue > 0 
              ? ((service.grossProfit / service.totalRevenue) * 100)
              : 0;
            
            return (
              <tr key={service.key} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full shadow-sm" 
                      style={{ backgroundColor: SERVICE_COLORS[service.key] || '#94a3b8' }}
                    />
                    {service.name}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                    {service.volume.toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-right text-slate-800 font-semibold">
                  {formatCurrency(service.totalRevenue)}
                </td>
                <td className="px-6 py-4 text-sm text-right text-slate-600">
                  {formatCurrency(service.totalCost)}
                </td>
                <td className="px-6 py-4 text-sm text-right text-slate-600">
                  {service.serviceFees > 0 ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 font-medium">
                      {formatCurrency(service.serviceFees)}
                    </span>
                  ) : '—'}
                </td>
                <td className={`px-6 py-4 text-sm text-right font-bold ${
                  service.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
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
        <tfoot className="bg-slate-100 border-t-2 border-slate-200 font-semibold">
          <tr>
            <td className="px-6 py-4 text-sm text-slate-800">
              Total
            </td>
            <td className="px-6 py-4 text-sm text-right">
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-200 text-slate-800 font-bold">
                {totals.volume.toLocaleString()}
              </span>
            </td>
            <td className="px-6 py-4 text-sm text-right text-slate-800 font-bold">
              {formatCurrency(totals.totalRevenue)}
            </td>
            <td className="px-6 py-4 text-sm text-right text-slate-600 font-bold">
              {formatCurrency(totals.totalCost)}
            </td>
            <td className="px-6 py-4 text-sm text-right text-slate-500">
              —
            </td>
            <td className={`px-6 py-4 text-sm text-right font-bold ${
              totals.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(totals.grossProfit)}
            </td>
            <td className="px-6 py-4 text-sm text-right">
              {(() => {
                const totalMargin = totals.totalRevenue > 0 
                  ? ((totals.grossProfit / totals.totalRevenue) * 100)
                  : 0;
                return (
                  <span className={`inline-flex items-center px-2 py-1 rounded-md font-bold ${
                    totalMargin >= 50 ? 'bg-green-200 text-green-800' :
                    totalMargin >= 25 ? 'bg-yellow-200 text-yellow-800' :
                    totalMargin >= 0 ? 'bg-orange-200 text-orange-800' :
                    'bg-red-200 text-red-800'
                  }`}>
                    {totalMargin.toFixed(1)}%
                  </span>
                );
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
