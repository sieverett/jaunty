/**
 * Dashboard Integration Example
 *
 * Shows how to integrate htmlRenderer utilities with the existing Dashboard component
 * for selective PDF export of non-SVG components.
 */

import {
  renderFunnelToCanvas,
  renderStatsToCanvas,
  renderTableToCanvas,
  renderInsightsToCanvas,
  type ForecastMetrics
} from './htmlRenderer';

/**
 * Example integration with Dashboard component
 * This shows how the utilities would be used in practice
 */
export class DashboardPDFRenderer {

  /**
   * Export stats cards section
   * Uses the calculated forecastMetrics from Dashboard component
   */
  static async exportStatsSection(forecastMetrics: ForecastMetrics): Promise<HTMLCanvasElement> {
    if (!forecastMetrics) {
      throw new Error('Forecast metrics are required');
    }

    try {
      return await renderStatsToCanvas(forecastMetrics);
    } catch (error) {
      console.error('Failed to export stats section:', error);
      throw error;
    }
  }

  /**
   * Export funnel chart section
   * Targets the custom FunnelChart component (HTML bars, not SVG)
   */
  static async exportFunnelSection(): Promise<HTMLCanvasElement> {
    const funnelElement = document.querySelector('[data-testid="funnel-chart"]') as HTMLElement;

    if (!funnelElement) {
      throw new Error('Funnel chart element not found. Ensure the FunnelChart component is rendered.');
    }

    try {
      return await renderFunnelToCanvas(funnelElement);
    } catch (error) {
      console.error('Failed to export funnel section:', error);
      throw error;
    }
  }

  /**
   * Export data table section
   * Targets the revenue data table with proper overflow handling
   */
  static async exportTableSection(): Promise<HTMLCanvasElement> {
    // Look for the table container in Dashboard component
    const tableContainer = document.querySelector('#forecast-overview-panel .overflow-x-auto') as HTMLElement;

    if (!tableContainer) {
      throw new Error('Data table element not found. Ensure the table is rendered and visible.');
    }

    try {
      return await renderTableToCanvas(tableContainer);
    } catch (error) {
      console.error('Failed to export table section:', error);
      throw error;
    }
  }

  /**
   * Export insights section (admin-only)
   * Targets the strategic insights section
   */
  static async exportInsightsSection(): Promise<HTMLCanvasElement> {
    const insightsContainer = document.querySelector('.insights-section, [data-section="insights"]') as HTMLElement;

    if (!insightsContainer) {
      throw new Error('Insights section not found. This may be admin-only content.');
    }

    try {
      return await renderInsightsToCanvas(insightsContainer);
    } catch (error) {
      console.error('Failed to export insights section:', error);
      throw error;
    }
  }

  /**
   * Export all Dashboard sections
   * Returns all available canvas elements for comprehensive PDF generation
   */
  static async exportAllSections(forecastMetrics: ForecastMetrics): Promise<{
    stats: HTMLCanvasElement;
    funnel?: HTMLCanvasElement;
    table: HTMLCanvasElement;
    insights?: HTMLCanvasElement;
  }> {
    const results: any = {};

    try {
      // Stats cards are always available
      results.stats = await this.exportStatsSection(forecastMetrics);

      // Table is always available
      results.table = await this.exportTableSection();

      // Funnel might not be available (depends on data)
      try {
        results.funnel = await this.exportFunnelSection();
      } catch (error) {
        console.warn('Funnel section not available:', error.message);
      }

      // Insights might not be available (admin-only)
      try {
        results.insights = await this.exportInsightsSection();
      } catch (error) {
        console.warn('Insights section not available:', error.message);
      }

      return results;
    } catch (error) {
      console.error('Failed to export Dashboard sections:', error);
      throw error;
    }
  }
}

/**
 * Example usage in Dashboard component
 */
export const dashboardExportExample = {

  // How to modify the existing handleSaveClick function in Dashboard.tsx
  handleSaveClickWithSectionExport: async (forecastMetrics: ForecastMetrics, scenarioName: string) => {
    try {
      // Export individual sections as canvases
      const canvases = await DashboardPDFRenderer.exportAllSections(forecastMetrics);

      // These canvases can then be used with jsPDF or other PDF libraries
      // Example:
      // const pdf = new jsPDF();
      // pdf.addImage(canvases.stats.toDataURL('image/png'), 'PNG', 10, 10, 190, 0);
      // if (canvases.funnel) {
      //   pdf.addPage();
      //   pdf.addImage(canvases.funnel.toDataURL('image/png'), 'PNG', 10, 10, 190, 0);
      // }
      // pdf.save(`${scenarioName}.pdf`);

      console.log('Exported sections:', {
        stats: canvases.stats ? 'Available' : 'Missing',
        funnel: canvases.funnel ? 'Available' : 'Missing',
        table: canvases.table ? 'Available' : 'Missing',
        insights: canvases.insights ? 'Available' : 'Missing'
      });

    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }
};