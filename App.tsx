
import React, { useState, useEffect, useReducer } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { Auth } from './components/Auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { analyzeTravelData } from './services/dataService';
import { AppState, ForecastResponse, User, SavedForecast } from './types';
import { Loader2 } from 'lucide-react';

interface LoadingStage {
  title: string;
  description: string;
}

const LOADING_STAGES: LoadingStage[] = [
  {
    title: "Uploading data...",
    description: "Securely transferring your CSV file to our analysis server"
  },
  {
    title: "Validating CSV format...",
    description: "Checking data structure and ensuring all required fields are present"
  },
  {
    title: "Training prediction models...",
    description: "Building Prophet time series and XGBoost models from your historical data"
  },
  {
    title: "Generating 12-month forecast...",
    description: "Calculating revenue predictions based on seasonal patterns and trends"
  },
  {
    title: "Calculating insights...",
    description: "Analyzing key drivers, funnel metrics, and performance indicators"
  }
];

const STAGE_DURATIONS = [2000, 2000, 11000, 10000, 5000]; // milliseconds for each stage

// App state reducer for atomic updates
interface AppStateData {
  appState: AppState;
  forecastData: ForecastResponse | null;
  errorMessage: string | null;
  isUploading: boolean;
  uploadedFile: File | null;
}

type AppStateAction =
  | { type: 'START_UPLOAD'; file: File }
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
        errorMessage: null,
        uploadedFile: action.file
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
        isUploading: false,
        uploadedFile: null
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
    isUploading: false,
    uploadedFile: null
  });

  const [user, setUser] = useState<User | null>(null);
  const [savedForecasts, setSavedForecasts] = useState<SavedForecast[]>([]);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);

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

  // Manage loading stage transitions
  useEffect(() => {
    if (state.appState !== AppState.ANALYZING) {
      setLoadingStageIndex(0);
      return;
    }

    // Start at stage 0
    setLoadingStageIndex(0);

    // Set up timers for each stage transition
    const timers: NodeJS.Timeout[] = [];
    let accumulatedTime = 0;

    for (let i = 0; i < STAGE_DURATIONS.length - 1; i++) {
      accumulatedTime += STAGE_DURATIONS[i];
      const timer = setTimeout(() => {
        setLoadingStageIndex(i + 1);
      }, accumulatedTime);
      timers.push(timer);
    }

    // Cleanup timers on unmount or state change
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [state.appState]);

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

    if (!file) {
      dispatch({ type: 'UPLOAD_ERROR', payload: 'No file provided' });
      return;
    }

    dispatch({ type: 'START_UPLOAD', file });

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
            <h2 className="text-xl font-semibold text-slate-900">
              {LOADING_STAGES[loadingStageIndex].title}
            </h2>
            <p className="text-slate-500 mt-2 max-w-md text-center">
              {LOADING_STAGES[loadingStageIndex].description}
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
              uploadedFile={state.uploadedFile}
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
