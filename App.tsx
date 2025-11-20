
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { Auth } from './components/Auth';
import { analyzeTravelData } from './services/geminiService';
import { AppState, ForecastResponse, User, SavedForecast } from './types';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [savedForecasts, setSavedForecasts] = useState<SavedForecast[]>([]);

  // Check for persisted session and data on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('jaunty_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    const saved = localStorage.getItem('jaunty_saved_forecasts');
    if (saved) {
      setSavedForecasts(JSON.parse(saved));
    }
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('jaunty_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('jaunty_user');
    handleReset();
  };

  const handleFileUpload = async (csvContent: string) => {
    setAppState(AppState.ANALYZING);
    try {
      const data = await analyzeTravelData(csvContent);
      setForecastData(data);
      setAppState(AppState.DASHBOARD);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to analyze data. Please ensure your CSV format is correct and try again.");
      setAppState(AppState.ERROR);
    }
  };

  const handleReset = () => {
    setAppState(AppState.UPLOAD);
    setForecastData(null);
    setErrorMessage(null);
  };

  const handleSaveForecast = (name: string) => {
    if (!forecastData || !user) return;

    const newSaved: SavedForecast = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      createdBy: user.name,
      data: forecastData
    };

    const updated = [newSaved, ...savedForecasts];
    setSavedForecasts(updated);
    localStorage.setItem('jaunty_saved_forecasts', JSON.stringify(updated));
  };

  const handleLoadForecast = (forecast: SavedForecast) => {
    setForecastData(forecast.data);
    setAppState(AppState.DASHBOARD);
  };

  const handleDeleteForecast = (id: string) => {
    if (user?.role !== 'admin') return; // Strict permission check
    const updated = savedForecasts.filter(f => f.id !== id);
    setSavedForecasts(updated);
    localStorage.setItem('jaunty_saved_forecasts', JSON.stringify(updated));
  };

  // Strict Data Filtering: Do not even pass restricted data to components if user is not admin
  const safeForecastData = React.useMemo(() => {
    if (!forecastData) return null;
    if (user?.role === 'admin') return forecastData;

    // Analyst View: Strip sensitive insights
    return {
      ...forecastData,
      insights: [], // Empty array ensures type safety but removes data
      keyDrivers: []
    };
  }, [forecastData, user]);

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header user={user} onLogout={handleLogout} />
      
      <main>
        {appState === AppState.UPLOAD && (
          <FileUpload 
            onFileUpload={handleFileUpload} 
            savedForecasts={savedForecasts}
            onLoadForecast={handleLoadForecast}
            onDeleteForecast={handleDeleteForecast}
            user={user}
          />
        )}

        {appState === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <Loader2 className="w-12 h-12 text-brand-600 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">Analyzing Historical Data</h2>
            <p className="text-slate-500 mt-2 max-w-md text-center">
              Gemini is identifying seasonal patterns, booking trends, and calculating your 12-month forecast...
            </p>
          </div>
        )}

        {appState === AppState.DASHBOARD && safeForecastData && (
          <Dashboard 
            data={safeForecastData} 
            onReset={handleReset} 
            onSave={handleSaveForecast}
            user={user} 
          />
        )}

        {appState === AppState.ERROR && (
           <div className="flex flex-col items-center justify-center h-[60vh] px-4">
             <div className="bg-red-50 p-8 rounded-2xl border border-red-100 text-center max-w-lg">
                <h2 className="text-xl font-bold text-red-700 mb-2">Analysis Failed</h2>
                <p className="text-slate-600 mb-6">{errorMessage}</p>
                <button 
                  onClick={handleReset}
                  className="px-6 py-2 bg-white border border-red-200 text-red-700 font-medium rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                >
                  Try Again
                </button>
             </div>
           </div>
        )}
      </main>
    </div>
  );
}
