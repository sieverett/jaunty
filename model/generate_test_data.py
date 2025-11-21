#!/usr/bin/env python3
"""
Generate test_data.csv with active leads for testing the ensemble pipeline.

This script creates synthetic travel booking data matching data_template.csv structure,
including active leads in various stages (inquiry, quote_sent, booked, final_payment).
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os

def generate_test_data(n_records=500, start_date='2022-01-01', end_date=None, active_lead_pct=0.25, random_seed=None, bookings_per_month=25):
    """
    Generate synthetic travel booking data matching data_template.csv structure.
    
    Column order matches template:
    lead_id, inquiry_date, destination, trip_price, lead_source, current_stage,
    is_repeat_customer, quote_date, booking_date, trip_date, final_payment_date, duration_days
    
    Parameters:
    - n_records: Total number of records to generate
    - start_date: Start date for historical data
    - end_date: End date (used as "today" for active leads). If None, uses current date.
    - active_lead_pct: Percentage of leads that should be active (default 25%)
    - random_seed: Random seed for reproducibility. If None, uses current time for varied datasets (default None)
    - bookings_per_month: Target average number of bookings per month (default 25)
    """
    
    # Set random seeds only if specified (for reproducibility)
    # If None, each run will generate different data (useful for robustness testing)
    if random_seed is not None:
        random.seed(random_seed)
        np.random.seed(random_seed)
    else:
        # Use current time as seed for variation
        import time
        random.seed(int(time.time() * 1000) % 2**32)
        np.random.seed(int(time.time() * 1000) % 2**32)
    
    if end_date is None:
        end_date = datetime.now().strftime('%Y-%m-%d')
    
    start = pd.to_datetime(start_date)
    end = pd.to_datetime(end_date)
    today = end  # Use end_date as "today" for determining active leads
    
    # Calculate number of months in date range
    months_in_range = (end.year - start.year) * 12 + (end.month - start.month) + 1
    target_bookings = int(months_in_range * bookings_per_month)
    
    # Adjust n_records to ensure we have enough leads to generate target bookings
    # Assuming ~40% conversion rate on average, we need more leads
    estimated_conversion_rate = 0.40
    min_records_needed = int(target_bookings / estimated_conversion_rate)
    if min_records_needed > n_records:
        n_records = min_records_needed
    
    data = []
    n_active = int(n_records * active_lead_pct)
    
    # Generate booking dates evenly distributed across months
    booking_dates_by_month = {}
    current_month = start.replace(day=1)
    month_idx = 0
    while current_month <= end:
        # Generate bookings for this month with variance from 15-35 per month
        bookings_this_month = random.randint(15, 35)
        
        # Distribute bookings throughout the month
        days_in_month = (current_month + pd.DateOffset(months=1) - pd.DateOffset(days=1)).day
        booking_dates_by_month[month_idx] = [
            current_month + timedelta(days=random.randint(1, days_in_month))
            for _ in range(bookings_this_month)
        ]
        current_month += pd.DateOffset(months=1)
        month_idx += 1
    
    # Flatten booking dates and shuffle
    all_booking_dates = []
    for dates in booking_dates_by_month.values():
        all_booking_dates.extend(dates)
    random.shuffle(all_booking_dates)
    
    booking_date_idx = 0
    
    for i in range(n_records):
        # Determine if this should be an active lead
        is_active = (i < n_active)
        
        if is_active:
            # Active leads: recent inquiry dates (within last 6 months)
            days_back = random.randint(0, 180)
            inquiry_date = today - timedelta(days=days_back)
        else:
            # Historical leads: spread across entire date range
            inquiry_date = start + timedelta(days=random.randint(0, (end - start).days))
        
        # Destination and characteristics (matching template values)
        destination = random.choice(['Latin America', 'Europe', 'Asia'])
        lead_source = random.choice(['Referral', 'Website', 'Repeat', 'Social Media'])
        duration = random.choice([7, 10, 14, 21])
        
        # Base price (matching template ranges)
        base_prices = {'Latin America': 3500, 'Europe': 4500, 'Asia': 5000}
        base_price = base_prices[destination]
        trip_price = base_price + (duration - 7) * 200 + random.gauss(0, 500)
        trip_price = max(2000, trip_price)
        
        is_repeat = 1 if lead_source == 'Repeat' else int(np.random.choice([0, 1], p=[0.8, 0.2]))
        
        # Initialize date fields as empty strings (matching template format)
        quote_date = ''
        booking_date = ''
        trip_date = ''
        final_payment_date = ''
        
        if is_active:
            # Active lead: assign to one of the active stages with realistic funnel distribution
            # More leads at earlier stages, fewer at later stages (proper funnel)
            stage_roll = random.random()
            if stage_roll < 0.50:
                # inquiry stage: just inquired, no dates filled (50% of active leads)
                current_stage = 'inquiry'
            elif stage_roll < 0.80:
                # quote_sent: quote sent, waiting for response (30% of active leads)
                current_stage = 'quote_sent'
                quote_date = inquiry_date + timedelta(days=random.randint(1, 7))
            elif stage_roll < 0.95:
                # booked: booked but trip hasn't happened yet (15% of active leads)
                current_stage = 'booked'
                quote_date = inquiry_date + timedelta(days=random.randint(1, 7))
                booking_date = quote_date + timedelta(days=random.randint(5, 30))
                # Trip date in the future (30-180 days from booking)
                trip_date = booking_date + timedelta(days=random.randint(30, 180))
            else:
                # final_payment: final payment made, trip upcoming (5% of active leads)
                current_stage = 'final_payment'
                quote_date = inquiry_date + timedelta(days=random.randint(1, 7))
                booking_date = quote_date + timedelta(days=random.randint(5, 30))
                trip_date = booking_date + timedelta(days=random.randint(30, 180))
                final_payment_date = trip_date - timedelta(days=random.randint(7, 30))
        else:
            # Historical lead: use booking dates to target ~25 bookings per month
            # Quote sent
            if random.random() < 0.85:
                quote_date = inquiry_date + timedelta(days=random.randint(1, 10))
                
                # Determine if this lead should be a booking based on available booking dates
                # This ensures we hit our target of ~25 bookings per month
                should_book = False
                booking_date = None
                
                if booking_date_idx < len(all_booking_dates):
                    # Use the pre-generated booking date
                    target_booking_date = all_booking_dates[booking_date_idx]
                    # Only book if inquiry date is before target booking date
                    if inquiry_date <= target_booking_date:
                        should_book = True
                        booking_date = target_booking_date
                        booking_date_idx += 1
                
                # Fallback: use conversion logic if we've used all pre-generated dates
                if not should_book:
                    base_conversion = 0.35
                    if is_repeat:
                        base_conversion += 0.25
                    if lead_source == 'Referral':
                        base_conversion += 0.15
                    base_conversion = min(base_conversion, 0.85)
                    should_book = random.random() < base_conversion
                    if should_book:
                        booking_date = quote_date + timedelta(days=random.randint(5, 45))
                
                if should_book:
                    lead_time_days = random.randint(30, 180)
                    trip_date = booking_date + timedelta(days=lead_time_days)
                    final_payment_date = trip_date - timedelta(days=random.randint(30, 45))
                    
                    if random.random() < 0.05:
                        current_stage = 'cancelled'
                        trip_price = 0
                    else:
                        current_stage = 'completed'
                else:
                    current_stage = 'lost'
                    trip_price = 0
                    # Keep dates as empty strings for lost leads
            else:
                current_stage = 'lost'
                trip_price = 0
                # Keep dates as empty strings
        
        # Format dates as strings (YYYY-MM-DD) or empty string
        def format_date(dt):
            if dt == '' or dt is None:
                return ''
            return dt.strftime('%Y-%m-%d') if isinstance(dt, (datetime, pd.Timestamp)) else dt
        
        data.append({
            'lead_id': f'LEAD_{i:04d}',
            'inquiry_date': inquiry_date.strftime('%Y-%m-%d'),
            'destination': destination,
            'trip_price': trip_price,
            'lead_source': lead_source,
            'current_stage': current_stage,
            'is_repeat_customer': is_repeat,
            'quote_date': format_date(quote_date),
            'booking_date': format_date(booking_date),
            'trip_date': format_date(trip_date),
            'final_payment_date': format_date(final_payment_date),
            'duration_days': duration
        })
    
    # Create DataFrame with exact column order matching template
    column_order = [
        'lead_id', 'inquiry_date', 'destination', 'trip_price', 'lead_source', 
        'current_stage', 'is_repeat_customer', 'quote_date', 'booking_date', 
        'trip_date', 'final_payment_date', 'duration_days'
    ]
    df = pd.DataFrame(data)
    df = df[column_order]  # Ensure correct column order
    
    return df


if __name__ == '__main__':
    # Generate test data with active leads
    # Using current date as end_date so active leads are truly "active"
    today = datetime.now().strftime('%Y-%m-%d')
    
    import sys
    
    # Parse command-line arguments
    random_seed = None
    output_file = None
    
    # Check for seed argument
    if len(sys.argv) > 1:
        try:
            random_seed = int(sys.argv[1])
            print(f"Using provided random seed: {random_seed} (deterministic)")
        except ValueError:
            # If not a number, treat as output filename
            output_file = sys.argv[1]
            print(f"Using provided output filename: {output_file}")
    
    # Check for output filename as second argument
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
        print(f"Using provided output filename: {output_file}")
    
    if random_seed is None and output_file is None:
        print("No seed provided - generating varied dataset (good for robustness testing)")
        print("  Usage: python generate_test_data.py [seed] [output_file.csv]")
        print("  Examples:")
        print("    python generate_test_data.py                    # Varied data, auto filename")
        print("    python generate_test_data.py 42                 # Deterministic data, auto filename")
        print("    python generate_test_data.py test_run_1.csv     # Varied data, custom filename")
        print("    python generate_test_data.py 42 test_run_1.csv # Deterministic data, custom filename")
    
    print("Generating synthetic test data matching data_template.csv structure...")
    print("="*70)
    print(f"Using '{today}' as 'today' for active leads")
    
    test_data = generate_test_data(n_records=500, start_date='2022-01-01', end_date=today, active_lead_pct=0.25, random_seed=random_seed, bookings_per_month=25)
    
    # Determine output path (save in data/ directory)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    data_dir = os.path.join(project_root, 'data')
    os.makedirs(data_dir, exist_ok=True)  # Create data directory if it doesn't exist
    
    # Use provided filename or generate timestamped filename
    if output_file:
        # If no directory specified, save to data/ directory
        if not os.path.dirname(output_file):
            test_csv_path = os.path.join(data_dir, output_file)
        else:
            test_csv_path = output_file
        # Ensure .csv extension
        if not test_csv_path.endswith('.csv'):
            test_csv_path += '.csv'
    else:
        test_csv_path = os.path.join(data_dir, f'test_data_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv')
    
    # Save to CSV (without index, matching template format)
    test_data.to_csv(test_csv_path, index=False)
    print(f"\n✓ Test data saved to {test_csv_path}")
    
    print(f"\nData summary:")
    print(f"  Total records: {len(test_data)}")
    print(f"  Completed trips: {len(test_data[test_data['current_stage'] == 'completed'])}")
    print(f"  Lost leads: {len(test_data[test_data['current_stage'] == 'lost'])}")
    print(f"  Cancelled: {len(test_data[test_data['current_stage'] == 'cancelled'])}")
    
    # Active pipeline breakdown
    active = test_data[test_data['current_stage'].isin(['inquiry', 'quote_sent', 'booked', 'final_payment'])]
    print(f"\n  Active pipeline: {len(active)} leads")
    if len(active) > 0:
        print(f"    - inquiry: {len(active[active['current_stage'] == 'inquiry'])}")
        print(f"    - quote_sent: {len(active[active['current_stage'] == 'quote_sent'])}")
        print(f"    - booked: {len(active[active['current_stage'] == 'booked'])}")
        print(f"    - final_payment: {len(active[active['current_stage'] == 'final_payment'])}")
        active_revenue = active['trip_price'].sum()
        print(f"    - Total pipeline value: ${active_revenue:,.0f}")
    
    # Show date ranges
    completed = test_data[test_data['current_stage'] == 'completed'].copy()
    if not completed.empty:
        completed['trip_date_dt'] = pd.to_datetime(completed['trip_date'])
        print(f"\n  Completed trip date range: {completed['trip_date_dt'].min().date()} to {completed['trip_date_dt'].max().date()}")
        date_range_years = (completed['trip_date_dt'].max() - completed['trip_date_dt'].min()).days / 365.25
        print(f"  Historical date span: {date_range_years:.2f} years")
    
    # Show active lead date ranges
    if len(active) > 0:
        active_copy = active.copy()
        active_copy['inquiry_date_dt'] = pd.to_datetime(active_copy['inquiry_date'])
        print(f"\n  Active leads inquiry date range: {active_copy['inquiry_date_dt'].min().date()} to {active_copy['inquiry_date_dt'].max().date()}")
    
    print(f"\n✓ Column order matches template: {list(test_data.columns) == ['lead_id', 'inquiry_date', 'destination', 'trip_price', 'lead_source', 'current_stage', 'is_repeat_customer', 'quote_date', 'booking_date', 'trip_date', 'final_payment_date', 'duration_days']}")

