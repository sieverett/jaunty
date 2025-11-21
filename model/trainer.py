"""
Model training module for ensemble revenue forecasting.
Separates training logic from inference.
"""

import pandas as pd
import numpy as np
import pickle
import os
from typing import Dict, Optional
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

try:
    import xgboost as xgb
    from sklearn.preprocessing import LabelEncoder
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False


class ModelTrainer:
    """Train ensemble models for revenue forecasting"""
    
    def __init__(self, model_dir: str = "model/artifacts"):
        """
        Initialize trainer.
        
        Parameters:
        -----------
        model_dir : str
            Directory to save trained models
        """
        # Store model directory (should already be resolved by pipeline)
        self.model_dir = model_dir
        os.makedirs(self.model_dir, exist_ok=True)
        print(f"Saving models to: {os.path.abspath(self.model_dir)}")
        
        self.prophet_model = None
        self.xgboost_model = None
        self.label_encoders = {}
        self.feature_names = []
        self.training_metadata = {}
    
    def train_prophet(self, monthly_revenue: pd.DataFrame) -> None:
        """
        Train Prophet time series model.
        
        Parameters:
        -----------
        monthly_revenue : pd.DataFrame
            Monthly revenue data with columns: date, revenue
        """
        if not PROPHET_AVAILABLE:
            raise ImportError(
                "Prophet not installed. Install with: pip install prophet"
            )
        
        print("Training Prophet model...")
        
        # Prepare data for Prophet
        prophet_df = monthly_revenue[['date', 'revenue']].copy()
        prophet_df.columns = ['ds', 'y']
        
        # Calculate recent trend to detect if we should dampen growth
        recent_months = min(6, len(prophet_df))
        if recent_months >= 3:
            recent_data = prophet_df.tail(recent_months)
            recent_trend = (recent_data['y'].iloc[-1] - recent_data['y'].iloc[0]) / len(recent_data)
            overall_trend = (prophet_df['y'].iloc[-1] - prophet_df['y'].iloc[0]) / len(prophet_df)
            
            # If recent trend is negative or flat, but overall trend is positive, use logistic growth with cap
            # This prevents extrapolating upward trends when recent data shows decline/flat
            use_logistic = (recent_trend <= 0 and overall_trend > 0) or (recent_trend < overall_trend * 0.5)
        else:
            use_logistic = False
        
        if use_logistic:
            # Use logistic growth with a cap based on recent maximum
            # This prevents unbounded growth extrapolation
            recent_max = prophet_df.tail(recent_months)['y'].max()
            historical_max = prophet_df['y'].max()
            # Cap at 1.5x recent max or historical max, whichever is higher
            growth_cap = max(recent_max * 1.5, historical_max * 1.2)
            
            # Add capacity column for logistic growth
            prophet_df['cap'] = growth_cap
            prophet_df['floor'] = 0
            
            self.prophet_model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=False,
                daily_seasonality=False,
                seasonality_mode='additive',
                interval_width=0.80,
                growth='logistic',  # Logistic growth with cap prevents unbounded extrapolation
                changepoint_prior_scale=0.05,
                seasonality_prior_scale=10.0,
                holidays_prior_scale=10.0,
                mcmc_samples=0,
                uncertainty_samples=1000
            )
        else:
            # Use linear growth but with more conservative changepoint settings
            self.prophet_model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=False,
                daily_seasonality=False,
                seasonality_mode='additive',
                interval_width=0.80,
                growth='linear',
                changepoint_prior_scale=0.01,  # Very low to prevent trend extrapolation
                changepoint_range=0.8,  # Only use first 80% of data for trend estimation
                seasonality_prior_scale=10.0,
                holidays_prior_scale=10.0,
                mcmc_samples=0,
                uncertainty_samples=1000
            )
        
        # Add monthly seasonality (reduced fourier order for less overfitting)
        self.prophet_model.add_seasonality(
            name='monthly',
            period=30.5,
            fourier_order=3  # Reduced from 5 to prevent overfitting
        )
        
        # Fit model
        self.prophet_model.fit(prophet_df)
        
        # Evaluate Prophet model using cross-validation
        try:
            from prophet.diagnostics import cross_validation, performance_metrics
            
            # Perform cross-validation
            cv_results = cross_validation(
                self.prophet_model,
                initial='180 days',  # Use first 6 months for initial training
                period='30 days',   # Evaluate every month
                horizon='90 days',  # Forecast 3 months ahead
                disable_tqdm=True
            )
            
            # Calculate performance metrics
            pm = performance_metrics(cv_results)
            
            mape = pm['mape'].mean()
            mae = pm['mae'].mean()
            rmse = pm['rmse'].mean()
            mse = pm['mse'].mean()
            
            print("\n" + "="*70)
            print("PROPHET MODEL PERFORMANCE METRICS (Cross-Validation)")
            print("="*70)
            print(f"  MAPE (Mean Absolute % Error): {mape:.2f}%")
            print(f"  MAE  (Mean Absolute Error):    ${mae:,.0f}")
            print(f"  RMSE (Root Mean Squared Error): ${rmse:,.0f}")
            print(f"  MSE  (Mean Squared Error):     ${mse:,.0f}")
            print("="*70)
            
            prophet_metrics = {
                'mape': float(mape),
                'mae': float(mae),
                'rmse': float(rmse),
                'mse': float(mse)
            }
        except Exception as e:
            print(f"\n⚠ Could not perform Prophet cross-validation: {e}")
            print("   (This is okay - model is still trained)")
            prophet_metrics = {}
        
        # Save model
        model_path = os.path.join(self.model_dir, 'prophet_model.pkl')
        with open(model_path, 'wb') as f:
            pickle.dump(self.prophet_model, f)
        
        print(f"\nProphet model trained and saved to {model_path}")
        
        self.training_metadata['prophet'] = {
            'trained': True,
            'training_samples': len(prophet_df),
            'date_range': {
                'start': prophet_df['ds'].min().strftime('%Y-%m-%d'),
                'end': prophet_df['ds'].max().strftime('%Y-%m-%d')
            },
            **prophet_metrics
        }
    
    def train_xgboost(self, df: pd.DataFrame) -> None:
        """
        Train XGBoost conversion prediction model.
        
        Parameters:
        -----------
        df : pd.DataFrame
            Full dataset with leads and outcomes
        """
        if not XGBOOST_AVAILABLE:
            raise ImportError(
                "XGBoost not installed. Install with: pip install xgboost"
            )
        
        print("Training XGBoost model...")
        
        # Filter to records with known outcomes
        training_data = df[
            df['current_stage'].isin(['completed', 'lost', 'cancelled'])
        ].copy()
        
        if training_data.empty:
            raise ValueError("No training data with known outcomes found")
        
        # Create target variable
        training_data['converted'] = (
            training_data['current_stage'] == 'completed'
        ).astype(int)
        
        # Prepare features
        X, y = self._prepare_features(training_data)
        
        if len(X) < 50:
            raise ValueError(
                f"Only {len(X)} training samples available. Need at least 50."
            )
        
        # Split data
        from sklearn.model_selection import train_test_split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Train model
        self.xgboost_model = xgb.XGBClassifier(
            objective='binary:logistic',
            max_depth=4,
            learning_rate=0.1,
            n_estimators=100,
            random_state=42,
            eval_metric='logloss'
        )
        
        # Fit model - handle different XGBoost versions
        try:
            # Try with early_stopping_rounds (newer versions)
            self.xgboost_model.fit(
                X_train, y_train,
                eval_set=[(X_test, y_test)],
                early_stopping_rounds=10,
                verbose=False
            )
        except (TypeError, ValueError) as e:
            # Fallback for older XGBoost versions or API changes
            print(f"Note: Using XGBoost fit() without early_stopping_rounds (version compatibility)")
            try:
                self.xgboost_model.fit(
                    X_train, y_train,
                    eval_set=[(X_test, y_test)],
                    verbose=False
                )
            except Exception as e2:
                # Final fallback - train without eval_set
                print(f"Note: Training without eval_set")
                self.xgboost_model.fit(X_train, y_train, verbose=False)
        
        # Evaluate on test set
        from sklearn.metrics import (
            accuracy_score, roc_auc_score, precision_score, 
            recall_score, f1_score, classification_report, confusion_matrix
        )
        y_pred_proba = self.xgboost_model.predict_proba(X_test)[:, 1]
        y_pred = (y_pred_proba > 0.5).astype(int)
        
        accuracy = accuracy_score(y_test, y_pred)
        roc_auc = roc_auc_score(y_test, y_pred_proba)
        precision = precision_score(y_test, y_pred, zero_division=0)
        recall = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        
        # Also evaluate on training set for comparison
        y_train_pred_proba = self.xgboost_model.predict_proba(X_train)[:, 1]
        y_train_pred = (y_train_pred_proba > 0.5).astype(int)
        train_accuracy = accuracy_score(y_train, y_train_pred)
        train_roc_auc = roc_auc_score(y_train, y_train_pred_proba)
        
        print("\n" + "="*70)
        print("XGBOOST MODEL PERFORMANCE METRICS")
        print("="*70)
        print(f"\nTest Set Performance:")
        print(f"  Accuracy:  {accuracy:.3f} ({accuracy*100:.1f}%)")
        print(f"  ROC-AUC:   {roc_auc:.3f}")
        print(f"  Precision: {precision:.3f}")
        print(f"  Recall:    {recall:.3f}")
        print(f"  F1-Score:  {f1:.3f}")
        print(f"\nTraining Set Performance (for comparison):")
        print(f"  Accuracy:  {train_accuracy:.3f} ({train_accuracy*100:.1f}%)")
        print(f"  ROC-AUC:   {train_roc_auc:.3f}")
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        print(f"\nConfusion Matrix:")
        print(f"  True Negatives:  {cm[0,0]}")
        print(f"  False Positives: {cm[0,1]}")
        print(f"  False Negatives: {cm[1,0]}")
        print(f"  True Positives:  {cm[1,1]}")
        print("="*70)
        
        # Save model and encoders
        model_path = os.path.join(self.model_dir, 'xgboost_model.json')
        self.xgboost_model.save_model(model_path)
        
        encoders_path = os.path.join(self.model_dir, 'label_encoders.pkl')
        with open(encoders_path, 'wb') as f:
            pickle.dump(self.label_encoders, f)
        
        feature_names_path = os.path.join(self.model_dir, 'feature_names.pkl')
        with open(feature_names_path, 'wb') as f:
            pickle.dump(self.feature_names, f)
        
        print(f"\nXGBoost model saved to {model_path}")
        
        self.training_metadata['xgboost'] = {
            'trained': True,
            'training_samples': len(X_train),
            'test_samples': len(X_test),
            'test_accuracy': float(accuracy),
            'test_roc_auc': float(roc_auc),
            'test_precision': float(precision),
            'test_recall': float(recall),
            'test_f1_score': float(f1),
            'train_accuracy': float(train_accuracy),
            'train_roc_auc': float(train_roc_auc),
            'confusion_matrix': {
                'tn': int(cm[0,0]),
                'fp': int(cm[0,1]),
                'fn': int(cm[1,0]),
                'tp': int(cm[1,1])
            }
        }
    
    def _prepare_features(self, df: pd.DataFrame):
        """Prepare features for XGBoost"""
        
        features = df.copy()
        
        # Encode categorical variables
        categorical_cols = ['destination', 'lead_source']
        
        for col in categorical_cols:
            if col in features.columns:
                if col not in self.label_encoders:
                    self.label_encoders[col] = LabelEncoder()
                    features[f'{col}_encoded'] = self.label_encoders[col].fit_transform(
                        features[col].fillna('Unknown')
                    )
                else:
                    # Handle new categories during inference
                    known_classes = set(self.label_encoders[col].classes_)
                    current_classes = set(features[col].fillna('Unknown').unique())
                    new_classes = current_classes - known_classes
                    
                    if new_classes:
                        # Add new classes
                        all_classes = list(known_classes) + list(new_classes)
                        self.label_encoders[col].classes_ = np.array(all_classes)
                    
                    features[f'{col}_encoded'] = self.label_encoders[col].transform(
                        features[col].fillna('Unknown')
                    )
        
        # Create time-based features
        if 'inquiry_date' in features.columns:
            features['inquiry_month'] = features['inquiry_date'].dt.month
            features['inquiry_quarter'] = features['inquiry_date'].dt.quarter
            features['inquiry_year'] = features['inquiry_date'].dt.year
        
        # Peak season indicator
        if 'inquiry_month' in features.columns:
            features['is_peak_season'] = features['inquiry_month'].isin([1, 2, 3, 9, 10]).astype(int)
        
        # Select feature columns
        feature_cols = []
        
        # Categorical encoded
        for col in categorical_cols:
            if f'{col}_encoded' in features.columns:
                feature_cols.append(f'{col}_encoded')
        
        # Numerical features
        numerical_cols = ['duration_days', 'is_repeat_customer', 
                         'inquiry_month', 'inquiry_quarter', 'is_peak_season']
        for col in numerical_cols:
            if col in features.columns:
                feature_cols.append(col)
        
        self.feature_names = feature_cols
        
        X = features[feature_cols].fillna(0)
        y = features['converted'] if 'converted' in features.columns else None
        
        return X, y
    
    def train_all(self, monthly_revenue: pd.DataFrame, full_data: pd.DataFrame) -> Dict:
        """
        Train all models in the ensemble.
        
        Parameters:
        -----------
        monthly_revenue : pd.DataFrame
            Monthly revenue time series
        full_data : pd.DataFrame
            Full dataset with leads
            
        Returns:
        --------
        dict
            Training metadata
        """
        print("="*70)
        print("TRAINING ENSEMBLE MODELS")
        print("="*70)
        
        # Train Prophet
        if PROPHET_AVAILABLE:
            try:
                self.train_prophet(monthly_revenue)
            except Exception as e:
                print(f"Warning: Prophet training failed: {e}")
        else:
            print("Skipping Prophet (not installed)")
        
        # Train XGBoost
        if XGBOOST_AVAILABLE:
            try:
                self.train_xgboost(full_data)
            except Exception as e:
                print(f"Warning: XGBoost training failed: {e}")
        else:
            print("Skipping XGBoost (not installed)")
        
        # Save training metadata
        metadata_path = os.path.join(self.model_dir, 'training_metadata.pkl')
        with open(metadata_path, 'wb') as f:
            pickle.dump(self.training_metadata, f)
        
        print("\n" + "="*70)
        print("TRAINING COMPLETE")
        print("="*70)
        
        # Print summary of training metrics
        self._print_training_summary()
        
        return self.training_metadata
    
    def _print_training_summary(self) -> None:
        """Print a summary of training metrics"""
        print("\n" + "="*70)
        print("TRAINING METRICS SUMMARY")
        print("="*70)
        
        if 'prophet' in self.training_metadata:
            pm = self.training_metadata['prophet']
            print("\nProphet Model:")
            print(f"  Status: {'✓ Trained' if pm.get('trained') else '✗ Not trained'}")
            print(f"  Training samples: {pm.get('training_samples', 'N/A')}")
            if 'mape' in pm:
                print(f"  MAPE: {pm['mape']:.2f}%")
                print(f"  MAE:  ${pm['mae']:,.0f}")
                print(f"  RMSE: ${pm['rmse']:,.0f}")
        
        if 'xgboost' in self.training_metadata:
            xm = self.training_metadata['xgboost']
            print("\nXGBoost Model:")
            print(f"  Status: {'✓ Trained' if xm.get('trained') else '✗ Not trained'}")
            print(f"  Training samples: {xm.get('training_samples', 'N/A')}")
            print(f"  Test samples: {xm.get('test_samples', 'N/A')}")
            if 'test_accuracy' in xm:
                print(f"  Test Accuracy:  {xm['test_accuracy']:.3f} ({xm['test_accuracy']*100:.1f}%)")
                print(f"  Test ROC-AUC:   {xm['test_roc_auc']:.3f}")
                print(f"  Test Precision: {xm.get('test_precision', 0):.3f}")
                print(f"  Test Recall:    {xm.get('test_recall', 0):.3f}")
                print(f"  Test F1-Score:  {xm.get('test_f1_score', 0):.3f}")
        
        print("="*70)

