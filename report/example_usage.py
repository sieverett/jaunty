"""
Example usage of the Report Generator

This script demonstrates how to use the ReportGenerator to create
strategic analysis reports from forecast metadata.
"""

import json
import sys
import os
from pathlib import Path

# Add parent directory to path to import report_generator
sys.path.insert(0, os.path.dirname(__file__))

from report_generator import ReportGenerator


def example_from_api_response():
    """Example: Generate report from a full API response JSON file."""
    print("Example 1: Generate report from API response file")
    print("=" * 70)
    
    # Path to API response JSON (you would get this from the /forecast endpoint)
    api_response_path = Path(__file__).parent.parent / "forecast_response.json"
    
    if not api_response_path.exists():
        print(f"⚠ API response file not found: {api_response_path}")
        print("   To use this example:")
        print("   1. Call the /forecast endpoint and save the response")
        print("   2. Save it as 'forecast_response.json' in the project root")
        print("   3. Run this script again")
        return
    
    # Load API response
    with open(api_response_path, 'r') as f:
        api_response = json.load(f)
    
    metadata = api_response.get("metadata", {})
    forecast = api_response.get("forecast", [])
    
    if not metadata:
        print("⚠ No metadata found in API response")
        return
    
    # Generate report
    try:
        generator = ReportGenerator()
        print("Generating strategic analysis report...")
        report = generator.generate_report(metadata, forecast)
        
        # Save report
        output_path = Path(__file__).parent / "strategic_report.json"
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"✓ Report generated successfully: {output_path}")
        print("\nReport Summary:")
        print("-" * 70)
        exec_summary = report.get("executive_summary", {})
        print(f"Overview: {exec_summary.get('overview', 'N/A')[:200]}...")
        print(f"Total Forecast: {exec_summary.get('total_forecast', 'N/A')}")
        print(f"Key Insights: {len(exec_summary.get('key_insights', []))} insights")
        
        driving_factors = report.get("driving_factors", {})
        print(f"\nPositive Factors: {len(driving_factors.get('positive_factors', []))}")
        print(f"Negative Factors: {len(driving_factors.get('negative_factors', []))}")
        
        recommendations = report.get("operational_recommendations", {})
        print(f"\nImmediate Actions: {len(recommendations.get('immediate_actions', []))}")
        print(f"Strategic Initiatives: {len(recommendations.get('strategic_initiatives', []))}")
        
    except Exception as e:
        print(f"✗ Error generating report: {e}")
        import traceback
        traceback.print_exc()


def example_from_metadata_only():
    """Example: Generate report from metadata dictionary only."""
    print("\n\nExample 2: Generate report from metadata dictionary")
    print("=" * 70)
    
    # Example metadata structure (simplified)
    example_metadata = {
        "forecast_parameters": {
            "forecast_date": "2024-11-20",
            "forecast_periods": 12,
            "forecast_start": "2024-12-01",
            "forecast_end": "2025-11-01",
            "models_trained": True
        },
        "model_info": {
            "model_directory": "/path/to/models",
            "models": [
                {
                    "filename": "prophet_model.pkl",
                    "description": "Prophet time series model",
                    "created_at": "2024-11-20T10:00:00",
                    "exists": True
                }
            ]
        },
        "metrics": {
            "prophet": {
                "available": True,
                "mape": 12.5,
                "mae": 5000.0,
                "rmse": 7500.0
            }
        },
        "dataset_stats": {
            "available": True,
            "dataset_info": {
                "total_records": 1000,
                "date_range": {
                    "trip_start": "2023-01-01",
                    "trip_end": "2024-11-01",
                    "trip_span_years": 1.83
                }
            },
            "revenue_stats": {
                "total_revenue": 2500000.0,
                "average_trip_value": 5000.0
            },
            "monthly_revenue_stats": {
                "total_months": 22,
                "average_monthly": 113636.36
            }
        },
        "other": {
            "forecast_summary": {
                "total_forecast": 3000000.0,
                "average_monthly": 250000.0,
                "coefficient_of_variation": 0.15
            },
            "ensemble_weights": {
                "prophet": 0.4,
                "xgboost": 0.3,
                "pipeline": 0.3
            }
        }
    }
    
    # Example forecast data
    example_forecast = [
        {"date": "2024-12-01", "forecast": 250000.0, "lower": 200000.0, "upper": 300000.0},
        {"date": "2025-01-01", "forecast": 260000.0, "lower": 210000.0, "upper": 310000.0},
        {"date": "2025-02-01", "forecast": 255000.0, "lower": 205000.0, "upper": 305000.0},
    ]
    
    try:
        generator = ReportGenerator()
        print("Generating strategic analysis report from example data...")
        report = generator.generate_report(example_metadata, example_forecast)
        
        print("✓ Report generated successfully!")
        print("\nReport Structure:")
        print("-" * 70)
        for key in report.keys():
            if isinstance(report[key], dict):
                print(f"  {key}: {len(report[key])} sections")
            elif isinstance(report[key], list):
                print(f"  {key}: {len(report[key])} items")
            else:
                print(f"  {key}: {type(report[key]).__name__}")
        
    except Exception as e:
        print(f"✗ Error generating report: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("Report Generator - Example Usage")
    print("=" * 70)
    
    # Check if Azure OpenAI is configured
    from dotenv import load_dotenv
    load_dotenv()
    
    import os
    if not all([
        os.getenv("AZURE_OPENAI_ENDPOINT"),
        os.getenv("AZURE_OPENAI_API_KEY"),
        os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    ]):
        print("⚠ Azure OpenAI not configured!")
        print("   Please set the following in your .env file:")
        print("   - AZURE_OPENAI_ENDPOINT")
        print("   - AZURE_OPENAI_API_KEY")
        print("   - AZURE_OPENAI_DEPLOYMENT_NAME")
        print("\n   Skipping examples that require API calls...")
    else:
        # Run examples
        example_from_api_response()
        # example_from_metadata_only()  # Uncomment to test with example data

