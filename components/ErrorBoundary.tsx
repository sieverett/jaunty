import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    console.error('[ERROR_BOUNDARY] getDerivedStateFromError called', error);
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ERROR_BOUNDARY] componentDidCatch called');
    console.error('[ERROR_BOUNDARY] Error:', error);
    console.error('[ERROR_BOUNDARY] ErrorInfo:', errorInfo);
    console.error('[ERROR_BOUNDARY] Component stack:', errorInfo.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-[60vh] px-4">
          <div className="bg-red-50 p-8 rounded-2xl border border-red-100 text-center max-w-lg">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 mb-2">Something went wrong</h2>
            <p className="text-slate-600 mb-6">
              {this.state.error?.message || 'An unexpected error occurred while rendering the dashboard.'}
            </p>
            <button
              onClick={this.handleReset}
              className="flex items-center space-x-2 mx-auto px-6 py-2 bg-white border border-red-200 text-red-700 font-medium rounded-lg hover:bg-red-50 transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}