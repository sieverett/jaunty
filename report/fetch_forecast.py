"""
Helper script to fetch forecast data from the backend API and save it as JSON.

This script calls the /forecast endpoint and saves the response to forecast_response.json
for use with the report generator.
"""

import requests
import json
import sys
import os
from pathlib import Path


def fetch_forecast(
    csv_path: str,
    api_url: str = "http://localhost:8000",
    forecast_date: str = None,
    train_models: bool = False,
    output_path: str = None
):
    """
    Fetch forecast from API and save to JSON file.
    
    Args:
        csv_path: Path to CSV file with historical booking data
        api_url: Base URL of the backend API (default: http://localhost:8000)
        forecast_date: Optional forecast reference date (YYYY-MM-DD)
        train_models: Whether to train models before forecasting
        output_path: Path to save the JSON response (default: forecast_response.json in current directory)
    """
    # Resolve CSV path
    csv_path = Path(csv_path)
    if not csv_path.exists():
        print(f"Error: Path not found: {csv_path}")
        sys.exit(1)
    
    if csv_path.is_dir():
        print(f"Error: Path is a directory, not a file: {csv_path}")
        # Look for CSV files in the directory
        csv_files = list(csv_path.glob("*.csv"))
        if csv_files:
            print(f"\nFound CSV files in this directory:")
            for csv_file in csv_files:
                print(f"  - {csv_file}")
            print(f"\nPlease specify a CSV file, for example:")
            print(f"  python fetch_forecast.py {csv_files[0]}")
        else:
            print(f"\nNo CSV files found in this directory.")
        sys.exit(1)
    
    if not csv_path.suffix.lower() == '.csv':
        print(f"Warning: File does not have .csv extension: {csv_path}")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    # Prepare request
    url = f"{api_url}/forecast"
    
    # Prepare form data
    data = {
        'train_models': str(train_models).lower()
    }
    if forecast_date:
        data['forecast_date'] = forecast_date
    
    # Prepare file upload
    try:
        with open(csv_path, 'rb') as f:
            files = {'file': (csv_path.name, f, 'text/csv')}
            
            print(f"Calling API: {url}")
            print(f"CSV file: {csv_path}")
            print(f"Train models: {train_models}")
            if forecast_date:
                print(f"Forecast date: {forecast_date}")
            print("...")
            
            # Make request
            response = requests.post(url, files=files, data=data)
            
            if response.status_code == 200:
                result = response.json()
                
                # Determine output path
                if output_path is None:
                    output_path = Path(__file__).parent / "forecast_response.json"
                else:
                    output_path = Path(output_path)
                
                # Save to file
                with open(output_path, 'w') as out_file:
                    json.dump(result, out_file, indent=2)
                
                print(f"✓ Forecast fetched successfully!")
                print(f"  Saved to: {output_path}")
                print(f"\nForecast Summary:")
                print(f"  Total Forecast: ${result['summary']['total_forecast']:,.0f}")
                print(f"  Average Monthly: ${result['summary']['average_monthly']:,.0f}")
                print(f"  Forecast Period: {result['metadata']['forecast_parameters']['forecast_start']} to {result['metadata']['forecast_parameters']['forecast_end']}")
                print(f"\nYou can now use this file with the report generator:")
                print(f"  python report_generator.py {output_path} -o strategic_report.json")
                
                return output_path
            else:
                print(f"✗ API request failed: {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"Error: {error_detail}")
                except:
                    print(f"Error: {response.text}")
                sys.exit(1)
                
    except requests.exceptions.ConnectionError:
        print(f"✗ Error: Could not connect to API at {api_url}")
        print("  Make sure the backend server is running:")
        print("  cd jaunty/backend && uvicorn main:app --reload")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    """Command-line interface."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Fetch forecast from backend API and save to JSON file"
    )
    parser.add_argument(
        "csv_path",
        type=str,
        help="Path to CSV file with historical booking data"
    )
    parser.add_argument(
        "-u", "--url",
        type=str,
        default="http://localhost:8000",
        help="Backend API URL (default: http://localhost:8000)"
    )
    parser.add_argument(
        "-d", "--forecast-date",
        type=str,
        default=None,
        help="Forecast reference date (YYYY-MM-DD). Defaults to today."
    )
    parser.add_argument(
        "-t", "--train",
        action="store_true",
        help="Train models before forecasting"
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default=None,
        help="Output JSON file path (default: forecast_response.json)"
    )
    
    args = parser.parse_args()
    
    fetch_forecast(
        csv_path=args.csv_path,
        api_url=args.url,
        forecast_date=args.forecast_date,
        train_models=args.train,
        output_path=args.output
    )


if __name__ == "__main__":
    main()

