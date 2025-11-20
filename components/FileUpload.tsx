
import React, { useState } from 'react';
import { UploadCloud, FileText, AlertCircle, Table, History, Trash2, ArrowRight, Calendar } from 'lucide-react';
import { SavedForecast, User } from '../types';

interface FileUploadProps {
  onFileUpload: (content: string) => void;
  savedForecasts: SavedForecast[];
  onLoadForecast: (forecast: SavedForecast) => void;
  onDeleteForecast: (id: string) => void;
  user: User;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUpload, 
  savedForecasts, 
  onLoadForecast, 
  onDeleteForecast,
  user 
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processFile(file);
  };

  const processFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setError("Please upload a valid .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        setError("File is empty.");
        return;
      }
      onFileUpload(content);
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const templateData = `Date,Revenue,Bookings,Destination_Region
2023-01,45000,120,Europe
2023-02,42000,110,Europe
2023-03,55000,150,Asia
...`;

  return (
    <div className="max-w-5xl mx-auto mt-8 px-4 sm:px-6 pb-12">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Predict Your Revenue with AI</h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Upload your historical booking data. Our Gemini-powered engine will analyze trends, seasonality, and market drivers to generate a precise forecast.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div 
            className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ease-in-out ${
              isDragging ? 'border-brand-500 bg-brand-50 scale-[1.02]' : 'border-slate-300 hover:border-brand-400 bg-white'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex items-center justify-center opacity-5">
              <Table size={200} />
            </div>
            
            <div className="relative z-10">
              <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <UploadCloud className="w-8 h-8" />
              </div>
              
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Click to upload or drag and drop
              </h3>
              <p className="text-slate-500 mb-8">CSV files only (max 5MB)</p>
              
              <input
                type="file"
                accept=".csv"
                id="file-upload"
                className="hidden"
                onChange={handleFileChange}
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 cursor-pointer transition-colors"
              >
                Select Spreadsheet
              </label>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
            <div className="flex items-center mb-4">
              <FileText className="w-5 h-5 text-slate-500 mr-2" />
              <h4 className="font-semibold text-slate-900">Required Data Format</h4>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Your CSV file should include at least <strong>Date</strong> (YYYY-MM) and <strong>Revenue</strong> columns.
            </p>
            <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs text-slate-300 font-mono">{templateData}</pre>
            </div>
          </div>
        </div>

        {/* Saved Forecasts Side Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-xl">
              <h3 className="font-semibold text-slate-800 flex items-center">
                <History className="w-4 h-4 mr-2 text-brand-500" />
                Saved Forecasts
              </h3>
              <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                {savedForecasts.length}
              </span>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto max-h-[600px] space-y-3">
              {savedForecasts.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <History className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No saved forecasts yet.</p>
                  <p className="text-xs mt-1">Analyze data to save your first report.</p>
                </div>
              ) : (
                savedForecasts.map((forecast) => (
                  <div key={forecast.id} className="group relative bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-all hover:border-brand-200">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-slate-900 pr-6 line-clamp-1" title={forecast.name}>
                        {forecast.name}
                      </h4>
                      {user.role === 'admin' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteForecast(forecast.id);
                          }}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                          title="Delete Forecast"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center text-xs text-slate-500 mb-3">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(forecast.createdAt).toLocaleDateString()}
                      <span className="mx-1.5">•</span>
                      <span className="truncate">by {forecast.createdBy}</span>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                      <div className="text-xs">
                        <span className="text-slate-400">Proj. Revenue:</span>
                        <div className="font-semibold text-slate-700">
                          {formatCurrency(forecast.data.forecast.reduce((sum, p) => sum + p.revenue, 0))}
                        </div>
                      </div>
                      <button
                        onClick={() => onLoadForecast(forecast)}
                        className="flex items-center text-xs font-medium text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-md transition-colors"
                      >
                        Load
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
