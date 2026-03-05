'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CHART_COLORS } from '@/lib/types';

interface ProspectChartProps {
  oecCount: number;
  owwaCount: number;
  travelVisaCount: number;
}

const COLORS = {
  OEC: CHART_COLORS.oec,
  OWWA: CHART_COLORS.owwa,
  'Travel Visa': CHART_COLORS.travelVisa,
};

export default function ProspectChart({ oecCount, owwaCount, travelVisaCount }: ProspectChartProps) {
  const data = [
    { name: 'OEC', value: oecCount },
    { name: 'OWWA', value: owwaCount },
    { name: 'Travel Visa', value: travelVisaCount },
  ].filter(d => d.value > 0);

  const total = oecCount + owwaCount + travelVisaCount;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-white rounded-xl border border-slate-200">
        <p className="text-slate-400">No prospects detected yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">Prospect Distribution</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            label={({ name, value, percent }) => `${name}\n${value} (${((percent || 0) * 100).toFixed(0)}%)`}
            labelLine={true}
          >
            {data.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
          />
          <Legend wrapperStyle={{ color: '#64748b', fontSize: '14px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
