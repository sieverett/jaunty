# Report Generator

This subproject generates strategic analysis reports from revenue forecasting pipeline metadata using Anthropic Claude.

## Overview

The report generator takes metadata from the forecasting pipeline API and produces a comprehensive strategic analysis report that includes:

- **Executive Summary**: High-level overview and key insights
- **Driving Factors**: Positive and negative factors affecting revenue, seasonal patterns, and trend analysis
- **Outliers and Anomalies**: Identification of forecast outliers, data quality issues, and model uncertainty
- **Operational Recommendations**: Immediate actions, strategic initiatives, risk mitigation, and optimization opportunities
- **Model Performance Assessment**: Confidence levels and recommendations for improvement

## Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Anthropic Claude**:
   
   Create a `.env` file in the project root (or ensure it exists) with the following variable:
   ```env
   ANTHROPIC_API_KEY=your-api-key-here
   ```

## Usage

### Step 1: Generate Forecast Response JSON

First, you need to get the forecast data from the backend API. You can do this in two ways:

#### Option A: Using the helper script (recommended)

```bash
# Make sure the backend server is running first
# cd ../jaunty/backend && uvicorn main:app --reload

# Then fetch the forecast
python fetch_forecast.py ../data/test_data.csv -o forecast_response.json

# Or with training enabled
python fetch_forecast.py ../data/test_data.csv --train -o forecast_response.json
```

#### Option B: Using curl

```bash
curl -X POST "http://localhost:8000/forecast" \
  -F "file=@../data/test_data.csv" \
  -F "train_models=false" \
  > forecast_response.json
```

#### Option C: Using Python requests

```python
import requests
import json

with open('../data/test_data.csv', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/forecast',
        files={'file': f},
        data={'train_models': 'false'}
    )

with open('forecast_response.json', 'w') as out:
    json.dump(response.json(), out, indent=2)
```

### Step 2: Generate Report

Once you have `forecast_response.json`, generate the strategic analysis report:

```bash
python report_generator.py forecast_response.json -o strategic_report.json
```

If the forecast data is in a separate file:

```bash
python report_generator.py metadata.json --forecast-file forecast.json -o report.json
```

### Python API

```python
from report_generator import ReportGenerator
import json

# Load metadata from API response
with open('forecast_response.json', 'r') as f:
    api_response = json.load(f)

metadata = api_response['metadata']
forecast = api_response['forecast']

# Generate report
generator = ReportGenerator()
report = generator.generate_report(metadata, forecast)

# Save report
with open('strategic_report.json', 'w') as f:
    json.dump(report, f, indent=2)
```

## Input Format

The script expects metadata in the format returned by the `/forecast` endpoint of the backend API:

```json
{
  "metadata": {
    "forecast_parameters": {...},
    "model_info": {...},
    "metrics": {...},
    "dataset_stats": {...},
    "other": {...}
  },
  "forecast": [
    {
      "date": "2024-12-01",
      "forecast": 25000.0,
      "lower": 17500.0,
      "upper": 32500.0
    },
    ...
  ]
}
```

Alternatively, you can pass just the metadata dictionary if forecast data is provided separately.

## Output Format

The report is returned as a JSON object with the following structure:

```json
{
  "executive_summary": {
    "overview": "...",
    "total_forecast": "...",
    "forecast_period": "...",
    "key_insights": [...]
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
    "overall_confidence": "...",
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

## Example Workflow

1. **Start the backend server** (if not already running):
   ```bash
   cd ../jaunty/backend
   uvicorn main:app --reload
   ```

2. **Get forecast from API** (in a new terminal):
   ```bash
   cd report
   python fetch_forecast.py ../data/test_data.csv -o forecast_response.json
   ```

3. **Generate report**:
   ```bash
   python report_generator.py forecast_response.json -o strategic_report.json
   ```

4. **View report**:
   ```bash
   cat strategic_report.json | jq .
   ```

Or as a one-liner:
```bash
python fetch_forecast.py ../data/test_data.csv -o forecast_response.json && \
python report_generator.py forecast_response.json -o strategic_report.json
```

## Error Handling

The script will raise errors if:
- Required Anthropic Claude environment variables are missing
- The input JSON file is invalid or missing
- Anthropic Claude API call fails
- The LLM response is not valid JSON

## Requirements

- Python 3.8+
- Anthropic API key
- Valid API credentials configured in `.env` file

## Notes

- The script prompts Claude to return structured JSON output
- Maximum tokens is set to 8000 to accommodate comprehensive reports
- The report includes metadata about when and how it was generated

