"""
Data loader for revenue forecasting pipeline.
Loads and validates CSV data with minimum 1 year requirement.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Dict
import warnings
warnings.filterwarnings('ignore')


class DataLoader:
    """Load and validate historical revenue data"""
    
    def __init__(self, min_years: float = 1.0):
        """
        Initialize data loader.
        
        Parameters:
        -----------
        min_years : float
            Minimum years of historical data required (default: 1.0)
        """
        self.min_years = min_years
        self.data = None
        self.metadata = {}
    
    def load_csv(self, csv_path: str) -> pd.DataFrame:
        """
        Load CSV file and validate data requirements.
        
        Parameters:
        -----------
        csv_path : str
            Path to CSV file
            
        Returns:
        --------
        pd.DataFrame
            Loaded and validated dataframe
            
        Raises:
        -------
        ValueError
            If data doesn't meet minimum requirements
        """
        # Read CSV - skip comment lines and handle empty date fields
        # First, read without skipping to check for comments
        with open(csv_path, 'r') as f:
            lines = f.readlines()
        
        # Find where data ends (lines starting with #)
        data_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith('#'):
                data_lines.append(line)
        
        # Read CSV from string, handling empty date fields
        import io
        csv_content = ''.join(data_lines)
        self.data = pd.read_csv(io.StringIO(csv_content))
        
        # Clean up: remove any rows that are all NaN (from comment parsing)
        self.data = self.data.dropna(how='all')
        
        # Validate required columns
        required_cols = [
            'inquiry_date', 'trip_price', 'current_stage', 
            'trip_date', 'booking_date'
        ]
        missing_cols = [col for col in required_cols if col not in self.data.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")
        
        # Convert date columns - handle empty strings as NaT
        date_cols = ['inquiry_date', 'trip_date', 'booking_date', 
                     'quote_date', 'final_payment_date']
        for col in date_cols:
            if col in self.data.columns:
                # Replace empty strings with NaN before conversion
                self.data[col] = self.data[col].replace('', np.nan)
                self.data[col] = pd.to_datetime(self.data[col], errors='coerce')
        
        # Validate minimum historical data
        self._validate_minimum_data()
        
        # Calculate metadata
        self._calculate_metadata()
        
        return self.data
    
    def _validate_minimum_data(self) -> None:
        """Validate that we have at least min_years of historical data"""
        
        # Get completed trips with trip dates
        completed = self.data[
            (self.data['current_stage'] == 'completed') & 
            (self.data['trip_date'].notna())
        ].copy()
        
        if completed.empty:
            raise ValueError(
                "No completed trips found. Need at least some completed trips "
                "with trip_date to forecast revenue."
            )
        
        # Calculate date range
        min_date = completed['trip_date'].min()
        max_date = completed['trip_date'].max()
        date_range_days = (max_date - min_date).days
        date_range_years = date_range_days / 365.25
        
        if date_range_years < self.min_years:
            raise ValueError(
                f"Historical data spans only {date_range_years:.2f} years. "
                f"Minimum {self.min_years} years required. "
                f"Date range: {min_date.date()} to {max_date.date()}"
            )
        
        self.metadata['date_range_years'] = date_range_years
        self.metadata['min_date'] = min_date
        self.metadata['max_date'] = max_date
    
    def _calculate_metadata(self) -> None:
        """Calculate data statistics"""
        
        # Revenue statistics
        completed = self.data[self.data['current_stage'] == 'completed'].copy()
        
        self.metadata.update({
            'total_records': len(self.data),
            'completed_trips': len(completed),
            'total_revenue': completed['trip_price'].sum() if not completed.empty else 0,
            'avg_trip_price': completed['trip_price'].mean() if not completed.empty else 0,
            'conversion_rate': len(completed) / len(self.data) if len(self.data) > 0 else 0
        })
    
    def prepare_monthly_revenue(self, forecast_date: Optional[str] = None, exclude_incomplete_months: int = 2) -> pd.DataFrame:
        """
        Prepare monthly revenue time series from completed trips.
        
        Parameters:
        -----------
        forecast_date : str, optional
            Forecast reference date. Months after this date will be excluded.
        exclude_incomplete_months : int, default=2
            Number of most recent months to exclude if they appear incomplete.
            A month is considered incomplete if its trip_count is < 50% of the rolling average.
        
        Returns:
        --------
        pd.DataFrame
            Monthly revenue data with columns: date, revenue, trip_count
        """
        if self.data is None:
            raise ValueError("Data must be loaded first")
        
        # Force print to stderr to ensure it shows up (stdout might be buffered)
        import sys
        import traceback
        def debug_print(*args, **kwargs):
            print(*args, **kwargs, file=sys.stderr)
            sys.stderr.flush()
        
        # Always print - this should show up no matter what
        print("\n" + "="*70)
        print(f"[prepare_monthly_revenue] CALLED")
        print(f"  forecast_date={forecast_date}")
        print(f"  exclude_incomplete_months={exclude_incomplete_months}")
        print(f"  data loaded: {self.data is not None}")
        if self.data is not None:
            print(f"  data shape: {self.data.shape}")
        print("="*70)
        import sys
        sys.stdout.flush()
        
        # Get completed trips
        completed = self.data[
            (self.data['current_stage'] == 'completed') & 
            (self.data['trip_date'].notna())
        ].copy()
        
        if completed.empty:
            return pd.DataFrame(columns=['date', 'revenue', 'trip_count'])
        
        # Convert forecast_date to datetime if provided
        if forecast_date is not None:
            forecast_date_dt = pd.to_datetime(forecast_date)
            # Exclude trips after forecast_date
            completed = completed[completed['trip_date'] <= forecast_date_dt]
        
        if completed.empty:
            return pd.DataFrame(columns=['date', 'revenue', 'trip_count'])
        
        # Group by month
        completed['month'] = completed['trip_date'].dt.to_period('M')
        monthly_revenue = completed.groupby('month').agg({
            'trip_price': 'sum',
            'lead_id': 'count'
        }).reset_index()
        
        monthly_revenue.columns = ['date', 'revenue', 'trip_count']
        monthly_revenue['date'] = monthly_revenue['date'].dt.to_timestamp()
        
        # Fill missing months with zero revenue
        date_range = pd.date_range(
            start=monthly_revenue['date'].min(),
            end=monthly_revenue['date'].max(),
            freq='MS'
        )
        
        monthly_revenue = monthly_revenue.set_index('date').reindex(date_range).reset_index()
        monthly_revenue.columns = ['date', 'revenue', 'trip_count']
        monthly_revenue['revenue'] = monthly_revenue['revenue'].fillna(0)
        monthly_revenue['trip_count'] = monthly_revenue['trip_count'].fillna(0)
        
        debug_print(f"\n[DEBUG] Preparing monthly revenue: {len(monthly_revenue)} months")
        if len(monthly_revenue) > 0:
            debug_print(f"[DEBUG]   Date range: {monthly_revenue['date'].min().strftime('%Y-%m')} to {monthly_revenue['date'].max().strftime('%Y-%m')}")
            debug_print(f"[DEBUG]   Last 3 months revenue:")
            for _, row in monthly_revenue.tail(3).iterrows():
                debug_print(f"[DEBUG]     {row['date'].strftime('%Y-%m')}: ${row['revenue']:,.0f} revenue, {row['trip_count']:.0f} trips")
        
        # Exclude incomplete recent months
        # Check both trip count and revenue to catch incomplete months
        debug_print(f"\n[DEBUG] Checking for incomplete months (exclude_incomplete_months={exclude_incomplete_months})...")
        if len(monthly_revenue) > exclude_incomplete_months:
            # Calculate rolling averages (excluding zeros)
            non_zero_months = monthly_revenue[monthly_revenue['trip_count'] > 0]
            if len(non_zero_months) > 0:
                # Use 6-month rolling average, or all available if less than 6 months
                window = min(6, len(non_zero_months))
                rolling_avg_trips = non_zero_months['trip_count'].tail(window).mean()
                rolling_avg_revenue = non_zero_months['revenue'].tail(window).mean()
                
                # Check last N months for incompleteness (check more months to catch consecutive low months)
                check_months = min(exclude_incomplete_months + 2, len(monthly_revenue))  # Check up to 4 months
                last_months = monthly_revenue.tail(check_months)
                
                debug_print(f"[DEBUG] Checking last {check_months} months for incompleteness:")
                debug_print(f"[DEBUG]   Rolling avg: {rolling_avg_trips:.1f} trips, ${rolling_avg_revenue:,.0f} revenue")
                
                # A month is incomplete if:
                # 1. Trip count < 50% of rolling average, OR
                # 2. Revenue < 30% of rolling average (more aggressive for revenue)
                # 3. Revenue is zero or near-zero (< $1000) - always exclude
                incomplete_mask = (
                    (last_months['trip_count'] < (rolling_avg_trips * 0.5)) |
                    (last_months['revenue'] < (rolling_avg_revenue * 0.3)) |
                    (last_months['revenue'] < 1000)  # Always exclude near-zero months
                )
                
                # Debug: print what we're checking
                for idx, row in last_months.iterrows():
                    is_incomplete = incomplete_mask.loc[idx]
                    reason = []
                    if row['trip_count'] < (rolling_avg_trips * 0.5):
                        reason.append(f"trips ({row['trip_count']:.0f} < {rolling_avg_trips * 0.5:.0f})")
                    if row['revenue'] < (rolling_avg_revenue * 0.3):
                        reason.append(f"revenue (${row['revenue']:,.0f} < ${rolling_avg_revenue * 0.3:,.0f})")
                    if row['revenue'] < 1000:
                        reason.append(f"near-zero (${row['revenue']:,.0f} < $1,000)")
                    
                    status = "INCOMPLETE" if is_incomplete else "complete"
                    debug_print(f"[DEBUG]   {row['date'].strftime('%Y-%m')}: ${row['revenue']:,.0f} revenue, {row['trip_count']:.0f} trips - {status}")
                    if reason:
                        debug_print(f"[DEBUG]     Reason: {', '.join(reason)}")
                
                if incomplete_mask.any():
                    # Find consecutive incomplete months from the end
                    # Work backwards from the last month
                    months_to_exclude = []
                    for i in range(len(last_months) - 1, -1, -1):
                        idx = last_months.index[i]
                        if incomplete_mask.loc[idx]:
                            months_to_exclude.append(last_months.iloc[i])
                        else:
                            # Stop at first complete month
                            break
                    
                    if len(months_to_exclude) > 0:
                        # Exclude all incomplete months from the end
                        # months_to_exclude contains Series objects, so access via .iloc or convert to dict
                        # Get the earliest date from the months to exclude
                        excluded_dates_list = []
                        cutoff_dates = []
                        for m in months_to_exclude:
                            # m is a Series, access date via index or iloc
                            date_val = m['date'] if isinstance(m, pd.Series) else m.get('date')
                            excluded_dates_list.append(date_val.strftime('%Y-%m'))
                            cutoff_dates.append(date_val)
                        
                        # Use the EARLIEST date to exclude all incomplete months
                        cutoff_date = min(cutoff_dates)
                        original_len = len(monthly_revenue)
                        monthly_revenue = monthly_revenue[monthly_revenue['date'] < cutoff_date]
                        debug_print(f"[DEBUG] ✓ Excluded {len(months_to_exclude)} incomplete month(s): {', '.join(excluded_dates_list)}")
                        debug_print(f"[DEBUG]   Cutoff date: {cutoff_date.strftime('%Y-%m')}")
                        debug_print(f"[DEBUG]   Historical data now ends at: {monthly_revenue['date'].max().strftime('%Y-%m')}")
                        debug_print(f"[DEBUG]   Reduced from {original_len} to {len(monthly_revenue)} months")
                else:
                    debug_print(f"[DEBUG] ✓ All checked months appear complete")
            else:
                debug_print(f"[DEBUG] ⚠ No non-zero months found for comparison")
        
        # Additional safeguard: If last month is dramatically lower than second-to-last, exclude it
        # This catches cases where thresholds might not catch it but there's still a clear drop
        if len(monthly_revenue) >= 2:
            last_month = monthly_revenue.iloc[-1]
            second_last = monthly_revenue.iloc[-2]
            
            # If last month revenue is < 20% of second-to-last month, exclude it
            if last_month['revenue'] > 0 and second_last['revenue'] > 0:
                revenue_ratio = last_month['revenue'] / second_last['revenue']
                if revenue_ratio < 0.2:
                    debug_print(f"[DEBUG] ⚠ Last month ({last_month['date'].strftime('%Y-%m')}) revenue is {revenue_ratio:.1%} of previous month")
                    debug_print(f"[DEBUG]   Excluding to prevent forecast jump (${last_month['revenue']:,.0f} vs ${second_last['revenue']:,.0f})")
                    monthly_revenue = monthly_revenue.iloc[:-1]
                    debug_print(f"[DEBUG]   Historical data now ends at: {monthly_revenue['date'].max().strftime('%Y-%m')}")
        
        return monthly_revenue
    
    def get_active_pipeline(self, forecast_date: Optional[str] = None) -> pd.DataFrame:
        """
        Get active pipeline (leads not yet completed/lost).
        
        Parameters:
        -----------
        forecast_date : str, optional
            Forecast reference date (default: today)
            
        Returns:
        --------
        pd.DataFrame
            Active pipeline leads
        """
        if self.data is None:
            raise ValueError("Data must be loaded first")
        
        if forecast_date is None:
            forecast_date = datetime.now()
        else:
            forecast_date = pd.to_datetime(forecast_date)
        
        # Active stages (leads that haven't been resolved yet)
        active_stages = ['inquiry', 'quote_sent', 'booked', 'final_payment']
        
        # Get active pipeline - leads that:
        # 1. Were inquired before forecast date
        # 2. Are still in an active stage (not completed/lost/cancelled)
        active = self.data[
            (self.data['inquiry_date'] <= forecast_date) &
            (self.data['current_stage'].isin(active_stages))
        ].copy()
        
        # Also include booked/final_payment leads with future trip dates
        # (these are already booked but trip hasn't happened yet)
        future_trips = self.data[
            (self.data['current_stage'] == 'completed') &
            (self.data['trip_date'].notna()) &
            (self.data['trip_date'] > forecast_date)
        ].copy()
        
        if not future_trips.empty:
            # Treat these as 'final_payment' stage for forecasting
            future_trips['current_stage'] = 'final_payment'
            active = pd.concat([active, future_trips], ignore_index=True)
        
        return active
    
    def get_metadata(self) -> Dict:
        """Get data metadata"""
        return self.metadata.copy()

