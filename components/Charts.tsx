import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Line
} from 'recharts';
import { DataPoint } from '../types';

interface RevenueChartProps {
  data: DataPoint[];
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  // Helper to format currency
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 3 }).format(value);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[400px]">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Revenue Forecast</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            stroke="#64748b" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
          />
          <YAxis 
            stroke="#64748b" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            tickFormatter={(value) => `$${value / 1000}k`}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            formatter={(value: number) => [formatCurrency(value), 'Revenue']}
          />
          <Legend />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            stroke="#0ea5e9" 
            fillOpacity={1} 
            fill="url(#colorRevenue)" 
            name="Historical"
            strokeWidth={2}
          />
           {/* To show forecast effectively, we might need to overlap or structure data differently. 
               Assuming 'data' is a merged array where forecast points also have 'revenue'.
               We can use a second Area if we separate the keys, but since they share 'revenue',
               we can use a composed approach or just styling based on payload if recharts supported it easily.
               Better: Render forecast line on top if possible, or separate keys.
               
               Workaround for simplicity: Re-map data to have 'revenueHistorical' and 'revenueForecast' 
           */}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ComparisonChart: React.FC<RevenueChartProps> = ({ data }) => {
    // Split data for a composed look if needed
    // This is a secondary chart example
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[400px]">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">YoY Growth Trend</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} wrapperStyle={{borderRadius: '8px'}} />
                    <Bar dataKey="revenue" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
