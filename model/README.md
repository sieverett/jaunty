# Ensemble Revenue Forecasting Pipeline

A production-ready ensemble pipeline for forecasting 12-month revenue from historical travel booking data.

## Features

- **Ensemble Approach**: Combines Prophet (time series), XGBoost (ML), and Pipeline (rule-based) models
- **Separated Training & Inference**: Clean separation between model training and forecast generation
- **Minimum Data Validation**: Requires at least 1 year of historical data
- **12-Month Forecasts**: Generates monthly revenue forecasts for the next 12 months

## Installation

```bash
# Install required packages
pip install pandas numpy scikit-learn
pip install prophet  # Optional but recommended
pip install xgboost  # Optional but recommended
```

## Quick Start

### Training Models

```python
from model.pipeline import EnsemblePipeline

# Initialize pipeline
pipeline = EnsemblePipeline(model_dir="model/artifacts")

# Train models from CSV
pipeline.train("data/data_template.csv")
```

### Generating Forecasts

```python
# After training, generate forecast
forecast = pipeline.forecast("data/test_data.csv")

# Display results
print(forecast)
```

### Training and Forecasting in One Step

```python
# Train and forecast in one call
forecast = pipeline.train_and_forecast("data/test_data.csv")
```

## Data Format

The CSV file should follow the format of `data/data_template.csv`. The exact column order is:

1. **lead_id**: Unique identifier for each lead (string, e.g., "LEAD_0001")
2. **inquiry_date**: Date when customer first contacted (YYYY-MM-DD, required)
3. **destination**: Travel destination (Latin America, Europe, Asia, or custom)
4. **trip_price**: Total cost of trip in dollars (number, 0 for lost/cancelled leads)
5. **lead_source**: How they found you (Referral, Website, Repeat, Social Media, or custom)
6. **current_stage**: Current status (inquiry, quote_sent, booked, final_payment, completed, lost, cancelled)
7. **is_repeat_customer**: 1 if returning customer, 0 if new (0 or 1)
8. **quote_date**: Date quote was sent (YYYY-MM-DD or empty string if not sent)
9. **booking_date**: Date they paid deposit/booked (YYYY-MM-DD or empty string if not booked)
10. **trip_date**: Date of actual trip (YYYY-MM-DD or empty string, required for completed trips)
11. **final_payment_date**: Date final payment was made (YYYY-MM-DD or empty string)
12. **duration_days**: Length of trip in days (number)

### Important Notes:

- **Date Format**: All dates must be in YYYY-MM-DD format
- **Empty Dates**: Leave date fields as empty strings (not "NULL" or "NaN") if that stage hasn't occurred
- **Lost Leads**: For lost leads, only `inquiry_date` and optionally `quote_date` should have values
- **Active Pipeline**: Fill in dates up to the current stage only
- **Trip Price**: Should be 0 for lost/cancelled leads
- **Comments**: CSV files can include comment lines starting with `#` - these are automatically ignored
- **Minimum Data**: Need at least 1 year of historical data with completed trips (having `trip_date` filled in)

### Example Row:

```csv
LEAD_0001,2023-01-15,Europe,4500,Referral,completed,0,2023-01-18,2023-02-01,2023-07-15,2023-06-15,14
```

This represents a completed trip where:
- Inquiry on 2023-01-15
- Quote sent on 2023-01-18
- Booked on 2023-02-01
- Trip occurred on 2023-07-15
- Final payment on 2023-06-15
- Trip price: $4,500

## Data Processing

### Incomplete Month Exclusion

The pipeline automatically excludes incomplete recent months from historical data to prevent abrupt forecast jumps. This ensures forecasts start from a representative baseline rather than artificially low recent data.

**How it works:**
- During inference, the system checks the last N months (default: 2, checks up to 4) for incompleteness
- A month is considered **incomplete** if:
  - Trip count is less than 50% of the rolling average (calculated from the last 6 months), OR
  - Revenue is less than 30% of the rolling average (more aggressive threshold for revenue)
- All consecutive incomplete months from the end of the historical series are excluded
- The forecast starts from the last complete month

**What causes incomplete months:**
- Partial month data (e.g., current month only partially recorded)
- Data collection delays (completed trips not yet recorded)
- Reporting lag (data arrives days/weeks after month-end)
- Anomalously low months due to data quality issues

**Configuration:**
- `exclude_incomplete_months` parameter in `prepare_monthly_revenue()` (default: 2)
- Trip count threshold: 50% of rolling average
- Revenue threshold: 30% of rolling average (more aggressive)
- Checks up to 4 months to catch consecutive low months
- Can be adjusted based on your data collection patterns

**Additional Safeguards:**
- The forecast logic also excludes anomalously low last month from recent average calculations
- If last month revenue < 30% of recent average (excluding itself), it's excluded from forecast anchoring
- Jump detection prevents forecasts from starting more than 50% above recent average

**Example:**
If the rolling average is 25 bookings/month and $50,000/month revenue:
- Month with 12 bookings (< 50% of 25) OR $15,000 revenue (< 30% of $50k) → flagged as incomplete, excluded
- Month with 15 bookings (≥ 50% of 25) AND $20,000 revenue (≥ 30% of $50k) → considered complete, included

## Model Components

### 1. Prophet (Time Series)
- Forecasts monthly revenue trends
- Captures seasonality and trends
- Provides confidence intervals

### 2. XGBoost (Machine Learning)
- Predicts conversion probability for active pipeline
- Uses lead characteristics (destination, source, timing, etc.)
- Estimates expected revenue from current pipeline

### 3. Pipeline (Rule-Based)
- Uses stage-based conversion probabilities
- Simple weighted revenue calculation
- Fallback when ML models unavailable

## Output Format

The forecast returns a DataFrame with:
- **date**: Month of forecast (first day of month)
- **forecast**: Predicted revenue for that month
- **lower**: Lower bound of confidence interval
- **upper**: Upper bound of confidence interval
- **method**: 'ensemble' (combined forecast)

## Directory Structure

```
model/
├── __init__.py
├── data_loader.py      # Data loading and validation
├── trainer.py          # Model training logic
├── inference.py        # Forecast generation
├── pipeline.py         # Main orchestrator
├── README.md
└── artifacts/         # Trained models (created after training)
    ├── prophet_model.pkl
    ├── xgboost_model.json
    ├── label_encoders.pkl
    ├── feature_names.pkl
    └── training_metadata.pkl
```

## Requirements

- Python 3.7+
- pandas
- numpy
- scikit-learn
- prophet (optional, for time series forecasting)
- xgboost (optional, for ML-based forecasting)

## Test Data Generation

The `generate_test_data.py` script creates synthetic test data with realistic distributions:

**Features:**
- **Active Leads**: 25% of records are active pipeline leads (inquiry, quote_sent, booked, final_payment)
- **Historical Leads**: 75% are historical (completed, lost, cancelled)
- **Booking Distribution**: Targets ~25 bookings per month (with variance of 15-35 per month)
- **Funnel Distribution**: Active leads follow realistic funnel:
  - 50% inquiry
  - 30% quote_sent
  - 15% booked
  - 5% final_payment
- **Reproducibility**: Optional random seed for deterministic data generation

**Usage:**
```bash
# Generate varied data (different each run)
python model/generate_test_data.py

# Generate deterministic data with seed
python model/generate_test_data.py 42

# Specify output filename
python model/generate_test_data.py test_run_1.csv

# Both seed and filename
python model/generate_test_data.py 42 test_run_1.csv
```

**Parameters:**
- `n_records`: Total number of records (default: 500, auto-adjusted for booking targets)
- `start_date`: Start date for historical data (default: '2022-01-01')
- `end_date`: End date / "today" for active leads (default: current date)
- `active_lead_pct`: Percentage of active leads (default: 0.25)
- `random_seed`: Seed for reproducibility (default: None for varied data)
- `bookings_per_month`: Target bookings per month (default: 25, variance: 15-35)

## Notes

- Minimum 1 year of historical data required
- Models are saved to `model/artifacts/` after training
- Forecasts are generated monthly (12 months ahead)
- Ensemble weights can be adjusted in `inference.py`
- Test data generator automatically adjusts record count to meet booking targets

