# Data Directory

This directory contains CSV data files for the revenue forecasting pipeline.

## Files

- **`data_template.csv`** - Template file showing the expected data structure and format
- **`test_data.csv`** - Generated test data with active leads (created by `model/generate_test_data.py`)

## Data Format

See `data_template.csv` for the exact column structure and format requirements.

## Usage

### For Training Models

```python
from model.pipeline import EnsemblePipeline

pipeline = EnsemblePipeline()
pipeline.train("data/data_template.csv")  # or your actual data file
```

### For Generating Forecasts

```python
forecast = pipeline.forecast("data/test_data.csv")
```

### Via API

```bash
curl -X POST "http://localhost:8000/forecast" \
  -F "file=@data/test_data.csv"
```

## Test Data Generation

The `test_data.csv` file is generated using `model/generate_test_data.py`:

**Features:**
- **Booking Distribution**: Targets ~25 bookings per month (variance: 15-35 per month)
- **Active Leads**: 25% of records are active pipeline leads
  - Distribution: 50% inquiry, 30% quote_sent, 15% booked, 5% final_payment
- **Historical Leads**: 75% are historical (completed, lost, cancelled)
- **Reproducibility**: Optional random seed for deterministic generation

**Usage:**
```bash
# Generate varied data
python model/generate_test_data.py

# Generate deterministic data
python model/generate_test_data.py 42

# Specify output filename
python model/generate_test_data.py test_data.csv
```

See `../model/README.md` for detailed parameters and usage.

## Notes

- CSV files can include comment lines starting with `#` (automatically ignored)
- Minimum 1 year of historical data required for training
- Empty date fields should be empty strings (not "NULL" or "NaN")
- See `../model/README.md` for detailed data format requirements

