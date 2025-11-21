# Mock Data Quick Start

## Enable Mock Data Mode

1. **Create `.env.local` file** in the `jaunty/` directory:
   ```env
   VITE_USE_MOCK_DATA=true
   ```

2. **Restart your dev server**:
   ```bash
   npm run dev
   ```

3. **Upload any CSV file** - The app will use mock data instead of calling APIs!

## What's Included

✅ **Realistic mock data** - 24 months historical + 12 months forecast  
✅ **Seasonal patterns** - Realistic travel industry seasonality  
✅ **Growth trends** - Simulated growth patterns  
✅ **Insights & drivers** - Sample strategic insights  
✅ **Simulation parameters** - Ready for scenario testing  

## Test Different Scenarios

In `mockDataService.ts`, you can use different scenarios:

```typescript
import { mockDataScenarios } from './services/mockDataService';

// High growth
const data = mockDataScenarios.highGrowth();

// Stable/declining  
const data = mockDataScenarios.stable();

// Volatile
const data = mockDataScenarios.volatile();
```

## Switch Back to Real API

When ready to test backend:

```env
VITE_USE_MOCK_DATA=false
VITE_API_URL=http://localhost:8000
```

## Files Created

- `services/mockDataService.ts` - Mock data generator
- `services/dataService.ts` - Unified data service (switches between mock/API/Gemini)
- `FRONTEND_DEVELOPMENT_GUIDE.md` - Complete development guide

## Next Steps

1. ✅ Enable mock data mode
2. ✅ Test all dashboard features
3. ✅ Refine UX based on testing
4. ✅ Document backend requirements
5. ✅ Build backend API
6. ✅ Switch to backend when ready

