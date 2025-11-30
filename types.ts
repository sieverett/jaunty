
export interface DataPoint {
  date: string;
  revenue: number;
  bookings?: number;
  type: 'historical' | 'forecast';
  lower?: number;
  upper?: number;
}

export interface ForecastResponse {
  historical: DataPoint[];
  forecast: DataPoint[];
  insights: string[];
  keyDrivers: string[];
  suggestedParameters: {
    name: string;
    key: string;
    min: number;
    max: number;
    default: number;
    description: string;
  }[];
  funnel?: FunnelData[];  // Optional funnel data
}

export interface SavedForecast {
  id: string;
  name: string;
  createdAt: number;
  createdBy: string;
  data: ForecastResponse;
}

export interface SimulationState {
  [key: string]: number;
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  ANALYZING = 'ANALYZING',
  DASHBOARD = 'DASHBOARD',
  ERROR = 'ERROR'
}

export type Role = 'admin' | 'analyst';

export interface User {
  name: string;
  email: string;
  role: Role;
}

export interface FunnelData {
  stage: string;
  count: number;
  conversionRate?: number;  // % that moved to next stage
  dropOffRate?: number;      // % that didn't progress
  revenuePotential: number;  // Sum of trip_price
  avgDaysInStage?: number;
  color: string;             // Based on conversion rate
}

export interface FunnelChartProps {
  data: FunnelData[];
  showLost?: boolean;        // Include lost leads
  showCancelled?: boolean;   // Include cancelled leads
}
