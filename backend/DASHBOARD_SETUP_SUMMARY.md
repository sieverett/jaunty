# Dashboard API Setup - Quick Summary

## What You Need

The dashboard needs data in this format:
- **Historical revenue** (monthly data points)
- **Forecast revenue** (12 months)
- **Insights** (AI-generated analysis)
- **Key drivers** (revenue factors)
- **Suggested parameters** (for scenario simulation)

## Current Situation

- ✅ Backend has `/forecast` endpoint
- ❌ Response format doesn't match dashboard needs
- ❌ Missing historical data in response
- ❌ Missing insights and key drivers

## Solution Options

### Option 1: Create New Endpoint (Recommended)

Create `/dashboard/forecast` that returns data in dashboard format.

**Pros:**
- Clean, optimized for dashboard
- Includes all required data
- No frontend transformation needed

**Steps:**
1. Add `DashboardForecastResponse` model to `main.py`
2. Create `/dashboard/forecast` endpoint (see `DASHBOARD_API_GUIDE.md`)
3. Update frontend to call new endpoint

### Option 2: Transform Existing Response

Modify frontend to transform `/forecast` response.

**Pros:**
- No backend changes
- Quick to implement

**Cons:**
- Frontend transformation logic needed
- Historical data may require separate call

## Quick Implementation

See `DASHBOARD_API_GUIDE.md` for complete code examples.

**Key Endpoint Structure:**
```python
@app.post("/dashboard/forecast", response_model=DashboardForecastResponse)
async def get_dashboard_forecast(...):
    # 1. Load data and generate forecast
    # 2. Extract historical monthly revenue
    # 3. Transform forecast data
    # 4. Generate insights from metadata
    # 5. Extract key drivers from dataset stats
    # 6. Return formatted response
```

## Testing

```bash
# Test in Swagger UI
http://localhost:8000/docs

# Or with curl
curl -X POST "http://localhost:8000/dashboard/forecast" \
  -F "file=@../../data/test_data.csv" \
  -F "train_models=false"
```

## Next Steps

1. ✅ Read `DASHBOARD_API_GUIDE.md` for detailed implementation
2. ✅ Implement `/dashboard/forecast` endpoint
3. ✅ Update frontend API service
4. ✅ Test with dashboard component
5. ✅ Add error handling

