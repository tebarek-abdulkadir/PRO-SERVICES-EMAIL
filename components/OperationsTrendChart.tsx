'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock, Building2, User, FileCheck, Calendar } from 'lucide-react';
import type { OperationsTrendData } from '@/lib/operations-types';

interface OperationsTrendChartProps {
  data: OperationsTrendData[];
  isLoading?: boolean;
}

export default function OperationsTrendChart({ data, isLoading }: OperationsTrendChartProps) {
  const [viewMode, setViewMode] = useState<'overview' | 'pending' | 'completion'>('overview');
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading trend data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-slate-600 font-medium">No trend data available</p>
            <p className="text-slate-400 text-sm mt-1">Select a date range to view trends</p>
          </div>
        </div>
      </div>
    );
  }

  // Format data for chart (format dates for display)
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    fullDate: item.date,
    casesDelayed: item.casesDelayed,
    doneToday: item.doneToday,
    pendingUs: item.pendingUs,
    pendingClient: item.pendingClient,
    pendingProVisit: item.pendingProVisit,
    pendingGov: item.pendingGov,
    totalPending: item.totalPending,
    mtdCompleted: item.mtdCompleted,
  }));

  // Calculate trend direction
  const calculateTrend = (values: number[]) => {
    if (values.length < 2) return 'stable';
    const first = values[0];
    const last = values[values.length - 1];
    const diff = last - first;
    const threshold = 5; // 5 case change threshold
    
    if (diff > threshold) return 'increasing';
    if (diff < -threshold) return 'decreasing';
    return 'stable';
  };

  const delayedTrend = calculateTrend(data.map(d => d.casesDelayed));
  const doneTrend = calculateTrend(data.map(d => d.doneToday));
  const pendingTrend = calculateTrend(data.map(d => d.totalPending));
  const mtdTrend = calculateTrend(data.map(d => d.mtdCompleted));

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-600" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-green-600" />;
      default:
        return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  // For delayed cases: increasing is bad (red), decreasing is good (green)
  const getDelayedTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'text-red-600';
      case 'decreasing':
        return 'text-green-600';
      default:
        return 'text-slate-600';
    }
  };

  // For done cases: increasing is good (green), decreasing is bad (red)
  const getDoneTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'text-green-600';
      case 'decreasing':
        return 'text-red-600';
      default:
        return 'text-slate-600';
    }
  };

  // For delayed cases, increasing is bad, decreasing is good
  // For done cases, increasing is good, decreasing is bad
  const getDelayedTrendLabel = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'increasing (worsening)';
      case 'decreasing':
        return 'decreasing (improving)';
      default:
        return 'stable';
    }
  };

  const getDoneTrendLabel = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'increasing (improving)';
      case 'decreasing':
        return 'decreasing (worsening)';
      default:
        return 'stable';
    }
  };

  // Determine which lines to show based on view mode
  const getLinesForView = () => {
    switch (viewMode) {
      case 'overview':
        return [
          { key: 'casesDelayed', name: 'Cases Delayed', color: '#ef4444', icon: AlertTriangle },
          { key: 'doneToday', name: 'Cases Done', color: '#10b981', icon: CheckCircle },
          { key: 'totalPending', name: 'Total Pending', color: '#f59e0b', icon: Clock },
        ];
      case 'pending':
        return [
          { key: 'totalPending', name: 'Total Pending (US + PRO)', color: '#f59e0b', icon: Clock },
          { key: 'pendingUs', name: 'Pending US', color: '#3b82f6', icon: FileCheck },
          { key: 'pendingClient', name: 'Pending Client', color: '#8b5cf6', icon: User },
          { key: 'pendingProVisit', name: 'Pending PRO', color: '#ec4899', icon: Building2 },
          { key: 'pendingGov', name: 'Pending Gov', color: '#ef4444', icon: Building2 },
        ];
      case 'completion':
        return [
          { key: 'doneToday', name: 'Done Today', color: '#10b981', icon: CheckCircle },
          { key: 'mtdCompleted', name: 'MTD Completed', color: '#06b6d4', icon: Calendar },
          { key: 'casesDelayed', name: 'Cases Delayed', color: '#ef4444', icon: AlertTriangle },
        ];
      default:
        return [];
    }
  };

  const lines = getLinesForView();

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Operations Trend Analysis</h3>
            <p className="text-sm text-slate-600 mt-1">
              Comprehensive view of operations metrics over the last {data.length} days
            </p>
          </div>
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'overview'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('pending')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'pending'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setViewMode('completion')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'completion'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completion
            </button>
          </div>
        </div>
        
        {/* Trend Indicators */}
        <div className="flex items-center gap-4 text-sm flex-wrap">
          {viewMode === 'overview' && (
            <>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className={`font-medium ${getDelayedTrendColor(delayedTrend)}`}>
                  Delayed {getDelayedTrendLabel(delayedTrend)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className={`font-medium ${getDoneTrendColor(doneTrend)}`}>
                  Done {getDoneTrendLabel(doneTrend)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className={`font-medium ${pendingTrend === 'increasing' ? 'text-red-600' : pendingTrend === 'decreasing' ? 'text-green-600' : 'text-slate-600'}`}>
                  Pending {pendingTrend === 'increasing' ? 'increasing' : pendingTrend === 'decreasing' ? 'decreasing' : 'stable'}
                </span>
              </div>
            </>
          )}
          {viewMode === 'completion' && (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className={`font-medium ${getDoneTrendColor(doneTrend)}`}>
                  Done {getDoneTrendLabel(doneTrend)}
              </span>
            </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-600" />
                <span className={`font-medium ${mtdTrend === 'increasing' ? 'text-green-600' : mtdTrend === 'decreasing' ? 'text-red-600' : 'text-slate-600'}`}>
                  MTD {mtdTrend === 'increasing' ? 'increasing' : mtdTrend === 'decreasing' ? 'decreasing' : 'stable'}
                </span>
          </div>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            stroke="#64748b"
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            stroke="#64748b"
            style={{ fontSize: '12px' }}
            label={{ value: 'Number of Cases', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            labelStyle={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}
            formatter={(value: number | undefined, name: string | undefined) => {
              if (value === undefined || value === null) return ['0', name || ''];
              return [value.toLocaleString(), name || ''];
            }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
            formatter={(value) => <span style={{ fontSize: '12px' }}>{value}</span>}
          />
          {lines.map((line) => (
          <Line 
              key={line.key}
            type="monotone" 
              dataKey={line.key} 
              stroke={line.color} 
            strokeWidth={2}
              dot={{ fill: line.color, r: 4 }}
            activeDot={{ r: 6 }}
              name={line.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className={`mt-6 grid gap-4 pt-6 border-t border-slate-200 ${
        viewMode === 'overview' ? 'grid-cols-3' : viewMode === 'pending' ? 'grid-cols-5' : 'grid-cols-3'
      }`}>
        {viewMode === 'overview' && (
          <>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Cases Delayed</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-600">
              {data.length > 0 ? data[data.length - 1].casesDelayed : 0}
            </span>
            {data.length > 1 && (
              <span className={`text-sm ${getDelayedTrendColor(delayedTrend)}`}>
                {delayedTrend === 'increasing' ? '↑' : delayedTrend === 'decreasing' ? '↓' : '→'}
                {Math.abs(data[data.length - 1].casesDelayed - data[0].casesDelayed)}
              </span>
            )}
          </div>
              <p className="text-xs text-slate-400 mt-1">vs. {data.length} days ago</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Cases Done</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-green-600">
              {data.length > 0 ? data[data.length - 1].doneToday : 0}
            </span>
            {data.length > 1 && (
              <span className={`text-sm ${getDoneTrendColor(doneTrend)}`}>
                {doneTrend === 'increasing' ? '↑' : doneTrend === 'decreasing' ? '↓' : '→'}
                {Math.abs(data[data.length - 1].doneToday - data[0].doneToday)}
              </span>
            )}
          </div>
              <p className="text-xs text-slate-400 mt-1">vs. {data.length} days ago</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Pending</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-600">
                  {data.length > 0 ? data[data.length - 1].totalPending : 0}
                </span>
                {data.length > 1 && (
                  <span className={`text-sm ${pendingTrend === 'increasing' ? 'text-red-600' : pendingTrend === 'decreasing' ? 'text-green-600' : 'text-slate-600'}`}>
                    {pendingTrend === 'increasing' ? '↑' : pendingTrend === 'decreasing' ? '↓' : '→'}
                    {Math.abs(data[data.length - 1].totalPending - data[0].totalPending)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">vs. {data.length} days ago</p>
            </div>
          </>
        )}
        
        {viewMode === 'pending' && (
          <>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Pending</p>
              <div className="text-xl font-bold text-amber-600">
                {data.length > 0 ? data[data.length - 1].totalPending : 0}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pending US</p>
              <div className="text-xl font-bold text-blue-600">
                {data.length > 0 ? data[data.length - 1].pendingUs : 0}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pending Client</p>
              <div className="text-xl font-bold text-purple-600">
                {data.length > 0 ? data[data.length - 1].pendingClient : 0}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pending PRO</p>
              <div className="text-xl font-bold text-pink-600">
                {data.length > 0 ? data[data.length - 1].pendingProVisit : 0}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pending Gov</p>
              <div className="text-xl font-bold text-red-600">
                {data.length > 0 ? data[data.length - 1].pendingGov : 0}
              </div>
            </div>
          </>
        )}
        
        {viewMode === 'completion' && (
          <>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Done Today</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-600">
                  {data.length > 0 ? data[data.length - 1].doneToday : 0}
                </span>
                {data.length > 1 && (
                  <span className={`text-sm ${getDoneTrendColor(doneTrend)}`}>
                    {doneTrend === 'increasing' ? '↑' : doneTrend === 'decreasing' ? '↓' : '→'}
                    {Math.abs(data[data.length - 1].doneToday - data[0].doneToday)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">vs. {data.length} days ago</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">MTD Completed</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-cyan-600">
                  {data.length > 0 ? data[data.length - 1].mtdCompleted : 0}
                </span>
                {data.length > 1 && (
                  <span className={`text-sm ${mtdTrend === 'increasing' ? 'text-green-600' : mtdTrend === 'decreasing' ? 'text-red-600' : 'text-slate-600'}`}>
                    {mtdTrend === 'increasing' ? '↑' : mtdTrend === 'decreasing' ? '↓' : '→'}
                    {Math.abs(data[data.length - 1].mtdCompleted - data[0].mtdCompleted)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">Cumulative this month</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Cases Delayed</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-red-600">
                  {data.length > 0 ? data[data.length - 1].casesDelayed : 0}
                </span>
                {data.length > 1 && (
                  <span className={`text-sm ${getDelayedTrendColor(delayedTrend)}`}>
                    {delayedTrend === 'increasing' ? '↑' : delayedTrend === 'decreasing' ? '↓' : '→'}
                    {Math.abs(data[data.length - 1].casesDelayed - data[0].casesDelayed)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">vs. {data.length} days ago</p>
            </div>
          </>
        )}
      </div>
      
      {/* Additional Details Section */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 mb-1">Avg Daily Done</p>
            <p className="font-semibold text-slate-900">
              {data.length > 0 
                ? Math.round(data.reduce((sum, d) => sum + d.doneToday, 0) / data.length)
                : 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Avg Daily Pending</p>
            <p className="font-semibold text-slate-900">
              {data.length > 0 
                ? Math.round(data.reduce((sum, d) => sum + d.totalPending, 0) / data.length)
                : 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Peak Delayed</p>
            <p className="font-semibold text-red-600">
              {data.length > 0 
                ? Math.max(...data.map(d => d.casesDelayed))
                : 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Peak Done</p>
            <p className="font-semibold text-green-600">
              {data.length > 0 
                ? Math.max(...data.map(d => d.doneToday))
                : 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

