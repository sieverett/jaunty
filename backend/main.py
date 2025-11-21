"""
FastAPI backend service for revenue forecasting.

This service provides an API endpoint that accepts historical revenue data
and returns a 12-month revenue forecast.
"""

import os
import sys
import pandas as pd
import numpy as np
from typing import Optional, List, Dict, Literal
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import io
import tempfile
import json
import shutil
from pathlib import Path

# Add project root to path to import model pipeline
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, project_root)

from model.pipeline import EnsemblePipeline

# Import report generator (optional - will fail gracefully if Azure OpenAI not configured)
try:
    from report.report_generator import ReportGenerator
    REPORT_GENERATOR_AVAILABLE = True
except (ImportError, ValueError) as e:
    REPORT_GENERATOR_AVAILABLE = False
    print(f"Warning: Report generator not available: {e}")
    print("  Report endpoint will not be available. Configure Azure OpenAI in .env file.")

# Initialize FastAPI app
app = FastAPI(
    title="Revenue Forecasting API",
    description="API for generating 12-month revenue forecasts from historical booking data",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global pipeline instance (initialized on startup)
pipeline: Optional[EnsemblePipeline] = None

# Configuration: Maximum number of files to keep in tmp directory
MAX_TMP_FILES = int(os.getenv("MAX_TMP_FILES", "50"))  # Default: 50 files


def get_model_info(model_dir: str) -> Dict:
    """
    Get information about trained model files.
    
    Parameters:
    -----------
    model_dir : str
        Directory containing model artifacts
        
    Returns:
    --------
    dict
        Model file information with filenames and creation timestamps
    """
    model_info = {
        "model_directory": model_dir,
        "models": []
    }
    
    if not os.path.exists(model_dir):
        return model_info
    
    model_files = {
        "prophet_model.pkl": "Prophet Time Series Model",
        "xgboost_model.json": "XGBoost Classification Model",
        "label_encoders.pkl": "Label Encoders",
        "feature_names.pkl": "Feature Names",
        "training_metadata.pkl": "Training Metadata"
    }
    
    for filename, description in model_files.items():
        filepath = os.path.join(model_dir, filename)
        if os.path.exists(filepath):
            stat = os.stat(filepath)
            model_info["models"].append({
                "filename": filename,
                "description": description,
                "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "size_bytes": stat.st_size,
                "exists": True
            })
        else:
            model_info["models"].append({
                "filename": filename,
                "description": description,
                "exists": False
            })
    
    return model_info


def get_training_metrics(pipeline: EnsemblePipeline) -> Dict:
    """
    Get training metrics for all models.
    
    Parameters:
    -----------
    pipeline : EnsemblePipeline
        Pipeline instance with trained models
        
    Returns:
    --------
    dict
        Training metrics for all models
    """
    try:
        metrics = pipeline.get_training_metrics()
        if not metrics:
            return {"available": False, "message": "No training metrics available"}
        
        # Convert any numpy types to native Python types for JSON serialization
        # Use default=str to handle numpy types, dates, etc.
        def convert_types(obj):
            if isinstance(obj, (np.integer, np.floating)):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, (datetime, pd.Timestamp)):
                return obj.isoformat()
            elif isinstance(obj, dict):
                return {k: convert_types(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_types(item) for item in obj]
            return obj
        
        return convert_types(metrics)
    except Exception as e:
        return {
            "error": f"Could not retrieve training metrics: {str(e)}",
            "available": False
        }


def get_dataset_stats(pipeline: EnsemblePipeline) -> Dict:
    """
    Get dataset statistics and basic EDA.
    
    Parameters:
    -----------
    pipeline : EnsemblePipeline
        Pipeline instance with loaded data
        
    Returns:
    --------
    dict
        Dataset statistics and EDA
    """
    stats = {
        "available": False
    }
    
    try:
        if pipeline.data is None or pipeline.data.empty:
            return stats
        
        data = pipeline.data.copy()
        stats["available"] = True
        
        # Basic dataset info
        stats["dataset_info"] = {
            "total_records": len(data),
            "columns": list(data.columns),
            "date_range": {}
        }
        
        # Date range analysis
        if 'inquiry_date' in data.columns and data['inquiry_date'].notna().any():
            inquiry_dates = pd.to_datetime(data['inquiry_date'], errors='coerce')
            stats["dataset_info"]["date_range"]["inquiry_start"] = inquiry_dates.min().isoformat() if inquiry_dates.notna().any() else None
            stats["dataset_info"]["date_range"]["inquiry_end"] = inquiry_dates.max().isoformat() if inquiry_dates.notna().any() else None
        
        if 'trip_date' in data.columns and data['trip_date'].notna().any():
            trip_dates = pd.to_datetime(data['trip_date'], errors='coerce')
            completed_trips = trip_dates[trip_dates.notna()]
            if len(completed_trips) > 0:
                stats["dataset_info"]["date_range"]["trip_start"] = completed_trips.min().isoformat()
                stats["dataset_info"]["date_range"]["trip_end"] = completed_trips.max().isoformat()
                trip_span_days = (completed_trips.max() - completed_trips.min()).days
                stats["dataset_info"]["date_range"]["trip_span_years"] = round(trip_span_days / 365.25, 2)
        
        # Stage distribution
        if 'current_stage' in data.columns:
            stage_dist = data['current_stage'].value_counts().to_dict()
            stats["stage_distribution"] = {str(k): int(v) for k, v in stage_dist.items()}
            stats["conversion_rate"] = {
                "completed": int(stage_dist.get('completed', 0)),
                "total": len(data),
                "rate": round(stage_dist.get('completed', 0) / len(data) * 100, 2) if len(data) > 0 else 0
            }
        
        # Revenue statistics
        if 'trip_price' in data.columns:
            completed_revenue = data[data['current_stage'] == 'completed']['trip_price']
            if len(completed_revenue) > 0:
                stats["revenue_stats"] = {
                    "total_revenue": float(completed_revenue.sum()),
                    "average_trip_value": float(completed_revenue.mean()),
                    "median_trip_value": float(completed_revenue.median()),
                    "min_trip_value": float(completed_revenue.min()),
                    "max_trip_value": float(completed_revenue.max()),
                    "std_trip_value": float(completed_revenue.std())
                }
        
        # Monthly revenue stats (if available)
        if pipeline.monthly_revenue is not None and not pipeline.monthly_revenue.empty:
            monthly = pipeline.monthly_revenue
            stats["monthly_revenue_stats"] = {
                "total_months": len(monthly),
                "average_monthly": float(monthly['revenue'].mean()),
                "median_monthly": float(monthly['revenue'].median()),
                "min_monthly": float(monthly['revenue'].min()),
                "max_monthly": float(monthly['revenue'].max()),
                "std_monthly": float(monthly['revenue'].std()),
                "first_month": monthly['date'].min().isoformat(),
                "last_month": monthly['date'].max().isoformat()
            }
        
        # Destination distribution
        if 'destination' in data.columns:
            dest_dist = data['destination'].value_counts().to_dict()
            stats["destination_distribution"] = {str(k): int(v) for k, v in dest_dist.items()}
        
        # Lead source distribution
        if 'lead_source' in data.columns:
            source_dist = data['lead_source'].value_counts().to_dict()
            stats["lead_source_distribution"] = {str(k): int(v) for k, v in source_dist.items()}
        
        # Active pipeline stats
        try:
            active_pipeline = pipeline.data_loader.get_active_pipeline()
            if not active_pipeline.empty:
                stats["active_pipeline"] = {
                    "total_leads": len(active_pipeline),
                    "total_value": float(active_pipeline['trip_price'].sum()) if 'trip_price' in active_pipeline.columns else 0,
                    "by_stage": active_pipeline['current_stage'].value_counts().to_dict() if 'current_stage' in active_pipeline.columns else {}
                }
        except Exception:
            stats["active_pipeline"] = {"available": False}
        
        # Data quality metrics
        stats["data_quality"] = {
            "missing_values": {col: int(data[col].isna().sum()) for col in data.columns},
            "duplicate_records": int(data.duplicated().sum())
        }
        
    except Exception as e:
        stats["error"] = f"Could not compute dataset stats: {str(e)}"
    
    return stats


def generate_insights_from_metadata(dataset_stats: Dict, metrics: Dict, monthly_revenue_stats: Optional[Dict] = None) -> List[str]:
    """
    Generate insights from dataset statistics and metrics.
    
    Parameters:
    -----------
    dataset_stats : dict
        Dataset statistics from get_dataset_stats()
    metrics : dict
        Training metrics from get_training_metrics()
    monthly_revenue_stats : dict, optional
        Monthly revenue statistics
        
    Returns:
    --------
    list
        List of insight strings
    """
    insights = []
    
    if not dataset_stats.get("available", False):
        return [
            "Revenue forecast generated successfully.",
            "Historical patterns indicate consistent performance.",
            "Forecast accounts for seasonal variations."
        ]
    
    # Conversion rate insights
    conv_rate = dataset_stats.get("conversion_rate", {})
    if conv_rate.get("rate", 0) > 0:
        rate = conv_rate.get("rate", 0)
        if rate > 30:
            insights.append(f"Strong conversion rate of {rate:.1f}% indicates effective sales processes.")
        elif rate > 20:
            insights.append(f"Conversion rate of {rate:.1f}% shows solid sales performance with room for improvement.")
        else:
            insights.append(f"Conversion rate of {rate:.1f}% suggests opportunities to optimize sales processes.")
    
    # Revenue statistics insights
    revenue_stats = dataset_stats.get("revenue_stats", {})
    if revenue_stats:
        avg_trip = revenue_stats.get("average_trip_value", 0)
        if avg_trip > 0:
            insights.append(f"Average trip value of ${avg_trip:,.0f} provides solid revenue foundation.")
        
        total_revenue = revenue_stats.get("total_revenue", 0)
        if total_revenue > 0:
            insights.append(f"Total historical revenue of ${total_revenue:,.0f} demonstrates strong business performance.")
    
    # Monthly revenue insights
    if monthly_revenue_stats:
        avg_monthly = monthly_revenue_stats.get("average_monthly", 0)
        if avg_monthly > 0:
            insights.append(f"Average monthly revenue of ${avg_monthly:,.0f} indicates stable revenue streams.")
        
        total_months = monthly_revenue_stats.get("total_months", 0)
        if total_months >= 12:
            insights.append(f"Historical data spans {total_months} months, providing robust foundation for forecasting.")
    
    # Model performance insights
    if metrics.get("available", False):
        prophet_metrics = metrics.get("prophet", {})
        if prophet_metrics:
            mape = prophet_metrics.get("mape", None)
            if mape is not None and mape < 15:
                insights.append(f"Prophet model shows strong accuracy with MAPE of {mape:.1f}%.")
    
    # Default insights if none generated
    if not insights:
        insights = [
            "Revenue forecast shows stable growth trajectory.",
            "Historical patterns indicate consistent performance.",
            "Forecast accounts for seasonal variations."
        ]
    
    return insights[:5]  # Limit to 5 insights


def generate_key_drivers_from_stats(dataset_stats: Dict) -> List[str]:
    """
    Generate key drivers from dataset statistics.
    
    Parameters:
    -----------
    dataset_stats : dict
        Dataset statistics from get_dataset_stats()
        
    Returns:
    --------
    list
        List of key driver strings
    """
    drivers = []
    
    if not dataset_stats.get("available", False):
        return [
            "Historical revenue trends",
            "Market demand patterns",
            "Customer acquisition channels"
        ]
    
    # Lead source distribution
    source_dist = dataset_stats.get("lead_source_distribution", {})
    if source_dist:
        top_source = max(source_dist.items(), key=lambda x: x[1])
        drivers.append(f"{top_source[0]} is the primary lead source ({top_source[1]} leads)")
    
    # Destination distribution
    dest_dist = dataset_stats.get("destination_distribution", {})
    if dest_dist:
        top_dest = max(dest_dist.items(), key=lambda x: x[1])
        drivers.append(f"{top_dest[0]} is the most popular destination ({top_dest[1]} trips)")
    
    # Conversion rate driver
    conv_rate = dataset_stats.get("conversion_rate", {})
    if conv_rate.get("rate", 0) > 0:
        rate = conv_rate.get("rate", 0)
        drivers.append(f"Conversion rate of {rate:.1f}% indicates strong sales performance")
    
    # Revenue trends
    revenue_stats = dataset_stats.get("revenue_stats", {})
    if revenue_stats:
        avg_trip = revenue_stats.get("average_trip_value", 0)
        if avg_trip > 0:
            drivers.append(f"Average trip value of ${avg_trip:,.0f} supports premium positioning")
    
    # Active pipeline
    active_pipeline = dataset_stats.get("active_pipeline", {})
    if active_pipeline and active_pipeline.get("total_leads", 0) > 0:
        total_leads = active_pipeline.get("total_leads", 0)
        total_value = active_pipeline.get("total_value", 0)
        drivers.append(f"Active pipeline of {total_leads} leads with ${total_value:,.0f} potential revenue")
    
    # Default drivers if none generated
    if not drivers:
        drivers = [
            "Historical revenue trends",
            "Market demand patterns",
            "Customer acquisition channels"
        ]
    
    return drivers[:5]  # Limit to 5 drivers


def generate_funnel_data(pipeline: EnsemblePipeline, forecast_date: Optional[str] = None) -> Optional[List[dict]]:
    """
    Generate funnel data from pipeline data.
    
    Parameters:
    -----------
    pipeline : EnsemblePipeline
        Pipeline instance with loaded data
    forecast_date : str, optional
        Forecast reference date for filtering active pipeline (default: today)
    
    Returns:
    --------
    list or None
        List of funnel data dictionaries or None if data unavailable
    """
    try:
        if pipeline.data is None or pipeline.data.empty:
            return None
        
        # For funnel visualization, we want TRUE active pipeline stages only
        # (not future completed trips that are reclassified for forecasting)
        # So we filter directly from pipeline.data instead of using get_active_pipeline()
        data = pipeline.data.copy()
        
        if 'current_stage' not in data.columns:
            return None
        
        # Filter to only true active pipeline stages (exclude completed, lost, cancelled)
        # Also filter by inquiry_date to match forecast_date if provided
        active_stages = ['inquiry', 'quote_sent', 'booked', 'final_payment']
        
        if forecast_date is None:
            forecast_date = datetime.now()
        else:
            forecast_date = pd.to_datetime(forecast_date)
        
        # Get true active pipeline (not including future completed trips)
        # Filter by inquiry_date if available, otherwise just filter by stage
        if 'inquiry_date' in data.columns:
            funnel_data_filtered = data[
                (pd.to_datetime(data['inquiry_date'], errors='coerce') <= forecast_date) &
                (data['current_stage'].isin(active_stages))
            ].copy()
        else:
            # Fallback: just filter by stage if inquiry_date not available
            funnel_data_filtered = data[data['current_stage'].isin(active_stages)].copy()
        
        if funnel_data_filtered.empty:
            return None
        
        # Define stage order - exclude 'completed' as it's historical data, not current pipeline
        # A funnel should show the CURRENT active pipeline state
        stage_order = ['inquiry', 'quote_sent', 'booked', 'final_payment']
        stage_colors = {
            'inquiry': '#0ea5e9',
            'quote_sent': '#3b82f6',
            'booked': '#8b5cf6',
            'final_payment': '#10b981',
            'completed': '#059669'
        }
        
        # Count leads per stage from filtered data
        stage_counts = funnel_data_filtered['current_stage'].value_counts().to_dict()
        
        # Calculate conversion rates
        funnel_data = []
        total_inquiries = stage_counts.get('inquiry', 0)
        
        for i, stage in enumerate(stage_order):
            count = stage_counts.get(stage, 0)
            
            # Calculate conversion rate FROM previous stage TO current stage
            # This shows what % of the previous stage converted to this stage
            if i > 0:
                prev_stage = stage_order[i - 1]
                prev_count = stage_counts.get(prev_stage, 0)
                if prev_count > 0:
                    # Conversion rate: what % of previous stage converted to this stage
                    conversion_rate = (count / prev_count) * 100
                    drop_off_rate = 100 - conversion_rate
                else:
                    conversion_rate = 0
                    drop_off_rate = 100
            else:
                # First stage (inquiry) has no previous stage
                conversion_rate = None
                drop_off_rate = None
            
            # Calculate revenue potential (use filtered data for consistency)
            if 'trip_price' in funnel_data_filtered.columns:
                stage_data = funnel_data_filtered[funnel_data_filtered['current_stage'] == stage]
                revenue_potential = float(stage_data['trip_price'].sum()) if not stage_data.empty else 0
            else:
                revenue_potential = 0
            
            # Calculate average days in stage (use filtered data)
            avg_days = 0
            if stage == 'inquiry' and 'inquiry_date' in funnel_data_filtered.columns and 'quote_date' in funnel_data_filtered.columns:
                stage_data = funnel_data_filtered[funnel_data_filtered['current_stage'] == stage]
                if not stage_data.empty:
                    dates = pd.to_datetime(stage_data['quote_date'], errors='coerce') - pd.to_datetime(stage_data['inquiry_date'], errors='coerce')
                    valid_dates = dates[dates.notna()]
                    if len(valid_dates) > 0:
                        avg_days = valid_dates.mean().days
            elif stage == 'quote_sent' and 'quote_date' in funnel_data_filtered.columns and 'booking_date' in funnel_data_filtered.columns:
                stage_data = funnel_data_filtered[funnel_data_filtered['current_stage'] == stage]
                if not stage_data.empty:
                    dates = pd.to_datetime(stage_data['booking_date'], errors='coerce') - pd.to_datetime(stage_data['quote_date'], errors='coerce')
                    valid_dates = dates[dates.notna()]
                    if len(valid_dates) > 0:
                        avg_days = valid_dates.mean().days
            elif stage == 'booked' and 'booking_date' in funnel_data_filtered.columns and 'final_payment_date' in funnel_data_filtered.columns:
                stage_data = funnel_data_filtered[funnel_data_filtered['current_stage'] == stage]
                if not stage_data.empty:
                    dates = pd.to_datetime(stage_data['final_payment_date'], errors='coerce') - pd.to_datetime(stage_data['booking_date'], errors='coerce')
                    valid_dates = dates[dates.notna()]
                    if len(valid_dates) > 0:
                        avg_days = valid_dates.mean().days
            
            funnel_data.append({
                "stage": stage,
                "count": int(count),
                "conversionRate": round(conversion_rate, 1) if conversion_rate is not None else None,
                "dropOffRate": round(drop_off_rate, 1) if drop_off_rate is not None else None,
                "revenuePotential": float(revenue_potential),
                "avgDaysInStage": round(avg_days, 1) if avg_days > 0 else None,
                "color": stage_colors.get(stage, '#6b7280')
            })
        
        return funnel_data if funnel_data else None
        
    except Exception as e:
        print(f"Warning: Could not generate funnel data: {e}")
        return None


def get_suggested_parameters() -> List[dict]:
    """
    Get default suggested parameters for scenario simulation.
    
    Returns:
    --------
    list
        List of parameter dictionaries
    """
    return [
        {
            "name": "Growth Rate",
            "key": "Growth Rate",
            "min": -20,
            "max": 50,
            "default": 0,
            "description": "Expected annual growth rate (%)"
        },
        {
            "name": "Market Growth",
            "key": "Market Growth",
            "min": -10,
            "max": 30,
            "default": 0,
            "description": "Overall market growth impact (%)"
        },
        {
            "name": "Marketing Spend",
            "key": "Marketing Spend",
            "min": -5,
            "max": 25,
            "default": 0,
            "description": "Impact of marketing investment (%)"
        },
        {
            "name": "Seasonality",
            "key": "Seasonality",
            "min": -15,
            "max": 15,
            "default": 0,
            "description": "Seasonal variation adjustment (%)"
        },
        {
            "name": "Customer Retention",
            "key": "Customer Retention",
            "min": -10,
            "max": 20,
            "default": 0,
            "description": "Impact of customer retention improvements (%)"
        }
    ]


class ForecastResponse(BaseModel):
    """
    Response model for forecast endpoint.
    
    Metadata structure:
    {
        "forecast_parameters": {
            "forecast_date": str,
            "forecast_periods": int,
            "forecast_start": str,
            "forecast_end": str,
            "models_trained": bool
        },
        "model_info": {
            "model_directory": str,
            "models": [
                {
                    "filename": str,
                    "description": str,
                    "created_at": str (ISO format),
                    "modified_at": str (ISO format),
                    "size_bytes": int,
                    "exists": bool
                }
            ]
        },
        "metrics": {
            "prophet": {...},
            "xgboost": {...}
        },
        "dataset_stats": {
            "dataset_info": {...},
            "stage_distribution": {...},
            "revenue_stats": {...},
            "monthly_revenue_stats": {...},
            ...
        },
        "other": {
            "generated_at": str,
            "api_version": str,
            "ensemble_weights": {...},
            "forecast_summary": {...}
        }
    }
    """
    forecast: List[dict] = Field(..., description="12-month forecast data")
    summary: dict = Field(..., description="Forecast summary statistics")
    metadata: dict = Field(..., description="Comprehensive metadata for LLM report generation")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    models_loaded: bool
    model_dir: str


class UploadResponse(BaseModel):
    """Response model for file upload endpoint"""
    status: str
    message: str
    filename: str
    file_path: str
    file_size: int
    uploaded_at: str
    files_deleted: Optional[int] = Field(None, description="Number of old files deleted to maintain limit")
    total_files: Optional[int] = Field(None, description="Total number of files in tmp directory after cleanup")


class DashboardDataPoint(BaseModel):
    """Data point for dashboard charts"""
    date: str
    revenue: float
    bookings: Optional[int] = None
    type: Literal['historical', 'forecast']


class DashboardForecastResponse(BaseModel):
    """Response model for dashboard forecast endpoint"""
    historical: List[DashboardDataPoint]
    forecast: List[DashboardDataPoint]
    insights: List[str]
    keyDrivers: List[str]
    suggestedParameters: List[dict]
    funnel: Optional[List[dict]] = None


@app.on_event("startup")
async def startup_event():
    """Initialize the pipeline on startup"""
    global pipeline
    
    # Resolve model directory relative to project root
    model_dir = os.path.join(project_root, "model/artifacts")
    
    try:
        pipeline = EnsemblePipeline(model_dir=model_dir, min_years=1.0)
        # Try to load existing models (if they exist)
        try:
            pipeline.inference.load_models()
        except Exception as e:
            print(f"Note: Models not yet trained. Train models first or provide training data. {e}")
    except Exception as e:
        print(f"Warning: Could not initialize pipeline: {e}")
        pipeline = None


@app.get("/", response_model=dict)
async def root():
    """Root endpoint"""
    endpoints = {
        "health": "/health",
        "upload": "/upload",
        "forecast": "/forecast",
        "dashboard/forecast": "/dashboard/forecast",
        "train": "/train",
        "docs": "/docs"
    }
    
    # Add report endpoint if available
    if REPORT_GENERATOR_AVAILABLE:
        endpoints["report"] = "/report"
    else:
        endpoints["report"] = "/report (not available - Azure OpenAI not configured)"
    
    return {
        "message": "Revenue Forecasting API",
        "version": "1.0.0",
        "endpoints": endpoints
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    global pipeline
    
    model_dir = os.path.join(project_root, "model/artifacts")
    models_loaded = (
        pipeline is not None and 
        pipeline.inference.prophet_model is not None
    )
    
    return HealthResponse(
        status="healthy" if pipeline is not None else "degraded",
        models_loaded=models_loaded,
        model_dir=model_dir
    )


@app.post("/forecast", response_model=ForecastResponse)
async def generate_forecast(
    file: UploadFile = File(..., description="CSV file with historical booking data"),
    forecast_date: Optional[str] = Form(None, description="Forecast reference date (YYYY-MM-DD). Defaults to today."),
    train_models: bool = Form(False, description="Whether to train models before forecasting")
):
    """
    Generate a 12-month revenue forecast from historical booking data.
    
    The CSV file should match the format of data/test_data.csv (or data/data_template.csv) with columns:
    - lead_id, inquiry_date, destination, trip_price, lead_source, current_stage,
    - is_repeat_customer, quote_date, booking_date, trip_date, final_payment_date, duration_days
    
    Parameters:
    -----------
    file : UploadFile
        CSV file with historical booking data
    forecast_date : str, optional
        Forecast reference date (YYYY-MM-DD). If not provided, uses today.
    train_models : bool
        If True, trains models before forecasting. If False, uses existing trained models.
    
    Returns:
    --------
    ForecastResponse
        JSON response with 12-month forecast, summary statistics, and metadata
    """
    global pipeline
    
    if pipeline is None:
        raise HTTPException(
            status_code=500,
            detail="Pipeline not initialized. Please check server logs."
        )
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV file"
        )
    
    try:
        # Read CSV file
        contents = await file.read()
        
        # Save to temporary file (pipeline expects file path)
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as tmp_file:
            tmp_file.write(contents)
            tmp_file_path = tmp_file.name
        
        try:
            # Train models if requested
            if train_models:
                print("Training models from provided data...")
                training_metadata = pipeline.train(tmp_file_path)
                print("Training completed successfully")
            else:
                # Check if models are loaded
                if pipeline.inference.prophet_model is None:
                    raise HTTPException(
                        status_code=400,
                        detail="Models not trained. Set train_models=true or train models separately."
                    )
            
            # Generate forecast
            forecast_df = pipeline.forecast(
                csv_path=tmp_file_path,
                forecast_date=forecast_date
            )
            
            # Convert forecast to list of dicts
            forecast_list = []
            for _, row in forecast_df.iterrows():
                forecast_list.append({
                    "date": row['date'].strftime('%Y-%m-%d'),
                    "forecast": float(row['forecast']),
                    "lower": float(row.get('lower', 0)),
                    "upper": float(row.get('upper', 0))
                })
            
            # Calculate summary statistics
            summary = {
                "total_forecast": float(forecast_df['forecast'].sum()),
                "average_monthly": float(forecast_df['forecast'].mean()),
                "min_monthly": float(forecast_df['forecast'].min()),
                "max_monthly": float(forecast_df['forecast'].max()),
                "std_monthly": float(forecast_df['forecast'].std())
            }
            
            # Build comprehensive metadata for LLM report generation
            model_dir = pipeline.model_dir
            
            metadata = {
                # Forecast parameters
                "forecast_parameters": {
                    "forecast_date": forecast_date or datetime.now().strftime('%Y-%m-%d'),
                    "forecast_periods": len(forecast_df),
                    "forecast_start": forecast_df['date'].min().strftime('%Y-%m-%d'),
                    "forecast_end": forecast_df['date'].max().strftime('%Y-%m-%d'),
                    "models_trained": train_models
                },
                
                # Model information
                "model_info": get_model_info(model_dir),
                
                # Training metrics
                "metrics": get_training_metrics(pipeline),
                
                # Dataset statistics and EDA
                "dataset_stats": get_dataset_stats(pipeline),
                
                # Other useful information
                "other": {
                    "generated_at": datetime.now().isoformat(),
                    "api_version": "1.0.0",
                    "ensemble_weights": {
                        "prophet": 0.4,
                        "xgboost": 0.3,
                        "pipeline": 0.3
                    },
                    "forecast_summary": {
                        "total_forecast": float(forecast_df['forecast'].sum()),
                        "average_monthly": float(forecast_df['forecast'].mean()),
                        "coefficient_of_variation": float(forecast_df['forecast'].std() / forecast_df['forecast'].mean()) if forecast_df['forecast'].mean() > 0 else 0
                    }
                }
            }
            
            return ForecastResponse(
                forecast=forecast_list,
                summary=summary,
                metadata=metadata
            )
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Data validation error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Forecast generation failed: {str(e)}"
        )


@app.post("/dashboard/forecast", response_model=DashboardForecastResponse)
async def get_dashboard_forecast(
    file: UploadFile = File(..., description="CSV file with historical booking data"),
    forecast_date: Optional[str] = Form(None, description="Forecast reference date (YYYY-MM-DD). Defaults to today."),
    train_models: bool = Form(False, description="Whether to train models before forecasting")
):
    """
    Generate forecast data formatted for the dashboard.
    
    This endpoint returns data in the exact format expected by the frontend dashboard,
    including historical data, forecast data, insights, and simulation parameters.
    
    Parameters:
    -----------
    file : UploadFile
        CSV file with historical booking data
    forecast_date : str, optional
        Forecast reference date (YYYY-MM-DD). If not provided, uses today.
    train_models : bool
        If True, trains models before forecasting. If False, uses existing trained models.
    
    Returns:
    --------
    DashboardForecastResponse
        JSON response with historical data, forecast data, insights, key drivers,
        suggested parameters, and optional funnel data
    """
    global pipeline
    
    if pipeline is None:
        raise HTTPException(
            status_code=500,
            detail="Pipeline not initialized. Please check server logs."
        )
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV file"
        )
    
    try:
        # Read CSV file
        contents = await file.read()
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as tmp_file:
            tmp_file.write(contents)
            tmp_file_path = tmp_file.name
        
        try:
            # Train models if requested
            if train_models:
                print("Training models from provided data...")
                pipeline.train(tmp_file_path)
                print("Training completed successfully")
            else:
                # Check if models are loaded
                if pipeline.inference.prophet_model is None:
                    raise HTTPException(
                        status_code=400,
                        detail="Models not trained. Set train_models=true or train models separately."
                    )
            
            # Generate forecast (this will load data internally if needed)
            forecast_df = pipeline.forecast(
                csv_path=tmp_file_path,
                forecast_date=forecast_date
            )
            
            # After forecast, data should be loaded - get monthly revenue
            if pipeline.monthly_revenue is None or pipeline.monthly_revenue.empty:
                # If monthly_revenue wasn't set by forecast, prepare it now
                # Pass forecast_date to exclude incomplete months
                monthly_revenue = pipeline.data_loader.prepare_monthly_revenue(forecast_date=forecast_date)
            else:
                monthly_revenue = pipeline.monthly_revenue
            
            # Ensure pipeline.data is set (forecast should have loaded it)
            if pipeline.data is None or pipeline.data.empty:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to load data for historical revenue calculation"
                )
            
            # Transform historical data
            historical_data = []
            for _, row in monthly_revenue.iterrows():
                # Count bookings for this month if available
                bookings = None
                if 'bookings' in row:
                    bookings = int(row['bookings'])
                elif pipeline.data is not None and not pipeline.data.empty and 'trip_date' in pipeline.data.columns:
                    # Count completed trips in this month
                    try:
                        month_start = pd.to_datetime(row['date'])
                        month_end = month_start + pd.DateOffset(months=1)
                        month_trips = pipeline.data[
                            (pd.to_datetime(pipeline.data['trip_date'], errors='coerce') >= month_start) &
                            (pd.to_datetime(pipeline.data['trip_date'], errors='coerce') < month_end) &
                            (pipeline.data['current_stage'] == 'completed')
                        ]
                        # Check if month_trips is valid DataFrame before accessing .empty
                        if month_trips is not None and hasattr(month_trips, 'empty'):
                            bookings = len(month_trips) if not month_trips.empty else None
                        else:
                            bookings = None
                    except Exception as e:
                        # If counting fails, just skip bookings
                        print(f"Warning: Could not count bookings for {row['date']}: {e}")
                        bookings = None
                
                historical_data.append(DashboardDataPoint(
                    date=row['date'].strftime('%Y-%m-%d'),
                    revenue=float(row['revenue']),
                    bookings=bookings,
                    type="historical"
                ))
            
            # Transform forecast data
            forecast_data = []
            for _, row in forecast_df.iterrows():
                forecast_data.append(DashboardDataPoint(
                    date=row['date'].strftime('%Y-%m-%d'),
                    revenue=float(row['forecast']),
                    bookings=None,  # Forecast doesn't include bookings
                    type="forecast"
                ))
            
            # Get dataset stats and metrics for insights/key drivers
            dataset_stats = get_dataset_stats(pipeline)
            metrics = get_training_metrics(pipeline)
            monthly_revenue_stats = dataset_stats.get("monthly_revenue_stats", None)
            
            # Generate insights
            insights = generate_insights_from_metadata(dataset_stats, metrics, monthly_revenue_stats)
            
            # Generate key drivers
            key_drivers = generate_key_drivers_from_stats(dataset_stats)
            
            # Get suggested parameters
            suggested_parameters = get_suggested_parameters()
            
            # Generate funnel data (use same forecast_date for consistency)
            funnel_data = generate_funnel_data(pipeline, forecast_date=forecast_date)
            
            return DashboardForecastResponse(
                historical=historical_data,
                forecast=forecast_data,
                insights=insights,
                keyDrivers=key_drivers,
                suggestedParameters=suggested_parameters,
                funnel=funnel_data
            )
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Data validation error: {str(e)}"
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Forecast generation failed: {str(e)}"
        )


@app.post("/train")
async def train_models(
    file: UploadFile = File(..., description="CSV file with historical booking data for training")
):
    """
    Train models from historical booking data.
    
    This endpoint trains the ensemble models (Prophet, XGBoost, Pipeline)
    from the provided CSV data. Trained models are saved and can be used
    for subsequent forecast requests.
    
    Parameters:
    -----------
    file : UploadFile
        CSV file with historical booking data
    
    Returns:
    --------
    dict
        Training metadata and status
    """
    global pipeline
    
    if pipeline is None:
        raise HTTPException(
            status_code=500,
            detail="Pipeline not initialized. Please check server logs."
        )
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV file"
        )
    
    try:
        # Read CSV file
        contents = await file.read()
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as tmp_file:
            tmp_file.write(contents)
            tmp_file_path = tmp_file.name
        
        try:
            # Train models
            training_metadata = pipeline.train(tmp_file_path)
            
            return {
                "status": "success",
                "message": "Models trained successfully",
                "metadata": training_metadata
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Data validation error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Training failed: {str(e)}"
        )


@app.post("/report")
async def generate_report(
    file: UploadFile = File(..., description="CSV file with historical booking data"),
    forecast_date: Optional[str] = Form(None, description="Forecast reference date (YYYY-MM-DD). Defaults to today."),
    train_models: bool = Form(False, description="Whether to train models before forecasting")
):
    """
    Generate a strategic analysis report from historical booking data.
    
    This endpoint generates a 12-month revenue forecast and then uses Azure OpenAI
    to create a comprehensive strategic analysis report with insights, recommendations,
    and operational guidance.
    
    The CSV file should match the format of data/test_data.csv (or data/data_template.csv) with columns:
    - lead_id, inquiry_date, destination, trip_price, lead_source, current_stage,
    - is_repeat_customer, quote_date, booking_date, trip_date, final_payment_date, duration_days
    
    Parameters:
    -----------
    file : UploadFile
        CSV file with historical booking data
    forecast_date : str, optional
        Forecast reference date (YYYY-MM-DD). If not provided, uses today.
    train_models : bool
        If True, trains models before forecasting. If False, uses existing trained models.
    
    Returns:
    --------
    dict
        Strategic analysis report in JSON format with:
        - executive_summary
        - driving_factors
        - outliers_and_anomalies
        - operational_recommendations
        - model_performance_assessment
    """
    global pipeline
    
    if not REPORT_GENERATOR_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Report generator not available. Please configure Azure OpenAI credentials in .env file (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT_NAME)."
        )
    
    if pipeline is None:
        raise HTTPException(
            status_code=500,
            detail="Pipeline not initialized. Please check server logs."
        )
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV file"
        )
    
    try:
        # Read CSV file
        contents = await file.read()
        
        # Save to temporary file (pipeline expects file path)
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as tmp_file:
            tmp_file.write(contents)
            tmp_file_path = tmp_file.name
        
        try:
            # Step 1: Train models if requested
            if train_models:
                print("Training models from provided data...")
                training_metadata = pipeline.train(tmp_file_path)
                print("Training completed successfully")
            else:
                # Check if models are loaded
                if pipeline.inference.prophet_model is None:
                    raise HTTPException(
                        status_code=400,
                        detail="Models not trained. Set train_models=true or train models separately."
                    )
            
            # Step 2: Generate forecast
            forecast_df = pipeline.forecast(
                csv_path=tmp_file_path,
                forecast_date=forecast_date
            )
            
            # Step 3: Convert forecast to list of dicts
            forecast_list = []
            for _, row in forecast_df.iterrows():
                forecast_list.append({
                    "date": row['date'].strftime('%Y-%m-%d'),
                    "forecast": float(row['forecast']),
                    "lower": float(row.get('lower', 0)),
                    "upper": float(row.get('upper', 0))
                })
            
            # Step 4: Build metadata (same as forecast endpoint)
            model_dir = pipeline.model_dir
            
            metadata = {
                # Forecast parameters
                "forecast_parameters": {
                    "forecast_date": forecast_date or datetime.now().strftime('%Y-%m-%d'),
                    "forecast_periods": len(forecast_df),
                    "forecast_start": forecast_df['date'].min().strftime('%Y-%m-%d'),
                    "forecast_end": forecast_df['date'].max().strftime('%Y-%m-%d'),
                    "models_trained": train_models
                },
                
                # Model information
                "model_info": get_model_info(model_dir),
                
                # Training metrics
                "metrics": get_training_metrics(pipeline),
                
                # Dataset statistics and EDA
                "dataset_stats": get_dataset_stats(pipeline),
                
                # Other useful information
                "other": {
                    "generated_at": datetime.now().isoformat(),
                    "api_version": "1.0.0",
                    "ensemble_weights": {
                        "prophet": 0.4,
                        "xgboost": 0.3,
                        "pipeline": 0.3
                    },
                    "forecast_summary": {
                        "total_forecast": float(forecast_df['forecast'].sum()),
                        "average_monthly": float(forecast_df['forecast'].mean()),
                        "coefficient_of_variation": float(forecast_df['forecast'].std() / forecast_df['forecast'].mean()) if forecast_df['forecast'].mean() > 0 else 0
                    }
                }
            }
            
            # Step 5: Generate strategic report using ReportGenerator
            try:
                report_generator = ReportGenerator()
                report = report_generator.generate_report(metadata, forecast_list)
                
                return report
                
            except ValueError as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Report generation failed: {str(e)}"
                )
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error generating report: {str(e)}"
                )
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Data validation error: {str(e)}"
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Report generation failed: {str(e)}"
        )


@app.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(..., description="CSV file to upload")
):
    """
    Upload a CSV file and store it in a temporary directory.
    
    This endpoint accepts a CSV file, validates it, and stores it in a tmp directory
    with a unique filename. The file can later be used for forecasting or training.
    
    Parameters:
    -----------
    file : UploadFile
        CSV file to upload
    
    Returns:
    --------
    UploadResponse
        Information about the uploaded file including path and metadata
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV file"
        )
    
    try:
        # Create tmp directory if it doesn't exist
        tmp_dir = os.path.join(project_root, "tmp")
        os.makedirs(tmp_dir, exist_ok=True)
        
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        original_filename = file.filename
        # Preserve original filename but add timestamp prefix
        safe_filename = f"{timestamp}_{original_filename}"
        file_path = os.path.join(tmp_dir, safe_filename)
        
        # Read file contents
        contents = await file.read()
        file_size = len(contents)
        
        # Validate file is not empty
        if file_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )
        
        # Write file to tmp directory
        with open(file_path, 'wb') as f:
            f.write(contents)
        
        # Clean up old files to maintain maximum file limit
        files_deleted = 0
        total_files = 0
        
        try:
            # Get all CSV files in tmp directory
            tmp_path = Path(tmp_dir)
            csv_files = list(tmp_path.glob("*.csv"))
            total_files = len(csv_files)
            
            # If we exceed the limit, delete oldest files
            if total_files > MAX_TMP_FILES:
                # Sort files by modification time (oldest first)
                csv_files.sort(key=lambda f: f.stat().st_mtime)
                
                # Calculate how many to delete
                files_to_delete = total_files - MAX_TMP_FILES
                
                # Delete oldest files
                for file_to_delete in csv_files[:files_to_delete]:
                    try:
                        file_to_delete.unlink()
                        files_deleted += 1
                    except Exception as e:
                        print(f"Warning: Failed to delete old file {file_to_delete}: {e}")
                
                # Recalculate total after cleanup
                total_files = len(list(tmp_path.glob("*.csv")))
                
        except Exception as e:
            # Don't fail the upload if cleanup fails, just log it
            print(f"Warning: Failed to clean up old files in tmp directory: {e}")
        
        response_message = "File uploaded successfully"
        if files_deleted > 0:
            response_message += f". Cleaned up {files_deleted} old file(s) to maintain limit of {MAX_TMP_FILES} files."
        
        return UploadResponse(
            status="success",
            message=response_message,
            filename=safe_filename,
            file_path=file_path,
            file_size=file_size,
            uploaded_at=datetime.now().isoformat(),
            files_deleted=files_deleted if files_deleted > 0 else None,
            total_files=total_files
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except OSError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

