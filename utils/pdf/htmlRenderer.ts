/**
 * HTML to Canvas Rendering Utilities for PDF Export
 *
 * Simplified approach for rendering Dashboard components to canvas using html2canvas.
 * Focuses on quality and simplicity without complex oklch workarounds.
 */

import html2canvas from 'html2canvas';
import type { FunnelData } from '../../types';

/**
 * Forecast metrics interface based on Dashboard component calculations
 */
export interface ForecastMetrics {
  totalForecastRevenue: number;
  baselineForecastRevenue: number;
  diff: number;
  diffPercent: number;
  forecast1mo: number;
  forecast3mo: number;
  forecast6mo: number;
  compare1mo: number;
  compare3mo: number;
  compare6mo: number;
  avg12mo: number;
}

/**
 * Canvas rendering options for html2canvas
 */
interface RenderOptions {
  scale?: number;
  backgroundColor?: string;
  useCORS?: boolean;
  allowTaint?: boolean;
  logging?: boolean;
  width?: number;
  height?: number;
}

/**
 * Default rendering options optimized for PDF export
 */
const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  scale: 2, // High DPI for sharp text
  backgroundColor: '#ffffff',
  useCORS: true,
  allowTaint: false,
  logging: false,
};

/**
 * Renders a funnel chart element to canvas
 *
 * @param element - HTMLElement containing the funnel chart (custom HTML bars, not SVG)
 * @param options - Optional rendering configuration
 * @returns Promise<HTMLCanvasElement> - Rendered canvas element
 *
 * @example
 * ```typescript
 * const funnelElement = document.getElementById('funnel-chart');
 * const canvas = await renderFunnelToCanvas(funnelElement);
 * ```
 */
export async function renderFunnelToCanvas(
  element: HTMLElement,
  options: RenderOptions = {}
): Promise<HTMLCanvasElement> {
  if (!element) {
    throw new Error('FunnelChart element is required');
  }

  try {
    // Ensure element is visible and properly styled
    const originalDisplay = element.style.display;
    const originalVisibility = element.style.visibility;

    element.style.display = 'block';
    element.style.visibility = 'visible';

    // Wait for any animations or async rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    const renderConfig = {
      ...DEFAULT_RENDER_OPTIONS,
      ...options,
      width: element.offsetWidth || options.width,
      height: element.offsetHeight || options.height,
    };

    const canvas = await html2canvas(element, renderConfig);

    // Restore original styles
    element.style.display = originalDisplay;
    element.style.visibility = originalVisibility;

    return canvas;
  } catch (error) {
    throw new Error(`Failed to render funnel chart to canvas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Renders forecast stats cards to canvas by creating temporary DOM elements
 *
 * @param metrics - ForecastMetrics object containing the calculated metrics
 * @param options - Optional rendering configuration
 * @returns Promise<HTMLCanvasElement> - Rendered canvas element
 *
 * @example
 * ```typescript
 * const metrics = { totalForecastRevenue: 1000000, ... };
 * const canvas = await renderStatsToCanvas(metrics);
 * ```
 */
export async function renderStatsToCanvas(
  metrics: ForecastMetrics,
  options: RenderOptions = {}
): Promise<HTMLCanvasElement> {
  if (!metrics) {
    throw new Error('ForecastMetrics object is required');
  }

  try {
    // Create temporary container with stats cards HTML structure
    const container = createStatsContainer(metrics);

    // Append to document for rendering
    document.body.appendChild(container);

    // Wait for styles to apply
    await new Promise(resolve => setTimeout(resolve, 100));

    const renderConfig = {
      ...DEFAULT_RENDER_OPTIONS,
      ...options,
      width: container.offsetWidth || options.width || 800,
      height: container.offsetHeight || options.height,
    };

    const canvas = await html2canvas(container, renderConfig);

    // Clean up temporary element
    document.body.removeChild(container);

    return canvas;
  } catch (error) {
    // Ensure cleanup on error
    const existingContainer = document.getElementById('temp-stats-container');
    if (existingContainer) {
      document.body.removeChild(existingContainer);
    }
    throw new Error(`Failed to render stats cards to canvas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Renders a data table element to canvas
 *
 * @param element - HTMLElement containing the table
 * @param options - Optional rendering configuration
 * @returns Promise<HTMLCanvasElement> - Rendered canvas element
 *
 * @example
 * ```typescript
 * const tableElement = document.querySelector('.revenue-table');
 * const canvas = await renderTableToCanvas(tableElement);
 * ```
 */
export async function renderTableToCanvas(
  element: HTMLElement,
  options: RenderOptions = {}
): Promise<HTMLCanvasElement> {
  if (!element) {
    throw new Error('Table element is required');
  }

  try {
    // Ensure table is visible and properly formatted
    const originalOverflow = element.style.overflow;
    element.style.overflow = 'visible';

    // Wait for table layout to stabilize
    await new Promise(resolve => setTimeout(resolve, 100));

    const renderConfig = {
      ...DEFAULT_RENDER_OPTIONS,
      ...options,
      width: element.scrollWidth || element.offsetWidth || options.width,
      height: element.scrollHeight || element.offsetHeight || options.height,
    };

    const canvas = await html2canvas(element, renderConfig);

    // Restore original styles
    element.style.overflow = originalOverflow;

    return canvas;
  } catch (error) {
    throw new Error(`Failed to render table to canvas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Renders insights section element to canvas
 *
 * @param element - HTMLElement containing the insights section
 * @param options - Optional rendering configuration
 * @returns Promise<HTMLCanvasElement> - Rendered canvas element
 *
 * @example
 * ```typescript
 * const insightsElement = document.querySelector('.insights-section');
 * const canvas = await renderInsightsToCanvas(insightsElement);
 * ```
 */
export async function renderInsightsToCanvas(
  element: HTMLElement,
  options: RenderOptions = {}
): Promise<HTMLCanvasElement> {
  if (!element) {
    throw new Error('Insights element is required');
  }

  try {
    // Ensure element is visible and text is readable
    const originalWhiteSpace = element.style.whiteSpace;
    element.style.whiteSpace = 'normal';

    // Wait for text layout to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const renderConfig = {
      ...DEFAULT_RENDER_OPTIONS,
      ...options,
      width: element.offsetWidth || options.width,
      height: element.offsetHeight || options.height,
    };

    const canvas = await html2canvas(element, renderConfig);

    // Restore original styles
    element.style.whiteSpace = originalWhiteSpace;

    return canvas;
  } catch (error) {
    throw new Error(`Failed to render insights to canvas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates a temporary DOM container with stats cards HTML structure
 * Replicates the Dashboard stats cards layout with Tailwind classes
 */
function createStatsContainer(metrics: ForecastMetrics): HTMLElement {
  const container = document.createElement('div');
  container.id = 'temp-stats-container';
  container.className = 'bg-white p-6 space-y-4';
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 800px;
    background: white;
    font-family: system-ui, -apple-system, sans-serif;
    z-index: -1;
    visibility: hidden;
  `;

  // Format currency helper
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Primary card: 12 Month Forecast
  const primaryCard = document.createElement('div');
  primaryCard.className = 'bg-white p-6 rounded-lg border border-slate-200 shadow-sm';
  primaryCard.innerHTML = `
    <div class="flex items-center space-x-2 mb-4">
      <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
      <h4 class="text-sm font-semibold text-slate-700">Forecasted Revenue (12 months)</h4>
    </div>
    <p class="text-4xl font-bold text-slate-900 mb-3">
      ${formatCurrency(metrics.totalForecastRevenue)}
    </p>
    <div class="border-t border-slate-200 pt-3">
      <div class="flex items-center space-x-4 text-sm text-slate-600">
        <span>
          ${metrics.diff >= 0 ? '+' : ''}${formatCurrency(metrics.diff)} (${metrics.diffPercent.toFixed(1)}%) vs Baseline
        </span>
        <span class="text-slate-400">|</span>
        <span>
          ${formatCurrency(metrics.avg12mo)}/mo avg
        </span>
      </div>
    </div>
  `;

  // Secondary cards: Short-term Forecasts
  const secondaryCardsContainer = document.createElement('div');
  secondaryCardsContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

  // Helper to create trend indicator
  const getTrendClass = (value: number) => value >= 0 ? 'text-green-600' : 'text-red-600';
  const getTrendIcon = (value: number) => value >= 0 ? '↑' : '↓';

  // 1 Month Card
  const oneMonthCard = document.createElement('div');
  oneMonthCard.className = 'bg-white p-5 rounded-lg border border-slate-200 shadow-sm';
  oneMonthCard.innerHTML = `
    <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">1 Month</p>
    <p class="text-2xl font-bold text-slate-900 mb-2">
      ${formatCurrency(metrics.forecast1mo)}
    </p>
    <div class="flex items-center space-x-1 text-xs font-medium ${getTrendClass(metrics.compare1mo)}">
      <span>${getTrendIcon(metrics.compare1mo)}</span>
      <span>
        ${Math.abs(metrics.compare1mo).toFixed(0)}% vs avg
      </span>
    </div>
  `;

  // 3 Month Card
  const threeMonthCard = document.createElement('div');
  threeMonthCard.className = 'bg-white p-5 rounded-lg border border-slate-200 shadow-sm';
  threeMonthCard.innerHTML = `
    <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">3 Months</p>
    <p class="text-2xl font-bold text-slate-900 mb-2">
      ${formatCurrency(metrics.forecast3mo)}
    </p>
    <div class="flex items-center space-x-1 text-xs font-medium ${getTrendClass(metrics.compare3mo)}">
      <span>${getTrendIcon(metrics.compare3mo)}</span>
      <span>
        ${Math.abs(metrics.compare3mo).toFixed(0)}% vs avg
      </span>
    </div>
  `;

  // 6 Month Card
  const sixMonthCard = document.createElement('div');
  sixMonthCard.className = 'bg-white p-5 rounded-lg border border-slate-200 shadow-sm';
  sixMonthCard.innerHTML = `
    <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">6 Months</p>
    <p class="text-2xl font-bold text-slate-900 mb-2">
      ${formatCurrency(metrics.forecast6mo)}
    </p>
    <div class="flex items-center space-x-1 text-xs font-medium ${getTrendClass(metrics.compare6mo)}">
      <span>${getTrendIcon(metrics.compare6mo)}</span>
      <span>
        ${Math.abs(metrics.compare6mo).toFixed(0)}% vs avg
      </span>
    </div>
  `;

  secondaryCardsContainer.appendChild(oneMonthCard);
  secondaryCardsContainer.appendChild(threeMonthCard);
  secondaryCardsContainer.appendChild(sixMonthCard);

  container.appendChild(primaryCard);
  container.appendChild(secondaryCardsContainer);

  // Apply inline styles for PDF rendering (since Tailwind might not be available)
  applyInlineStyles(container);

  return container;
}

/**
 * Applies inline styles to ensure consistent rendering without external CSS dependencies
 */
function applyInlineStyles(container: HTMLElement): void {
  const styles = {
    '.bg-white': 'background-color: white;',
    '.p-6': 'padding: 1.5rem;',
    '.p-5': 'padding: 1.25rem;',
    '.space-y-4 > * + *': 'margin-top: 1rem;',
    '.rounded-lg': 'border-radius: 0.5rem;',
    '.border': 'border: 1px solid #e2e8f0;',
    '.shadow-sm': 'box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);',
    '.grid': 'display: grid;',
    '.grid-cols-3': 'grid-template-columns: repeat(3, minmax(0, 1fr));',
    '.gap-4': 'gap: 1rem;',
    '.flex': 'display: flex;',
    '.items-center': 'align-items: center;',
    '.space-x-2 > * + *': 'margin-left: 0.5rem;',
    '.space-x-4 > * + *': 'margin-left: 1rem;',
    '.text-4xl': 'font-size: 2.25rem; line-height: 2.5rem;',
    '.text-2xl': 'font-size: 1.5rem; line-height: 2rem;',
    '.text-sm': 'font-size: 0.875rem; line-height: 1.25rem;',
    '.text-xs': 'font-size: 0.75rem; line-height: 1rem;',
    '.font-bold': 'font-weight: 700;',
    '.font-semibold': 'font-weight: 600;',
    '.text-slate-900': 'color: #0f172a;',
    '.text-slate-700': 'color: #334155;',
    '.text-slate-600': 'color: #475569;',
    '.text-green-600': 'color: #16a34a;',
    '.text-red-600': 'color: #dc2626;',
    '.bg-blue-500': 'background-color: #3b82f6;',
    '.w-2': 'width: 0.5rem;',
    '.h-2': 'height: 0.5rem;',
    '.rounded-full': 'border-radius: 9999px;',
    '.mb-2': 'margin-bottom: 0.5rem;',
    '.mb-3': 'margin-bottom: 0.75rem;',
    '.mb-4': 'margin-bottom: 1rem;',
    '.pt-3': 'padding-top: 0.75rem;',
    '.border-t': 'border-top: 1px solid #e2e8f0;',
    '.uppercase': 'text-transform: uppercase;',
    '.tracking-wide': 'letter-spacing: 0.025em;',
  };

  // Apply styles by walking the DOM tree
  const applyStylesToElement = (element: Element) => {
    const classList = Array.from(element.classList);
    let computedStyle = '';

    classList.forEach(className => {
      const styleKey = `.${className}`;
      if (styles[styleKey]) {
        computedStyle += styles[styleKey] + ' ';
      }
    });

    if (computedStyle) {
      (element as HTMLElement).style.cssText += computedStyle;
    }

    // Apply to children
    Array.from(element.children).forEach(applyStylesToElement);
  };

  applyStylesToElement(container);
}

/**
 * Generic function to render any HTMLElement to canvas with error handling
 *
 * @param element - HTMLElement to render
 * @param options - Optional rendering configuration
 * @returns Promise<HTMLCanvasElement> - Rendered canvas element
 */
export async function renderElementToCanvas(
  element: HTMLElement,
  options: RenderOptions = {}
): Promise<HTMLCanvasElement> {
  if (!element) {
    throw new Error('HTMLElement is required');
  }

  try {
    const renderConfig = {
      ...DEFAULT_RENDER_OPTIONS,
      ...options,
    };

    return await html2canvas(element, renderConfig);
  } catch (error) {
    throw new Error(`Failed to render element to canvas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}