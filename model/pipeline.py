"""
Main ensemble pipeline orchestrator.
Coordinates data loading, training, and inference.
"""

import pandas as pd
from typing import Optional, Dict
from .data_loader import DataLoader
from .trainer import ModelTrainer
from .inference import ForecastInference


class EnsemblePipeline:
    """Main pipeline for ensemble revenue forecasting"""
    
    def __init__(self, model_dir: str = "model/artifacts", min_years: float = 1.0):
        """
        Initialize pipeline.
        
        Parameters:
        -----------
        model_dir : str
            Directory for model artifacts (relative to project root)
        min_years : float
            Minimum years of historical data required
        """
        # Resolve model_dir relative to project root (where this file is)
        import os
        if not os.path.isabs(model_dir):
            # Get the directory where this file is located (model/)
            current_file_dir = os.path.dirname(os.path.abspath(__file__))
            # Go up one level to project root, then join model_dir
            project_root = os.path.dirname(current_file_dir)
            self.model_dir = os.path.join(project_root, model_dir)
        else:
            self.model_dir = model_dir
        
        self.data_loader = DataLoader(min_years=min_years)
        self.trainer = ModelTrainer(model_dir=self.model_dir)
        self.inference = ForecastInference(model_dir=self.model_dir)
        self.data = None
        self.monthly_revenue = None
    
    def train(self, csv_path: str) -> Dict:
        """
        Train models from CSV data.
        
        Parameters:
        -----------
        csv_path : str
            Path to CSV file with historical data
            
        Returns:
        --------
        dict
            Training metadata
        """
        print("="*70)
        print("ENSEMBLE PIPELINE - TRAINING")
        print("="*70)
        
        # Load data
        print(f"\nLoading data from {csv_path}...")
        self.data = self.data_loader.load_csv(csv_path)
        
        # Display data summary
        metadata = self.data_loader.get_metadata()
        print(f"\nData Summary:")
        print(f"  Total records: {metadata['total_records']}")
        print(f"  Completed trips: {metadata['completed_trips']}")
        print(f"  Total revenue: ${metadata['total_revenue']:,.0f}")
        print(f"  Date range: {metadata['date_range_years']:.2f} years")
        print(f"  Conversion rate: {metadata['conversion_rate']:.1%}")
        
        # Prepare monthly revenue
        print("\nPreparing monthly revenue time series...")
        self.monthly_revenue = self.data_loader.prepare_monthly_revenue()
        print(f"  Monthly data points: {len(self.monthly_revenue)}")
        
        # Train models
        training_metadata = self.trainer.train_all(
            monthly_revenue=self.monthly_revenue,
            full_data=self.data
        )
        
        # Display training metrics summary
        print("\n" + "="*70)
        print("TRAINING METADATA")
        print("="*70)
        for model_name, metrics in training_metadata.items():
            print(f"\n{model_name.upper()}:")
            for key, value in metrics.items():
                if isinstance(value, dict):
                    print(f"  {key}:")
                    for k, v in value.items():
                        print(f"    {k}: {v}")
                else:
                    print(f"  {key}: {value}")
        
        return training_metadata
    
    def get_training_metrics(self) -> Dict:
        """
        Get training metrics for all models.
        
        Returns:
        --------
        dict
            Training metrics dictionary
        """
        return self.trainer.training_metadata.copy()
    
    def forecast(
        self,
        csv_path: Optional[str] = None,
        forecast_date: Optional[str] = None
    ) -> pd.DataFrame:
        """
        Generate 12-month revenue forecast.
        
        Parameters:
        -----------
        csv_path : str, optional
            Path to CSV file (if not already loaded)
        forecast_date : str, optional
            Forecast reference date (default: today)
            
        Returns:
        --------
        pd.DataFrame
            12-month forecast with columns: date, forecast, lower, upper
        """
        print("="*70)
        print("ENSEMBLE PIPELINE - INFERENCE")
        print("="*70)
        print("*** DEBUG: Starting forecast() method ***")
        print(f"*** DEBUG: self.data is None: {self.data is None} ***")
        print(f"*** DEBUG: csv_path: {csv_path} ***")
        print(f"*** DEBUG: forecast_date: {forecast_date} ***")
        
        # Load data if not already loaded
        if self.data is None:
            if csv_path is None:
                raise ValueError("Must provide csv_path if data not already loaded")
            
            print(f"\nLoading data from {csv_path}...")
            self.data = self.data_loader.load_csv(csv_path)
        
        # CRITICAL: ALWAYS re-prepare monthly_revenue during inference to exclude incomplete months
        # This MUST happen even if monthly_revenue was already prepared during training
        # because training includes all months, but inference should exclude incomplete recent months
        print("\n*** DEBUG: About to re-prepare monthly_revenue ***")
        print("\n" + "="*70)
        print("[INFERENCE] Re-preparing monthly revenue with incomplete month exclusion...")
        print("="*70)
        print(f"  Data loaded: {self.data is not None}")
        if self.data is not None:
            print(f"  Data shape: {self.data.shape}")
        if self.monthly_revenue is not None:
            print(f"  Previous monthly_revenue had {len(self.monthly_revenue)} months")
            if len(self.monthly_revenue) > 0:
                print(f"  Previous date range: {self.monthly_revenue['date'].min().strftime('%Y-%m')} to {self.monthly_revenue['date'].max().strftime('%Y-%m')}")
                print(f"  Last month revenue: ${self.monthly_revenue['revenue'].iloc[-1]:,.0f}")
        else:
            print("  Previous monthly_revenue: None")
        
        try:
            self.monthly_revenue = self.data_loader.prepare_monthly_revenue(forecast_date=forecast_date)
            print(f"\n  After exclusion: {len(self.monthly_revenue)} months")
            if len(self.monthly_revenue) > 0:
                print(f"  New date range: {self.monthly_revenue['date'].min().strftime('%Y-%m')} to {self.monthly_revenue['date'].max().strftime('%Y-%m')}")
                print(f"  Last month revenue: ${self.monthly_revenue['revenue'].iloc[-1]:,.0f}")
        except Exception as e:
            print(f"  ERROR preparing monthly revenue: {e}")
            import traceback
            traceback.print_exc()
            raise
        print("="*70)
        
        # Load trained models
        print("\nLoading trained models...")
        self.inference.load_models()
        
        # Get active pipeline
        print("\nAnalyzing active pipeline...")
        active_pipeline = self.data_loader.get_active_pipeline(forecast_date=forecast_date)
        print(f"  Active leads: {len(active_pipeline)}")
        
        if active_pipeline.empty:
            print("  ⚠ No active leads found in pipeline")
            print("     This is normal for historical data where all leads are resolved.")
            print("     For real forecasting, include leads with stages: inquiry, quote_sent, booked, final_payment")
            
            # Show stage distribution in data
            if self.data is not None:
                stage_dist = self.data['current_stage'].value_counts()
                print(f"\n  Current stage distribution in data:")
                for stage, count in stage_dist.items():
                    print(f"    {stage}: {count}")
        else:
            print(f"  Pipeline value: ${active_pipeline['trip_price'].sum():,.0f}")
            print(f"  By stage:")
            stage_summary = active_pipeline.groupby('current_stage').agg({
                'lead_id': 'count',
                'trip_price': 'sum'
            })
            for stage, row in stage_summary.iterrows():
                print(f"    {stage}: {row['lead_id']} leads, ${row['trip_price']:,.0f}")
        
        # Generate forecast
        forecast_df = self.inference.generate_12_month_forecast(
            monthly_revenue=self.monthly_revenue,
            active_pipeline=active_pipeline
        )
        
        return forecast_df
    
    def train_and_forecast(self, csv_path: str) -> pd.DataFrame:
        """
        Train models and generate forecast in one call.
        
        Parameters:
        -----------
        csv_path : str
            Path to CSV file with historical data
            
        Returns:
        --------
        pd.DataFrame
            12-month forecast
        """
        # Train
        self.train(csv_path)
        
        # Forecast
        forecast_df = self.forecast()
        
        return forecast_df

