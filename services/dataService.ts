/**
 * Data Service - Unified interface for data fetching
 * 
 * This service provides a single interface that can switch between:
 * - Real API calls (primary)
 * - Gemini AI (fallback if API not available)
 * 
 * Usage:
 * - Set VITE_API_URL for backend API mode (defaults to http://localhost:8000)
 * - Mock data has been removed - use real backend API only
 */

import { ForecastResponse, FunnelData } from '../types';

// API_URL: Default to localhost if not explicitly set
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Analyze travel data from CSV content
 * 
 * This function uses the backend API only - no mock data fallback.
 * Errors will be thrown if the API fails.
 */
export async function analyzeTravelData(
  csvContent: string,
  file?: File
): Promise<ForecastResponse> {
  // Use backend API (required - no mock data fallback)
  if (!file) {
    throw new Error('File is required. Please upload a CSV file.');
  }

  if (!API_URL) {
    throw new Error('API URL not configured. Please set VITE_API_URL in your environment.');
  }

  try {
    return await fetchFromBackendAPI(file);
  } catch (error) {
    console.error('[API] Error in analyzeTravelData:', error);
    throw error;
  }
}

/**
 * Fetch forecast from backend API
 */
async function fetchFromBackendAPI(file: File): Promise<ForecastResponse> {
  if (!API_URL) {
    throw new Error('API URL not configured');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('train_models', 'true'); // Always retrain models on new data to ensure forecasts match the uploaded dataset

  const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '60000', 10); // Default 60 seconds

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT);

  try {
    const response = await fetch(`${API_URL}/dashboard/forecast`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.detail || errorBody.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Validate response structure
    if (!data.historical || !data.forecast) {
      throw new Error('Invalid response format from backend API');
    }

    return data as ForecastResponse;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('[API] Request aborted (timeout)');
        throw new Error('Request timed out. Please try again or use a smaller dataset.');
      }
      // Check for network errors
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('ERR_')) {
        console.error('[API] Network error:', error.message);
        throw new Error(`Cannot connect to backend API at ${API_URL}. Make sure the backend server is running.`);
      }
      console.error('[API] Other error:', error);
      throw error;
    }

    console.error('[API] Unknown error:', error);
    throw new Error(`Failed to fetch forecast: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get available data sources
 */
export function getDataSource(): 'api' {
  return 'api';
}

/**
 * Get funnel data with optional date filtering
 */
export async function getFunnelData(startDate?: string, endDate?: string): Promise<FunnelData[]> {
  if (!API_URL) {
    throw new Error('API URL not configured');
  }

  try {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const queryString = params.toString();
    const url = `${API_URL}/funnel${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.detail || errorBody.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    // Backend returns { funnel: [...] }, extract the array
    return (data.funnel || []) as FunnelData[];
  } catch (error) {
    console.error('[API] Error fetching funnel data:', error);
    throw error;
  }
}

/**
 * Get available date range for funnel data
 */
export async function getFunnelDateRange(): Promise<{ minDate: string; maxDate: string }> {
  if (!API_URL) {
    throw new Error('API URL not configured');
  }

  try {
    const response = await fetch(`${API_URL}/funnel/date-range`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.detail || errorBody.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    // Map snake_case from backend to camelCase for frontend
    return {
      minDate: data.min_date,
      maxDate: data.max_date
    };
  } catch (error) {
    console.error('[API] Error fetching funnel date range:', error);
    throw error;
  }
}

/**
 * Generate full report from uploaded file
 */
export async function generateFullReport(file: File): Promise<any> {
  if (!API_URL) {
    throw new Error('API URL not configured');
  }

  const formData = new FormData();
  formData.append('file', file);

  const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '120000', 10); // 2 minutes for report generation

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT);

  try {
    const response = await fetch(`${API_URL}/report`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Failed to generate report: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Report generation timed out. Please try again or use a smaller dataset.');
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('ERR_')) {
        throw new Error(`Cannot connect to backend API at ${API_URL}. Make sure the backend server is running.`);
      }
      throw error;
    }

    throw new Error(`Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate full report from existing data (when file is not available)
 * Used when loading saved analyses
 */
export async function generateReportFromData(metadata: any, forecast: any[]): Promise<any> {
  if (!API_URL) {
    throw new Error('API URL not configured');
  }

  const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '120000', 10);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT);

  try {
    const response = await fetch(`${API_URL}/report/from-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ metadata, forecast }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Failed to generate report: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Report generation timed out. Please try again.');
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error(`Cannot connect to backend API at ${API_URL}. Make sure the backend server is running.`);
      }
      throw error;
    }

    throw new Error(`Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

