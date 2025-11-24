# JAUNTY Application Bug Fixes Documentation

## Issue #1: Flash-Back-to-Loading Bug

**Date Fixed**: November 23, 2025
**Severity**: Critical - Application unusable for main workflow

### Problem Description
The JAUNTY revenue forecasting application exhibited a critical "flash-back-to-loading" behavior during data upload operations. The symptoms were:

1. User uploads CSV data file
2. Application shows loading screen during analysis
3. Dashboard briefly appears with revenue forecast graph (missing one data point)
4. Application unexpectedly flashes back to the loading screen
5. Dashboard becomes permanently inaccessible

The issue occurred consistently across different datasets and user sessions, making the core forecasting functionality completely unusable.

### Root Cause Analysis
The issue was **NOT** related to React state management, concurrent rendering, or API communication as initially suspected. Through systematic debugging and console log analysis, the actual root cause was identified as:

**Vite Development Server File Watcher Configuration Issue**

- Vite was configured to watch the entire project directory for file changes
- During ML model processing, the backend updates model artifacts in `model/artifacts/xgboost_model.json`
- Vite detected these backend file changes and triggered automatic page reloads
- Page reloads reset the React application state, causing the dashboard to unmount and return to the initial upload state

### Technical Details
**Console Evidence:**
- Vite reload messages: `[vite] (client) page reload model/artifacts/xgboost_model.json`
- React state logs showed `state.forecastData` becoming null after successful API responses
- `safeForecastData` useMemo returning null, causing dashboard unmount

**File Changes During Processing:**
- `backend/model/artifacts/xgboost_model.json` - Updated by ML pipeline
- `backend/model/artifacts/prophet_model.json` - Updated by forecasting engine
- Various Python cache files in `__pycache__/` directories

### Solution Implemented
**File**: `vite.config.ts`
**Change**: Added `watch.ignored` configuration to exclude backend files from Vite's file watcher

```typescript
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        watch: {
          ignored: [
            '**/backend/**',
            '**/model/**',
            '**/*.log',
            '**/venv/**',
            '**/__pycache__/**'
          ]
        }
      },
      // ... rest of config
    };
});
```

### Verification
After implementing the fix:
- No more Vite reload messages during data processing
- React state persists throughout the upload → analysis → dashboard flow
- Dashboard remains stable and functional after data upload
- Console logs show proper state transitions without unexpected resets

### Prevention Measures
1. **Vite Configuration**: Always exclude backend, model artifacts, and generated files from development server file watching
2. **File Structure**: Keep frontend and backend artifacts in separate directories with clear boundaries
3. **Development Monitoring**: Watch for unexpected Vite reload messages during testing

### Lessons Learned
1. **Multi-Service Architecture Considerations**: In full-stack applications with ML components, development server configuration must account for backend file generation
2. **Debugging Approach**: State management issues aren't always in the state management code - external factors like build tools can cause apparent state bugs
3. **Console Monitoring**: Vite reload messages are critical diagnostic information that should be monitored during debugging

### Files Modified
- `vite.config.ts` - Added watch.ignored configuration
- No changes required to React state management code (App.tsx was already correctly implemented)

### Impact
- **Before**: Application completely unusable for primary workflow
- **After**: Stable, reliable upload-to-dashboard flow with persistent state
- **Development**: Eliminates false positive debugging sessions focused on React state management when the issue is in build tooling