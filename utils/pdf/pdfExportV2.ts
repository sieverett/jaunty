/**
 * PDF Export Orchestrator V2
 *
 * Main entry point for multi-section PDF export system
 * Orchestrates SVG extraction (Recharts), HTML rendering (custom components),
 * and PDF composition for complete forecast reports
 *
 * Integration Points:
 * - svgExtractor: Handles Recharts chart extraction
 * - htmlRenderer: Renders custom HTML components to canvas
 * - pdfComposer: Assembles final multi-page PDF
 * - Dashboard: Source of forecast data and UI state
 */

import type {
  ExportSection,
  ExportOptions,
  ForecastMetrics
} from './types';
import type {
  DataPoint,
  ForecastResponse,
  User
} from '../../types';

import { extractChartAsDataURL } from './svgExtractor';
import {
  renderStatsToCanvas,
  renderInsightsToCanvas,
  renderFunnelToCanvas,
  renderTableToCanvas,
  renderElementToCanvas
} from './htmlRenderer';
import { composePDF } from './pdfComposer';

/**
 * Main PDF export orchestrator
 *
 * Coordinates the complete export pipeline:
 * 1. Extracts Recharts charts as SVG -> PNG data URLs
 * 2. Renders HTML components (stats, insights, funnel) to canvas
 * 3. Composes multi-section PDF with professional layout
 * 4. Downloads final PDF file
 *
 * @param sections - Array of content sections to include
 * @param options - Export configuration and metadata
 *
 * @example
 * ```typescript
 * // From Dashboard component
 * await exportToPDF(
 *   [
 *     { type: 'cover', title: 'Cover Page', data: {} },
 *     { type: 'chart', title: 'Revenue Forecast', chartId: 'revenue-chart' },
 *     { type: 'stats', title: 'Key Stats', metrics: forecastMetrics }
 *   ],
 *   {
 *     filename: 'forecast-analysis',
 *     user: { name: 'John Doe', email: 'john@example.com', role: 'admin' },
 *     forecastData: data,
 *     scenarioName: 'Q4 Forecast'
 *   }
 * );
 * ```
 */
export async function exportToPDF(
  sections: ExportSection[],
  options: ExportOptions = {}
): Promise<void> {
  try {
    // Validate inputs
    if (!sections || sections.length === 0) {
      throw new Error('No sections provided for export');
    }

    // Process sections and prepare data
    const processedSections = await processSections(sections);

    // Compose final PDF
    const pdf = await composePDF(processedSections, options);

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = options.filename || `forecast-analysis-${timestamp}`;

    // Download PDF
    pdf.save(`${filename}.pdf`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('PDF Export Error:', errorMessage);
    throw new Error(`Failed to export PDF: ${errorMessage}`);
  }
}

/**
 * Process sections: extract charts, render components, prepare data
 *
 * Handles the heavy lifting of converting DOM elements to PDF-ready formats
 */
async function processSections(sections: ExportSection[]): Promise<ExportSection[]> {
  const processed: ExportSection[] = [];

  for (const section of sections) {
    try {
      const processedSection = await processSection(section);
      processed.push(processedSection);
    } catch (error) {
      console.warn(`Failed to process section "${section.title}":`, error);
      // Continue processing other sections even if one fails
    }
  }

  return processed;
}

/**
 * Process individual section based on type
 */
async function processSection(section: ExportSection): Promise<ExportSection> {
  switch (section.type) {
    case 'cover':
      // Cover page: no processing needed, just pass through
      return section;

    case 'chart':
      // Extract Recharts chart as SVG data URL
      return await processChartSection(section);

    case 'stats':
      // Render stats cards to canvas
      return await processStatsSection(section);

    case 'insights':
      // Render insights section to canvas
      return await processInsightsSection(section);

    case 'funnel':
      // Render funnel chart to canvas
      return await processFunnelSection(section);

    case 'table':
      // Table data: no processing needed, composer handles rendering
      return section;

    default:
      console.warn(`Unknown section type: ${section.type}`);
      return section;
  }
}

/**
 * Extract Recharts chart and convert to data URL
 */
async function processChartSection(section: ExportSection): Promise<ExportSection> {
  const chartId = section.data?.chartId;

  if (!chartId) {
    throw new Error('Chart section requires chartId in data');
  }

  // Extract chart using SVG extractor
  const result = await extractChartAsDataURL(chartId, {
    scale: 2,
    backgroundColor: '#ffffff',
    outputFormat: 'png'
  });

  if (!result.success) {
    throw new Error(result.error || 'Chart extraction failed');
  }

  return {
    ...section,
    svgDataUrl: result.dataUrl
  };
}

/**
 * Render stats cards to canvas
 */
async function processStatsSection(section: ExportSection): Promise<ExportSection> {
  const metrics = section.data?.metrics as ForecastMetrics;

  if (!metrics) {
    throw new Error('Stats section requires metrics in data');
  }

  // Render using HTML renderer
  const canvas = await renderStatsToCanvas(metrics, {
    scale: 2,
    backgroundColor: '#ffffff'
  });

  return {
    ...section,
    canvas
  };
}

/**
 * Render insights section to canvas
 */
async function processInsightsSection(section: ExportSection): Promise<ExportSection> {
  const elementId = section.data?.elementId;

  if (!elementId) {
    throw new Error('Insights section requires elementId in data');
  }

  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Insights element not found: ${elementId}`);
  }

  const canvas = await renderInsightsToCanvas(element, {
    scale: 2,
    backgroundColor: '#ffffff'
  });

  return {
    ...section,
    canvas
  };
}

/**
 * Render funnel chart to canvas
 */
async function processFunnelSection(section: ExportSection): Promise<ExportSection> {
  const elementId = section.data?.elementId;

  if (!elementId) {
    throw new Error('Funnel section requires elementId in data');
  }

  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Funnel element not found: ${elementId}`);
  }

  const canvas = await renderFunnelToCanvas(element, {
    scale: 2,
    backgroundColor: '#ffffff'
  });

  return {
    ...section,
    canvas
  };
}

/**
 * Helper function to build section list for Dashboard export
 *
 * Creates appropriate sections based on user role and available data
 *
 * @param forecastData - Full forecast response data
 * @param simulatedData - Data with simulation parameters applied
 * @param forecastMetrics - Calculated forecast metrics
 * @param user - Current user (determines role-based sections)
 * @param scenarioName - Optional scenario name
 *
 * @example
 * ```typescript
 * // In Dashboard component
 * const sections = buildDashboardSections(
 *   data,
 *   simulatedData,
 *   forecastMetrics,
 *   user,
 *   'Q4 Forecast'
 * );
 * await exportToPDF(sections, { user, forecastData: data });
 * ```
 */
export function buildDashboardSections(
  forecastData: ForecastResponse,
  simulatedData: DataPoint[],
  forecastMetrics: ForecastMetrics,
  user: User,
  scenarioName?: string
): ExportSection[] {
  const sections: ExportSection[] = [];

  // 1. Cover page
  sections.push({
    type: 'cover',
    title: 'Cover Page',
    data: {}
  });

  // 2. Revenue chart (always included)
  sections.push({
    type: 'chart',
    title: 'Revenue Forecast',
    data: {
      chartId: 'revenue-chart-container'
    }
  });

  // 3. Key statistics (always included)
  sections.push({
    type: 'stats',
    title: 'Key Statistics',
    data: {
      metrics: forecastMetrics
    }
  });

  // 4. Insights (admin only)
  if (user.role === 'admin' && forecastData.insights && forecastData.insights.length > 0) {
    sections.push({
      type: 'insights',
      title: 'Insights & Analysis',
      data: {
        elementId: 'insights-section'
      }
    });
  }

  // 5. Funnel chart (admin only, if funnel data exists)
  if (user.role === 'admin' && forecastData.funnel && forecastData.funnel.length > 0) {
    sections.push({
      type: 'funnel',
      title: 'Conversion Funnel',
      data: {
        elementId: 'funnel-chart-container'
      }
    });
  }

  // 6. Data table (always included)
  sections.push({
    type: 'table',
    title: 'Forecast Data',
    tableData: simulatedData
  });

  return sections;
}

/**
 * Simplified export function for Dashboard component
 *
 * Handles all the boilerplate of building sections and export options
 *
 * @param forecastData - Forecast response from API
 * @param simulatedData - Data with simulation parameters applied
 * @param forecastMetrics - Calculated metrics
 * @param user - Current user
 * @param scenarioName - Optional scenario name
 * @param companyName - Optional company name for branding
 *
 * @example
 * ```typescript
 * // In Dashboard component export handler
 * try {
 *   await exportDashboardToPDF(
 *     data,
 *     simulatedData,
 *     forecastMetrics,
 *     user,
 *     'Q4 2024 Forecast',
 *     'JAUNTY'
 *   );
 * } catch (error) {
 *   console.error('Export failed:', error);
 * }
 * ```
 */
export async function exportDashboardToPDF(
  forecastData: ForecastResponse,
  simulatedData: DataPoint[],
  forecastMetrics: ForecastMetrics,
  user: User,
  scenarioName?: string,
  companyName?: string
): Promise<void> {
  // Build sections based on available data and user role
  const sections = buildDashboardSections(
    forecastData,
    simulatedData,
    forecastMetrics,
    user,
    scenarioName
  );

  // Export options
  const options: ExportOptions = {
    filename: scenarioName
      ? `forecast-${scenarioName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`
      : undefined,
    includeMetadata: true,
    user,
    scenarioName,
    forecastData,
    companyName: companyName || 'JAUNTY'
  };

  // Execute export
  await exportToPDF(sections, options);
}

/**
 * Error handling wrapper for Dashboard integration
 *
 * Provides user-friendly error messages and logging
 *
 * @returns Error object with user-friendly message
 */
export function handleExportError(error: unknown): Error {
  if (error instanceof Error) {
    // Known error types
    if (error.message.includes('not found')) {
      return new Error('Could not find chart or component to export. Please ensure all content is visible.');
    }
    if (error.message.includes('extraction failed')) {
      return new Error('Failed to extract chart. Try refreshing the page and trying again.');
    }
    if (error.message.includes('canvas')) {
      return new Error('Failed to render component. Your browser may not support this feature.');
    }

    return error;
  }

  return new Error('An unexpected error occurred during PDF export');
}
