'use client';

import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Award, AlertCircle } from 'lucide-react';
import type { OperationMetric } from '@/lib/operations-types';

interface ServicePerformance {
  serviceType: string;
  delayRate: number; // Cases Delayed / Total Cases
  completionRate: number; // Done Today / Total Pending
  totalPending: number;
  doneToday: number;
  casesDelayed: number;
  mtdCompleted: number;
  performanceScore: number; // 0-100 score
  status: 'excellent' | 'good' | 'warning' | 'critical';
  delayedNotes?: string;
}

interface ServicePerformanceComparisonProps {
  operations: OperationMetric[];
  mtdData: Record<string, number>;
}

export default function ServicePerformanceComparison({ 
  operations, 
  mtdData 
}: ServicePerformanceComparisonProps) {
  
  // Calculate performance metrics for each service
  const calculatePerformance = (op: OperationMetric): ServicePerformance => {
    const totalPending = op.pendingUs + op.pendingClient + op.pendingProVisit + op.pendingGov;
    const totalCases = totalPending + op.doneToday + op.casesDelayed;
    
    // Delay rate: percentage of cases that are delayed
    const delayRate = totalCases > 0 ? (op.casesDelayed / totalCases) * 100 : 0;
    
    // Completion rate: done today vs total pending (efficiency metric)
    const completionRate = totalPending > 0 ? (op.doneToday / totalPending) * 100 : (op.doneToday > 0 ? 100 : 0);
    
    // Performance score calculation (0-100)
    // Lower delay rate = better (max 50 points)
    // Higher completion rate = better (max 30 points)
    // Lower pending = better (max 20 points, inverse relationship)
    const delayScore = Math.max(0, 50 - (delayRate * 0.5)); // 0% delay = 50pts, 100% delay = 0pts
    const completionScore = Math.min(30, completionRate * 0.3); // 100% completion = 30pts
    const pendingScore = Math.max(0, 20 - (totalPending * 0.1)); // 0 pending = 20pts, 200+ pending = 0pts
    
    const performanceScore = delayScore + completionScore + pendingScore;
    
    // Determine status based on performance score and key metrics
    let status: 'excellent' | 'good' | 'warning' | 'critical';
    if (performanceScore >= 70 && delayRate < 10 && completionRate > 50) {
      status = 'excellent';
    } else if (performanceScore >= 50 && delayRate < 25 && completionRate > 30) {
      status = 'good';
    } else if (performanceScore >= 30 || delayRate < 50) {
      status = 'warning';
    } else {
      status = 'critical';
    }
    
    // Override status for critical conditions
    if (op.casesDelayed > 30 || delayRate > 60) {
      status = 'critical';
    } else if (op.casesDelayed > 15 || delayRate > 40) {
      status = 'warning';
    }
    
    return {
      serviceType: op.serviceType,
      delayRate,
      completionRate,
      totalPending,
      doneToday: op.doneToday,
      casesDelayed: op.casesDelayed,
      mtdCompleted: mtdData[op.serviceType] || 0,
      performanceScore,
      status,
      delayedNotes: op.delayedNotes
    };
  };
  
  const performances = operations
    .map(calculatePerformance)
    .sort((a, b) => b.performanceScore - a.performanceScore); // Sort by performance score
  
  // Separate into categories
  const excellent = performances.filter(p => p.status === 'excellent');
  const good = performances.filter(p => p.status === 'good');
  const warning = performances.filter(p => p.status === 'warning');
  const critical = performances.filter(p => p.status === 'critical');
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'good':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <Award className="w-5 h-5 text-green-600" />;
      case 'good':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'Excellent';
      case 'good':
        return 'Good';
      case 'warning':
        return 'Needs Attention';
      case 'critical':
        return 'Critical';
      default:
        return 'Unknown';
    }
  };
  
  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Service Performance Comparison</h3>
            <p className="text-sm text-slate-600 mt-1">Identify which services need attention based on delays, completion rates, and pending cases</p>
          </div>
          <TrendingUp className="w-5 h-5 text-slate-400" />
        </div>
      </div>
      
      <div className="p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-green-600" />
              <p className="text-xs font-medium text-green-800">Excellent</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{excellent.length}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <p className="text-xs font-medium text-blue-800">Good</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{good.length}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <p className="text-xs font-medium text-amber-800">Needs Attention</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">{warning.length}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-xs font-medium text-red-800">Critical</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{critical.length}</p>
          </div>
        </div>
        
        {/* Critical Services - Show First */}
        {critical.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h4 className="font-semibold text-red-800">Critical - Immediate Attention Required</h4>
            </div>
            <div className="space-y-3">
              {critical.map((perf) => (
                <ServiceCard key={perf.serviceType} performance={perf} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} getStatusLabel={getStatusLabel} />
              ))}
            </div>
          </div>
        )}
        
        {/* Warning Services */}
        {warning.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <h4 className="font-semibold text-amber-800">Needs Attention</h4>
            </div>
            <div className="space-y-3">
              {warning.map((perf) => (
                <ServiceCard key={perf.serviceType} performance={perf} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} getStatusLabel={getStatusLabel} />
              ))}
            </div>
          </div>
        )}
        
        {/* Good Services */}
        {good.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-blue-800">Good Performance</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {good.map((perf) => (
                <ServiceCard key={perf.serviceType} performance={perf} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} getStatusLabel={getStatusLabel} />
              ))}
            </div>
          </div>
        )}
        
        {/* Excellent Services */}
        {excellent.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-green-800">Excellent Performance</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {excellent.map((perf) => (
                <ServiceCard key={perf.serviceType} performance={perf} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} getStatusLabel={getStatusLabel} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceCard({ 
  performance, 
  getStatusColor, 
  getStatusIcon, 
  getStatusLabel 
}: { 
  performance: ServicePerformance;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusLabel: (status: string) => string;
}) {
  const statusColor = getStatusColor(performance.status);
  const statusIcon = getStatusIcon(performance.status);
  const statusLabel = getStatusLabel(performance.status);
  
  return (
    <div className={`rounded-lg border-2 p-4 ${statusColor} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {statusIcon}
            <h5 className="font-semibold text-sm">{performance.serviceType}</h5>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{Math.round(performance.performanceScore)}</div>
          <div className="text-xs text-slate-600">Score</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200">
        <div>
          <p className="text-xs text-slate-600 mb-1">Delay Rate</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold ${performance.delayRate > 30 ? 'text-red-600' : performance.delayRate > 15 ? 'text-amber-600' : 'text-green-600'}`}>
              {performance.delayRate.toFixed(1)}%
            </span>
            {performance.delayRate > 30 && <TrendingUp className="w-3 h-3 text-red-600" />}
            {performance.delayRate < 10 && <TrendingDown className="w-3 h-3 text-green-600" />}
          </div>
          <p className="text-xs text-slate-500">{performance.casesDelayed} delayed</p>
        </div>
        
        <div>
          <p className="text-xs text-slate-600 mb-1">Completion Rate</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold ${performance.completionRate > 50 ? 'text-green-600' : performance.completionRate > 30 ? 'text-blue-600' : 'text-amber-600'}`}>
              {performance.completionRate.toFixed(1)}%
            </span>
            {performance.completionRate > 50 && <TrendingUp className="w-3 h-3 text-green-600" />}
          </div>
          <p className="text-xs text-slate-500">{performance.doneToday} done today</p>
        </div>
        
        <div>
          <p className="text-xs text-slate-600 mb-1">Total Pending</p>
          <p className="text-lg font-bold text-slate-900">{performance.totalPending}</p>
        </div>
        
        <div>
          <p className="text-xs text-slate-600 mb-1">MTD Completed</p>
          <p className="text-lg font-bold text-blue-600">{performance.mtdCompleted}</p>
        </div>
      </div>
      
      {performance.delayedNotes && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs font-medium text-slate-700 mb-1">Delay Notes:</p>
          <p className="text-xs text-slate-600 bg-white/50 rounded p-2">{performance.delayedNotes}</p>
        </div>
      )}
    </div>
  );
}

