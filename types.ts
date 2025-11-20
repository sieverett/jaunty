
export interface DataPoint {
  date: string;
  revenue: number;
  bookings?: number;
  type: 'historical' | 'forecast';
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
