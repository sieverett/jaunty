#!/usr/bin/env python3
"""
Generate sample_data_template.csv for the frontend.

This script creates a sample dataset with at least 1 year of historical data
to meet the backend's minimum requirements.
"""

import sys
import os

# Add project root (jaunty/) to path
# From jaunty/scripts/, go up one level to jaunty/ (repo root)
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from model.generate_test_data import generate_test_data
from datetime import datetime

if __name__ == '__main__':
    # Generate sample data with at least 1 year of historical data
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Calculate start date to ensure at least 1.5 years of data
    # This ensures we have enough completed trips spanning at least 1 year
    start_date = '2022-06-01'  # Start 1.5+ years ago
    
    print("Generating sample data template for frontend...")
    print("="*70)
    print(f"Start date: {start_date}")
    print(f"End date (today): {today}")
    
    # Generate smaller dataset for sample (200 records is enough)
    # But ensure we have enough completed trips
    sample_data = generate_test_data(
        n_records=200, 
        start_date=start_date, 
        end_date=today, 
        active_lead_pct=0.20  # 20% active leads
    )
    
    # Verify we have at least 1 year of completed trips
    completed = sample_data[sample_data['current_stage'] == 'completed'].copy()
    if not completed.empty and 'trip_date' in completed.columns:
        completed['trip_date_dt'] = pd.to_datetime(completed['trip_date'], errors='coerce')
        completed = completed[completed['trip_date_dt'].notna()]
        
        if not completed.empty:
            date_range_years = (completed['trip_date_dt'].max() - completed['trip_date_dt'].min()).days / 365.25
            print(f"\nCompleted trips date range: {completed['trip_date_dt'].min().date()} to {completed['trip_date_dt'].max().date()}")
            print(f"Date span: {date_range_years:.2f} years")
            
            if date_range_years < 1.0:
                print(f"\n⚠️  Warning: Only {date_range_years:.2f} years of completed trips.")
                print("Generating additional data to meet 1-year requirement...")
                
                # Generate more data if needed
                additional_data = generate_test_data(
                    n_records=100,
                    start_date='2022-01-01',
                    end_date='2023-12-31',
                    active_lead_pct=0.0  # All historical
                )
                
                # Combine datasets
                sample_data = pd.concat([sample_data, additional_data], ignore_index=True)
                
                # Recalculate
                completed = sample_data[sample_data['current_stage'] == 'completed'].copy()
                completed['trip_date_dt'] = pd.to_datetime(completed['trip_date'], errors='coerce')
                completed = completed[completed['trip_date_dt'].notna()]
                
                if not completed.empty:
                    date_range_years = (completed['trip_date_dt'].max() - completed['trip_date_dt'].min()).days / 365.25
                    print(f"Updated date span: {date_range_years:.2f} years")
    
    # Determine output path (save in public/ directory)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(script_dir, '../public')
    os.makedirs(public_dir, exist_ok=True)
    sample_csv_path = os.path.join(public_dir, 'sample_data_template.csv')
    
    # Save to CSV (without index, matching template format)
    sample_data.to_csv(sample_csv_path, index=False)
    print(f"\n✓ Sample data saved to {sample_csv_path}")
    
    print(f"\nData summary:")
    print(f"  Total records: {len(sample_data)}")
    print(f"  Completed trips: {len(sample_data[sample_data['current_stage'] == 'completed'])}")
    print(f"  Lost leads: {len(sample_data[sample_data['current_stage'] == 'lost'])}")
    print(f"  Cancelled: {len(sample_data[sample_data['current_stage'] == 'cancelled'])}")
    
    # Active pipeline breakdown
    active = sample_data[sample_data['current_stage'].isin(['inquiry', 'quote_sent', 'booked', 'final_payment'])]
    print(f"\n  Active pipeline: {len(active)} leads")
    if len(active) > 0:
        print(f"    - inquiry: {len(active[active['current_stage'] == 'inquiry'])}")
        print(f"    - quote_sent: {len(active[active['current_stage'] == 'quote_sent'])}")
        print(f"    - booked: {len(active[active['current_stage'] == 'booked'])}")
        print(f"    - final_payment: {len(active[active['current_stage'] == 'final_payment'])}")
    
    print(f"\n✓ Sample data template ready for frontend use!")

