"""
Example usage of the ensemble revenue forecasting pipeline.

The CSV file should match the structure of data_template.csv:
- Column order: lead_id, inquiry_date, destination, trip_price, lead_source, 
  current_stage, is_repeat_customer, quote_date, booking_date, trip_date, 
  final_payment_date, duration_days
- Empty date fields should be empty strings (not NULL or NaN)
- Dates in YYYY-MM-DD format
- Need at least 1 year of historical data with completed trips
"""

from model.pipeline import EnsemblePipeline

# Example 1: Train models and generate forecast in one step
print("Example 1: Train and Forecast")
print("="*70)

pipeline = EnsemblePipeline(model_dir="artifacts", min_years=1.0)

# Replace with your actual CSV path
csv_path = "data/data_template.csv"

try:
    # Train models and generate forecast
    forecast = pipeline.train_and_forecast(csv_path)
    
    print("\n12-Month Forecast:")
    print(forecast)
    print(f"\nTotal Forecast Revenue: ${forecast['forecast'].sum():,.0f}")
    
except Exception as e:
    print(f"Error: {e}")
    print("\nNote: Make sure your CSV has at least 1 year of historical data")
    print("with completed trips that have trip_date filled in.")


# Example 2: Separate training and inference
print("\n\nExample 2: Separate Training and Inference")
print("="*70)

pipeline2 = EnsemblePipeline(model_dir="artifacts", min_years=1.0)

try:
    # Step 1: Train models
    print("\nStep 1: Training models...")
    training_metadata = pipeline2.train(csv_path)
    print("Training complete!")
    
    # Step 2: Generate forecast (can be called multiple times without retraining)
    print("\nStep 2: Generating forecast...")
    forecast = pipeline2.forecast()
    print("Forecast generated!")
    
    print(f"\nTotal Forecast Revenue: ${forecast['forecast'].sum():,.0f}")
    
except Exception as e:
    print(f"Error: {e}")

