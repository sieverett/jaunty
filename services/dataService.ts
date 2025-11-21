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

import { ForecastResponse } from '../types';

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
    const result = await fetchFromBackendAPI(file);
    return result;
  } catch (error) {
    // Re-throw error so user sees what went wrong
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
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
  
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
        throw new Error('Request timed out. Please try again or use a smaller dataset.');
      }
      // Check for network errors
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('ERR_')) {
        throw new Error(`Cannot connect to backend API at ${API_URL}. Make sure the backend server is running.`);
      }
      throw error;
    }
    
    throw new Error(`Failed to fetch forecast: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get available data sources
 */
export function getDataSource(): 'api' {
  return 'api';
}

