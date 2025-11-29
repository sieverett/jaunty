"""
Inference module for generating 12-month revenue forecasts.
Separated from training logic.
"""

import pandas as pd
import numpy as np
import pickle
import os
from typing import Dict, Optional, List
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False


class ForecastInference:
    """Generate 12-month revenue forecasts using trained models"""
    
    def __init__(self, model_dir: str = "model/artifacts"):
        """
        Initialize inference engine.

        Parameters:
        -----------
        model_dir : str
            Directory containing trained models
        """
        # Store model directory (should already be resolved by pipeline)
        self.model_dir = model_dir
        self.prophet_model = None
        self.xgboost_model = None
        self.label_encoders = {}
        self.feature_names = []
        self.stage_conversion_rates = None  # Will be loaded from artifacts
        self.ensemble_weights = {
            'prophet': 0.4,
            'xgboost': 0.3,
            'pipeline': 0.3  # Increased weight for pipeline (more conservative)
        }
    
    def load_models(self) -> None:
        """Load trained models from disk"""

        # Use the model_dir (should already be resolved by pipeline)
        abs_model_dir = os.path.abspath(self.model_dir)

        print(f"Loading models from: {abs_model_dir}")

        # Check if directory exists
        if not os.path.exists(abs_model_dir):
            print(f"⚠ Model directory does not exist: {abs_model_dir}")
            print("   Models need to be trained first using pipeline.train()")
            return

        # List files in directory
        files_in_dir = os.listdir(abs_model_dir)
        print(f"   Files found: {files_in_dir}")

        # Load stage conversion rates
        rates_path = os.path.join(abs_model_dir, 'stage_conversion_rates.pkl')
        if os.path.exists(rates_path):
            try:
                with open(rates_path, 'rb') as f:
                    self.stage_conversion_rates = pickle.load(f)

                # Check if we have the new segmented format
                if isinstance(self.stage_conversion_rates, dict) and 'segmented_rates' in self.stage_conversion_rates:
                    print("✓ Loaded segmented stage conversion rates")
                    flat_rates = self.stage_conversion_rates['flat_rates']
                    segmented_rates = self.stage_conversion_rates['segmented_rates']
                    print("\nFlat rates:")
                    for stage, rate in flat_rates.items():
                        print(f"   {stage}: {rate:.3f}")
                    print(f"\nSegmented rates: {len(segmented_rates)} segments loaded")
                    print(f"   Min segment size: {self.stage_conversion_rates.get('min_segment_size', 'N/A')}")
                else:
                    # Old format - just flat rates
                    print("✓ Loaded empirical stage conversion rates (flat)")
                    for stage, rate in self.stage_conversion_rates.items():
                        print(f"   {stage}: {rate:.3f}")
            except Exception as e:
                print(f"⚠ Could not load stage conversion rates: {e}")
                print("   Will use hardcoded fallback rates")
        else:
            print("⚠ Stage conversion rates file not found")
            print("   Will use hardcoded fallback rates")

        # Load Prophet model
        prophet_path = os.path.join(abs_model_dir, 'prophet_model.pkl')
        if os.path.exists(prophet_path) and PROPHET_AVAILABLE:
            try:
                with open(prophet_path, 'rb') as f:
                    self.prophet_model = pickle.load(f)
                print("✓ Loaded Prophet model")
            except Exception as e:
                print(f"⚠ Could not load Prophet model: {e}")
        elif not os.path.exists(prophet_path):
            print("⚠ Prophet model file not found")
        elif not PROPHET_AVAILABLE:
            print("⚠ Prophet not installed")

        # Load XGBoost model
        xgb_path = os.path.join(abs_model_dir, 'xgboost_model.json')
        encoders_path = os.path.join(abs_model_dir, 'label_encoders.pkl')
        features_path = os.path.join(abs_model_dir, 'feature_names.pkl')

        # Check which files exist
        missing_files = []
        if not os.path.exists(xgb_path):
            missing_files.append('xgboost_model.json')
        if not os.path.exists(encoders_path):
            missing_files.append('label_encoders.pkl')
        if not os.path.exists(features_path):
            missing_files.append('feature_names.pkl')

        if missing_files:
            print(f"⚠ XGBoost model files missing: {missing_files}")
            print("   XGBoost model needs to be trained first")
        elif XGBOOST_AVAILABLE:
            try:
                self.xgboost_model = xgb.XGBClassifier()
                self.xgboost_model.load_model(xgb_path)

                with open(encoders_path, 'rb') as f:
                    self.label_encoders = pickle.load(f)

                with open(features_path, 'rb') as f:
                    self.feature_names = pickle.load(f)

                print("✓ Loaded XGBoost model")
            except Exception as e:
                print(f"⚠ Could not load XGBoost model: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("⚠ XGBoost not installed")
    
    def forecast_prophet(self, periods: int = 12) -> pd.DataFrame:
        """
        Generate Prophet forecast.
        
        Parameters:
        -----------
        periods : int
            Number of months to forecast (default: 12)
            
        Returns:
        --------
        pd.DataFrame
            Forecast with columns: date, forecast, lower, upper
        """
        if self.prophet_model is None:
            return pd.DataFrame()
        
        # Create future dataframe
        future = self.prophet_model.make_future_dataframe(
            periods=periods,
            freq='MS'
        )
        
        # If using logistic growth, set capacity for future periods
        if 'cap' in self.prophet_model.history.columns:
            # Get the capacity from training data
            training_cap = self.prophet_model.history['cap'].iloc[-1]
            future['cap'] = training_cap
            future['floor'] = 0
        
        # Generate forecast
        forecast_df = self.prophet_model.predict(future)
        
        # Extract future periods only
        last_historical = forecast_df['ds'].max() - pd.DateOffset(months=periods)
        future_forecast = forecast_df[forecast_df['ds'] > last_historical].copy()
        
        result = pd.DataFrame({
            'date': future_forecast['ds'],
            'forecast': future_forecast['yhat'],
            'lower': future_forecast['yhat_lower'],
            'upper': future_forecast['yhat_upper']
        })
        
        # Ensure non-negative forecasts (revenue can't be negative)
        result['forecast'] = result['forecast'].clip(lower=0)
        result['lower'] = result['lower'].clip(lower=0)
        result['upper'] = result['upper'].clip(lower=0)
        
        # Keep Prophet's natural variation - don't over-smooth
        # Only apply minimal smoothing if there are extreme outliers
        if len(result) > 1:
            # Check for extreme spikes (more than 3x the median)
            median_val = result['forecast'].median()
            if median_val > 0:
                # Cap extreme outliers but preserve natural variation
                max_reasonable = median_val * 3
                result['forecast'] = result['forecast'].clip(upper=max_reasonable)
        
        return result
    
    def forecast_xgboost(self, active_pipeline: pd.DataFrame) -> Dict:
        """
        Generate XGBoost-based forecast from active pipeline.
        
        Parameters:
        -----------
        active_pipeline : pd.DataFrame
            Active leads in pipeline
            
        Returns:
        --------
        dict
            Forecast summary
        """
        if self.xgboost_model is None or active_pipeline.empty:
            return {'forecast': 0, 'details': {}}
        
        # Prepare features
        X = self._prepare_features(active_pipeline)
        
        if X.empty:
            return {'forecast': 0, 'details': {}}
        
        # Predict conversion probabilities
        probabilities = self.xgboost_model.predict_proba(X)[:, 1]
        
        # Calculate expected revenue
        active_pipeline = active_pipeline.copy()
        active_pipeline['conversion_probability'] = probabilities
        active_pipeline['expected_revenue'] = (
            active_pipeline['trip_price'] * active_pipeline['conversion_probability']
        )
        
        total_forecast = active_pipeline['expected_revenue'].sum()
        
        return {
            'forecast': total_forecast,
            'details': {
                'pipeline_count': len(active_pipeline),
                'avg_probability': probabilities.mean(),
                'total_pipeline_value': active_pipeline['trip_price'].sum()
            }
        }
    
    def forecast_pipeline(self, active_pipeline: pd.DataFrame) -> Dict:
        """
        Generate simple pipeline-based forecast using segmented conversion rates.

        Parameters:
        -----------
        active_pipeline : pd.DataFrame
            Active leads in pipeline

        Returns:
        --------
        dict
            Forecast summary
        """
        if active_pipeline.empty:
            return {'forecast': 0, 'details': {}}

        # Check if we have segmented rates loaded
        has_segmented = (
            self.stage_conversion_rates is not None and
            isinstance(self.stage_conversion_rates, dict) and
            'segmented_rates' in self.stage_conversion_rates
        )

        # Use empirical stage conversion rates if available, otherwise fallback to hardcoded
        if has_segmented:
            flat_rates = self.stage_conversion_rates['flat_rates']
            segmented_rates = self.stage_conversion_rates['segmented_rates']
            min_segment_size = self.stage_conversion_rates.get('min_segment_size', 20)
            rates_source = 'segmented'
        elif self.stage_conversion_rates is not None:
            # Backwards compatibility: old format was just a dict of flat rates
            flat_rates = self.stage_conversion_rates.copy()
            segmented_rates = {}
            min_segment_size = 20
            rates_source = 'empirical'
        else:
            # Fallback to hardcoded rates
            flat_rates = {
                'inquiry': 0.15,
                'quote_sent': 0.35,
                'booked': 0.90,
                'final_payment': 0.98
            }
            segmented_rates = {}
            min_segment_size = 20
            rates_source = 'hardcoded'

        # Calculate weighted revenue using segmented rates where available
        active_pipeline = active_pipeline.copy()

        # Track which rates were used for transparency
        segment_usage = {'segmented': 0, 'flat': 0, 'missing': 0}

        def get_conversion_rate(row):
            """Get conversion rate for a lead, using segmented rate if available"""
            stage = row['current_stage']

            # Try segmented rate first (if we have lead_source and is_repeat_customer)
            if segmented_rates and 'lead_source' in row and 'is_repeat_customer' in row:
                segment_key = (stage, row['lead_source'], int(row['is_repeat_customer']))
                if segment_key in segmented_rates:
                    segment_usage['segmented'] += 1
                    return segmented_rates[segment_key]

            # Fall back to flat rate
            if stage in flat_rates:
                segment_usage['flat'] += 1
                return flat_rates[stage]

            # No rate found (shouldn't happen for valid stages)
            segment_usage['missing'] += 1
            return 0.0

        active_pipeline['conversion_rate'] = active_pipeline.apply(get_conversion_rate, axis=1)
        active_pipeline['weighted_revenue'] = active_pipeline['trip_price'] * active_pipeline['conversion_rate']

        total_forecast = active_pipeline['weighted_revenue'].sum()

        # Build detailed response
        details = {
            'pipeline_count': len(active_pipeline),
            'total_pipeline_value': active_pipeline['trip_price'].sum(),
            'by_stage': active_pipeline.groupby('current_stage')['trip_price'].sum().to_dict(),
            'rates_source': rates_source,
            'flat_rates': flat_rates,
            'segment_usage': segment_usage
        }

        # Add segmented breakdown if available
        if segmented_rates and 'lead_source' in active_pipeline.columns:
            details['by_segment'] = active_pipeline.groupby(
                ['current_stage', 'lead_source', 'is_repeat_customer']
            ).agg({
                'trip_price': 'sum',
                'weighted_revenue': 'sum',
                'lead_id': 'count'
            }).to_dict()

        return {
            'forecast': total_forecast,
            'details': details
        }
    
    def generate_12_month_forecast(
        self,
        monthly_revenue: pd.DataFrame,
        active_pipeline: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Generate 12-month ensemble forecast.
        
        Parameters:
        -----------
        monthly_revenue : pd.DataFrame
            Historical monthly revenue
        active_pipeline : pd.DataFrame
            Active leads in pipeline
            
        Returns:
        --------
        pd.DataFrame
            12-month forecast with columns: date, forecast, lower, upper, method
        """
        print("="*70)
        print("GENERATING 12-MONTH FORECAST")
        print("="*70)
        
        forecasts = []
        
        # Get last historical date for forecast start
        recent_avg = None
        recent_std = None
        
        if monthly_revenue.empty:
            # If no historical data, use today as start
            last_date = pd.Timestamp.now().replace(day=1)
            print("Warning: No historical revenue data available. Using current date as forecast start.")
        else:
            # Ensure we're using the filtered monthly_revenue (after incomplete month exclusion)
            # Double-check: if last month is anomalously low compared to recent average, exclude it
            if len(monthly_revenue) >= 2:
                # Calculate recent average excluding the last month
                recent_months = min(12, len(monthly_revenue) - 1)  # Exclude last month from calculation
                recent_avg_excluding_last = monthly_revenue.iloc[-(recent_months+1):-1]['revenue'].mean()
                last_month_revenue = monthly_revenue['revenue'].iloc[-1]
                last_month_date = monthly_revenue['date'].iloc[-1]
                
                # Exclude if last month is < 30% of recent average (excluding itself)
                # This catches anomalously low months that weren't caught by the earlier exclusion
                if recent_avg_excluding_last > 0 and last_month_revenue < (recent_avg_excluding_last * 0.3):
                    print(f"\n⚠ Last month ({last_month_date.strftime('%Y-%m')}) has anomalously low revenue: ${last_month_revenue:,.0f}")
                    print(f"   Recent average (excluding last month): ${recent_avg_excluding_last:,.0f}")
                    print(f"   Last month is {last_month_revenue/recent_avg_excluding_last:.1%} of recent average")
                    print(f"   Excluding from historical data to prevent forecast jump")
                    monthly_revenue = monthly_revenue.iloc[:-1]
                elif last_month_revenue < 1000:  # Also exclude absolute near-zero months
                    print(f"\n⚠ Last month ({last_month_date.strftime('%Y-%m')}) has near-zero revenue: ${last_month_revenue:,.0f}")
                    print(f"   Excluding from historical data")
                    monthly_revenue = monthly_revenue.iloc[:-1]
            
            if monthly_revenue.empty:
                last_date = pd.Timestamp.now().replace(day=1)
                print("Warning: After filtering, no historical revenue data available. Using current date as forecast start.")
            else:
                last_date = monthly_revenue['date'].max() + pd.DateOffset(months=1)
            hist_mean = monthly_revenue['revenue'].mean()
            hist_max = monthly_revenue['revenue'].max()
            hist_min = monthly_revenue['revenue'].min()
            
            # Calculate recent average (last 6-12 months) to anchor forecast
            recent_months = min(12, len(monthly_revenue))
            recent_revenue = monthly_revenue.tail(recent_months)['revenue']
            
            # Check if last month is anomalously low compared to recent average
            if len(recent_revenue) > 1:
                recent_avg_excluding_last = recent_revenue.iloc[:-1].mean()
                last_month_revenue = recent_revenue.iloc[-1]
                
                # If last month is < 30% of recent average (excluding itself), exclude it from recent avg calculation
                if last_month_revenue < recent_avg_excluding_last * 0.3:
                    print(f"⚠ Last month revenue (${last_month_revenue:,.0f}) is anomalously low compared to recent average (${recent_avg_excluding_last:,.0f})")
                    print(f"   Using average excluding last month for forecast anchoring")
                    recent_avg = recent_avg_excluding_last
                    recent_std = recent_revenue.iloc[:-1].std()
                else:
                    recent_avg = recent_revenue.mean()
                    recent_std = recent_revenue.std()
            else:
                recent_avg = recent_revenue.mean()
                recent_std = recent_revenue.std()
            
            print(f"Forecast start date: {last_date.strftime('%Y-%m-%d')}")
            print(f"Historical revenue stats: mean=${hist_mean:,.0f}, min=${hist_min:,.0f}, max=${hist_max:,.0f}")
            print(f"Recent average (last {recent_months} months): ${recent_avg:,.0f} ± ${recent_std:,.0f}")
        
        # Prophet forecast (monthly)
        if self.prophet_model is not None:
            try:
                prophet_forecast = self.forecast_prophet(periods=12)
                if not prophet_forecast.empty:
                    # Sanity check: prevent upward trend extrapolation
                    if not monthly_revenue.empty:
                        hist_mean = monthly_revenue['revenue'].mean()
                        hist_max = monthly_revenue['revenue'].max()
                        hist_std = monthly_revenue['revenue'].std()
                        
                        # Calculate recent average (last 6 months) to detect if forecast is jumping
                        recent_months = min(6, len(monthly_revenue))
                        recent_avg = monthly_revenue.tail(recent_months)['revenue'].mean()
                        last_month = monthly_revenue['revenue'].iloc[-1]
                        
                        # Ensure non-negative first
                        prophet_forecast['forecast'] = prophet_forecast['forecast'].clip(lower=0)
                        prophet_forecast['lower'] = prophet_forecast['lower'].clip(lower=0)
                        prophet_forecast['upper'] = prophet_forecast['upper'].clip(lower=0)
                        
                        # Check if forecast starts significantly higher than recent average
                        first_forecast = prophet_forecast['forecast'].iloc[0]
                        if first_forecast > recent_avg * 1.3:  # More than 30% above recent average
                            print(f"⚠ Prophet forecast starts too high: ${first_forecast:,.0f} vs recent avg: ${recent_avg:,.0f}")
                            print(f"   This suggests trend extrapolation bias. Dampening forecast.")
                            
                            # Dampen the forecast: scale down to start closer to recent average
                            # Use a decay factor that reduces the jump
                            for i in range(len(prophet_forecast)):
                                # Decay factor: start at recent_avg, gradually allow more forecast
                                decay = 0.7 + (i / len(prophet_forecast)) * 0.3  # 70% recent -> 100% forecast
                                target = recent_avg * (1 - decay) + prophet_forecast['forecast'].iloc[i] * decay
                                prophet_forecast.iloc[i, prophet_forecast.columns.get_loc('forecast')] = target
                            
                            # Recalculate bounds
                            prophet_forecast['lower'] = (prophet_forecast['forecast'] * 0.75).clip(lower=0)
                            prophet_forecast['upper'] = (prophet_forecast['forecast'] * 1.25).clip(lower=0)
                        
                        # Cap at reasonable upper bound (prevent extreme spikes)
                        max_reasonable = max(hist_max * 1.5, recent_avg * 2)
                        if prophet_forecast['forecast'].max() > max_reasonable:
                            print(f"⚠ Prophet forecast exceeds reasonable bounds. Capping at ${max_reasonable:,.0f}/month")
                            prophet_forecast['forecast'] = prophet_forecast['forecast'].clip(upper=max_reasonable)
                            prophet_forecast['upper'] = prophet_forecast['upper'].clip(upper=max_reasonable * 1.5)
                        
                        # Add realistic month-to-month variation based on historical patterns
                        if len(prophet_forecast) > 1:
                            # Calculate historical coefficient of variation (std/mean)
                            hist_cv = hist_std / hist_mean if hist_mean > 0 else 0.3
                            # Add variation: ±(CV * forecast) with some randomness
                            np.random.seed(42)  # For reproducibility
                            variation_factor = np.random.normal(1.0, hist_cv * 0.5, len(prophet_forecast))
                            variation_factor = np.clip(variation_factor, 0.7, 1.3)  # Limit variation to ±30%
                            prophet_forecast['forecast'] = prophet_forecast['forecast'] * variation_factor
                            
                            # Recalculate bounds to reflect variation
                            prophet_forecast['lower'] = (prophet_forecast['forecast'] * 0.75).clip(lower=0)
                            prophet_forecast['upper'] = (prophet_forecast['forecast'] * 1.25).clip(lower=0)
                    
                    prophet_forecast['method'] = 'prophet'
                    forecasts.append(prophet_forecast)
                    print(f"✓ Prophet forecast: ${prophet_forecast['forecast'].sum():,.0f} total (avg: ${prophet_forecast['forecast'].mean():,.0f}/month)")
                else:
                    print("⚠ Prophet model loaded but forecast returned empty")
            except Exception as e:
                print(f"⚠ Prophet forecast failed: {e}")
        else:
            print("⚠ Prophet model not available (not trained or not loaded)")
        
        # XGBoost forecast (total from pipeline)
        if self.xgboost_model is not None:
            try:
                xgb_result = self.forecast_xgboost(active_pipeline)
                if xgb_result['forecast'] > 0:
                    # Distribute across months (simple approach)
                    monthly_xgb = xgb_result['forecast'] / 12
                    xgb_forecast = pd.DataFrame({
                        'date': pd.date_range(
                            start=last_date,
                            periods=12,
                            freq='MS'
                        ),
                        'forecast': monthly_xgb,
                        'lower': monthly_xgb * 0.7,
                        'upper': monthly_xgb * 1.3,
                        'method': 'xgboost'
                    })
                    forecasts.append(xgb_forecast)
                    details = xgb_result.get('details', {})
                    print(f"✓ XGBoost forecast: ${xgb_result['forecast']:,.0f} total")
                    if details:
                        print(f"   Pipeline: {details.get('pipeline_count', 0)} leads, "
                              f"Avg conversion prob: {details.get('avg_probability', 0):.1%}")
                else:
                    if active_pipeline.empty:
                        print(f"⚠ XGBoost forecast: $0 (no active leads in pipeline)")
                        print(f"   Note: XGBoost predicts conversion for specific leads.")
                        print(f"   Without active leads, it cannot contribute to the forecast.")
                        print(f"   This is expected for historical data where all leads are resolved.")
                    else:
                        print(f"⚠ XGBoost forecast: $0 (zero expected revenue from pipeline)")
            except Exception as e:
                print(f"⚠ XGBoost forecast failed: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("⚠ XGBoost model not available (not trained or not loaded)")
        
        # Pipeline forecast (total from pipeline) - always available
        try:
            pipeline_result = self.forecast_pipeline(active_pipeline)
            
            # If no active pipeline, use recent historical average as baseline
            if pipeline_result['forecast'] == 0 and not monthly_revenue.empty:
                # Use recent average (not overall average) to prevent jumps
                recent_months = min(12, len(monthly_revenue))
                recent_avg = monthly_revenue.tail(recent_months)['revenue'].mean()
                monthly_pipeline = recent_avg
                print(f"⚠ No active pipeline. Using recent average: ${recent_avg:,.0f}/month")
            else:
                # Distribute pipeline forecast evenly across months
                monthly_pipeline = pipeline_result['forecast'] / 12 if pipeline_result['forecast'] > 0 else 0
            
            pipeline_forecast = pd.DataFrame({
                'date': pd.date_range(
                    start=last_date,
                    periods=12,
                    freq='MS'
                ),
                'forecast': monthly_pipeline,
                'lower': monthly_pipeline * 0.8,
                'upper': monthly_pipeline * 1.2,
                'method': 'pipeline'
            })
            forecasts.append(pipeline_forecast)
            print(f"✓ Pipeline forecast: ${pipeline_result['forecast']:,.0f} total (distributed: ${monthly_pipeline:,.0f}/month)")
        except Exception as e:
            print(f"⚠ Pipeline forecast failed: {e}")
        
        if not forecasts:
            error_msg = (
                "\n" + "="*70 + "\n"
                "ERROR: No models available for forecasting\n"
                "="*70 + "\n"
                "Possible causes:\n"
                "1. Models not trained - Run pipeline.train(csv_path) first\n"
                "2. Model files missing - Check model/artifacts/ directory\n"
                "3. All forecast methods failed\n"
                "\n"
                "To fix:\n"
                "  pipeline = EnsemblePipeline()\n"
                "  pipeline.train('your_data.csv')  # Train models first\n"
                "  forecast = pipeline.forecast()     # Then generate forecast\n"
                "="*70
            )
            raise ValueError(error_msg)
        
        # Combine forecasts using ensemble weights
        ensemble_forecast = self._combine_forecasts(forecasts)
        
        # Final sanity check on ensemble forecast
        if not monthly_revenue.empty:
            hist_mean = monthly_revenue['revenue'].mean()
            hist_max = monthly_revenue['revenue'].max()
            hist_std = monthly_revenue['revenue'].std()
            
            # Calculate recent average for jump detection
            # Exclude anomalously low last month if present
            recent_months = min(6, len(monthly_revenue))
            recent_revenue = monthly_revenue.tail(recent_months)['revenue']
            
            if len(recent_revenue) > 1:
                recent_avg_excluding_last = recent_revenue.iloc[:-1].mean()
                last_month = recent_revenue.iloc[-1]
                
                # If last month is < 30% of recent average (excluding itself), exclude it
                if last_month < recent_avg_excluding_last * 0.3:
                    recent_avg = recent_avg_excluding_last
                else:
                    recent_avg = recent_revenue.mean()
            else:
                recent_avg = recent_revenue.mean()
            
            # Get last month revenue for transition smoothing
            last_month = monthly_revenue['revenue'].iloc[-1]
            
            # Ensure non-negative (revenue can't be negative)
            ensemble_forecast['forecast'] = ensemble_forecast['forecast'].clip(lower=0)
            ensemble_forecast['lower'] = ensemble_forecast['lower'].clip(lower=0)
            ensemble_forecast['upper'] = ensemble_forecast['upper'].clip(lower=0)
            
            # Cap at reasonable upper bound
            max_reasonable = max(hist_max * 1.5, recent_avg * 2)
            if ensemble_forecast['forecast'].max() > max_reasonable:
                print(f"\n⚠ Ensemble forecast exceeds reasonable bounds. Capping at ${max_reasonable:,.0f}/month")
                ensemble_forecast['forecast'] = ensemble_forecast['forecast'].clip(upper=max_reasonable)
                ensemble_forecast['upper'] = ensemble_forecast['upper'].clip(upper=max_reasonable * 1.5)
            
            # Add realistic variation to match historical patterns
            if len(ensemble_forecast) > 1:
                # Calculate recent_std if not already set
                try:
                    if recent_std is None:
                        recent_months_for_std = min(12, len(monthly_revenue))
                        recent_revenue_for_std = monthly_revenue.tail(recent_months_for_std)['revenue']
                        recent_std = recent_revenue_for_std.std()
                except NameError:
                    # recent_std not defined, calculate it
                    recent_months_for_std = min(12, len(monthly_revenue))
                    recent_revenue_for_std = monthly_revenue.tail(recent_months_for_std)['revenue']
                    recent_std = recent_revenue_for_std.std()
                
                # Use recent historical stats for variation calculation
                if recent_avg is not None and recent_std is not None:
                    hist_cv = recent_std / recent_avg if recent_avg > 0 else 0.3
                else:
                    hist_cv = hist_std / hist_mean if hist_mean > 0 else 0.3
                
                # Add month-to-month variation similar to historical patterns
                # Use a small amount of smoothing (alpha=0.7) to prevent extreme jumps while preserving variation
                alpha = 0.7  # Less smoothing (higher = less smoothing)
                base_forecast = ensemble_forecast['forecast'].ewm(alpha=alpha, adjust=False).mean()
                
                # Add realistic variation based on historical CV
                np.random.seed(42)  # For reproducibility
                variation = np.random.normal(0, hist_cv * 0.4, len(ensemble_forecast))
                variation = np.clip(variation, -0.25, 0.25)  # Limit to ±25% variation
                ensemble_forecast['forecast'] = base_forecast * (1 + variation)
                
                # Ensure non-negative
                ensemble_forecast['forecast'] = ensemble_forecast['forecast'].clip(lower=0)
                
                # Recalculate confidence intervals based on historical variation
                ensemble_forecast['lower'] = (ensemble_forecast['forecast'] * (1 - hist_cv)).clip(lower=0)
                ensemble_forecast['upper'] = ensemble_forecast['forecast'] * (1 + hist_cv)
            
            # CRITICAL: Prevent forecast jump - ensure smooth transition from last historical month
            # This must happen AFTER variation is added, so we smooth the final forecast
            first_forecast = ensemble_forecast['forecast'].iloc[0]
            
            # Calculate jump ratio
            jump_ratio = first_forecast / last_month if last_month > 0 else float('inf')
            
            # Always smooth the transition if there's a significant jump (>30% increase)
            # This ensures visual continuity even if models predict growth
            if jump_ratio > 1.3:  # More than 30% increase
                print(f"\n⚠ Smoothing forecast transition:")
                print(f"   Last historical month: ${last_month:,.0f}")
                print(f"   First forecast month (before smoothing): ${first_forecast:,.0f}")
                print(f"   Jump ratio: {jump_ratio:.1%}")
                print(f"   Recent average: ${recent_avg:,.0f}")
                print(f"   Applying gradual transition to prevent visual jump...")
                
                # Store original forecast for transition
                original_forecast = ensemble_forecast['forecast'].copy()
                
                # Use last month as the anchor point for smoother transition
                # Start forecast closer to last month, then gradually move toward model prediction
                for i in range(len(ensemble_forecast)):
                    # Transition: start near last_month, gradually move toward forecast
                    # First month: 80% last_month + 20% forecast
                    # Gradually increase forecast weight over 3 months
                    if i < 3:
                        # First 3 months: gradual transition from last_month to forecast
                        transition = 0.2 + (i / 3) * 0.6  # 20% -> 80% forecast weight
                        target = last_month * (1 - transition) + original_forecast.iloc[i] * transition
                    else:
                        # After 3 months: use full forecast
                        target = original_forecast.iloc[i]
                    
                    ensemble_forecast.iloc[i, ensemble_forecast.columns.get_loc('forecast')] = target
                
                # Recalculate bounds
                ensemble_forecast['lower'] = (ensemble_forecast['forecast'] * 0.7).clip(lower=0)
                ensemble_forecast['upper'] = (ensemble_forecast['forecast'] * 1.3).clip(lower=0)
                print(f"   Adjusted first month: ${ensemble_forecast['forecast'].iloc[0]:,.0f}")
                print(f"   Transition complete by month 3: ${ensemble_forecast['forecast'].iloc[2]:,.0f}")
        
        print(f"\nEnsemble forecast: ${ensemble_forecast['forecast'].sum():,.0f} total")
        print(f"  Average monthly: ${ensemble_forecast['forecast'].mean():,.0f}")
        print(f"  Min monthly: ${ensemble_forecast['forecast'].min():,.0f}")
        print(f"  Max monthly: ${ensemble_forecast['forecast'].max():,.0f}")
        print("="*70)
        
        return ensemble_forecast
    
    def _combine_forecasts(self, forecasts: List[pd.DataFrame]) -> pd.DataFrame:
        """
        Combine multiple forecasts using ensemble weights.
        
        Parameters:
        -----------
        forecasts : list
            List of forecast dataframes
            
        Returns:
        --------
        pd.DataFrame
            Combined ensemble forecast
        """
        # Get common date range
        all_dates = set()
        for f in forecasts:
            all_dates.update(f['date'].dt.to_period('M'))
        
        dates = sorted(all_dates)
        dates = [d.to_timestamp() for d in dates]
        
        # Initialize ensemble dataframe
        ensemble = pd.DataFrame({'date': dates})
        ensemble['forecast'] = 0.0
        ensemble['lower'] = 0.0
        ensemble['upper'] = 0.0
        
        # Combine forecasts
        total_weight = 0
        for forecast_df in forecasts:
            method = forecast_df['method'].iloc[0]
            weight = self.ensemble_weights.get(method, 1.0 / len(forecasts))
            
            # Merge on date
            forecast_df['date_period'] = forecast_df['date'].dt.to_period('M')
            ensemble['date_period'] = ensemble['date'].dt.to_period('M')
            
            merged = ensemble.merge(
                forecast_df[['date_period', 'forecast', 'lower', 'upper']],
                on='date_period',
                how='left',
                suffixes=('', '_new')
            )
            
            # Weighted combination
            ensemble['forecast'] += merged['forecast_new'].fillna(0) * weight
            ensemble['lower'] += merged['lower_new'].fillna(0) * weight
            ensemble['upper'] += merged['upper_new'].fillna(0) * weight
            
            total_weight += weight
        
        # Normalize if weights don't sum to 1
        if total_weight > 0 and abs(total_weight - 1.0) > 0.01:
            ensemble['forecast'] /= total_weight
            ensemble['lower'] /= total_weight
            ensemble['upper'] /= total_weight
        
        ensemble['method'] = 'ensemble'
        ensemble = ensemble.drop('date_period', axis=1)
        
        return ensemble
    
    def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepare features for XGBoost inference"""
        
        features = df.copy()
        
        # Encode categorical variables
        for col, encoder in self.label_encoders.items():
            if col in features.columns:
                # Handle new categories
                known_classes = set(encoder.classes_)
                current_values = features[col].fillna('Unknown').unique()
                
                # Map unknown to a default
                features[f'{col}_encoded'] = features[col].fillna('Unknown').apply(
                    lambda x: encoder.transform([x])[0] if x in known_classes else 0
                )
        
        # Create time-based features
        if 'inquiry_date' in features.columns:
            features['inquiry_month'] = features['inquiry_date'].dt.month
            features['inquiry_quarter'] = features['inquiry_date'].dt.quarter
        
        # Peak season indicator
        if 'inquiry_month' in features.columns:
            features['is_peak_season'] = features['inquiry_month'].isin([1, 2, 3, 9, 10]).astype(int)
        
        # Select and align features
        X = pd.DataFrame(index=features.index)
        for col in self.feature_names:
            if col in features.columns:
                X[col] = features[col]
            else:
                X[col] = 0
        
        X = X.fillna(0)
        
        return X

