
import React, { useState, useEffect, useReducer } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { Auth } from './components/Auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { analyzeTravelData } from './services/dataService';
import { AppState, ForecastResponse, User, SavedForecast } from './types';
import { Loader2 } from 'lucide-react';

// App state reducer for atomic updates
interface AppStateData {
  appState: AppState;
  forecastData: ForecastResponse | null;
  errorMessage: string | null;
  isUploading: boolean;
}

type AppStateAction =
  | { type: 'START_UPLOAD' }
  | { type: 'UPLOAD_SUCCESS'; payload: ForecastResponse }
  | { type: 'UPLOAD_ERROR'; payload: string }
  | { type: 'RESET' }
  | { type: 'LOAD_FORECAST'; payload: ForecastResponse };

function appStateReducer(state: AppStateData, action: AppStateAction): AppStateData {
  switch (action.type) {
    case 'START_UPLOAD':
      return {
        ...state,
        appState: AppState.ANALYZING,
        isUploading: true,
        errorMessage: null
      };

    case 'UPLOAD_SUCCESS':
      return {
        ...state,
        appState: AppState.DASHBOARD,
        forecastData: action.payload,
        isUploading: false,
        errorMessage: null
      };

    case 'UPLOAD_ERROR':
      return {
        ...state,
        appState: AppState.ERROR,
        errorMessage: action.payload,
        isUploading: false
      };

    case 'RESET':
      return {
        ...state,
        appState: AppState.UPLOAD,
        forecastData: null,
        errorMessage: null,
        isUploading: false
      };

    case 'LOAD_FORECAST':
      return {
        ...state,
        appState: AppState.DASHBOARD,
        forecastData: action.payload,
        errorMessage: null
      };

    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(appStateReducer, {
    appState: AppState.UPLOAD,
    forecastData: null,
    errorMessage: null,
    isUploading: false
  });

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

  const handleFileUpload = async (csvContent: string, file?: File) => {
    if (state.isUploading) {
      return; // Prevent concurrent uploads
    }

    dispatch({ type: 'START_UPLOAD' });

    try {
      const data = await analyzeTravelData(csvContent, file);
      dispatch({ type: 'UPLOAD_SUCCESS', payload: data });
    } catch (error) {
      console.error('[UPLOAD] Error during upload:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to analyze data. Please ensure your CSV format is correct and try again.";
      dispatch({ type: 'UPLOAD_ERROR', payload: errorMessage });
    }
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' });
  };

  const handleSaveForecast = (name: string) => {
    if (!state.forecastData || !user) return;

    const newSaved: SavedForecast = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      createdBy: user.name,
      data: state.forecastData
    };

    const updated = [newSaved, ...savedForecasts];
    setSavedForecasts(updated);
    localStorage.setItem('jaunty_saved_forecasts', JSON.stringify(updated));
  };

  const handleLoadForecast = (forecast: SavedForecast) => {
    dispatch({ type: 'LOAD_FORECAST', payload: forecast.data });
  };

  const handleDeleteForecast = (id: string) => {
    if (user?.role !== 'admin') return; // Strict permission check
    const updated = savedForecasts.filter(f => f.id !== id);
    setSavedForecasts(updated);
    localStorage.setItem('jaunty_saved_forecasts', JSON.stringify(updated));
  };

  // Strict Data Filtering: Do not even pass restricted data to components if user is not admin
  const safeForecastData = React.useMemo(() => {
    if (!state.forecastData) {
      return null;
    }

    if (user?.role === 'admin') {
      return state.forecastData;
    }

    // Analyst View: Strip sensitive insights
    return {
      ...state.forecastData,
      insights: [], // Empty array ensures type safety but removes data
      keyDrivers: []
    };
  }, [state.forecastData, user]);

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header user={user} onLogout={handleLogout} />
      
      <main>
        {state.appState === AppState.UPLOAD && (
          <FileUpload
            onFileUpload={handleFileUpload}
            savedForecasts={savedForecasts}
            onLoadForecast={handleLoadForecast}
            onDeleteForecast={handleDeleteForecast}
            user={user}
          />
        )}

        {state.appState === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <Loader2 className="w-12 h-12 text-brand-600 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">Analyzing Historical Data</h2>
            <p className="text-slate-500 mt-2 max-w-md text-center">
              Analyzing seasonal patterns, booking trends, and calculating your 12-month forecast...
            </p>
          </div>
        )}

        {state.appState === AppState.DASHBOARD && safeForecastData && (
          <ErrorBoundary>
            <Dashboard
              data={safeForecastData}
              onReset={handleReset}
              onSave={handleSaveForecast}
              user={user}
            />
          </ErrorBoundary>
        )}

        {state.appState === AppState.ERROR && (
           <div className="flex flex-col items-center justify-center h-[60vh] px-4">
             <div className="bg-red-50 p-8 rounded-2xl border border-red-100 text-center max-w-lg">
                <h2 className="text-xl font-bold text-red-700 mb-2">Analysis Failed</h2>
                <p className="text-slate-600 mb-6">{state.errorMessage}</p>
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
