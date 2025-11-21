# Dashboard API Setup Guide

This guide explains how to set up endpoints to fetch data for the dashboard charts.

## Dashboard Data Requirements

The dashboard (`Dashboard.tsx`) expects a `ForecastResponse` object with the following structure:

```typescript
interface ForecastResponse {
  historical: DataPoint[];        // Historical monthly revenue data
  forecast: DataPoint[];          // 12-month forecast data
  insights: string[];              // AI-generated insights
  keyDrivers: string[];           // Key revenue drivers
  suggestedParameters: {          // Parameters for scenario simulation
    name: string;
    key: string;
    min: number;
    max: number;
    default: number;
    description: string;
  }[];
}

interface DataPoint {
  date: string;                   // Format: "YYYY-MM-DD" or "YYYY-MM"
  revenue: number;                // Revenue amount
  bookings?: number;              // Optional: number of bookings
  type: 'historical' | 'forecast';
}
```

## Current Backend Response Format

The existing `/forecast` endpoint returns:
```json
{
  "forecast": [
    {
      "date": "2024-12-01",
      "forecast": 25000.0,
      "lower": 17500.0,
      "upper": 32500.0
    }
  ],
  "summary": {...},
  "metadata": {...}
}
```

## Solution: Create a Dashboard-Specific Endpoint

We need to create a new endpoint `/dashboard/forecast` that transforms the forecast data into the dashboard format.

### Step 1: Add Dashboard Response Model

Add to `main.py`:

```python
class DashboardDataPoint(BaseModel):
    """Data point for dashboard charts"""
    date: str
    revenue: float
    bookings: Optional[int] = None
    type: Literal['historical', 'forecast']

class DashboardForecastResponse(BaseModel):
    """Response model for dashboard forecast endpoint"""
    historical: List[DashboardDataPoint]
    forecast: List[DashboardDataPoint]
    insights: List[str]
    keyDrivers: List[str]
    suggestedParameters: List[dict]
```

### Step 2: Create Dashboard Endpoint

Add this endpoint to `main.py`:

```python
@app.post("/dashboard/forecast", response_model=DashboardForecastResponse)
async def get_dashboard_forecast(
    file: UploadFile = File(..., description="CSV file with historical booking data"),
    forecast_date: Optional[str] = Form(None, description="Forecast reference date (YYYY-MM-DD). Defaults to today."),
    train_models: bool = Form(False, description="Whether to train models before forecasting")
):
    """
    Generate forecast data formatted for the dashboard.
    
    This endpoint returns data in the exact format expected by the frontend dashboard,
    including historical data, forecast data, insights, and simulation parameters.
    """
    global pipeline
    
    if pipeline is None:
        raise HTTPException(
            status_code=500,
            detail="Pipeline not initialized. Please check server logs."
        )
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV file"
        )
    
    try:
        # Read CSV file
        contents = await file.read()
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as tmp_file:
            tmp_file.write(contents)
            tmp_file_path = tmp_file.name
        
        try:
            # Train models if requested
            if train_models:
                print("Training models from provided data...")
                pipeline.train(tmp_file_path)
                print("Training completed successfully")
            else:
                # Check if models are loaded
                if pipeline.inference.prophet_model is None:
                    raise HTTPException(
                        status_code=400,
                        detail="Models not trained. Set train_models=true or train models separately."
                    )
            
            # Load data to get historical revenue
            pipeline.data = pipeline.data_loader.load_csv(tmp_file_path)
            monthly_revenue = pipeline.data_loader.prepare_monthly_revenue()
            
            # Generate forecast
            forecast_df = pipeline.forecast(
                csv_path=tmp_file_path,
                forecast_date=forecast_date
            )
            
            # Transform historical data
            historical_data = []
            for _, row in monthly_revenue.iterrows():
                historical_data.append({
                    "date": row['date'].strftime('%Y-%m-%d'),
                    "revenue": float(row['revenue']),
                    "type": "historical"
                })
            
            # Transform forecast data
            forecast_data = []
            for _, row in forecast_df.iterrows():
                forecast_data.append({
                    "date": row['date'].strftime('%Y-%m-%d'),
                    "revenue": float(row['forecast']),
                    "type": "forecast"
                })
            
            # Generate insights from metadata (or use report generator)
            dataset_stats = get_dataset_stats(pipeline)
            metrics = get_training_metrics(pipeline)
            
            # Extract key insights from dataset stats
            insights = []
            if dataset_stats.get("available", False):
                conv_rate = dataset_stats.get("conversion_rate", {})
                if conv_rate.get("rate", 0) > 30:
                    insights.append(f"Strong conversion rate of {conv_rate.get('rate', 0):.1f}% indicates effective sales processes.")
                
                revenue_stats = dataset_stats.get("revenue_stats", {})
                if revenue_stats:
                    avg_trip = revenue_stats.get("average_trip_value", 0)
                    insights.append(f"Average trip value of ${avg_trip:,.0f} provides solid revenue foundation.")
            
            # Extract key drivers from dataset stats
            key_drivers = []
            if dataset_stats.get("available", False):
                source_dist = dataset_stats.get("lead_source_distribution", {})
                if source_dist:
                    top_source = max(source_dist.items(), key=lambda x: x[1])
                    key_drivers.append(f"{top_source[0]} is the primary lead source ({top_source[1]} leads)")
                
                dest_dist = dataset_stats.get("destination_distribution", {})
                if dest_dist:
                    top_dest = max(dest_dist.items(), key=lambda x: x[1])
                    key_drivers.append(f"{top_dest[0]} is the most popular destination ({top_dest[1]} trips)")
            
            # Default suggested parameters for scenario simulation
            suggested_parameters = [
                {
                    "name": "Growth Rate",
                    "key": "Growth Rate",
                    "min": -20,
                    "max": 50,
                    "default": 0,
                    "description": "Expected annual growth rate (%)"
                },
                {
                    "name": "Market Growth",
                    "key": "Market Growth",
                    "min": -10,
                    "max": 30,
                    "default": 0,
                    "description": "Overall market growth impact (%)"
                },
                {
                    "name": "Marketing Spend",
                    "key": "Marketing Spend",
                    "min": -5,
                    "max": 25,
                    "default": 0,
                    "description": "Impact of marketing investment (%)"
                },
                {
                    "name": "Seasonality",
                    "key": "Seasonality",
                    "min": -15,
                    "max": 15,
                    "default": 0,
                    "description": "Seasonal variation adjustment (%)"
                }
            ]
            
            return DashboardForecastResponse(
                historical=historical_data,
                forecast=forecast_data,
                insights=insights if insights else [
                    "Revenue forecast shows stable growth trajectory.",
                    "Historical patterns indicate consistent performance.",
                    "Forecast accounts for seasonal variations."
                ],
                keyDrivers=key_drivers if key_drivers else [
                    "Historical revenue trends",
                    "Market demand patterns",
                    "Customer acquisition channels"
                ],
                suggestedParameters=suggested_parameters
            )
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Data validation error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Forecast generation failed: {str(e)}"
        )
```

### Step 3: Update Frontend to Use New Endpoint

In your frontend code (likely in `App.tsx` or a service file), update the API call:

```typescript
// Example: services/apiService.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchDashboardForecast(
  file: File,
  forecastDate?: string,
  trainModels: boolean = false
): Promise<ForecastResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (forecastDate) {
    formData.append('forecast_date', forecastDate);
  }
  formData.append('train_models', trainModels.toString());

  const response = await fetch(`${API_BASE_URL}/dashboard/forecast`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}
```

### Step 4: Alternative: Use Existing `/forecast` Endpoint

If you prefer to use the existing `/forecast` endpoint, you can transform the response in the frontend:

```typescript
// Transform backend response to dashboard format
function transformForecastResponse(apiResponse: any): ForecastResponse {
  // Get historical data from metadata or generate from monthly_revenue
  const historical: DataPoint[] = []; // You'll need to extract this from metadata
  
  // Transform forecast data
  const forecast: DataPoint[] = apiResponse.forecast.map((item: any) => ({
    date: item.date,
    revenue: item.forecast,
    type: 'forecast' as const
  }));
  
  // Extract insights from metadata
  const insights = extractInsights(apiResponse.metadata);
  
  // Extract key drivers from metadata
  const keyDrivers = extractKeyDrivers(apiResponse.metadata);
  
  // Default suggested parameters
  const suggestedParameters = [
    {
      name: "Growth Rate",
      key: "Growth Rate",
      min: -20,
      max: 50,
      default: 0,
      description: "Expected annual growth rate (%)"
    },
    // ... more parameters
  ];
  
  return {
    historical,
    forecast,
    insights,
    keyDrivers,
    suggestedParameters
  };
}
```

## Recommended Approach

**Option 1: Create `/dashboard/forecast` endpoint (Recommended)**
- ✅ Clean separation of concerns
- ✅ Optimized for dashboard needs
- ✅ Includes historical data automatically
- ✅ Better performance (no frontend transformation)

**Option 2: Transform existing `/forecast` response**
- ✅ No backend changes needed
- ❌ Requires frontend transformation logic
- ❌ Historical data may need separate call

## Testing the Endpoint

### Using Swagger UI

1. Navigate to http://localhost:8000/docs
2. Find `POST /dashboard/forecast`
3. Click "Try it out"
4. Upload a CSV file
5. Set `train_models` to `true` or `false`
6. Click "Execute"
7. Verify the response matches `ForecastResponse` structure

### Using curl

```bash
curl -X POST "http://localhost:8000/dashboard/forecast" \
  -F "file=@../../data/test_data.csv" \
  -F "train_models=false"
```

### Expected Response

```json
{
  "historical": [
    {
      "date": "2023-01-01",
      "revenue": 45000.0,
      "type": "historical"
    },
    ...
  ],
  "forecast": [
    {
      "date": "2024-12-01",
      "revenue": 25000.0,
      "type": "forecast"
    },
    ...
  ],
  "insights": [
    "Strong conversion rate of 32.2% indicates effective sales processes.",
    "Average trip value of $5,000 provides solid revenue foundation."
  ],
  "keyDrivers": [
    "Social Media is the primary lead source (135 leads)",
    "Latin America is the most popular destination (150 trips)"
  ],
  "suggestedParameters": [
    {
      "name": "Growth Rate",
      "key": "Growth Rate",
      "min": -20,
      "max": 50,
      "default": 0,
      "description": "Expected annual growth rate (%)"
    },
    ...
  ]
}
```

## Next Steps

1. **Implement the endpoint** following Step 2 above
2. **Update frontend** to call `/dashboard/forecast` instead of transforming `/forecast`
3. **Test thoroughly** with various CSV files
4. **Add error handling** for edge cases
5. **Consider caching** if the same data is requested multiple times

## Additional Enhancements

### Option: Use Report Generator for Insights

If you want more sophisticated insights, you can use the report generator:

```python
# After generating forecast
try:
    report_generator = ReportGenerator()
    metadata = {...}  # Build metadata
    report = report_generator.generate_report(metadata, forecast_list)
    
    # Extract insights from report
    insights = report.get("executive_summary", {}).get("key_insights", [])
    key_drivers = [
        f.get("factor", "") for f in 
        report.get("driving_factors", {}).get("positive_factors", [])
    ]
except Exception as e:
    # Fallback to basic insights
    insights = ["Forecast generated successfully."]
```

This provides AI-generated insights using Azure OpenAI.

