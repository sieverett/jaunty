/**
 * PDF Composer Usage Example
 *
 * Demonstrates how to integrate the PDF composition engine
 * with existing JAUNTY application components
 */

import { composePDF, ExportSection, ExportOptions } from './pdfComposer';
import { exportForecastToPDF } from '../pdfExport'; // Existing export function
import { ForecastResponse, DataPoint, User } from '../../types';

/**
 * Enhanced multi-section PDF export function
 * Replaces the single-section approach with comprehensive report generation
 */
export async function exportComprehensiveForecastReport(
  forecastData: ForecastResponse,
  options: {
    user?: User;
    scenarioName?: string;
    companyName?: string;
    filename?: string;
    // Element IDs for different sections
    chartElementId?: string;
    statsElementId?: string;
    insightsElementId?: string;
    funnelElementId?: string;
  } = {}
): Promise<void> {
  const {
    user,
    scenarioName,
    companyName,
    filename,
    chartElementId = 'forecast-chart',
    statsElementId = 'forecast-stats',
    insightsElementId = 'forecast-insights',
    funnelElementId = 'funnel-chart'
  } = options;

  try {
    console.log('Generating comprehensive forecast report...');

    // Prepare export sections
    const sections: ExportSection[] = [];

    // 1. Cover page with key metrics
    sections.push({
      type: 'cover',
      title: 'Executive Summary',
      data: forecastData
    });

    // 2. Main forecast chart (SVG extraction)
    const chartElement = document.getElementById(chartElementId);
    if (chartElement) {
      const svgElement = chartElement.querySelector('svg');
      if (svgElement) {
        const svgDataUrl = await extractSvgAsDataUrl(svgElement);
        sections.push({
          type: 'chart',
          title: 'Revenue Forecast Visualization',
          svgDataUrl
        });
      }
    }

    // 3. Key statistics (canvas rendering)
    const statsElement = document.getElementById(statsElementId);
    if (statsElement) {
      const statsCanvas = await renderElementToCanvas(statsElement);
      sections.push({
        type: 'stats',
        title: 'Key Performance Metrics',
        canvas: statsCanvas
      });
    }

    // 4. Business insights (admin only)
    if (user?.role === 'admin') {
      const insightsElement = document.getElementById(insightsElementId);
      if (insightsElement) {
        const insightsCanvas = await renderElementToCanvas(insightsElement);
        sections.push({
          type: 'insights',
          title: 'Business Insights & Analysis',
          canvas: insightsCanvas
        });
      }

      // 5. Conversion funnel (admin only)
      if (forecastData.funnel) {
        const funnelElement = document.getElementById(funnelElementId);
        if (funnelElement) {
          const funnelCanvas = await renderElementToCanvas(funnelElement);
          sections.push({
            type: 'funnel',
            title: 'Conversion Funnel Analysis',
            canvas: funnelCanvas
          });
        }
      }
    }

    // 6. Data table with all forecast points
    const allData: DataPoint[] = [...forecastData.historical, ...forecastData.forecast];
    sections.push({
      type: 'table',
      title: 'Complete Forecast Dataset',
      tableData: allData
    });

    // Configure export options
    const exportOptions: ExportOptions = {
      filename: filename || `forecast-report-${new Date().toISOString().split('T')[0]}.pdf`,
      includeMetadata: true,
      user,
      scenarioName,
      forecastData,
      companyName: companyName || 'JAUNTY'
    };

    // Generate and download PDF
    console.log(`Generating PDF with ${sections.length} sections...`);
    const pdf = await composePDF(sections, exportOptions);

    // Save the PDF
    pdf.save(exportOptions.filename);

    console.log(`✅ Report exported successfully: ${exportOptions.filename}`);
    console.log(`📄 Generated ${pdf.getNumberOfPages()} pages`);

  } catch (error) {
    console.error('Failed to export comprehensive report:', error);
    throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract SVG element as data URL for PDF embedding
 */
async function extractSvgAsDataUrl(svgElement: SVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Clone SVG to avoid modifying original
      const svgClone = svgElement.cloneNode(true) as SVGElement;

      // Ensure SVG has proper dimensions
      if (!svgClone.getAttribute('width')) {
        svgClone.setAttribute('width', '800');
      }
      if (!svgClone.getAttribute('height')) {
        svgClone.setAttribute('height', '450');
      }

      // Add xmlns if missing
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Serialize SVG to string
      const svgString = new XMLSerializer().serializeToString(svgClone);

      // Create canvas for rasterization
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width || 800;
        canvas.height = img.height || 450;

        // Draw white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw SVG
        ctx.drawImage(img, 0, 0);

        resolve(canvas.toDataURL('image/png', 1.0));
      };

      img.onerror = () => reject(new Error('Failed to rasterize SVG'));

      // Convert SVG to data URL
      const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
      img.src = svgDataUrl;

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render DOM element to canvas using html2canvas
 */
async function renderElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  // Import html2canvas dynamically to avoid build issues
  const html2canvas = (await import('html2canvas')).default;

  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    allowTaint: false,
    foreignObjectRendering: false,
    imageTimeout: 15000,
    removeContainer: true
  });
}

/**
 * Migration helper: Convert from old single-section export to new multi-section
 * This helps transition existing code gradually
 */
export async function migrateToMultiSectionExport(
  elementId: string,
  forecastData: ForecastResponse,
  options: {
    user?: User;
    scenarioName?: string;
    filename?: string;
    useNewComposer?: boolean;
  } = {}
): Promise<void> {
  const { useNewComposer = true, ...exportOptions } = options;

  if (useNewComposer) {
    // Use new multi-section composer
    await exportComprehensiveForecastReport(forecastData, {
      ...exportOptions,
      chartElementId: elementId
    });
  } else {
    // Fall back to original export function
    await exportForecastToPDF(elementId, forecastData, exportOptions);
  }
}

/**
 * Quick export function for single sections
 * Useful for component-level exports
 */
export async function exportSingleSection(
  sectionType: 'chart' | 'stats' | 'insights' | 'funnel',
  elementId: string,
  title: string,
  options: {
    user?: User;
    filename?: string;
  } = {}
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with ID "${elementId}" not found`);
  }

  const sections: ExportSection[] = [];

  if (sectionType === 'chart') {
    const svgElement = element.querySelector('svg');
    if (svgElement) {
      const svgDataUrl = await extractSvgAsDataUrl(svgElement);
      sections.push({
        type: 'chart',
        title,
        svgDataUrl
      });
    }
  } else {
    const canvas = await renderElementToCanvas(element);
    sections.push({
      type: sectionType,
      title,
      canvas
    });
  }

  const exportOptions: ExportOptions = {
    filename: options.filename || `${sectionType}-export-${Date.now()}.pdf`,
    includeMetadata: true,
    user: options.user
  };

  const pdf = await composePDF(sections, exportOptions);
  pdf.save(exportOptions.filename);
}

// Example usage for React components:
/*
// In a React component:
import { exportComprehensiveForecastReport, exportSingleSection } from './utils/pdf/usage-example';

const handleExportReport = async () => {
  await exportComprehensiveForecastReport(forecastData, {
    user: currentUser,
    scenarioName: 'Q4 2024 Projection',
    companyName: 'Acme Corp',
    chartElementId: 'main-forecast-chart',
    statsElementId: 'key-stats-panel',
    insightsElementId: 'insights-panel',
    funnelElementId: 'conversion-funnel'
  });
};

const handleExportChart = async () => {
  await exportSingleSection('chart', 'forecast-visualization', 'Revenue Forecast', {
    user: currentUser,
    filename: 'revenue-chart.pdf'
  });
};
*/