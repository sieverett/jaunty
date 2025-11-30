import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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
  Line,
  ReferenceLine,
  ComposedChart,
  Brush
} from 'recharts';
import { DataPoint, FunnelData } from '../types';

interface RevenueChartProps {
  data: DataPoint[];
}

interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  minDate?: string;
  maxDate?: string;
  onDateChange: (startDate: string, endDate: string) => void;
  onReset: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

// Custom tooltip component with enhanced information
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0].payload as DataPoint;
  // Get revenue directly from the data point, not from payload value (which could be the confidence band array)
  const revenue = dataPoint.revenue;
  const isForecast = dataPoint.type === 'forecast';

  // Calculate period-over-period change if we have previous data
  const prevIndex = payload[0].payload.index;
  const prevRevenue = prevIndex > 0 ? payload[0].payload.prevRevenue : null;
  const pctChange = prevRevenue && revenue ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

  // Get confidence interval if available
  const lower = dataPoint.lower;
  const upper = dataPoint.upper;
  const hasConfidence = lower !== undefined && upper !== undefined;
  const confidenceInterval = hasConfidence ? (upper - lower) / 2 : null;

  // Format date
  const date = new Date(label);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
      <p className="text-sm font-semibold text-slate-900 mb-2">{formattedDate}</p>
      <div className="flex items-center space-x-2 mb-1">
        <div
          className={`w-3 h-3 rounded-full ${isForecast ? 'bg-purple-500' : 'bg-sky-500'}`}
        />
        <span className="text-xs font-medium text-slate-600">
          {isForecast ? 'Forecast' : 'Historical'}
        </span>
      </div>
      <p className="text-lg font-bold text-slate-900">
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        }).format(revenue)}
      </p>
      {hasConfidence && confidenceInterval !== null && (
        <p className="text-xs text-purple-600 mt-1">
          ± {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
          }).format(confidenceInterval)} confidence
        </p>
      )}
      {pctChange !== null && (
        <p className={`text-xs mt-1 ${pctChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {pctChange >= 0 ? '↑' : '↓'} {Math.abs(pctChange).toFixed(1)}% vs previous period
        </p>
      )}
    </div>
  );
};

export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  // Use refs to track brush state without causing re-renders during drag
  const brushStartIndexRef = useRef<number>(0);
  const brushEndIndexRef = useRef<number>(Math.max(0, data.length - 1));
  const [brushStartIndex, setBrushStartIndex] = useState<number>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number>(() => Math.max(0, data.length - 1));
  
  // Reset filter when data changes
  useEffect(() => {
    if (data.length > 0) {
      const maxIndex = data.length - 1;
      brushStartIndexRef.current = 0;
      brushEndIndexRef.current = maxIndex;
      setBrushStartIndex(0);
      setBrushEndIndex(maxIndex);
    }
  }, [data.length]);
  
  // Separate historical and forecast data, and prepare for visualization
  // Use a stable reference to prevent unnecessary re-renders
  const chartData = useMemo(() => {
    let lastHistoricalIndex = -1;

    return data.map((point, index) => {
      if (point.type === 'historical') {
        lastHistoricalIndex = index;
      }

      return {
        ...point,
        revenueHistorical: point.type === 'historical' ? point.revenue : null,
        revenueForecast: point.type === 'forecast' ? point.revenue : null,
        // Confidence band for forecast points (array format for Area chart)
        confidenceBand: point.type === 'forecast' && point.lower !== undefined && point.upper !== undefined
          ? [point.lower, point.upper]
          : null,
        prevRevenue: index > 0 ? data[index - 1].revenue : null,
        index,
        // Format date for display
        dateFormatted: new Date(point.date).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric'
        }),
      };
    });
  }, [data]);

  // Check if any forecast data has confidence intervals
  const hasConfidenceIntervals = useMemo(() => {
    return data.some(d => d.type === 'forecast' && d.lower !== undefined && d.upper !== undefined);
  }, [data]);
  
  // Filter data based on brush selection - use refs for immediate updates
  const visibleData = useMemo(() => {
    return chartData.slice(brushStartIndexRef.current, brushEndIndexRef.current + 1);
  }, [chartData, brushStartIndex, brushEndIndex]); // Still depend on state for re-render trigger

  // Find the transition point (last historical data point)
  const transitionIndex = useMemo(() => {
    // findLastIndex might not be available in all environments, so we'll iterate backwards
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].type === 'historical') {
        return i;
      }
    }
    return -1;
  }, [data]);

  // Format date for X-axis
  const formatXAxisDate = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  // Handle brush change - update refs immediately, debounce state update to prevent re-renders during drag
  const handleBrushChange = React.useCallback((brushData: { startIndex?: number; endIndex?: number } | null) => {
    if (brushData && typeof brushData.startIndex === 'number' && typeof brushData.endIndex === 'number') {
      // Update refs immediately (no re-render)
      brushStartIndexRef.current = brushData.startIndex;
      brushEndIndexRef.current = brushData.endIndex;
      
      // Debounce state update to avoid re-renders during active dragging
      // This allows the Brush to move smoothly without interference
      const timeoutId = setTimeout(() => {
        setBrushStartIndex(brushData.startIndex);
        setBrushEndIndex(brushData.endIndex);
      }, 100);
      
      // Store timeout ID to clear if needed (though we'll let it complete)
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // Zoom controls
  const zoomIn = () => {
    const range = brushEndIndex - brushStartIndex;
    const newRange = Math.max(6, Math.floor(range * 0.7)); // Zoom in by 30%, minimum 6 months
    const center = Math.floor((brushStartIndex + brushEndIndex) / 2);
    const newStart = Math.max(0, center - Math.floor(newRange / 2));
    const newEnd = Math.min(chartData.length - 1, newStart + newRange);
    setBrushStartIndex(newStart);
    setBrushEndIndex(newEnd);
  };

  const zoomOut = () => {
    const range = brushEndIndex - brushStartIndex;
    const newRange = Math.min(chartData.length, Math.ceil(range * 1.4)); // Zoom out by 40%
    const center = Math.floor((brushStartIndex + brushEndIndex) / 2);
    const newStart = Math.max(0, center - Math.floor(newRange / 2));
    const newEnd = Math.min(chartData.length - 1, newStart + newRange);
    setBrushStartIndex(newStart);
    setBrushEndIndex(newEnd);
  };

  const resetZoom = () => {
    setBrushStartIndex(0);
    setBrushEndIndex(chartData.length - 1);
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[450px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Revenue Forecast</h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={zoomOut}
              className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              title="Zoom Out"
            >
              −
            </button>
            <button
              onClick={resetZoom}
              className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              title="Reset Zoom"
            >
              Reset
            </button>
            <button
              onClick={zoomIn}
              className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              title="Zoom In"
            >
              +
            </button>
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-sky-500" />
              <span className="text-slate-600">Historical</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-slate-600">Forecast</span>
            </div>
            {hasConfidenceIntervals && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded bg-purple-200 border border-purple-300" />
                <span className="text-slate-600">Confidence</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 0, bottom: 90 }}
        >
          <defs>
            <linearGradient id="colorHistorical" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.6}/>
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05}/>
            </linearGradient>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
            </linearGradient>
            <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            stroke="#64748b" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false}
            tickFormatter={formatXAxisDate}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            stroke="#64748b" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false}
            tickFormatter={(value) => `$${value / 1000}k`}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Historical Area */}
          <Area 
            type="monotone" 
            dataKey="revenueHistorical" 
            stroke="#0ea5e9" 
            strokeWidth={2.5}
            fillOpacity={1} 
            fill="url(#colorHistorical)" 
            name="Historical"
            connectNulls={false}
          />
          
          {/* Confidence Band for Forecast (rendered behind forecast line) */}
          {hasConfidenceIntervals && (
            <Area
              type="monotone"
              dataKey="confidenceBand"
              stroke="none"
              fillOpacity={1}
              fill="url(#colorConfidence)"
              name="Confidence Interval"
              connectNulls={false}
              legendType="none"
            />
          )}

          {/* Forecast Area */}
          <Area
            type="monotone"
            dataKey="revenueForecast"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            strokeDasharray="5 5"
            fillOpacity={1}
            fill="url(#colorForecast)"
            name="Forecast"
            connectNulls={false}
          />
          
          {/* Reference line at transition point */}
          {transitionIndex >= 0 && transitionIndex >= brushStartIndex && transitionIndex <= brushEndIndex && (
            <ReferenceLine 
              x={chartData[transitionIndex]?.date} 
              stroke="#94a3b8" 
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{ 
                value: "Forecast Start", 
                position: "top",
                fill: "#64748b",
                fontSize: 10,
                offset: 5
              }}
            />
          )}
          
          {/* Brush - uncontrolled like the example, only onChange to filter chart */}
          <Brush
            dataKey="date"
            height={30}
            stroke="#94a3b8"
            onChange={handleBrushChange}
            data={chartData}
          />
        </ComposedChart>
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

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  startDate,
  endDate,
  minDate,
  maxDate,
  onDateChange,
  onReset,
  isLoading = false,
  disabled = false
}) => {
  // Generate array of dates between min and max for the brush
  const dateRange = useMemo(() => {
    if (!minDate || !maxDate) return [];
    const dates: { date: string; value: number }[] = [];
    const start = new Date(minDate);
    const end = new Date(maxDate);
    const current = new Date(start);
    let index = 0;

    while (current <= end) {
      dates.push({
        date: current.toISOString().split('T')[0],
        value: 1 // Constant value for visual representation
      });
      current.setDate(current.getDate() + 1);
      index++;
    }
    return dates;
  }, [minDate, maxDate]);

  // Find indices for current selection
  const startIndex = useMemo(() => {
    const idx = dateRange.findIndex(d => d.date === startDate);
    return idx >= 0 ? idx : 0;
  }, [dateRange, startDate]);

  const endIndex = useMemo(() => {
    const idx = dateRange.findIndex(d => d.date === endDate);
    return idx >= 0 ? idx : dateRange.length - 1;
  }, [dateRange, endDate]);

  // Handle brush change
  const handleBrushChange = useCallback((brushData: { startIndex?: number; endIndex?: number } | null) => {
    if (disabled || isLoading) return;
    if (brushData && typeof brushData.startIndex === 'number' && typeof brushData.endIndex === 'number') {
      const newStartDate = dateRange[brushData.startIndex]?.date;
      const newEndDate = dateRange[brushData.endIndex]?.date;
      if (newStartDate && newEndDate) {
        onDateChange(newStartDate, newEndDate);
      }
    }
  }, [dateRange, onDateChange, disabled, isLoading]);

  // Format date for display
  const formatDisplayDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (dateRange.length === 0) {
    return null;
  }

  // Compact date format
  const formatCompactDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Date range display */}
      <span className="text-xs text-slate-500">Filter:</span>
      <span className="text-xs font-medium text-slate-700">{formatCompactDate(startDate)}</span>
      <span className="text-xs text-slate-400">→</span>
      <span className="text-xs font-medium text-slate-700">{formatCompactDate(endDate)}</span>

      {/* Compact Brush slider */}
      <div className="flex-1 h-6 max-w-xs">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dateRange} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Brush
              dataKey="date"
              height={24}
              stroke="#3b82f6"
              fill="#dbeafe"
              startIndex={startIndex}
              endIndex={endIndex}
              onChange={handleBrushChange}
              tickFormatter={() => ''}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Reset button */}
      <button
        onClick={onReset}
        disabled={disabled || isLoading}
        className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
      >
        Reset
      </button>

      {isLoading && (
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-400"></div>
      )}
    </div>
  );
};

interface FunnelChartProps {
  data: FunnelData[];
  showLost?: boolean;
  showCancelled?: boolean;
  // Optional date filter props
  dateFilter?: {
    startDate: string;
    endDate: string;
    minDate: string;
    maxDate: string;
    onDateChange: (startDate: string, endDate: string) => void;
    onReset: () => void;
    isLoading?: boolean;
  };
}

// Custom tooltip for funnel chart
const FunnelTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload as FunnelData;
  
  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
      <p className="text-sm font-semibold text-slate-900 mb-2 capitalize">{data.stage.replace('_', ' ')}</p>
      <div className="space-y-1">
        <p className="text-lg font-bold text-slate-900">
          {data.count.toLocaleString()} leads
        </p>
        {data.conversionRate !== undefined && data.conversionRate !== null && (
          <p className="text-xs text-slate-600">
            Conversion: <span className="font-semibold text-green-600">{data.conversionRate.toFixed(1)}%</span>
          </p>
        )}
        {data.dropOffRate !== undefined && data.dropOffRate !== null && (
          <p className="text-xs text-slate-600">
            Drop-off: <span className="font-semibold text-red-600">{data.dropOffRate.toFixed(1)}%</span>
          </p>
        )}
        <p className="text-xs text-slate-600">
          Revenue Potential: <span className="font-semibold text-brand-600">
            {new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD', 
              maximumFractionDigits: 0 
            }).format(data.revenuePotential)}
          </span>
        </p>
        {data.avgDaysInStage !== undefined && data.avgDaysInStage !== null && (
          <p className="text-xs text-slate-600">
            Avg Time: <span className="font-semibold">{data.avgDaysInStage.toFixed(1)} days</span>
          </p>
        )}
      </div>
    </div>
  );
};

export const FunnelChart: React.FC<FunnelChartProps> = ({ data, showLost = false, showCancelled = false, dateFilter }) => {
  // Define the correct pipeline stage order (from inquiry to completed)
  const stageOrder: { [key: string]: number } = {
    'inquiry': 1,
    'quote_sent': 2,
    'booked': 3,
    'final_payment': 4,
    'completed': 5,
    'lost': 6,
    'cancelled': 7
  };

  // Filter data based on props
  const filteredData = data.filter(item => {
    if (item.stage === 'lost' && !showLost) return false;
    if (item.stage === 'cancelled' && !showCancelled) return false;
    return true;
  });

  // Sort by pipeline stage order (inquiry first, completed last)
  // This ensures the funnel flows correctly from top (most leads) to bottom (fewest leads)
  const sortedData = [...filteredData].sort((a, b) => {
    const orderA = stageOrder[a.stage.toLowerCase()] || 999;
    const orderB = stageOrder[b.stage.toLowerCase()] || 999;
    return orderA - orderB;
  });

  // Calculate max count for scaling (use first item which should be inquiry with highest count)
  const maxCount = sortedData.length > 0 ? sortedData[0].count : 1;

  // Format stage names for display
  const formatStageName = (stage: string) => {
    return stage
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Pipeline Funnel</h3>
        <div className="flex items-center space-x-4 text-xs">
          {showLost && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-600">Lost</span>
            </div>
          )}
          {showCancelled && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-slate-600">Cancelled</span>
            </div>
          )}
        </div>
      </div>

      {/* Inline Date Filter */}
      {dateFilter && (
        <DateRangeSelector
          startDate={dateFilter.startDate}
          endDate={dateFilter.endDate}
          minDate={dateFilter.minDate}
          maxDate={dateFilter.maxDate}
          onDateChange={dateFilter.onDateChange}
          onReset={dateFilter.onReset}
          isLoading={dateFilter.isLoading}
          disabled={dateFilter.isLoading}
        />
      )}

      {/* Column Headers */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stage</span>
        </div>
        <div className="flex items-center space-x-4 text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wide">Count</span>
          <span className="font-semibold text-slate-500 uppercase tracking-wide min-w-[80px] text-right">Revenue Potential</span>
        </div>
      </div>

      <div className="space-y-4">
        {sortedData.map((item, index) => {
          const widthPercent = (item.count / maxCount) * 100;
          // Use conversion rate from backend if available, otherwise calculate from previous stage
          const previousItem = sortedData[index - 1];
          const conversionFromPrevious = item.conversionRate !== undefined && item.conversionRate !== null
            ? item.conversionRate.toFixed(1)
            : previousItem 
              ? ((item.count / previousItem.count) * 100).toFixed(1)
              : null;

          return (
            <div key={item.stage} className="relative">
              {/* Stage Label and Count */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-semibold text-slate-700 capitalize">
                    {formatStageName(item.stage)}
                  </span>
                  {item.conversionRate !== undefined && item.conversionRate !== null && (
                    <span className="text-xs text-slate-500">
                      {item.conversionRate.toFixed(1)}% conversion
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="font-bold text-slate-900">
                    {item.count.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Intl.NumberFormat('en-US', { 
                      style: 'currency', 
                      currency: 'USD', 
                      maximumFractionDigits: 0,
                      notation: 'compact'
                    }).format(item.revenuePotential)}
                  </span>
                </div>
              </div>

              {/* Funnel Bar */}
              <div className="relative">
                <div
                  className="h-12 rounded-lg transition-all duration-300 hover:opacity-90 cursor-pointer"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: item.color,
                    minWidth: '60px'
                  }}
                >
                  <div className="h-full flex items-center justify-center">
                    <span className="text-xs font-semibold text-white px-2">
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Conversion Arrow and Rate - show conversion FROM previous stage TO current */}
              {conversionFromPrevious && index > 0 && (
                <div className="flex items-center justify-center my-2">
                  <div className="flex flex-col items-center">
                    <svg
                      className="w-6 h-6 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                    <span className="text-xs font-medium text-slate-500 mt-1">
                      {conversionFromPrevious}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Total Pipeline</p>
            <p className="text-lg font-bold text-slate-900">
              {sortedData.reduce((sum, d) => sum + d.count, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Overall Conversion</p>
            <p className="text-lg font-bold text-green-600">
              {sortedData.length > 1 
                ? (((sortedData[sortedData.length - 1].count / sortedData[0].count) * 100).toFixed(1))
                : '0'
              }%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Total Revenue Potential</p>
            <p className="text-lg font-bold text-brand-600">
              {new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD', 
                maximumFractionDigits: 0,
                notation: 'compact'
              }).format(sortedData.reduce((sum, d) => sum + d.revenuePotential, 0))}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Avg Conversion Rate</p>
            <p className="text-lg font-bold text-slate-900">
              {sortedData.length > 1
                ? (sortedData
                    .slice(1) // Skip first item (no previous stage)
                    .map((item, idx) => {
                      const prev = sortedData[idx];
                      return (item.count / prev.count) * 100;
                    })
                    .reduce((sum, rate) => sum + rate, 0) / (sortedData.length - 1)
                  ).toFixed(1)
                : '0'
              }%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
