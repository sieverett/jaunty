
import React, { useState } from 'react';
import { LogOut, User as UserIcon, Info } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user?: User | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10">
              <img
                src="/logo.png"
                alt="Jaunty Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-slate-900">Jaunty</span><span className="text-brand-600">Forecast</span>
            </h1>
          </div>

          <div className="flex items-center space-x-6">
            {user && (
              <div className="flex items-center pl-6 border-l border-slate-200 space-x-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold text-slate-800">{user.name}</span>
                  <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                    {user.role}
                  </span>
                </div>
                <div className="h-8 w-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700">
                  <UserIcon className="w-4 h-4" />
                </div>
                <button
                  onClick={() => setIsInfoModalOpen(true)}
                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
                  title="Forecasting Methodology"
                >
                  <Info className="w-5 h-5" />
                </button>
                <button
                  onClick={onLogout}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Forecasting Methodology Modal */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Background overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-20"
            onClick={() => setIsInfoModalOpen(false)}
          ></div>

          {/* Modal panel */}
          <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-white px-6 py-6">
              <div className="flex items-start justify-between">
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  How Our Forecasting Works
                </h3>
                <button
                  onClick={() => setIsInfoModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6 text-slate-700">
                <p className="text-base leading-relaxed">
                  Our forecasting system combines two powerful AI models to provide accurate revenue predictions:
                </p>

                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">Prophet Time Series Model</h4>
                    <p className="text-sm text-blue-800">
                      Captures seasonal patterns, long-term trends, and holiday effects in your historical data.
                      This model excels at understanding recurring business cycles and external factors that
                      influence your revenue patterns.
                    </p>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">XGBoost Machine Learning Model</h4>
                    <p className="text-sm text-green-800">
                      Uses gradient boosting to predict conversion rates and revenue based on complex relationships
                      in your historical data. This model identifies subtle patterns and interactions that traditional
                      methods might miss.
                    </p>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="font-semibold text-purple-900 mb-2">Ensemble Approach</h4>
                    <p className="text-sm text-purple-800">
                      By combining both models, we create more robust and accurate predictions. The ensemble approach
                      reduces individual model weaknesses while amplifying their strengths, resulting in forecasts
                      that are both statistically sound and business-relevant.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="font-semibold text-slate-900 mb-2">Why This Matters for Your Business</h4>
                  <ul className="text-sm text-slate-700 space-y-1">
                    <li>• More accurate revenue projections for strategic planning</li>
                    <li>• Better understanding of seasonal and cyclical patterns</li>
                    <li>• Confidence intervals to help assess forecast reliability</li>
                    <li>• Data-driven insights to support business decisions</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-3">
              <button
                type="button"
                onClick={() => setIsInfoModalOpen(false)}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-brand-600 text-base font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 sm:text-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
