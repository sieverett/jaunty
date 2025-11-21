# Frontend Development Guide - Mock Data Setup

This guide explains how to develop and test the frontend independently using mock data, before connecting to the backend API.

## Why Mock Data First?

- ✅ **Faster iteration** - No need to wait for backend API
- ✅ **Test edge cases** - Easy to create different scenarios
- ✅ **UX validation** - Ensure UI/UX is right before backend changes
- ✅ **Offline development** - Work without network dependencies
- ✅ **Cost savings** - No API calls during development

## Quick Start

### Step 1: Enable Mock Data Mode

Create or update `.env.local` in the `jaunty/` directory:

```env
# Enable mock data mode
VITE_USE_MOCK_DATA=true

# Optional: Set API URL for when you're ready to test backend
# VITE_API_URL=http://localhost:8000
```

### Step 2: Update App.tsx to Use Data Service

Replace the direct import of `geminiService` with the unified `dataService`:

```typescript
// Before:
import { analyzeTravelData } from './services/geminiService';

// After:
import { analyzeTravelData } from './services/dataService';
```

### Step 3: Update File Upload Handler

The `handleFileUpload` function should pass the File object if available:

```typescript
const handleFileUpload = async (csvContent: string, file?: File) => {
  setAppState(AppState.ANALYZING);
  try {
    const data = await analyzeTravelData(csvContent, file);
    setForecastData(data);
    setAppState(AppState.DASHBOARD);
  } catch (error) {
    console.error(error);
    setErrorMessage("Failed to analyze data. Please ensure your CSV format is correct and try again.");
    setAppState(AppState.ERROR);
  }
};
```

And update `FileUpload.tsx` to pass the file:

```typescript
// In FileUpload component
const processFile = (file: File | undefined) => {
  // ... existing validation ...
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result as string;
    if (!content) {
      setError("File is empty.");
      return;
    }
    onFileUpload(content, file); // Pass file object
  };
  reader.readAsText(file);
};
```

## Mock Data Features

### Realistic Data Generation

The mock service generates:
- **24 months of historical data** with realistic seasonality
- **12 months of forecast** with growth trends
- **Insights** based on typical travel industry patterns
- **Key drivers** reflecting common revenue factors
- **Suggested parameters** for scenario simulation

### Data Scenarios

Test different scenarios using `mockDataScenarios`:

```typescript
import { mockDataScenarios } from './services/mockDataService';

// High growth scenario
const highGrowthData = mockDataScenarios.highGrowth();

// Stable/declining scenario
const stableData = mockDataScenarios.stable();

// Volatile scenario
const volatileData = mockDataScenarios.volatile();
```

## Testing Different UX Flows

### 1. Test Loading States

Mock data includes a configurable delay (default: 1.5s):

```typescript
// In mockDataService.ts
await mockAnalyzeTravelData(csvContent, 2000); // 2 second delay
```

### 2. Test Error States

Modify `dataService.ts` to simulate errors:

```typescript
if (USE_MOCK_DATA) {
  // Simulate error 10% of the time
  if (Math.random() < 0.1) {
    throw new Error('Simulated API error');
  }
  return mockAnalyzeTravelData(csvContent);
}
```

### 3. Test Empty States

Create mock data with empty arrays:

```typescript
const emptyData: ForecastResponse = {
  historical: [],
  forecast: [],
  insights: [],
  keyDrivers: [],
  suggestedParameters: []
};
```

### 4. Test Edge Cases

- Very large numbers (revenue in millions)
- Negative growth scenarios
- Missing optional fields
- Invalid date formats

## Switching Between Modes

### Development Mode (Mock Data)

```env
VITE_USE_MOCK_DATA=true
```

### Backend Testing Mode

```env
VITE_USE_MOCK_DATA=false
VITE_API_URL=http://localhost:8000
```

### Production Mode (Gemini AI)

```env
VITE_USE_MOCK_DATA=false
# VITE_API_URL not set
VITE_GEMINI_API_KEY=your_key
```

## Data Source Indicator

Add a visual indicator to show which data source is active:

```typescript
import { getDataSource } from './services/dataService';

function DataSourceIndicator() {
  const source = getDataSource();
  const labels = {
    mock: '📦 Mock Data',
    api: '🌐 Backend API',
    gemini: '🤖 Gemini AI'
  };
  
  return (
    <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-3 py-2 rounded-lg text-xs">
      {labels[source]}
    </div>
  );
}
```

## Validating Frontend Requirements

As you develop the frontend, document any changes needed in the backend:

### Checklist

- [ ] **Data Structure** - Does the mock data match what backend will return?
- [ ] **Error Handling** - Are all error cases handled gracefully?
- [ ] **Loading States** - Are loading indicators appropriate?
- [ ] **Empty States** - What happens with no data?
- [ ] **Edge Cases** - Very large/small numbers, missing fields?
- [ ] **Performance** - Does the UI handle large datasets smoothly?
- [ ] **Accessibility** - Are charts and data accessible?
- [ ] **Responsive Design** - Does it work on mobile/tablet?

### Document Backend Requirements

Create a `BACKEND_REQUIREMENTS.md` file documenting:

```markdown
# Backend API Requirements (from Frontend)

## Endpoint: POST /dashboard/forecast

### Required Response Format
- historical: Array<DataPoint> (24 months)
- forecast: Array<DataPoint> (12 months)
- insights: string[] (5-7 items)
- keyDrivers: string[] (5-7 items)
- suggestedParameters: Parameter[] (4-6 items)

### Data Point Format
- date: "YYYY-MM-DD" format
- revenue: number (no decimals needed)
- bookings?: number (optional)
- type: "historical" | "forecast"

### Error Handling
- 400: Invalid CSV format
- 500: Server error
- Response should include `detail` field with error message

### Performance
- Response time should be < 5 seconds
- Support files up to 10MB
```

## Next Steps

1. ✅ Set up mock data service
2. ✅ Test all dashboard features with mock data
3. ✅ Validate UX and make improvements
4. ✅ Document backend requirements
5. ✅ Implement backend API to match requirements
6. ✅ Switch to backend API for testing
7. ✅ Deploy!

## Tips

- **Keep mock data realistic** - Use actual patterns from your industry
- **Test with different scenarios** - High growth, stable, volatile
- **Simulate delays** - Make sure loading states work properly
- **Test error cases** - Network errors, invalid data, etc.
- **Document everything** - Requirements, edge cases, UX decisions

## Troubleshooting

### Mock data not loading
- Check `.env.local` has `VITE_USE_MOCK_DATA=true`
- Restart dev server after changing env vars
- Check browser console for errors

### Want to test with real API
- Set `VITE_USE_MOCK_DATA=false`
- Set `VITE_API_URL=http://localhost:8000`
- Ensure backend is running

### Want to use Gemini AI
- Set `VITE_USE_MOCK_DATA=false`
- Don't set `VITE_API_URL`
- Ensure `VITE_GEMINI_API_KEY` is set

