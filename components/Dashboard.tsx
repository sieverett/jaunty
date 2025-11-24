
import React, { useState, useMemo } from 'react';
import { ForecastResponse, SimulationState, User } from '../types';
import { RevenueChart, FunnelChart } from './Charts';
import { Sliders, ArrowLeft, Zap, TrendingUp, TrendingDown, DollarSign, Lock, Save, ChevronLeft, ChevronRight, Download, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { exportForecastToPDF } from '../utils/pdfExport';

interface DashboardProps {
  data: ForecastResponse;
  onReset: () => void;
  onSave: (name: string) => void;
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onReset, onSave, user }) => {

  // Initialize simulation state based on suggested parameters with defensive guards
  const initialSimState: SimulationState = React.useMemo(() => {
    const state: SimulationState = {};

    // Defensive guard: ensure data and suggestedParameters exist and are valid
    if (!data || !Array.isArray(data.suggestedParameters)) {
      return state;
    }

    data.suggestedParameters.forEach(p => {
      // Additional defensive guard for each parameter
      if (p && typeof p.key === 'string' && typeof p.default === 'number') {
        state[p.key] = p.default;
      }
    });

    return state;
  }, [data]);

  const [simParams, setSimParams] = useState<SimulationState>(initialSimState);
  const [activeTab, setActiveTab] = useState<'forecast' | 'insights'>('forecast');
  const [isSaving, setIsSaving] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isTableMinimized, setIsTableMinimized] = useState(true);

  // Calculate simulated data locally to be instant
  // Sort by date to ensure chronological order and identify any gaps
  const simulatedData = useMemo(() => {
    // Defensive guard: ensure data exists and has required arrays
    if (!data || !Array.isArray(data.historical) || !Array.isArray(data.forecast)) {
      return [];
    }

    const combined = [...data.historical, ...data.forecast]
      .map(point => {
        let newRevenue = Number(point.revenue);

        if (point.type === 'forecast') {
          let totalModifier = 1;
          Object.entries(simParams).forEach(([key, value]) => {
             totalModifier *= (1 + (Number(value) / 100));
          });
          
          newRevenue = newRevenue * totalModifier;
        }
        
        return {
          ...point,
          revenue: newRevenue,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return combined;
  }, [data, simParams]);

  // Calculate all forecast metrics using useMemo to ensure they update when simulatedData changes
  const forecastMetrics = useMemo(() => {
    // Defensive guard: ensure simulatedData exists and is an array
    if (!Array.isArray(simulatedData) || simulatedData.length === 0) {
      return {
        totalForecastRevenue: 0,
        baselineForecastRevenue: 0,
        diff: 0,
        diffPercent: 0,
        forecast1mo: 0,
        forecast3mo: 0,
        forecast6mo: 0,
        compare1mo: 0,
        compare3mo: 0,
        compare6mo: 0,
        avg12mo: 0,
      };
    }

    const totalForecastRevenue = simulatedData
      .filter(d => d && d.type === 'forecast' && typeof d.revenue === 'number')
      .reduce((sum, d) => sum + d.revenue, 0);

    // Defensive guard for baseline calculation
    const baselineForecastRevenue = (data && Array.isArray(data.forecast))
      ? data.forecast.filter(d => d && typeof d.revenue === 'number').reduce((sum, d) => sum + d.revenue, 0)
      : 0;
      
    const diff = totalForecastRevenue - baselineForecastRevenue;
    const diffPercent = baselineForecastRevenue > 0 ? (diff / baselineForecastRevenue) * 100 : 0;

    // Calculate forecasted revenue for different time periods
    // Ensure forecast data is sorted by date (ascending) to get correct chronological order
    const forecastData = simulatedData
      .filter(d => d.type === 'forecast')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const forecast1mo = forecastData.slice(0, 1).reduce((sum, d) => sum + d.revenue, 0);
    const forecast3mo = forecastData.slice(0, 3).reduce((sum, d) => sum + d.revenue, 0);
    const forecast6mo = forecastData.slice(0, 6).reduce((sum, d) => sum + d.revenue, 0);

    // Calculate historical average for comparison (monthly average)
    const historicalAvg = (data && Array.isArray(data.historical) && data.historical.length > 0)
      ? data.historical.filter(d => d && typeof d.revenue === 'number').reduce((a, b) => a + b.revenue, 0) / data.historical.length
      : 0;
    
    // Calculate comparison percentages vs historical average
    // For 1mo: compare single month directly to monthly average
    // For 3mo and 6mo: compare monthly average of the period to historical monthly average
    const compare1mo = historicalAvg > 0 ? ((forecast1mo - historicalAvg) / historicalAvg) * 100 : 0;
    const avg3mo = forecast3mo / 3;
    const avg6mo = forecast6mo / 6;
    const compare3mo = historicalAvg > 0 ? ((avg3mo - historicalAvg) / historicalAvg) * 100 : 0;
    const compare6mo = historicalAvg > 0 ? ((avg6mo - historicalAvg) / historicalAvg) * 100 : 0;
    
    // Calculate monthly average for 12mo (already calculated avg3mo and avg6mo above)
    const avg12mo = totalForecastRevenue / 12;

    return {
      totalForecastRevenue,
      baselineForecastRevenue,
      diff,
      diffPercent,
      forecast1mo,
      forecast3mo,
      forecast6mo,
      compare1mo,
      compare3mo,
      compare6mo,
      avg12mo,
    };
  }, [simulatedData, data.historical, data.forecast, simParams]);

  // Destructure for easier access
  const {
    totalForecastRevenue,
    baselineForecastRevenue,
    diff,
    diffPercent,
    forecast1mo,
    forecast3mo,
    forecast6mo,
    compare1mo,
    compare3mo,
    compare6mo,
    avg12mo,
  } = forecastMetrics;

  const isAdmin = user.role === 'admin';

  // Generate CSV content from table data
  const generateTableCSV = (data: typeof simulatedData): string => {
    const headers = ['Date', 'Revenue', 'Type'];
    if (data.some(d => d.bookings !== undefined && d.bookings !== null)) {
      headers.push('Bookings');
    }
    
    const rows = data.map(point => {
      const date = new Date(point.date);
      const formattedDate = date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
      const revenue = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        maximumFractionDigits: 0 
      }).format(point.revenue);
      
      const row = [
        formattedDate,
        revenue,
        point.type === 'forecast' ? 'Forecast' : 'Historical'
      ];
      
      if (point.bookings !== undefined && point.bookings !== null) {
        row.push(point.bookings.toString());
      }
      
      return row;
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
  };

  // Download CSV file
  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    setExportError(null);
    
    try {
      // Simple prompt for demo; in production use a modal
      const scenarioName = window.prompt("Enter a name for this forecast scenario:", `Forecast ${new Date().toLocaleDateString()}`);
      
      if (scenarioName) {
        // Export to PDF
        setIsExportingPDF(true);
        
        await exportForecastToPDF(
          'forecast-overview-panel',
          data,
          {
            filename: `forecast-analysis-${scenarioName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`,
            includeMetadata: true,
            user: {
              name: user.name,
              email: user.email
            },
            scenarioName: scenarioName
          }
        );
        
        setIsExportingPDF(false);
        
        // Also call the original save handler if needed
        onSave(scenarioName);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setExportError(error instanceof Error ? error.message : 'Failed to export PDF. Please try again.');
      setIsExportingPDF(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onReset}
            className="flex items-center text-slate-500 hover:text-slate-800 transition-colors px-3 py-2 hover:bg-slate-100 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Upload
          </button>
          <div className="h-6 w-px bg-slate-200"></div>
          <button
            onClick={handleSaveClick}
            disabled={isSaving || isExportingPDF}
            className="flex items-center text-brand-600 hover:text-brand-700 font-medium px-3 py-2 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExportingPDF ? (
              <>
                <Download className="w-4 h-4 mr-2 animate-pulse" />
                Exporting PDF...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Analysis
              </>
            )}
          </button>
        </div>

        <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('forecast')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'forecast' ? 'bg-brand-100 text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Forecast & Simulation
          </button>
          <div className="relative group">
            <button 
              onClick={() => isAdmin && setActiveTab('insights')}
              disabled={!isAdmin}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center ${
                activeTab === 'insights' 
                  ? 'bg-brand-100 text-brand-700 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50'
              } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Strategic Insights
              {!isAdmin && <Lock className="w-3 h-3 ml-2 text-slate-400" />}
            </button>
            {!isAdmin && (
               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center z-10">
                 Restricted to Admins
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {exportError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800 mb-1">Export Failed</h4>
            <p className="text-sm text-red-700">{exportError}</p>
            <button
              onClick={() => setExportError(null)}
              className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {activeTab === 'forecast' ? (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Charts Panel - Takes 5/6 when expanded, full width when minimized */}
          <div className={`transition-all duration-300 ${isPanelCollapsed ? 'lg:w-full' : 'lg:w-5/6'}`}>
            <div id="forecast-overview-panel" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Forecast Overview</h3>
              
              {/* Stats Cards */}
              <div className="space-y-4 mb-8">
                {/* Primary Card: 12 Month Forecast */}
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-2 h-2 bg-brand-500 rounded-full"></div>
                    <h4 className="text-sm font-semibold text-slate-700">Forecasted Revenue (12 months)</h4>
                  </div>
                  <p className="text-4xl font-bold text-slate-900 mb-3">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalForecastRevenue)}
                  </p>
                  <div className="border-t border-slate-200 pt-3">
                    <div className="flex items-center space-x-4 text-sm text-slate-600">
                      <span>
                        {diff >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(diff)} ({diffPercent.toFixed(1)}%) vs Baseline
                      </span>
                      <span className="text-slate-400">|</span>
                      <span>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(avg12mo)}/mo avg
                      </span>
                    </div>
                  </div>
                </div>

                {/* Secondary Cards: Short-term Forecasts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 1 Month */}
                  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">1 Month</p>
                    <p className="text-2xl font-bold text-slate-900 mb-2">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(forecast1mo)}
                    </p>
                    <div className={`flex items-center space-x-1 text-xs font-medium ${
                      compare1mo >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {compare1mo < 0 && <TrendingDown className="w-3 h-3" />}
                      {compare1mo >= 0 && <TrendingUp className="w-3 h-3" />}
                      <span>
                        {Math.abs(compare1mo).toFixed(0)}% vs avg
                      </span>
                    </div>
                  </div>

                  {/* 3 Months */}
                  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">3 Months</p>
                    <p className="text-2xl font-bold text-slate-900 mb-2">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(forecast3mo)}
                    </p>
                    <div className={`flex items-center space-x-1 text-xs font-medium ${
                      compare3mo >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {compare3mo < 0 && <TrendingDown className="w-3 h-3" />}
                      {compare3mo >= 0 && <TrendingUp className="w-3 h-3" />}
                      <span>
                        {Math.abs(compare3mo).toFixed(0)}% vs avg
                      </span>
                    </div>
                  </div>

                  {/* 6 Months */}
                  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">6 Months</p>
                    <p className="text-2xl font-bold text-slate-900 mb-2">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(forecast6mo)}
                    </p>
                    <div className={`flex items-center space-x-1 text-xs font-medium ${
                      compare6mo >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {compare6mo < 0 && <TrendingDown className="w-3 h-3" />}
                      {compare6mo >= 0 && <TrendingUp className="w-3 h-3" />}
                      <span>
                        {Math.abs(compare6mo).toFixed(0)}% vs avg
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Revenue Chart */}
              <RevenueChart data={simulatedData} />

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Revenue Data</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        const csvContent = generateTableCSV(simulatedData);
                        downloadCSV(csvContent, 'revenue_data.csv');
                      }}
                      className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      title="Download as CSV"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Download
                    </button>
                    <button
                      onClick={() => setIsTableMinimized(!isTableMinimized)}
                      className="flex items-center justify-center p-1.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      aria-label={isTableMinimized ? "Expand table" : "Minimize table"}
                      title={isTableMinimized ? "Expand table" : "Minimize table"}
                    >
                      {isTableMinimized ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                {!isTableMinimized && (
                  <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Revenue</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                        {simulatedData.some(d => d.bookings !== undefined && d.bookings !== null) && (
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Bookings</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {simulatedData.map((point, index) => {
                        const date = new Date(point.date);
                        const formattedDate = date.toLocaleDateString('en-US', { 
                          month: 'short', 
                          year: 'numeric' 
                        });
                        const isForecast = point.type === 'forecast';
                        
                        return (
                          <tr 
                            key={`${point.date}-${index}`}
                            className={`hover:bg-slate-50 transition-colors ${
                              isForecast ? 'bg-purple-50/30' : ''
                            }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                              {formattedDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-slate-900">
                              {new Intl.NumberFormat('en-US', { 
                                style: 'currency', 
                                currency: 'USD', 
                                maximumFractionDigits: 0 
                              }).format(point.revenue)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                isForecast 
                                  ? 'bg-purple-100 text-purple-700' 
                                  : 'bg-sky-100 text-sky-700'
                              }`}>
                                {isForecast ? 'Forecast' : 'Historical'}
                              </span>
                            </td>
                            {point.bookings !== undefined && point.bookings !== null && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-600">
                                {point.bookings.toLocaleString()}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scenario Builder Panel */}
          <div className={`transition-all duration-300 sticky top-24 ${isPanelCollapsed ? 'lg:w-16' : 'lg:w-1/6'}`}>
            <div className="relative bg-white rounded-xl border border-slate-200 shadow-sm h-full">
              {/* Collapse Handle - Upper Left */}
              <button
                onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                className="absolute -left-4 top-4 bg-white border border-slate-200 rounded-l-lg px-2 py-2 shadow-sm hover:bg-slate-50 hover:border-brand-300 transition-colors z-10 flex items-center justify-center group"
                aria-label={isPanelCollapsed ? "Expand panel" : "Collapse panel"}
              >
                {isPanelCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-brand-600" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-slate-500 group-hover:text-brand-600" />
                )}
              </button>

              {isPanelCollapsed ? (
                // Minimized state - narrow strip with centered title
                <div className="p-2 h-full flex flex-col items-center justify-center min-h-[400px]">
                  <div className="transform -rotate-90 whitespace-nowrap origin-center">
                    <div className="flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">Scenario Builder</span>
                    </div>
                  </div>
                </div>
              ) : (
                // Expanded state - full content
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                      <Sliders className="w-5 h-5 mr-2" />
                      Scenario Builder
                    </h3>
                    <button 
                      onClick={() => setSimParams(initialSimState)}
                      className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="space-y-6">
                    {data.suggestedParameters.map((param) => (
                      <div key={param.key}>
                        <div className="flex justify-between mb-1">
                          <label htmlFor={param.key} className="text-sm font-medium text-slate-700">
                            {param.name}
                          </label>
                          <span className="text-sm font-bold text-brand-600">
                            {simParams[param.key] > 0 ? '+' : ''}{simParams[param.key]}%
                          </span>
                        </div>
                        <input
                          type="range"
                          id={param.key}
                          min={param.min}
                          max={param.max}
                          step={1}
                          value={simParams[param.key]}
                          onChange={(e) => setSimParams({ ...simParams, [param.key]: parseFloat(e.target.value) })}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                        />
                        <p className="text-xs text-slate-500 mt-1">{param.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 bg-brand-50 rounded-lg p-4 border border-brand-100">
                    <h4 className="text-sm font-bold text-brand-800 mb-2">Simulation Impact</h4>
                    <p className="text-xs text-brand-700 leading-relaxed">
                      Adjusting these variables instantly recalculates the 12-month forecast curve shown on the left. Use this to plan for "Best Case" and "Worst Case" scenarios.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        isAdmin && (
          <div className="space-y-8">
            {/* Top Row: Key Drivers and Strategic Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-amber-500" />
                  Key Drivers
                </h3>
                <ul className="space-y-4">
                  {data.keyDrivers.map((driver, idx) => (
                    <li key={idx} className="flex items-start">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                        {idx + 1}
                      </div>
                      <span className="text-slate-700">{driver}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-brand-500" />
                  AI Strategic Analysis
                </h3>
                <div className="space-y-4">
                  {data.insights.map((insight, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                       <p className="text-slate-700 leading-relaxed text-sm">{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row: Pipeline Funnel */}
            {data.funnel && data.funnel.length > 0 && (
              <div>
                <FunnelChart data={data.funnel} showLost={false} showCancelled={false} />
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};
