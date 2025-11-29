# Empirical Stage-Based Conversion Rates

## Summary

Implemented empirical stage-based conversion rates for the JAUNTY prediction system. The system now calculates conversion rates from historical data instead of using hardcoded values.

## Implementation Details

### 1. Conversion Rate Calculation (trainer.py)

Added `calculate_stage_conversion_rates()` method to `ModelTrainer` class:

```python
def calculate_stage_conversion_rates(self, df: pd.DataFrame) -> Dict[str, float]:
    """
    Calculate empirical conversion rates from historical data.

    For each stage, calculates the rate at which leads at that stage
    eventually convert to 'completed'.
    """
```

The method calculates rates for:
- **inquiry**: All leads start here. Rate = completed / total_leads
- **quote_sent**: Leads that received a quote. Rate = completed_with_quote / total_with_quote
- **booked**: Leads that booked a trip. Rate = completed_with_booking / total_booked
- **final_payment**: Leads that made final payment. Rate = completed_with_payment / total_with_payment

### 2. Artifact Storage (trainer.py)

During training, conversion rates are:
1. Calculated from historical data
2. Saved as pickle file: `model/artifacts/stage_conversion_rates.pkl`
3. Added to training metadata for tracking

### 3. Inference Integration (inference.py)

Modified `ForecastInference` class:
- Added `stage_conversion_rates` attribute
- Updated `load_models()` to load empirical rates from artifacts
- Modified `forecast_pipeline()` to use empirical rates with fallback to hardcoded values

### 4. Fallback Mechanism

The system maintains backwards compatibility:
- If empirical rates are available → use them
- If empirical rates are missing → fallback to hardcoded rates
- The `rates_source` field in forecast results indicates which was used

## Results from Real Data

Using `./data/test_data.csv` (2,937 records, 4.27 years):

### Empirical Rates (from data)
- inquiry: 0.320 (32.0%)
- quote_sent: 0.723 (72.3%)
- booked: 0.865 (86.5%)
- final_payment: 0.964 (96.4%)

### Hardcoded Rates (previous)
- inquiry: 0.150 (15.0%)
- quote_sent: 0.350 (35.0%)
- booked: 0.900 (90.0%)
- final_payment: 0.980 (98.0%)

### Differences
- inquiry: +0.170 (+113.1%) - much higher conversion than assumed
- quote_sent: +0.373 (+106.5%) - much higher conversion than assumed
- booked: -0.035 (-3.8%) - slightly lower than assumed
- final_payment: -0.016 (-1.6%) - slightly lower than assumed

## Impact on Forecasting

For a sample pipeline with 4 leads at $10,000 each:

- **With Hardcoded Rates**: $23,800.00 total forecast
- **With Empirical Rates**: $28,720.81 total forecast
- **Difference**: +$4,920.81 (+20.7%)

The empirical rates show that early-stage leads (inquiry, quote_sent) convert at much higher rates than previously assumed, leading to more optimistic (but data-driven) forecasts.

## Testing

Created comprehensive test suite:

### Test 1: Conversion Rate Calculation
- Verifies rates are calculated correctly from data
- Tests with synthetic data with known conversion rates
- Status: ✓ PASSED

### Test 2: Save and Load Rates
- Verifies rates are saved during training
- Verifies rates are loaded during inference
- Status: ✓ PASSED

### Test 3: Fallback to Hardcoded
- Verifies fallback works when empirical rates unavailable
- Tests backwards compatibility
- Status: ✓ PASSED

### Test 4: Empirical Override Hardcoded
- Verifies empirical rates are used when available
- Confirms hardcoded rates are not used when empirical exist
- Status: ✓ PASSED

All tests passed successfully.

## Files Modified

1. **jaunty/model/trainer.py**
   - Added `calculate_stage_conversion_rates()` method
   - Modified `train_all()` to calculate and save rates

2. **jaunty/model/inference.py**
   - Added `stage_conversion_rates` attribute
   - Modified `load_models()` to load empirical rates
   - Modified `forecast_pipeline()` to use empirical rates with fallback

## Files Created

1. **jaunty/model/test_conversion_rates.py**
   - Comprehensive test suite for conversion rates
   - 4 tests covering calculation, storage, loading, and usage

2. **jaunty/test_real_data.py**
   - Test with real historical data
   - Demonstrates empirical rates calculation and usage

3. **jaunty/test_rates_in_use.py**
   - Verification that empirical rates are actually used in calculations
   - Compares results with hardcoded rates

4. **jaunty/EMPIRICAL_CONVERSION_RATES.md**
   - This documentation file

## Artifacts Created

When training is run, the following artifact is created:

- **model/artifacts/stage_conversion_rates.pkl**
  - Contains dictionary mapping stages to conversion rates
  - Loaded automatically during inference
  - Example: `{'inquiry': 0.320, 'quote_sent': 0.723, ...}`

## Usage

### Training (calculates empirical rates)
```python
from model.pipeline import EnsemblePipeline

pipeline = EnsemblePipeline(model_dir="model/artifacts")
metadata = pipeline.train('data/historical_data.csv')

# Rates are in metadata
rates = metadata['stage_conversion_rates']
print(rates)  # {'inquiry': 0.320, 'quote_sent': 0.723, ...}
```

### Forecasting (uses empirical rates)
```python
# Rates are loaded automatically
forecast = pipeline.forecast()

# Check which rates were used
from model.inference import ForecastInference
inference = ForecastInference(model_dir="model/artifacts")
inference.load_models()

if inference.stage_conversion_rates is not None:
    print("Using empirical rates:")
    print(inference.stage_conversion_rates)
else:
    print("Using hardcoded fallback rates")
```

## Backwards Compatibility

The implementation maintains full backwards compatibility:

1. **Old models without empirical rates**: Will use hardcoded fallback rates
2. **New models with empirical rates**: Will use empirical rates
3. **No changes to API**: Existing code continues to work without modification

## Future Improvements

Potential enhancements:
1. Track stage history to capture leads that move between stages
2. Calculate conversion rates by segment (destination, source, season)
3. Time-based conversion rates (e.g., how quickly leads convert)
4. Confidence intervals for conversion rates
5. Periodic recalculation to detect changes in conversion patterns

## Verification

Run tests to verify implementation:

```bash
# Run comprehensive test suite
python model/test_conversion_rates.py

# Test with real data
python test_real_data.py

# Verify rates are used in calculations
python test_rates_in_use.py
```

All tests should pass with output showing empirical rates are calculated, saved, loaded, and used correctly.
