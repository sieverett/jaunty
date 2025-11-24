# Test Upload Flow - Debugging Instructions

## Comprehensive logging has been added to track the flash-back issue.

### What was added:

1. **App.tsx reducer logging** - Every state transition logs:
   - Action type
   - Current state
   - New state
   - Timestamp

2. **App.tsx render logging** - Every render logs:
   - Current appState
   - Whether forecastData exists
   - Upload status
   - Error messages

3. **handleFileUpload logging** - Tracks:
   - Function call
   - Data availability
   - API call start
   - API completion
   - Dispatch events

4. **Dashboard component logging**:
   - Component mount/unmount events
   - Data availability on render
   - Initial simulation state

5. **API service logging**:
   - analyzeTravelData entry/exit
   - fetchFromBackendAPI detailed flow
   - Request/response status
   - Data validation

6. **ErrorBoundary logging**:
   - Any caught rendering errors
   - Component stack traces

7. **Global error handlers**:
   - Unhandled promise rejections
   - Unhandled errors

### How to test:

1. Open browser console (F12)
2. Navigate to http://localhost:3000
3. Login (any credentials)
4. Click "Load Sample Data" button
5. Watch console logs carefully

### What to look for:

**Expected flow:**
```
[UPLOAD] handleFileUpload called
[REDUCER] Action dispatched: START_UPLOAD
[REDUCER] START_UPLOAD -> ANALYZING
[APP] Render: appState: ANALYZING
[UPLOAD] Calling analyzeTravelData...
[API] analyzeTravelData called
[API] fetchFromBackendAPI started
[API] Sending POST request to...
[API] Response received: status: 200, ok: true
[API] Response parsed
[API] Response validated successfully
[UPLOAD] analyzeTravelData completed successfully
[UPLOAD] UPLOAD_SUCCESS dispatched
[REDUCER] Action dispatched: UPLOAD_SUCCESS
[REDUCER] UPLOAD_SUCCESS -> DASHBOARD
[APP] Render: appState: DASHBOARD
[DASHBOARD] Component rendering
[DASHBOARD] Component MOUNTED
```

**If flash-back occurs, look for:**
- Any RESET action that wasn't triggered by clicking "Back to Upload"
- Dashboard UNMOUNTED followed by remounting
- Any ERROR_BOUNDARY catches
- Any GLOBAL unhandled rejections/errors
- Multiple rapid state transitions
- Data becoming null after being set

### Key files modified:

- ./App.tsx
- ./components/Dashboard.tsx
- ./services/dataService.ts
- ./components/ErrorBoundary.tsx
- ./index.tsx

### Next steps after testing:

1. Capture console output during the flash-back
2. Identify which log shows the unexpected behavior
3. Determine root cause from the log sequence
4. Fix the specific issue (not state management - that's already handled)
