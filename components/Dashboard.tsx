
import React, { useState, useMemo } from 'react';
import { ForecastResponse, SimulationState, User } from '../types';
import { RevenueChart } from './Charts';
import { Sliders, ArrowLeft, Zap, TrendingUp, DollarSign, Lock, Save } from 'lucide-react';

interface DashboardProps {
  data: ForecastResponse;
  onReset: () => void;
  onSave: (name: string) => void;
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onReset, onSave, user }) => {
  // Initialize simulation state based on suggested parameters
  const initialSimState: SimulationState = {};
  data.suggestedParameters.forEach(p => {
    initialSimState[p.key] = p.default;
  });

  const [simParams, setSimParams] = useState<SimulationState>(initialSimState);
  const [activeTab, setActiveTab] = useState<'forecast' | 'insights'>('forecast');
  const [isSaving, setIsSaving] = useState(false);

  // Calculate simulated data locally to be instant
  const simulatedData = useMemo(() => {
    const combined = [...data.historical, ...data.forecast].map(point => {
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
    });
    return combined;
  }, [data, simParams]);

  const totalForecastRevenue = simulatedData
    .filter(d => d.type === 'forecast')
    .reduce((sum, d) => sum + d.revenue, 0);

  const baselineForecastRevenue = data.forecast
    .reduce((sum, d) => sum + d.revenue, 0);
    
  const diff = totalForecastRevenue - baselineForecastRevenue;
  const diffPercent = (diff / baselineForecastRevenue) * 100;

  const isAggressive = useMemo(() => {
    const growthRate = simParams['Growth Rate'] || 0;
    const marketGrowth = simParams['Market Growth'] || 0;
    return (Number(growthRate) + Number(marketGrowth)) > 0;
  }, [simParams]);

  const isAdmin = user.role === 'admin';

  const handleSaveClick = () => {
    setIsSaving(true);
    // Simple prompt for demo; in production use a modal
    const name = window.prompt("Enter a name for this forecast scenario:", `Forecast ${new Date().toLocaleDateString()}`);
    if (name) {
      onSave(name);
    }
    setIsSaving(false);
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
            disabled={isSaving}
            className="flex items-center text-brand-600 hover:text-brand-700 font-medium px-3 py-2 hover:bg-brand-50 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Analysis
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

      {activeTab === 'forecast' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-500">Forecasted Revenue (12mo)</p>
                  <DollarSign className="w-4 h-4 text-brand-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalForecastRevenue)}
                </p>
                <div className={`text-xs font-medium mt-1 ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {diff >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(diff)} ({diffPercent.toFixed(1)}%) vs Baseline
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-500">Historical Average</p>
                  <TrendingUp className="w-4 h-4 text-brand-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                   {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                     data.historical.reduce((a, b) => a + b.revenue, 0) / data.historical.length
                   )}
                   <span className="text-xs font-normal text-slate-400 ml-1">/mo</span>
                </p>
              </div>

               <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-500">Growth Trajectory</p>
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-lg font-medium text-slate-900">
                  {isAggressive ? 'Aggressive' : 'Stable'}
                </p>
                 <p className="text-xs text-slate-500">Based on simulation</p>
              </div>
            </div>

            <RevenueChart data={simulatedData} />
          </div>

          {/* Controls */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sticky top-24">
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
          </div>
        </div>
      ) : (
        isAdmin && (
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
        )
      )}
    </div>
  );
};
