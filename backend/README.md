# Revenue Forecasting API

FastAPI backend service (v1.0.0) for generating 12-month revenue forecasts from historical booking data.

**Location**: `jaunty/backend/`  
**Model Dependency**: Uses forecasting pipeline from `../../model/`

## Features

- **RESTful API**: Simple HTTP endpoints for forecast generation
- **CSV Upload**: Accepts CSV files in the same format as `test_data.csv`
- **Model Training**: Optional endpoint to train models from data
- **12-Month Forecasts**: Returns monthly revenue predictions with confidence intervals
- **Dashboard Endpoint**: Returns data formatted for frontend consumption (`/dashboard/forecast`) - **NEW**
- **Strategic Reports**: Generate comprehensive analysis reports using Azure OpenAI
- **Health Checks**: Endpoint to verify service status and model availability

## Installation

```bash
# Navigate to backend directory
cd jaunty/backend

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Note: The backend uses models from ../../model/artifacts/
# Ensure models are trained before generating forecasts

# Optional: Configure Azure OpenAI for /report endpoint
# Create a .env file in the project root with:
# AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
# AZURE_OPENAI_API_KEY=your-api-key
# AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
```

## Running the Service

### Development Mode

```bash
# From the backend directory
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

The API will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

## API Endpoints

### 1. Upload File

```bash
POST /upload
```

Upload a CSV file and store it in a temporary directory.

**Request:**
- **file** (multipart/form-data): CSV file to upload

**Example using curl:**
```bash
curl -X POST "http://localhost:8000/upload" \
  -F "file=@../../data/test_data.csv"
```

**Response:**
```json
{
  "status": "success",
  "message": "File uploaded successfully. Cleaned up 5 old file(s) to maintain limit of 50 files.",
  "filename": "20241120_211500_test_data.csv",
  "file_path": "/path/to/JAUNTY/tmp/20241120_211500_test_data.csv",
  "file_size": 44831,
  "uploaded_at": "2024-11-20T21:15:00.123456",
  "files_deleted": 5,
  "total_files": 50
}
```

**Notes:**
- Files are stored in `tmp/` directory at the project root
- Filenames are prefixed with a timestamp to ensure uniqueness
- Original filename is preserved after the timestamp
- **Automatic cleanup**: The system automatically maintains a maximum number of files (default: 50) by deleting the oldest files when the limit is exceeded
- Configure the maximum with `MAX_TMP_FILES` environment variable (e.g., `MAX_TMP_FILES=100`)

**Testing in Swagger UI (`/docs`):**
1. Navigate to http://localhost:8000/docs
2. Find the `POST /upload` endpoint
3. Click "Try it out"
4. Click "Choose File" in the `file` parameter section
5. Select a CSV file from your computer (e.g., `data/test_data.csv`)
6. Click "Execute"
7. View the response below showing the uploaded file details

### 2. Health Check

```bash
GET /health
```

Returns service status and whether models are loaded.

**Response:**
```json
{
  "status": "healthy",
  "models_loaded": true,
  "model_dir": "/path/to/model/artifacts"
}
```

### 3. Generate Forecast

```bash
POST /forecast
```

Generates a 12-month revenue forecast from historical data.

**Request:**
- **file** (multipart/form-data): CSV file with historical booking data
- **forecast_date** (optional, form-data): Forecast reference date (YYYY-MM-DD). Defaults to today.
- **train_models** (optional, form-data, boolean): Whether to train models before forecasting. Default: false

**Example using curl:**
```bash
curl -X POST "http://localhost:8000/forecast" \
  -F "file=@../../data/test_data.csv" \
  -F "forecast_date=2024-11-20" \
  -F "train_models=false"
```

**Response:**
```json
{
  "forecast": [
    {
      "date": "2024-12-01",
      "forecast": 25000.0,
      "lower": 17500.0,
      "upper": 32500.0
    },
    ...
  ],
  "summary": {
    "total_forecast": 300000.0,
    "average_monthly": 25000.0,
    "min_monthly": 20000.0,
    "max_monthly": 30000.0,
    "std_monthly": 3000.0
  },
  "metadata": {
    "forecast_date": "2024-11-20",
    "forecast_periods": 12,
    "forecast_start": "2024-12-01",
    "forecast_end": "2025-11-01",
    "models_trained": false
  }
}
```

### 3. Generate Dashboard Forecast

```bash
POST /dashboard/forecast
```

Generate forecast data formatted specifically for the frontend dashboard. This endpoint returns data in the exact format expected by the frontend, including historical data, forecast data, insights, key drivers, and simulation parameters.

**Request:**
- **file** (multipart/form-data): CSV file with historical booking data
- **forecast_date** (optional, form-data): Forecast reference date (YYYY-MM-DD). Defaults to today.
- **train_models** (optional, form-data, boolean): Whether to train models before forecasting. Default: false

**Example using curl:**
```bash
curl -X POST "http://localhost:8000/dashboard/forecast" \
  -F "file=@../../data/test_data.csv" \
  -F "train_models=false"
```

**Response:**
```json
{
  "historical": [
    {
      "date": "2023-01-01",
      "revenue": 45000.0,
      "bookings": 120,
      "type": "historical"
    },
    ...
  ],
  "forecast": [
    {
      "date": "2024-12-01",
      "revenue": 52000.0,
      "type": "forecast"
    },
    ...
  ],
  "insights": [
    "Strong conversion rate of 32.2% indicates effective sales processes.",
    "Average trip value of $5,000 provides solid revenue foundation.",
    ...
  ],
  "keyDrivers": [
    "Social Media is the primary lead source (135 leads)",
    "Latin America is the most popular destination (150 trips)",
    ...
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
  ],
  "funnel": [
    {
      "stage": "inquiry",
      "count": 1000,
      "conversionRate": 65.0,
      "dropOffRate": 35.0,
      "revenuePotential": 4500000.0,
      "avgDaysInStage": 2.5,
      "color": "#0ea5e9"
    },
    ...
  ]
}
```

**Key Features:**
- Returns historical monthly revenue data (from loaded CSV)
- Returns 12-month forecast data (formatted for charts)
- Generates insights from dataset statistics and metrics
- Extracts key drivers from lead sources, destinations, and conversion rates
- Provides suggested parameters for scenario simulation
- Optionally includes funnel data based on `current_stage` distribution

**Use Case:**
This endpoint is designed specifically for frontend consumption. The frontend `dataService.ts` calls this endpoint when `VITE_API_URL` is configured and `VITE_USE_MOCK_DATA=false`.

**Testing in Swagger UI (`/docs`):**
1. Navigate to http://localhost:8000/docs
2. Find `POST /dashboard/forecast`
3. Click "Try it out"
4. Upload a CSV file
5. Set `train_models` to `true` or `false`
6. Click "Execute"
7. Verify the response matches the `DashboardForecastResponse` structure

### 4. Train Models

```bash
POST /train
```

Trains the ensemble models from historical data.

**Request:**
- **file** (multipart/form-data): CSV file with historical booking data

**Example using curl:**
```bash
curl -X POST "http://localhost:8000/train" \
  -F "file=@../../data/test_data.csv"
```

**Response:**
```json
{
  "status": "success",
  "message": "Models trained successfully",
  "metadata": {
    "prophet": {...},
    "xgboost": {...}
  }
}
```

### 5. Generate Strategic Report

```bash
POST /report
```

Generates a comprehensive strategic analysis report from historical booking data. This endpoint:
1. Generates a 12-month revenue forecast
2. Uses Azure OpenAI to analyze the forecast and metadata
3. Returns a strategic report with insights, recommendations, and operational guidance

**Requirements:**
- Azure OpenAI must be configured in `.env` file:
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_DEPLOYMENT_NAME`

**Request:**
- **file** (multipart/form-data): CSV file with historical booking data
- **forecast_date** (optional, form-data): Forecast reference date (YYYY-MM-DD). Defaults to today.
- **train_models** (optional, form-data, boolean): Whether to train models before forecasting. Default: false

**Example using curl:**
```bash
curl -X POST "http://localhost:8000/report" \
  -F "file=@../../data/test_data.csv" \
  -F "forecast_date=2024-11-20" \
  -F "train_models=false"
```

**Response:**
```json
{
  "executive_summary": {
    "overview": "High-level summary of the forecast and key findings",
    "total_forecast": 346410,
    "forecast_period": "2026-04-01 to 2027-03-01",
    "key_insights": ["...", "...", "..."]
  },
  "driving_factors": {
    "positive_factors": [...],
    "negative_factors": [...],
    "seasonal_patterns": "...",
    "trend_analysis": "..."
  },
  "outliers_and_anomalies": {
    "forecast_outliers": [...],
    "data_quality_issues": [...],
    "model_uncertainty": "..."
  },
  "operational_recommendations": {
    "immediate_actions": [...],
    "strategic_initiatives": [...],
    "risk_mitigation": [...],
    "optimization_opportunities": [...]
  },
  "model_performance_assessment": {
    "overall_confidence": "High/Medium/Low",
    "model_reliability": "...",
    "recommendations_for_improvement": [...]
  },
  "generated_at": "2024-11-20T12:00:00",
  "analyst_notes": "...",
  "report_metadata": {
    "generated_at": "...",
    "model_used": "...",
    "api_version": "...",
    "forecast_parameters": {...}
  }
}
```

**Note:** If Azure OpenAI is not configured, this endpoint will return a 503 error.

## Data Format

The CSV file must match the format of `data/test_data.csv` (or `data/data_template.csv`) with the following columns:

| Column | Type | Description |
|--------|------|-------------|
| lead_id | string | Unique identifier for each lead |
| inquiry_date | date (YYYY-MM-DD) | Date when customer first contacted |
| destination | string | Travel destination (Latin America, Europe, Asia, etc.) |
| trip_price | float | Total cost of trip in dollars |
| lead_source | string | How they found you (Referral, Website, Repeat, Social Media, etc.) |
| current_stage | string | Current status (inquiry, quote_sent, booked, final_payment, completed, lost, cancelled) |
| is_repeat_customer | int | 1 if returning customer, 0 if new |
| quote_date | date (YYYY-MM-DD) or empty | Date quote was sent |
| booking_date | date (YYYY-MM-DD) or empty | Date they paid deposit/booked |
| trip_date | date (YYYY-MM-DD) or empty | Date of actual trip |
| final_payment_date | date (YYYY-MM-DD) or empty | Date final payment was made |
| duration_days | int | Length of trip in days |

**Important Notes:**
- Dates must be in YYYY-MM-DD format
- Leave date fields empty (empty string) if that stage hasn't occurred yet
- Minimum 1 year of historical data required
- CSV can include comment lines starting with `#` (they are automatically ignored)

## Usage Examples

### Python

```python
import requests

# Generate forecast
with open('../../data/test_data.csv', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/forecast',
        files={'file': f},
        data={
            'forecast_date': '2024-11-20',
            'train_models': 'false'
        }
    )

forecast = response.json()
print(f"Total forecast: ${forecast['summary']['total_forecast']:,.0f}")
```

### JavaScript/TypeScript

```typescript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('forecast_date', '2024-11-20');
formData.append('train_models', 'false');

const response = await fetch('http://localhost:8000/forecast', {
  method: 'POST',
  body: formData
});

const forecast = await response.json();
console.log(`Total forecast: $${forecast.summary.total_forecast.toLocaleString()}`);
```

## Workflow

### First Time Setup

1. **Train Models**: Upload historical data to `/train` endpoint to train the models
2. **Generate Forecasts**: Use `/forecast` endpoint with `train_models=false` to generate forecasts

### Subsequent Forecasts

- Use `/forecast` endpoint with `train_models=false` (uses existing trained models)
- Or use `train_models=true` to retrain on new data before forecasting

## Error Handling

The API returns appropriate HTTP status codes:

- **200**: Success
- **400**: Bad Request (invalid data format, missing required fields)
- **500**: Internal Server Error (model training/forecast generation failed)

Error responses include a `detail` field with error message:

```json
{
  "detail": "Data validation error: Historical data spans only 0.5 years. Minimum 1.0 years required."
}
```

## Configuration

The service uses models from `model/artifacts/` directory (relative to project root).

To use a different model directory, modify the `startup_event` function in `main.py`.

### Environment Variables

- **MAX_TMP_FILES** (optional): Maximum number of files to keep in `tmp/` directory. Default: 50
  ```bash
  export MAX_TMP_FILES=100
  ```
  
  When this limit is exceeded, the oldest files are automatically deleted to prevent disk bloat.

## CORS

CORS is currently configured to allow all origins (`allow_origins=["*"]`). In production, update this to specific allowed origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    ...
)
```

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

### Project Structure

```
backend/
├── __init__.py
├── main.py              # FastAPI application
├── example_client.py    # Example Python client for testing
├── requirements.txt     # Python dependencies
├── README.md           # This file
└── .gitignore          # Backend-specific git ignores
```

## Dependencies

The backend depends on the core forecasting models located in `../../model/`:
- Uses `model.pipeline.EnsemblePipeline` for forecasting
- Models stored in `../../model/artifacts/`
- See `../../model/README.md` for model documentation

## Notes

- Models must be trained before generating forecasts (unless `train_models=true` is used)
- Training can take several minutes depending on data size
- The service loads models on startup - if models don't exist, they must be trained via `/train` endpoint
- Forecasts are generated monthly (12 months ahead)
- Confidence intervals are included in the response

