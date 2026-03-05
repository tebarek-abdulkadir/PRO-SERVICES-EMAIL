'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ChatTrendData } from '@/lib/chat-types';

interface ChatTrendChartProps {
  data: ChatTrendData[];
  isLoading?: boolean;
}

export default function ChatTrendChart({ data, isLoading }: ChatTrendChartProps) {
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
    frustration: item.frustrationPercentage,
    confusion: item.confusionPercentage,
  }));

  // Calculate trend direction
  const calculateTrend = (values: number[]) => {
    if (values.length < 2) return 'stable';
    const first = values[0];
    const last = values[values.length - 1];
    const diff = last - first;
    const threshold = 2; // 2% change threshold
    
    if (diff > threshold) return 'increasing';
    if (diff < -threshold) return 'decreasing';
    return 'stable';
  };

  const frustrationTrend = calculateTrend(data.map(d => d.frustrationPercentage));
  const confusionTrend = calculateTrend(data.map(d => d.confusionPercentage));

  // Dynamic Y-axis: scale to the max value with padding (round up to nearest 5)
  const overallMax = Math.max(
    Math.max(...data.map(d => d.frustrationPercentage)),
    Math.max(...data.map(d => d.confusionPercentage))
  );
  const yAxisMax = Math.min(100, Math.ceil(overallMax / 5) * 5 + 5);

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

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'text-red-600';
      case 'decreasing':
        return 'text-green-600';
      default:
        return 'text-slate-600';
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-900">Trend Analysis</h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              {getTrendIcon(frustrationTrend)}
              <span className={`font-medium ${getTrendColor(frustrationTrend)}`}>
                Frustration {frustrationTrend}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon(confusionTrend)}
              <span className={`font-medium ${getTrendColor(confusionTrend)}`}>
                Confusion {confusionTrend}
              </span>
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Changes in frustration and confusion levels over the last {data.length} days
        </p>
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
            label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
            domain={[0, yAxisMax]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 12px'
            }}
            labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
            formatter={(value: number | undefined) => {
              if (value === undefined || value === null) return ['0.0%', ''];
              return [`${value.toFixed(1)}%`, ''];
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line 
            type="monotone" 
            dataKey="frustration" 
            stroke="#ef4444" 
            strokeWidth={2}
            dot={{ fill: '#ef4444', r: 4 }}
            activeDot={{ r: 6 }}
            name="Frustration %"
          />
          <Line 
            type="monotone" 
            dataKey="confusion" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="Confusion %"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* ── Summary Stats ── */}
      <div className="mt-6 grid grid-cols-2 gap-4 pt-6 border-t border-slate-200">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Frustration</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-600">
              {data.length > 0 ? data[data.length - 1].frustrationPercentage.toFixed(1) : '0.0'}%
            </span>
            {data.length > 1 && (
              <span className={`text-sm ${getTrendColor(frustrationTrend)}`}>
                {frustrationTrend === 'increasing' ? '↑' : frustrationTrend === 'decreasing' ? '↓' : '→'}
                {Math.abs(data[data.length - 1].frustrationPercentage - data[0].frustrationPercentage).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Current vs. {data.length} days ago</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Confusion</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">
              {data.length > 0 ? data[data.length - 1].confusionPercentage.toFixed(1) : '0.0'}%
            </span>
            {data.length > 1 && (
              <span className={`text-sm ${getTrendColor(confusionTrend)}`}>
                {confusionTrend === 'increasing' ? '↑' : confusionTrend === 'decreasing' ? '↓' : '→'}
                {Math.abs(data[data.length - 1].confusionPercentage - data[0].confusionPercentage).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Current vs. {data.length} days ago</p>
        </div>
      </div>

      {/* ── Cumulative Totals ── */}
      {data.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-4">Cumulative Totals (from {new Date(data[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to {new Date(data[data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</p>
          <div className="grid grid-cols-2 gap-4">
            {/* Total Frustrated */}
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Total Frustrated</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600">
                  {data.reduce((sum, item) => sum + (item.frustratedCount || 0), 0)}
                </span>
                <span className="text-sm text-slate-600">
                  out of {data.reduce((sum, item) => sum + (item.totalPeople || 0), 0)} total people
                </span>
              </div>
              <div className="mt-2">
                <span className="text-lg font-semibold text-red-700">
                  {data.reduce((sum, item) => sum + (item.totalPeople || 0), 0) > 0
                    ? ((data.reduce((sum, item) => sum + (item.frustratedCount || 0), 0) / data.reduce((sum, item) => sum + (item.totalPeople || 0), 0)) * 100).toFixed(1)
                    : '0.0'}%
                </span>
                <span className="text-xs text-slate-500 ml-2">of total people</span>
              </div>
            </div>

            {/* Total Confused */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Total Confused</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600">
                  {data.reduce((sum, item) => sum + (item.confusedCount || 0), 0)}
                </span>
                <span className="text-sm text-slate-600">
                  out of {data.reduce((sum, item) => sum + (item.totalPeople || 0), 0)} total people
                </span>
              </div>
              <div className="mt-2">
                <span className="text-lg font-semibold text-blue-700">
                  {data.reduce((sum, item) => sum + (item.totalPeople || 0), 0) > 0
                    ? ((data.reduce((sum, item) => sum + (item.confusedCount || 0), 0) / data.reduce((sum, item) => sum + (item.totalPeople || 0), 0)) * 100).toFixed(1)
                    : '0.0'}%
                </span>
                <span className="text-xs text-slate-500 ml-2">of total people</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

