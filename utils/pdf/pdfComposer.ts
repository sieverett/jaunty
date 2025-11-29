/**
 * PDF Composition Engine
 *
 * Multi-section PDF generation orchestrator for JAUNTY reports
 * Handles cover page, charts (SVG), stats/insights/funnel (canvas), and table sections
 * Professional A4 layout with Jaunty branding, headers, footers, and page numbering
 */

import jsPDF from 'jspdf';
import { DataPoint, ForecastResponse, FunnelData } from '../../types';

// A4 dimensions in mm
const A4_WIDTH = 210;
const A4_HEIGHT = 297;

// Professional margins
const MARGINS = {
  TOP: 20,
  BOTTOM: 20,
  LEFT: 15,
  RIGHT: 15
} as const;

// Layout constants
const HEADER_HEIGHT = 30;
const FOOTER_HEIGHT = 18;
const CONTENT_WIDTH = A4_WIDTH - MARGINS.LEFT - MARGINS.RIGHT;
const CONTENT_HEIGHT = A4_HEIGHT - MARGINS.TOP - MARGINS.BOTTOM - HEADER_HEIGHT - FOOTER_HEIGHT;

// Jaunty Brand Colors (RGB values)
const BRAND_COLORS = {
  primary: [14, 165, 233],      // #0ea5e9 - brand-500
  primaryDark: [3, 105, 161],   // #0369a1 - brand-700
  primaryLight: [56, 189, 248], // #38bdf8 - brand-400
  accent: [125, 211, 252],      // #7dd3fc - brand-300
  light: [240, 249, 255],       // #f0f9ff - brand-50
  lighter: [224, 242, 254],     // #e0f2fe - brand-100
  dark: [7, 89, 133],           // #075985 - brand-800
  darkest: [12, 74, 110],       // #0c4a6e - brand-900
  text: [15, 23, 42],           // slate-900
  textMuted: [71, 85, 105],     // slate-600
  textLight: [100, 116, 139],   // slate-500
  border: [226, 232, 240],      // slate-200
  background: [248, 250, 252],  // slate-50
} as const;

// Logo configuration
const LOGO = {
  width: 72,
  height: 18,
  // Base64 will be loaded dynamically to avoid large inline strings
} as const;

export interface ExportSection {
  type: 'cover' | 'chart' | 'stats' | 'insights' | 'funnel' | 'table';
  title: string;
  data?: any;
  svgDataUrl?: string;
  canvas?: HTMLCanvasElement;
  tableData?: DataPoint[];
}

export interface ExportOptions {
  filename?: string;
  includeMetadata?: boolean;
  user?: {
    name: string;
    email: string;
    role: 'admin' | 'analyst';
  };
  scenarioName?: string;
  forecastData?: ForecastResponse;
  companyName?: string;
}

/**
 * Load and convert logo to base64 for PDF embedding
 */
async function loadLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch('/header_logo.png');
    if (!response.ok) {
      console.warn('Logo fetch failed:', response.status);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Could not load logo for PDF:', error);
    return null;
  }
}

/**
 * Draw Jaunty logo on PDF
 */
function drawLogo(pdf: jsPDF, logoBase64: string, x: number, y: number, width: number, height: number): void {
  try {
    pdf.addImage(logoBase64, 'PNG', x, y, width, height);
  } catch (error) {
    // Fallback: Draw a simple branded text logo
    pdf.setFontSize(12);
    pdf.setTextColor(...BRAND_COLORS.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.text('JAUNTY', x, y + height / 2);
  }
}

/**
 * Draw branded section divider
 */
function drawSectionDivider(pdf: jsPDF, y: number, title?: string): void {
  // Background gradient effect (simulated with rectangles)
  pdf.setFillColor(...BRAND_COLORS.lighter);
  pdf.rect(MARGINS.LEFT, y - 5, CONTENT_WIDTH, 3, 'F');

  pdf.setFillColor(...BRAND_COLORS.light);
  pdf.rect(MARGINS.LEFT, y - 2, CONTENT_WIDTH, 1, 'F');

  // Primary brand line
  pdf.setDrawColor(...BRAND_COLORS.primary);
  pdf.setLineWidth(1.5);
  pdf.line(MARGINS.LEFT, y, A4_WIDTH - MARGINS.RIGHT, y);

  if (title) {
    // Title background
    const textWidth = pdf.getTextWidth(title);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(MARGINS.LEFT + 10, y - 8, textWidth + 8, 12, 2, 2, 'F');

    // Title text
    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND_COLORS.primaryDark);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, MARGINS.LEFT + 14, y - 1);
  }
}

/**
 * Main PDF composition orchestrator
 * Generates multi-section professional PDF report with Jaunty branding
 */
export async function composePDF(
  sections: ExportSection[],
  options: ExportOptions = {}
): Promise<jsPDF> {
  const pdf = new jsPDF('p', 'mm', 'a4');

  // Load logo for branding
  const logoBase64 = await loadLogoBase64();

  let isFirstPage = true;

  for (const section of sections) {
    if (!isFirstPage) {
      pdf.addPage();
    }

    switch (section.type) {
      case 'cover':
        addCoverPage(pdf, section.data, options, logoBase64);
        break;
      case 'chart':
        if (section.svgDataUrl && section.title) {
          addChartSection(pdf, section.svgDataUrl, section.title);
        }
        break;
      case 'stats':
        if (section.canvas) {
          addStatsSection(pdf, section.canvas);
        }
        break;
      case 'insights':
        if (section.canvas) {
          addInsightsSection(pdf, section.canvas);
        }
        break;
      case 'funnel':
        if (section.canvas) {
          addFunnelSection(pdf, section.canvas);
        }
        break;
      case 'table':
        if (section.tableData) {
          addTableSection(pdf, section.tableData);
        }
        break;
    }

    isFirstPage = false;
  }

  // Add branded metadata to all pages
  if (options.includeMetadata !== false) {
    addMetadata(pdf, options, logoBase64);
  }

  return pdf;
}

/**
 * Generate professional cover page with Jaunty branding and key metrics
 */
export function addCoverPage(pdf: jsPDF, data: any, options: ExportOptions = {}, logoBase64?: string | null): void {
  const { forecastData, scenarioName, companyName, user } = options;

  // Header background - white to match logo background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, A4_WIDTH, 50, 'F');

  // Brand accent strip
  pdf.setFillColor(...BRAND_COLORS.primary);
  pdf.rect(0, 45, A4_WIDTH, 5, 'F');

  // Logo placement
  if (logoBase64) {
    drawLogo(pdf, logoBase64, MARGINS.LEFT, 15, LOGO.width, LOGO.height);
  }

  // Report type with enhanced styling
  pdf.setFontSize(28);
  pdf.setTextColor(...BRAND_COLORS.text);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Forecast Analysis Report', MARGINS.LEFT, 80);

  // Decorative line under title
  pdf.setDrawColor(...BRAND_COLORS.accent);
  pdf.setLineWidth(2);
  pdf.line(MARGINS.LEFT, 85, MARGINS.LEFT + 80, 85);

  // Scenario name with brand styling
  if (scenarioName) {
    pdf.setFontSize(18);
    pdf.setTextColor(...BRAND_COLORS.primaryDark);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Scenario Analysis:', MARGINS.LEFT, 110);

    pdf.setFontSize(16);
    pdf.setTextColor(...BRAND_COLORS.textMuted);
    pdf.setFont('helvetica', 'normal');
    pdf.text(scenarioName, MARGINS.LEFT, 125);
  }

  // Date with improved formatting
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  pdf.setFontSize(12);
  pdf.setTextColor(...BRAND_COLORS.textLight);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated: ${dateStr}`, MARGINS.LEFT, scenarioName ? 145 : 125);

  // Key metrics section if forecast data available
  if (forecastData) {
    const totalForecast = forecastData.forecast.reduce((sum, d) => sum + d.revenue, 0);
    const totalHistorical = forecastData.historical.reduce((sum, d) => sum + d.revenue, 0);
    const avgMonthly = totalForecast / 12;
    const growth = ((totalForecast - totalHistorical) / totalHistorical) * 100;

    const summaryY = scenarioName ? 165 : 145;

    // Section divider with branding
    drawSectionDivider(pdf, summaryY, 'Executive Summary');

    // Enhanced metrics container with brand styling
    const boxY = summaryY + 15;
    const boxHeight = 90;

    // Gradient background effect
    pdf.setFillColor(...BRAND_COLORS.lighter);
    pdf.roundedRect(MARGINS.LEFT, boxY, CONTENT_WIDTH, boxHeight, 5, 5, 'F');

    pdf.setFillColor(...BRAND_COLORS.light);
    pdf.roundedRect(MARGINS.LEFT + 3, boxY + 3, CONTENT_WIDTH - 6, boxHeight - 6, 3, 3, 'F');

    // Branded border
    pdf.setDrawColor(...BRAND_COLORS.primary);
    pdf.setLineWidth(1.5);
    pdf.roundedRect(MARGINS.LEFT, boxY, CONTENT_WIDTH, boxHeight, 5, 5, 'D');

    // Metrics content with enhanced typography
    const metricsX = MARGINS.LEFT + 15;
    let metricsY = boxY + 25;
    const valueX = metricsX + 80;

    // 12-Month Forecast Total
    pdf.setFontSize(14);
    pdf.setTextColor(...BRAND_COLORS.primaryDark);
    pdf.setFont('helvetica', 'bold');
    pdf.text('12-Month Forecast Total:', metricsX, metricsY);

    pdf.setFontSize(20);
    pdf.setTextColor(...BRAND_COLORS.text);
    pdf.setFont('helvetica', 'bold');
    pdf.text(formatCurrency(totalForecast), valueX, metricsY);

    // Average Monthly
    metricsY += 25;
    pdf.setFontSize(12);
    pdf.setTextColor(...BRAND_COLORS.textMuted);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Average Monthly:', metricsX, metricsY);

    pdf.setFontSize(14);
    pdf.setTextColor(...BRAND_COLORS.text);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatCurrency(avgMonthly), valueX, metricsY);

    // Projected Growth with enhanced styling
    metricsY += 20;
    pdf.setFontSize(12);
    pdf.setTextColor(...BRAND_COLORS.textMuted);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Projected Growth:', metricsX, metricsY);

    const growthColor = growth >= 0 ? [22, 163, 74] : [220, 38, 38];
    pdf.setFontSize(16);
    pdf.setTextColor(growthColor[0], growthColor[1], growthColor[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`, valueX, metricsY);

    // Growth indicator icon (simple text-based)
    pdf.setFontSize(12);
    pdf.text(growth >= 0 ? '↗' : '↘', valueX + 35, metricsY);
  }

  // Enhanced footer with brand styling
  if (user) {
    const footerY = A4_HEIGHT - 35;

    // Footer background with brand accent
    pdf.setFillColor(...BRAND_COLORS.lighter);
    pdf.rect(0, footerY - 5, A4_WIDTH, 35, 'F');

    pdf.setFillColor(...BRAND_COLORS.primary);
    pdf.rect(0, footerY - 5, A4_WIDTH, 2, 'F');

    pdf.setFontSize(11);
    pdf.setTextColor(...BRAND_COLORS.textMuted);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Prepared by:', MARGINS.LEFT, footerY + 10);

    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND_COLORS.text);
    pdf.setFont('helvetica', 'normal');
    pdf.text(user.name, MARGINS.LEFT + 25, footerY + 10);

    if (user.email) {
      pdf.setFontSize(9);
      pdf.setTextColor(...BRAND_COLORS.textLight);
      pdf.text(user.email, MARGINS.LEFT, footerY + 22);
    }

    // Company branding in footer
    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND_COLORS.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.text('JauntyForecast Analytics', A4_WIDTH - MARGINS.RIGHT, footerY + 22, { align: 'right' });
  }
}

/**
 * Add chart section with SVG content and brand styling
 */
export function addChartSection(pdf: jsPDF, svgDataUrl: string, title: string): void {
  // Branded section divider and title
  const titleY = MARGINS.TOP + HEADER_HEIGHT + 20;
  drawSectionDivider(pdf, titleY - 5, 'Chart Analysis');

  pdf.setFontSize(20);
  pdf.setTextColor(...BRAND_COLORS.text);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, MARGINS.LEFT, titleY + 10);

  // Calculate image dimensions maintaining aspect ratio
  const availableWidth = CONTENT_WIDTH - 10; // Add some padding
  const availableHeight = CONTENT_HEIGHT - 50; // Leave space for title and padding

  // Assume 16:9 aspect ratio for charts, adjust as needed
  const imageWidth = availableWidth;
  const imageHeight = (availableWidth * 9) / 16;

  const finalHeight = Math.min(imageHeight, availableHeight);
  const finalWidth = imageWidth * (finalHeight / imageHeight);

  // Center image horizontally with brand container
  const containerX = MARGINS.LEFT + 5;
  const containerY = titleY + 25;

  // Add subtle brand border around chart
  pdf.setDrawColor(...BRAND_COLORS.border);
  pdf.setLineWidth(1);
  pdf.roundedRect(containerX - 5, containerY - 5, finalWidth + 10, finalHeight + 10, 3, 3, 'D');

  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(containerX - 3, containerY - 3, finalWidth + 6, finalHeight + 6, 2, 2, 'F');

  const imageX = containerX;
  const imageY = containerY;

  try {
    pdf.addImage(svgDataUrl, 'PNG', imageX, imageY, finalWidth, finalHeight);
  } catch (error) {
    // Fallback if image fails
    pdf.setFontSize(12);
    pdf.setTextColor(220, 38, 38);
    pdf.text('Chart rendering failed', imageX, imageY + 20);
  }
}

/**
 * Add stats section with canvas content
 */
export function addStatsSection(pdf: jsPDF, canvas: HTMLCanvasElement): void {
  addCanvasSection(pdf, canvas, 'Key Statistics');
}

/**
 * Add insights section with canvas content (admin only)
 */
export function addInsightsSection(pdf: jsPDF, canvas: HTMLCanvasElement): void {
  addCanvasSection(pdf, canvas, 'Insights & Analysis');
}

/**
 * Add funnel section with canvas content (admin only)
 */
export function addFunnelSection(pdf: jsPDF, canvas: HTMLCanvasElement): void {
  addCanvasSection(pdf, canvas, 'Conversion Funnel');
}

/**
 * Generic canvas section renderer with brand styling
 */
function addCanvasSection(pdf: jsPDF, canvas: HTMLCanvasElement, title: string): void {
  // Branded section divider and title
  const titleY = MARGINS.TOP + HEADER_HEIGHT + 20;
  drawSectionDivider(pdf, titleY - 5, 'Analytics');

  pdf.setFontSize(20);
  pdf.setTextColor(...BRAND_COLORS.text);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, MARGINS.LEFT, titleY + 10);

  const canvasDataUrl = canvas.toDataURL('image/png', 1.0);

  // Calculate scaling to fit content area with brand container
  const canvasAspectRatio = canvas.width / canvas.height;
  const availableWidth = CONTENT_WIDTH - 10;
  const availableHeight = CONTENT_HEIGHT - 50;
  const availableAspectRatio = availableWidth / availableHeight;

  let scaledWidth: number;
  let scaledHeight: number;

  if (canvasAspectRatio > availableAspectRatio) {
    // Canvas is wider - fit to width
    scaledWidth = availableWidth;
    scaledHeight = scaledWidth / canvasAspectRatio;
  } else {
    // Canvas is taller - fit to height
    scaledHeight = availableHeight;
    scaledWidth = scaledHeight * canvasAspectRatio;
  }

  // Center content with brand styling
  const containerX = MARGINS.LEFT + (CONTENT_WIDTH - scaledWidth) / 2;
  const containerY = titleY + 25;

  // Add brand border around content
  pdf.setDrawColor(...BRAND_COLORS.border);
  pdf.setLineWidth(1);
  pdf.roundedRect(containerX - 5, containerY - 5, scaledWidth + 10, scaledHeight + 10, 3, 3, 'D');

  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(containerX - 3, containerY - 3, scaledWidth + 6, scaledHeight + 6, 2, 2, 'F');

  const imageX = containerX;
  const imageY = containerY;

  try {
    pdf.addImage(canvasDataUrl, 'PNG', imageX, imageY, scaledWidth, scaledHeight);
  } catch (error) {
    // Fallback if image fails
    pdf.setFontSize(12);
    pdf.setTextColor(220, 38, 38);
    pdf.text('Content rendering failed', imageX, imageY + 20);
  }
}

/**
 * Add table section with pagination support and brand styling
 */
export function addTableSection(pdf: jsPDF, data: DataPoint[]): void {
  // Filter to show only forecast data (exclude historical data)
  const forecastData = data.filter(point => point.type === 'forecast');

  // Branded section divider and title
  const titleY = MARGINS.TOP + HEADER_HEIGHT + 20;
  drawSectionDivider(pdf, titleY - 5, 'Data Table');

  pdf.setFontSize(20);
  pdf.setTextColor(...BRAND_COLORS.text);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Forecast Data', MARGINS.LEFT, titleY + 10);

  // Table configuration with enhanced spacing
  const tableStartY = titleY + 35;
  const rowHeight = 9;
  const headerHeight = 12;
  const colWidths = [45, 55, 45, 45]; // Date, Revenue, Bookings, Type
  const totalTableWidth = colWidths.reduce((sum, w) => sum + w, 0);

  // Center table horizontally
  const tableStartX = MARGINS.LEFT + (CONTENT_WIDTH - totalTableWidth) / 2;

  let currentY = tableStartY;
  const maxRowsPerPage = Math.floor((CONTENT_HEIGHT - 80) / rowHeight);
  let rowCount = 0;
  let pageCount = 1;

  // Enhanced table headers with brand styling
  function drawTableHeaders(y: number): number {
    // Header background with brand gradient
    pdf.setFillColor(...BRAND_COLORS.primary);
    pdf.roundedRect(tableStartX, y, totalTableWidth, headerHeight, 2, 2, 'F');

    // Header text
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');

    let x = tableStartX;
    const headers = ['Date', 'Revenue', 'Bookings', 'Type'];
    headers.forEach((header, i) => {
      pdf.text(header, x + 8, y + 8);
      x += colWidths[i];
    });

    return y + headerHeight;
  }

  currentY = drawTableHeaders(currentY);

  // Table rows
  forecastData.forEach((point, index) => {
    // Check if we need a new page
    if (rowCount >= maxRowsPerPage) {
      pdf.addPage();
      pageCount++;
      currentY = MARGINS.TOP + HEADER_HEIGHT + 20;

      // Repeat section title and headers on new page
      pdf.setFontSize(18);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Forecast Data (continued)', MARGINS.LEFT, currentY);
      currentY += 20;

      currentY = drawTableHeaders(currentY);
      rowCount = 0;
    }

    // Enhanced row background (alternating with brand colors)
    if (index % 2 === 0) {
      pdf.setFillColor(...BRAND_COLORS.light);
      pdf.rect(tableStartX, currentY, totalTableWidth, rowHeight, 'F');
    } else {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(tableStartX, currentY, totalTableWidth, rowHeight, 'F');
    }

    // Subtle row borders with brand color
    pdf.setDrawColor(...BRAND_COLORS.border);
    pdf.setLineWidth(0.5);
    pdf.rect(tableStartX, currentY, totalTableWidth, rowHeight, 'D');

    // Enhanced row data typography
    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND_COLORS.text);
    pdf.setFont('helvetica', 'normal');

    let x = tableStartX;
    const rowData = [
      new Date(point.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      formatCurrency(point.revenue),
      point.bookings ? point.bookings.toString() : 'N/A',
      point.type
    ];

    rowData.forEach((text, i) => {
      pdf.text(text, x + 8, currentY + 6.5);
      x += colWidths[i];
    });

    currentY += rowHeight;
    rowCount++;
  });
}

/**
 * Add branded metadata (headers and footers) to all pages
 */
export function addMetadata(pdf: jsPDF, options: ExportOptions, logoBase64?: string | null): void {
  const pageCount = pdf.getNumberOfPages();
  const { user, scenarioName, forecastData } = options;

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);

    // Branded Header
    if (i > 1) { // Skip header on cover page
      const headerY = 18;

      // Header background - white to match logo background
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, A4_WIDTH, HEADER_HEIGHT, 'F');

      // Brand accent line
      pdf.setFillColor(...BRAND_COLORS.primary);
      pdf.rect(0, HEADER_HEIGHT - 3, A4_WIDTH, 3, 'F');

      // Logo in header
      if (logoBase64) {
        drawLogo(pdf, logoBase64, MARGINS.LEFT, 8, 48, 12);
      }


      // Date (right aligned) with improved styling
      const dateStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      pdf.setFontSize(9);
      pdf.setTextColor(...BRAND_COLORS.textLight);
      pdf.setFont('helvetica', 'normal');
      pdf.text(dateStr, A4_WIDTH - MARGINS.RIGHT, headerY + 4, { align: 'right' });
    }

    // Enhanced Footer with branding
    const footerY = A4_HEIGHT - 12;

    // Footer background with brand styling
    pdf.setFillColor(...BRAND_COLORS.lighter);
    pdf.rect(0, A4_HEIGHT - FOOTER_HEIGHT, A4_WIDTH, FOOTER_HEIGHT, 'F');

    // Brand accent line at top of footer
    pdf.setFillColor(...BRAND_COLORS.primary);
    pdf.rect(0, A4_HEIGHT - FOOTER_HEIGHT, A4_WIDTH, 2, 'F');

    // Page number with brand styling
    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND_COLORS.primaryDark);
    pdf.setFont('helvetica', 'bold');
    pdf.text(
      `Page ${i} of ${pageCount}`,
      A4_WIDTH - MARGINS.RIGHT,
      footerY,
      { align: 'right' }
    );

    // User info (left side) with improved styling
    if (user) {
      pdf.setFontSize(8);
      pdf.setTextColor(...BRAND_COLORS.textMuted);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${user.name}`, MARGINS.LEFT, footerY);
    }

    // Scenario name (center) with brand color
    if (scenarioName && i > 1) {
      pdf.setFontSize(8);
      pdf.setTextColor(...BRAND_COLORS.textLight);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`Scenario: ${scenarioName}`, A4_WIDTH / 2, footerY, { align: 'center' });
    }

    // Company watermark
    if (!scenarioName && i > 1) {
      pdf.setFontSize(7);
      pdf.setTextColor(...BRAND_COLORS.textLight);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Navigate Your Business Future', A4_WIDTH / 2, footerY, { align: 'center' });
    }
  }
}

/**
 * Format currency for PDF display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}