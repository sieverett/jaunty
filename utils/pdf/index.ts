/**
 * PDF Export Utilities
 *
 * This module provides utilities for exporting Dashboard components to PDF format.
 * Hybrid approach: SVG extraction for Recharts, Canvas rendering for HTML components.
 */

// Type Definitions
export type {
  SectionType,
  ExportSection,
  ExportOptions,
  ForecastMetrics,
  SvgExtractionOptions,
  SvgExtractionResult,
  RechartsContainerStructure
} from './types';

// SVG Extraction (Recharts Charts)
export {
  extractRechartsChart,
  inlineAllComputedStyles,
  fixRechartsGradients,
  svgToDataURL,
  svgToDataURLAsync,
  extractChartAsDataURL
} from './svgExtractor';

// HTML Canvas Renderers (Custom Components)
export {
  renderFunnelToCanvas,
  renderStatsToCanvas,
  renderTableToCanvas,
  renderInsightsToCanvas,
  renderElementToCanvas
} from './htmlRenderer';

// PDF Composition
export {
  composePDF,
  addCoverPage,
  addChartSection,
  addStatsSection,
  addInsightsSection,
  addFunnelSection,
  addTableSection,
  addMetadata
} from './pdfComposer';

// Main PDF Export Orchestrator (V2)
export {
  exportToPDF,
  exportDashboardToPDF,
  buildDashboardSections,
  handleExportError
} from './pdfExportV2';

// Note: For legacy PDF export functionality, import directly from '../pdfExport'