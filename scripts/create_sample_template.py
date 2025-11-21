#!/usr/bin/env python3
"""
Create sample_data_template.csv from test_data.csv.

Extracts a sample dataset with at least 1 year of completed trips
to meet the backend's minimum requirements.
"""

import pandas as pd
import os
from datetime import datetime

def create_sample_template():
    """Create sample_data_template.csv with sufficient historical data"""
    
    # Paths - jaunty/ is the repo root
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    test_data_path = os.path.join(project_root, 'data', 'test_data.csv')
    sample_output_path = os.path.join(project_root, 'public', 'sample_data_template.csv')
    
    if not os.path.exists(test_data_path):
        print(f"Error: {test_data_path} not found")
        print("Please run jaunty/model/generate_test_data.py first to create test_data.csv")
        return False
    
    # Read test data
    print(f"Reading {test_data_path}...")
    df = pd.read_csv(test_data_path)
    
    # Filter for completed trips with trip_date
    completed = df[
        (df['current_stage'] == 'completed') & 
        (df['trip_date'].notna()) &
        (df['trip_date'] != '')
    ].copy()
    
    if completed.empty:
        print("Error: No completed trips found in test_data.csv")
        return False
    
    # Convert trip_date to datetime
    completed['trip_date_dt'] = pd.to_datetime(completed['trip_date'], errors='coerce')
    completed = completed[completed['trip_date_dt'].notna()]
    
    if completed.empty:
        print("Error: No valid trip dates found")
        return False
    
    # Calculate date range
    min_date = completed['trip_date_dt'].min()
    max_date = completed['trip_date_dt'].max()
    date_range_years = (max_date - min_date).days / 365.25
    
    print(f"Completed trips date range: {min_date.date()} to {max_date.date()}")
    print(f"Date span: {date_range_years:.2f} years")
    
    if date_range_years < 1.0:
        print(f"Warning: Only {date_range_years:.2f} years. Need at least 1.0 years.")
        print("Using all available data...")
    
    # Get all completed trips (these are required for historical data)
    sample_df = df[df['current_stage'] == 'completed'].copy()
    
    # Add some active leads for funnel visualization (up to 50)
    active_leads = df[df['current_stage'].isin(['inquiry', 'quote_sent', 'booked', 'final_payment'])].head(50)
    sample_df = pd.concat([sample_df, active_leads], ignore_index=True)
    
    # Add some lost/cancelled leads for completeness (up to 20)
    lost_leads = df[df['current_stage'].isin(['lost', 'cancelled'])].head(20)
    sample_df = pd.concat([sample_df, lost_leads], ignore_index=True)
    
    # Ensure correct column order
    column_order = [
        'lead_id', 'inquiry_date', 'destination', 'trip_price', 'lead_source', 
        'current_stage', 'is_repeat_customer', 'quote_date', 'booking_date', 
        'trip_date', 'final_payment_date', 'duration_days'
    ]
    sample_df = sample_df[column_order]
    
    # Verify we still have at least 1 year of completed trips
    completed_sample = sample_df[
        (sample_df['current_stage'] == 'completed') & 
        (sample_df['trip_date'].notna()) &
        (sample_df['trip_date'] != '')
    ].copy()
    
    if not completed_sample.empty:
        completed_sample['trip_date_dt'] = pd.to_datetime(completed_sample['trip_date'], errors='coerce')
        completed_sample = completed_sample[completed_sample['trip_date_dt'].notna()]
        
        if not completed_sample.empty:
            min_date_sample = completed_sample['trip_date_dt'].min()
            max_date_sample = completed_sample['trip_date_dt'].max()
            date_range_sample = (max_date_sample - min_date_sample).days / 365.25
            
            print(f"\nSample dataset:")
            print(f"  Total records: {len(sample_df)}")
            print(f"  Completed trips: {len(completed_sample)}")
            print(f"  Date range: {min_date_sample.date()} to {max_date_sample.date()}")
            print(f"  Date span: {date_range_sample:.2f} years")
            
            if date_range_sample < 1.0:
                print(f"\n⚠️  Warning: Sample only has {date_range_sample:.2f} years")
                print("This may not pass validation. Consider using more data.")
            else:
                print(f"\n✓ Sample has sufficient historical data ({date_range_sample:.2f} years)")
    
    # Save to public directory
    os.makedirs(os.path.dirname(sample_output_path), exist_ok=True)
    sample_df.to_csv(sample_output_path, index=False)
    print(f"\n✓ Sample data template saved to {sample_output_path}")
    
    return True

if __name__ == '__main__':
    success = create_sample_template()
    if success:
        print("\n✓ Done! Sample data template is ready for frontend use.")
    else:
        print("\n✗ Failed to create sample template.")

