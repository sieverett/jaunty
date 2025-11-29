/**
 * Type Definitions for JAUNTY Hybrid PDF Export System
 *
 * Centralized type definitions for PDF generation workflow
 * Supports both SVG (Recharts) and Canvas (HTML) rendering approaches
 */

import type { DataPoint, ForecastResponse, FunnelData, User } from '../../types';

/**
 * Section types supported in PDF export
 */
export type SectionType = 'cover' | 'chart' | 'stats' | 'insights' | 'funnel' | 'table';

/**
 * Individual section definition for PDF composition
 */
export interface ExportSection {
  /** Type of content section */
  type: SectionType;

  /** Section title for headers */
  title: string;

  /** Generic data payload for the section */
  data?: any;

  /** SVG chart as data URL (for Recharts charts) */
  svgDataUrl?: string;

  /** Rendered canvas element (for HTML components) */
  canvas?: HTMLCanvasElement;

  /** Table data for data grid sections */
  tableData?: DataPoint[];
}

/**
 * PDF export configuration options
 */
export interface ExportOptions {
  /** Output filename (without extension) */
  filename?: string;

  /** Include PDF metadata (title, author, etc.) */
  includeMetadata?: boolean;

  /** User generating the report */
  user?: User;

  /** Scenario/forecast name */
  scenarioName?: string;

  /** Full forecast data payload */
  forecastData?: ForecastResponse;

  /** Company/organization name */
  companyName?: string;
}

/**
 * Forecast metrics calculated from Dashboard data
 * Used for stats section rendering
 */
export interface ForecastMetrics {
  /** Total forecasted revenue across all periods */
  totalForecastRevenue: number;

  /** Baseline forecast revenue (no adjustments) */
  baselineForecastRevenue: number;

  /** Absolute difference from baseline */
  diff: number;

  /** Percentage difference from baseline */
  diffPercent: number;

  /** 1-month forward forecast */
  forecast1mo: number;

  /** 3-month forward forecast */
  forecast3mo: number;

  /** 6-month forward forecast */
  forecast6mo: number;

  /** 1-month comparison percentage */
  compare1mo: number;

  /** 3-month comparison percentage */
  compare3mo: number;

  /** 6-month comparison percentage */
  compare6mo: number;

  /** 12-month average */
  avg12mo: number;
}

/**
 * SVG extraction configuration
 */
export interface SvgExtractionOptions {
  /** Canvas width in pixels (default: container width) */
  width?: number;

  /** Canvas height in pixels (default: container height) */
  height?: number;

  /** Scale factor for high-DPI rendering (default: 2) */
  scale?: number;

  /** Background color (default: #ffffff) */
  backgroundColor?: string;

  /** Inline all computed styles into SVG elements */
  inlineStyles?: boolean;

  /** Fix Recharts gradient IDs to avoid conflicts */
  fixGradients?: boolean;

  /** Output format */
  outputFormat?: 'png' | 'svg';
}

/**
 * Result of SVG extraction operation
 */
export interface SvgExtractionResult {
  /** Data URL of extracted/rendered content */
  dataUrl: string;

  /** Original SVG width */
  width: number;

  /** Original SVG height */
  height: number;

  /** Whether extraction was successful */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Recharts chart container structure
 * ResponsiveContainer > div.recharts-wrapper > svg.recharts-surface
 */
export interface RechartsContainerStructure {
  /** Outer ResponsiveContainer element */
  container: HTMLElement;

  /** Inner wrapper div */
  wrapper: HTMLElement | null;

  /** Actual SVG element */
  svg: SVGElement | null;
}
