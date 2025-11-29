# JAUNTY PDF Export System V2

Hybrid PDF export system combining SVG extraction (Recharts) and HTML rendering (custom components) for high-quality forecast reports.

## Architecture

```
pdfExportV2.ts (orchestrator)
├── svgExtractor.ts (Recharts charts → SVG → PNG)
├── htmlRenderer.ts (Custom HTML → Canvas)
└── pdfComposer.ts (Multi-section PDF assembly)
```

## Overview

Complete PDF export pipeline that handles different content types appropriately:
- **Recharts charts**: SVG extraction with gradient fix → PNG
- **Custom components**: HTML rendering via html2canvas
- **Multi-section PDFs**: Professional A4 layout with headers/footers

## Quick Start - Dashboard Integration

### Replace Existing Export

```typescript
// In Dashboard.tsx
import { exportDashboardToPDF, handleExportError } from '../utils/pdf/pdfExportV2';

const handleExportPDF = async () => {
  setIsExportingPDF(true);
  setExportError(null);

  try {
    await exportDashboardToPDF(
      data,              // ForecastResponse
      simulatedData,     // DataPoint[] with simulations
      forecastMetrics,   // Calculated metrics
      user,              // User with role
      'Q4 2024 Forecast', // Optional scenario
      'JAUNTY'           // Optional company name
    );
  } catch (error) {
    const err = handleExportError(error);
    setExportError(err.message);
  } finally {
    setIsExportingPDF(false);
  }
};
```

### Role-Based Sections

**Analyst Role**: Cover, Revenue Chart, Stats, Data Table

**Admin Role**: Cover, Revenue Chart, Stats, Insights, Funnel (if data exists), Data Table

## Core Functions

### `exportDashboardToPDF()` - Main Entry Point

Simplified function for Dashboard component. Automatically builds sections based on user role and available data.

```typescript
await exportDashboardToPDF(
  forecastData: ForecastResponse,
  simulatedData: DataPoint[],
  forecastMetrics: ForecastMetrics,
  user: User,
  scenarioName?: string,
  companyName?: string
): Promise<void>
```

### `exportToPDF()` - Advanced Export

For custom section configurations:

```typescript
const sections = [
  { type: 'cover', title: 'Cover Page', data: {} },
  { type: 'chart', title: 'Revenue Forecast', data: { chartId: 'revenue-chart-container' } },
  { type: 'stats', title: 'Key Statistics', data: { metrics: forecastMetrics } },
  { type: 'table', title: 'Data', tableData: simulatedData }
];

await exportToPDF(sections, {
  filename: 'custom-report',
  user,
  forecastData,
  scenarioName
});
```

### `buildDashboardSections()` - Section Builder

Build section array automatically:

```typescript
const sections = buildDashboardSections(
  forecastData,
  simulatedData,
  forecastMetrics,
  user,
  scenarioName
);
```

## Component Functions

### `renderFunnelToCanvas(element: HTMLElement): Promise<HTMLCanvasElement>`

Renders custom FunnelChart HTML bars to canvas. The FunnelChart component uses custom HTML/CSS bars rather than SVG elements from recharts.

```typescript
import { renderFunnelToCanvas } from '@/utils/pdf/htmlRenderer';

const funnelElement = document.querySelector('[data-component="funnel-chart"]');
const canvas = await renderFunnelToCanvas(funnelElement);
```

### `renderStatsToCanvas(metrics: ForecastMetrics): Promise<HTMLCanvasElement>`

Renders Dashboard stats cards by creating temporary DOM elements with the same Tailwind structure.

```typescript
import { renderStatsToCanvas } from '@/utils/pdf/htmlRenderer';

const forecastMetrics = {
  totalForecastRevenue: 1000000,
  baselineForecastRevenue: 900000,
  diff: 100000,
  diffPercent: 11.1,
  forecast1mo: 83333,
  forecast3mo: 250000,
  forecast6mo: 500000,
  compare1mo: 15.2,
  compare3mo: 12.8,
  compare6mo: 10.5,
  avg12mo: 83333
};

const canvas = await renderStatsToCanvas(forecastMetrics);
```

### `renderTableToCanvas(element: HTMLElement): Promise<HTMLCanvasElement>`

Renders data table elements with proper overflow handling.

```typescript
import { renderTableToCanvas } from '@/utils/pdf/htmlRenderer';

const tableElement = document.querySelector('.revenue-table');
const canvas = await renderTableToCanvas(tableElement);
```

### `renderInsightsToCanvas(element: HTMLElement): Promise<HTMLCanvasElement>`

Renders insights section with proper text layout handling.

```typescript
import { renderInsightsToCanvas } from '@/utils/pdf/htmlRenderer';

const insightsElement = document.querySelector('.insights-section');
const canvas = await renderInsightsToCanvas(insightsElement);
```

### `renderElementToCanvas(element: HTMLElement, options?): Promise<HTMLCanvasElement>`

Generic function to render any HTMLElement with custom options.

```typescript
import { renderElementToCanvas } from '@/utils/pdf/htmlRenderer';

const canvas = await renderElementToCanvas(element, {
  scale: 3, // Higher DPI
  backgroundColor: '#f8fafc',
  width: 1200,
  height: 800
});
```

## Features

- **High DPI Support**: 2x scale by default for sharp text and graphics
- **Tailwind Compatibility**: Proper handling of Tailwind CSS classes
- **Responsive Layouts**: Supports flexible and responsive component layouts
- **Error Handling**: Comprehensive error handling with descriptive messages
- **TypeScript**: Full TypeScript support with proper type definitions
- **Simplified Approach**: No complex oklch color workarounds needed

## Usage in Dashboard Component

The Dashboard component can use these utilities to export specific sections:

```typescript
import {
  renderStatsToCanvas,
  renderFunnelToCanvas,
  renderTableToCanvas
} from '@/utils/pdf/htmlRenderer';

// Export stats section
const exportStats = async (forecastMetrics) => {
  const canvas = await renderStatsToCanvas(forecastMetrics);
  // Use canvas in PDF generation
};

// Export funnel chart
const exportFunnel = async () => {
  const funnelElement = document.getElementById('funnel-chart');
  const canvas = await renderFunnelToCanvas(funnelElement);
  // Use canvas in PDF generation
};
```

## Canvas to PDF Integration

The returned canvas elements can be easily integrated with jsPDF:

```typescript
import jsPDF from 'jspdf';
import { renderStatsToCanvas } from '@/utils/pdf/htmlRenderer';

const pdf = new jsPDF();
const canvas = await renderStatsToCanvas(metrics);
const imgData = canvas.toDataURL('image/png');

pdf.addImage(imgData, 'PNG', 10, 10, 190, 0); // Auto height
pdf.save('dashboard-stats.pdf');
```

## Error Handling

All functions include comprehensive error handling:

- **Element validation**: Ensures HTMLElement exists before rendering
- **Cleanup**: Proper cleanup of temporary DOM elements
- **Descriptive errors**: Clear error messages for debugging
- **Style restoration**: Restores original element styles after rendering

## Performance Notes

- **2x scale default**: Good balance between quality and performance
- **Temporary DOM manipulation**: Minimal impact on existing page layout
- **Efficient cleanup**: Immediate cleanup of temporary elements
- **Async rendering**: Non-blocking canvas generation

## Browser Support

Requires modern browser support for:
- html2canvas (latest version 1.4.1)
- Canvas API
- Promises/async-await
- Modern DOM APIs

## DOM Element Requirements

For export to work, Dashboard components must have proper element IDs:

```tsx
// Revenue Chart (required)
<div id="revenue-chart-container">
  <ResponsiveContainer width="100%" height={450}>
    <LineChart data={simulatedData}>
      {/* Recharts chart */}
    </LineChart>
  </ResponsiveContainer>
</div>

// Insights Section (admin only)
<div id="insights-section" className="bg-white p-6">
  {data.insights.map(insight => (
    <p key={insight}>{insight}</p>
  ))}
</div>

// Funnel Chart (admin only, if funnel data exists)
<div id="funnel-chart-container">
  <FunnelChart data={data.funnel} />
</div>
```

## Section Types Reference

### Cover Page
```typescript
{ type: 'cover', title: 'Cover Page', data: {} }
```
Professional cover with company name, report title, metrics summary, user attribution.

### Chart (Recharts)
```typescript
{
  type: 'chart',
  title: 'Revenue Forecast',
  data: { chartId: 'revenue-chart-container' }
}
```
Extracts SVG chart, fixes gradients, converts to high-DPI PNG.

### Stats Cards
```typescript
{
  type: 'stats',
  title: 'Key Statistics',
  data: {
    metrics: {
      totalForecastRevenue: 1000000,
      baselineForecastRevenue: 900000,
      diff: 100000,
      diffPercent: 11.1,
      forecast1mo: 85000,
      forecast3mo: 250000,
      forecast6mo: 500000,
      compare1mo: 5.5,
      compare3mo: 8.2,
      compare6mo: 10.1,
      avg12mo: 83333
    }
  }
}
```
Programmatically renders forecast metrics to canvas.

### Insights (Admin)
```typescript
{
  type: 'insights',
  title: 'Insights & Analysis',
  data: { elementId: 'insights-section' }
}
```
Renders insights section from DOM.

### Funnel (Admin)
```typescript
{
  type: 'funnel',
  title: 'Conversion Funnel',
  data: { elementId: 'funnel-chart-container' }
}
```
Renders custom funnel visualization.

### Data Table
```typescript
{
  type: 'table',
  title: 'Forecast Data',
  tableData: simulatedData // DataPoint[]
}
```
Renders paginated data table directly in PDF.

## Migration from Old Export

### Before (pdfExport.ts)
```typescript
import { exportForecastToPDF } from '../utils/pdfExport';

await exportForecastToPDF('forecast-overview-panel', data, {
  filename: 'forecast-analysis',
  user,
  scenarioName
});
```

### After (pdfExportV2.ts)
```typescript
import { exportDashboardToPDF, handleExportError } from '../utils/pdf/pdfExportV2';

try {
  await exportDashboardToPDF(
    data,
    simulatedData,
    forecastMetrics,
    user,
    scenarioName,
    'JAUNTY'
  );
} catch (error) {
  const err = handleExportError(error);
  setExportError(err.message);
}
```

## Troubleshooting

**Charts not in PDF**
- Verify element ID matches: `id="revenue-chart-container"`
- Ensure chart is visible when export runs
- Check browser console for extraction errors

**Blank pages**
- Element ID doesn't exist in DOM
- Component hidden/collapsed during export
- Canvas rendering not supported in browser

**Poor quality**
- Increase scale in options (default: 2x)
- Check chart/component dimensions
- Verify fonts loaded

**Slow export**
- Large datasets cause table pagination
- Reduce number of sections
- Lower scale factor if quality acceptable