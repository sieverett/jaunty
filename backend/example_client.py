"""
Example client script for testing the Revenue Forecasting API.

This script demonstrates how to interact with the API endpoints.
"""

import requests
import json
from pathlib import Path

# API base URL
BASE_URL = "http://localhost:8000"

def test_health():
    """Test health check endpoint"""
    print("Testing health check...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    print()

def train_models(csv_path: str):
    """Train models from CSV file"""
    print(f"Training models from {csv_path}...")
    
    with open(csv_path, 'rb') as f:
        response = requests.post(
            f"{BASE_URL}/train",
            files={'file': f}
        )
    
    if response.status_code == 200:
        print("✓ Models trained successfully")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    else:
        print(f"✗ Training failed: {response.status_code}")
        print(f"Error: {response.json()}")
    print()

def generate_forecast(csv_path: str, forecast_date: str = None, train_models_flag: bool = False):
    """Generate forecast from CSV file"""
    print(f"Generating forecast from {csv_path}...")
    
    data = {'train_models': str(train_models_flag).lower()}
    if forecast_date:
        data['forecast_date'] = forecast_date
    
    with open(csv_path, 'rb') as f:
        response = requests.post(
            f"{BASE_URL}/forecast",
            files={'file': f},
            data=data
        )
    
    if response.status_code == 200:
        result = response.json()
        print("✓ Forecast generated successfully")
        
        # Forecast Summary
        print(f"\n{'='*70}")
        print("FORECAST SUMMARY")
        print(f"{'='*70}")
        print(f"  Total Forecast: ${result['summary']['total_forecast']:,.0f}")
        print(f"  Average Monthly: ${result['summary']['average_monthly']:,.0f}")
        print(f"  Min Monthly: ${result['summary']['min_monthly']:,.0f}")
        print(f"  Max Monthly: ${result['summary']['max_monthly']:,.0f}")
        print(f"  Std Deviation: ${result['summary']['std_monthly']:,.0f}")
        
        # Forecast Parameters
        meta = result['metadata']
        params = meta.get('forecast_parameters', {})
        print(f"\n{'='*70}")
        print("FORECAST PARAMETERS")
        print(f"{'='*70}")
        print(f"  Forecast Date: {params.get('forecast_date', 'N/A')}")
        print(f"  Forecast Period: {params.get('forecast_start', 'N/A')} to {params.get('forecast_end', 'N/A')}")
        print(f"  Periods: {params.get('forecast_periods', 'N/A')} months")
        print(f"  Models Trained: {params.get('models_trained', False)}")
        
        # Model Info
        model_info = meta.get('model_info', {})
        print(f"\n{'='*70}")
        print("MODEL INFORMATION")
        print(f"{'='*70}")
        print(f"  Model Directory: {model_info.get('model_directory', 'N/A')}")
        models = model_info.get('models', [])
        print(f"  Available Models:")
        for model in models:
            if model.get('exists', False):
                print(f"    ✓ {model.get('filename', 'N/A')} - {model.get('description', 'N/A')}")
                print(f"      Created: {model.get('created_at', 'N/A')}")
                print(f"      Size: {model.get('size_bytes', 0):,} bytes")
            else:
                print(f"    ✗ {model.get('filename', 'N/A')} - Not found")
        
        # Training Metrics
        metrics = meta.get('metrics', {})
        if metrics.get('available', True) and not metrics.get('error'):
            print(f"\n{'='*70}")
            print("MODEL METRICS")
            print(f"{'='*70}")
            
            if 'prophet' in metrics:
                prophet_metrics = metrics['prophet']
                print(f"  Prophet Model:")
                if 'mape' in prophet_metrics:
                    print(f"    MAPE: {prophet_metrics.get('mape', 'N/A'):.2f}%")
                if 'mae' in prophet_metrics:
                    print(f"    MAE: ${prophet_metrics.get('mae', 0):,.0f}")
                if 'rmse' in prophet_metrics:
                    print(f"    RMSE: ${prophet_metrics.get('rmse', 0):,.0f}")
            
            if 'xgboost' in metrics:
                xgb_metrics = metrics['xgboost']
                print(f"  XGBoost Model:")
                if 'accuracy' in xgb_metrics:
                    print(f"    Accuracy: {xgb_metrics.get('accuracy', 0):.2%}")
                if 'roc_auc' in xgb_metrics:
                    print(f"    ROC-AUC: {xgb_metrics.get('roc_auc', 0):.3f}")
                if 'precision' in xgb_metrics:
                    print(f"    Precision: {xgb_metrics.get('precision', 0):.2%}")
                if 'recall' in xgb_metrics:
                    print(f"    Recall: {xgb_metrics.get('recall', 0):.2%}")
        else:
            print(f"\n{'='*70}")
            print("MODEL METRICS")
            print(f"{'='*70}")
            print(f"  {metrics.get('error', 'Metrics not available')}")
        
        # Dataset Statistics
        dataset_stats = meta.get('dataset_stats', {})
        if dataset_stats.get('available', False):
            print(f"\n{'='*70}")
            print("DATASET STATISTICS")
            print(f"{'='*70}")
            
            ds_info = dataset_stats.get('dataset_info', {})
            print(f"  Total Records: {ds_info.get('total_records', 'N/A'):,}")
            
            date_range = ds_info.get('date_range', {})
            if date_range:
                print(f"  Date Range:")
                if 'inquiry_start' in date_range:
                    print(f"    Inquiry: {date_range.get('inquiry_start', 'N/A')} to {date_range.get('inquiry_end', 'N/A')}")
                if 'trip_start' in date_range:
                    print(f"    Trips: {date_range.get('trip_start', 'N/A')} to {date_range.get('trip_end', 'N/A')}")
                    if 'trip_span_years' in date_range:
                        print(f"    Span: {date_range.get('trip_span_years', 'N/A')} years")
            
            stage_dist = dataset_stats.get('stage_distribution', {})
            if stage_dist:
                print(f"  Stage Distribution:")
                for stage, count in stage_dist.items():
                    print(f"    {stage}: {count:,}")
            
            conv_rate = dataset_stats.get('conversion_rate', {})
            if conv_rate:
                print(f"  Conversion Rate: {conv_rate.get('rate', 0):.1f}% ({conv_rate.get('completed', 0):,} completed / {conv_rate.get('total', 0):,} total)")
            
            revenue_stats = dataset_stats.get('revenue_stats', {})
            if revenue_stats:
                print(f"  Revenue Statistics:")
                print(f"    Total Revenue: ${revenue_stats.get('total_revenue', 0):,.0f}")
                print(f"    Average Trip Value: ${revenue_stats.get('average_trip_value', 0):,.0f}")
                print(f"    Median Trip Value: ${revenue_stats.get('median_trip_value', 0):,.0f}")
            
            monthly_stats = dataset_stats.get('monthly_revenue_stats', {})
            if monthly_stats:
                print(f"  Monthly Revenue Statistics:")
                print(f"    Total Months: {monthly_stats.get('total_months', 'N/A')}")
                print(f"    Average Monthly: ${monthly_stats.get('average_monthly', 0):,.0f}")
                print(f"    Range: ${monthly_stats.get('min_monthly', 0):,.0f} to ${monthly_stats.get('max_monthly', 0):,.0f}")
        
        # Other Metadata
        other = meta.get('other', {})
        print(f"\n{'='*70}")
        print("OTHER INFORMATION")
        print(f"{'='*70}")
        print(f"  Generated At: {other.get('generated_at', 'N/A')}")
        print(f"  API Version: {other.get('api_version', 'N/A')}")
        
        ensemble_weights = other.get('ensemble_weights', {})
        if ensemble_weights:
            print(f"  Ensemble Weights:")
            print(f"    Prophet: {ensemble_weights.get('prophet', 0):.1%}")
            print(f"    XGBoost: {ensemble_weights.get('xgboost', 0):.1%}")
            print(f"    Pipeline: {ensemble_weights.get('pipeline', 0):.1%}")
        
        forecast_summary = other.get('forecast_summary', {})
        if forecast_summary:
            print(f"  Forecast Summary:")
            print(f"    Total: ${forecast_summary.get('total_forecast', 0):,.0f}")
            print(f"    Average Monthly: ${forecast_summary.get('average_monthly', 0):,.0f}")
            cv = forecast_summary.get('coefficient_of_variation', 0)
            print(f"    Coefficient of Variation: {cv:.2%}")
        
        # Forecast Preview
        print(f"\n{'='*70}")
        print("FORECAST PREVIEW (First 3 Months)")
        print(f"{'='*70}")
        for month in result['forecast'][:3]:
            print(f"  {month['date']}: ${month['forecast']:,.0f} (${month['lower']:,.0f} - ${month['upper']:,.0f})")
        
        print(f"\n{'='*70}")
        print("Full metadata available in response['metadata'] for LLM report generation")
        print(f"{'='*70}")
    else:
        print(f"✗ Forecast failed: {response.status_code}")
        print(f"Error: {response.json()}")
    print()

def generate_report(csv_path: str, forecast_date: str = None, train_models_flag: bool = False):
    """Generate strategic analysis report from CSV file"""
    print(f"Generating strategic report from {csv_path}...")
    
    data = {'train_models': str(train_models_flag).lower()}
    if forecast_date:
        data['forecast_date'] = forecast_date
    
    with open(csv_path, 'rb') as f:
        response = requests.post(
            f"{BASE_URL}/report",
            files={'file': f},
            data=data
        )
    
    if response.status_code == 200:
        report = response.json()
        print("✓ Strategic report generated successfully")
        
        # Executive Summary
        exec_summary = report.get("executive_summary", {})
        print(f"\n{'='*70}")
        print("EXECUTIVE SUMMARY")
        print(f"{'='*70}")
        print(f"Overview: {exec_summary.get('overview', 'N/A')[:200]}...")
        print(f"Total Forecast: ${exec_summary.get('total_forecast', 0):,.0f}")
        print(f"Forecast Period: {exec_summary.get('forecast_period', 'N/A')}")
        print(f"\nKey Insights:")
        for insight in exec_summary.get('key_insights', [])[:5]:
            print(f"  • {insight}")
        
        # Driving Factors
        driving = report.get("driving_factors", {})
        print(f"\n{'='*70}")
        print("DRIVING FACTORS")
        print(f"{'='*70}")
        print(f"Positive Factors: {len(driving.get('positive_factors', []))}")
        print(f"Negative Factors: {len(driving.get('negative_factors', []))}")
        print(f"Seasonal Patterns: {driving.get('seasonal_patterns', 'N/A')[:150]}...")
        
        # Operational Recommendations
        recommendations = report.get("operational_recommendations", {})
        print(f"\n{'='*70}")
        print("OPERATIONAL RECOMMENDATIONS")
        print(f"{'='*70}")
        print(f"Immediate Actions: {len(recommendations.get('immediate_actions', []))}")
        print(f"Strategic Initiatives: {len(recommendations.get('strategic_initiatives', []))}")
        print(f"Risk Mitigation: {len(recommendations.get('risk_mitigation', []))}")
        print(f"Optimization Opportunities: {len(recommendations.get('optimization_opportunities', []))}")
        
        # Model Performance
        model_perf = report.get("model_performance_assessment", {})
        print(f"\n{'='*70}")
        print("MODEL PERFORMANCE ASSESSMENT")
        print(f"{'='*70}")
        print(f"Overall Confidence: {model_perf.get('overall_confidence', 'N/A')}")
        print(f"Reliability: {model_perf.get('model_reliability', 'N/A')[:150]}...")
        
        print(f"\n{'='*70}")
        print("Full report available in response JSON")
        print(f"{'='*70}")
        
        return report
    else:
        print(f"✗ Report generation failed: {response.status_code}")
        try:
            error_detail = response.json()
            print(f"Error: {error_detail}")
        except:
            print(f"Error: {response.text}")
    print()

if __name__ == "__main__":
    import sys
    
    # Find test_data.csv in data/ directory (JAUNTY project root)
    # jaunty/backend/ -> jaunty/ -> JAUNTY/
    project_root = Path(__file__).parent.parent.parent
    test_data_path = project_root / "data" / "test_data.csv"
    
    if not test_data_path.exists():
        print(f"Error: test_data.csv not found at {test_data_path}")
        print("Expected location: JAUNTY/data/test_data.csv")
        print("Please provide a CSV file path as an argument")
        sys.exit(1)
    
    print("="*70)
    print("Revenue Forecasting API - Example Client")
    print("="*70)
    print()
    
    # Test health check
    try:
        test_health()
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to API. Is the server running?")
        print(f"  Start server with: uvicorn main:app --reload")
        sys.exit(1)
    
    # Train models (optional - skip if models already exist)
    if len(sys.argv) > 1 and sys.argv[1] == "--train":
        train_models(str(test_data_path))
    
    # Generate report (if --report flag is set)
    if len(sys.argv) > 1 and sys.argv[1] == "--report":
        generate_report(
            str(test_data_path),
            forecast_date=None,  # Use today
            train_models_flag=False  # Use existing models
        )
    else:
        # Generate forecast (default)
        generate_forecast(
            str(test_data_path),
            forecast_date=None,  # Use today
            train_models_flag=False  # Use existing models
        )

