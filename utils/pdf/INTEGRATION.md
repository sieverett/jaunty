# Dashboard Integration Guide

Step-by-step guide to replace the old PDF export with the new V2 system.

## Step 1: Update Dashboard Imports

```typescript
// In Dashboard.tsx

// OLD - Remove this
import { exportForecastToPDF } from '../utils/pdfExport';

// NEW - Add this
import { exportDashboardToPDF, handleExportError } from '../utils/pdf/pdfExportV2';
```

## Step 2: Update Export Handler

Replace the existing export handler with the new one:

```typescript
// In Dashboard component

// OLD export handler (remove)
const handleExportPDF = async () => {
  setIsExportingPDF(true);
  setExportError(null);

  try {
    await exportForecastToPDF('forecast-overview-panel', data, {
      filename: 'forecast-analysis',
      includeMetadata: true,
      user,
      scenarioName: undefined
    });
  } catch (error) {
    setExportError(error instanceof Error ? error.message : 'Export failed');
    console.error('PDF Export Error:', error);
  } finally {
    setIsExportingPDF(false);
  }
};

// NEW export handler (add)
const handleExportPDF = async () => {
  setIsExportingPDF(true);
  setExportError(null);

  try {
    await exportDashboardToPDF(
      data,              // ForecastResponse - existing data prop
      simulatedData,     // DataPoint[] - existing calculated data
      forecastMetrics,   // ForecastMetrics - existing calculated metrics
      user,              // User - existing user prop
      undefined,         // Optional: scenario name
      'JAUNTY'          // Optional: company name
    );
  } catch (error) {
    const err = handleExportError(error);
    setExportError(err.message);
    console.error('PDF Export Error:', error);
  } finally {
    setIsExportingPDF(false);
  }
};
```

## Step 3: Add Required Element IDs

Ensure Dashboard components have the correct IDs for extraction:

### Revenue Chart Container

```tsx
// Find the revenue chart in Dashboard.tsx and ensure it has this ID
<div id="revenue-chart-container">
  <ResponsiveContainer width="100%" height={450}>
    <LineChart data={simulatedData}>
      {/* existing chart configuration */}
    </LineChart>
  </ResponsiveContainer>
</div>
```

### Insights Section (Admin Only)

```tsx
// Find the insights section and add ID
{isAdmin && data.insights && data.insights.length > 0 && (
  <div id="insights-section" className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
    <h3 className="text-lg font-semibold text-slate-900 mb-4">
      Key Insights
    </h3>
    <div className="space-y-3">
      {data.insights.map((insight, index) => (
        <div key={index} className="flex items-start space-x-2">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2" />
          <p className="text-sm text-slate-700">{insight}</p>
        </div>
      ))}
    </div>
  </div>
)}
```

### Funnel Chart Container (Admin Only)

```tsx
// Find the funnel chart and add ID
{isAdmin && data.funnel && data.funnel.length > 0 && (
  <div id="funnel-chart-container" className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
    <h3 className="text-lg font-semibold text-slate-900 mb-4">
      Conversion Funnel
    </h3>
    <FunnelChart data={data.funnel} />
  </div>
)}
```

## Step 4: Test the Integration

### Test Cases

1. **Analyst User Export**
   - Login as analyst
   - Load forecast data
   - Click export button
   - Verify PDF contains:
     - Cover page
     - Revenue chart
     - Stats cards
     - Data table
   - No insights or funnel sections

2. **Admin User Export**
   - Login as admin
   - Load forecast data with insights and funnel
   - Click export button
   - Verify PDF contains:
     - Cover page
     - Revenue chart
     - Stats cards
     - Insights section
     - Funnel chart
     - Data table

3. **Error Handling**
   - Test with missing chart element (should show friendly error)
   - Test with very large dataset (should handle pagination)
   - Test in different browsers (Chrome, Firefox, Safari)

## Step 5: Verify Quality

Check the exported PDF for:
- **Charts**: Sharp, readable, no gradient issues
- **Text**: Crisp, properly sized, no stretching
- **Layout**: Professional margins, headers, footers
- **Tables**: Proper pagination, readable data
- **Metadata**: Correct user info, dates, page numbers

## Common Issues and Solutions

### Chart not appearing in PDF

**Problem**: Revenue chart shows as blank or missing

**Solution**:
- Verify element ID: `id="revenue-chart-container"`
- Ensure chart is fully rendered before export
- Check that chart container is visible (not hidden)

```tsx
// Correct structure
<div id="revenue-chart-container">
  <ResponsiveContainer>
    <LineChart>...</LineChart>
  </ResponsiveContainer>
</div>
```

### Insights/Funnel missing

**Problem**: Admin sections not in PDF

**Solution**:
- Check user role: `user.role === 'admin'`
- Verify data exists: `data.insights.length > 0`
- Ensure element ID matches: `id="insights-section"`

```tsx
// Ensure conditional rendering uses correct ID
{isAdmin && data.insights && (
  <div id="insights-section">
    {/* content */}
  </div>
)}
```

### Export hangs or is very slow

**Problem**: Export takes too long or browser freezes

**Solution**:
- Check dataset size (large tables slow down export)
- Reduce scale factor if quality acceptable
- Consider pagination for very large datasets

```typescript
// For large exports, you could modify options
const sections = buildDashboardSections(
  data,
  simulatedData.slice(0, 100), // Limit rows if needed
  forecastMetrics,
  user
);
```

### Poor image quality

**Problem**: Charts appear blurry or pixelated

**Solution**:
- Default scale is 2x (good quality)
- Can increase to 3x for very high quality
- Check chart dimensions in DOM

Note: Current implementation uses 2x scale which provides good balance of quality and performance.

## Rollback Plan

If issues arise, you can quickly revert:

1. Restore old import:
```typescript
import { exportForecastToPDF } from '../utils/pdfExport';
```

2. Restore old handler:
```typescript
await exportForecastToPDF('forecast-overview-panel', data, {
  filename: 'forecast-analysis',
  user,
  scenarioName
});
```

3. Old system still exists at `/utils/pdfExport.ts`

## Performance Comparison

### Old System (pdfExport.ts)
- Single panel export
- HTML cloning with style manipulation
- Complex oklch workarounds
- Single-section PDF
- ~3-5 seconds export time

### New System (pdfExportV2.ts)
- Multi-section export
- SVG extraction for charts (better quality)
- Canvas rendering for HTML
- Role-based sections
- ~4-6 seconds export time
- Better quality output

## Next Steps

After successful integration:

1. Test thoroughly with real users
2. Gather feedback on quality and performance
3. Monitor error logs for any issues
4. Consider removing old pdfExport.ts once stable
5. Add scenario naming feature if needed
6. Consider adding export templates for different report types
