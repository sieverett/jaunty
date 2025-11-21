"""
Report Generator for Revenue Forecasting Pipeline

This script takes metadata from the forecasting pipeline and generates
a strategic analysis report using Azure OpenAI.
"""

import os
import json
import sys
from typing import Dict, Any, Optional
from datetime import datetime
from dotenv import load_dotenv
from openai import AzureOpenAI

# Load environment variables from .env file
load_dotenv()


class ReportGenerator:
    """Generates strategic analysis reports from forecast metadata using Azure OpenAI."""
    
    def __init__(self):
        """Initialize the report generator with Azure OpenAI client."""
        # Azure OpenAI configuration from environment variables
        self.endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        self.api_key = os.getenv("AZURE_OPENAI_API_KEY")
        self.api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        self.deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
        
        if not all([self.endpoint, self.api_key, self.deployment_name]):
            raise ValueError(
                "Missing required Azure OpenAI environment variables. "
                "Please set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT_NAME in .env file"
            )
        
        # Initialize Azure OpenAI client
        self.client = AzureOpenAI(
            azure_endpoint=self.endpoint,
            api_key=self.api_key,
            api_version=self.api_version
        )
    
    def prepare_metadata_summary(self, metadata: Dict[str, Any]) -> str:
        """
        Prepare a formatted summary of the metadata for the LLM prompt.
        
        Args:
            metadata: The metadata dictionary from the forecast API response
            
        Returns:
            Formatted string summary of the metadata
        """
        summary_parts = []
        
        # Forecast Parameters
        forecast_params = metadata.get("forecast_parameters", {})
        summary_parts.append("=== FORECAST PARAMETERS ===")
        summary_parts.append(f"Forecast Date: {forecast_params.get('forecast_date', 'N/A')}")
        summary_parts.append(f"Forecast Period: {forecast_params.get('forecast_start', 'N/A')} to {forecast_params.get('forecast_end', 'N/A')}")
        summary_parts.append(f"Forecast Periods: {forecast_params.get('forecast_periods', 'N/A')} months")
        summary_parts.append(f"Models Trained: {forecast_params.get('models_trained', False)}")
        summary_parts.append("")
        
        # Model Information
        model_info = metadata.get("model_info", {})
        summary_parts.append("=== MODEL INFORMATION ===")
        summary_parts.append(f"Model Directory: {model_info.get('model_directory', 'N/A')}")
        models = model_info.get("models", [])
        summary_parts.append(f"Available Models: {len(models)}")
        for model in models:
            if model.get("exists", False):
                summary_parts.append(f"  - {model.get('filename', 'N/A')} ({model.get('description', 'N/A')})")
                summary_parts.append(f"    Created: {model.get('created_at', 'N/A')}")
        summary_parts.append("")
        
        # Training Metrics
        metrics = metadata.get("metrics", {})
        summary_parts.append("=== MODEL PERFORMANCE METRICS ===")
        
        if "prophet" in metrics and metrics["prophet"].get("available", False):
            prophet_metrics = metrics["prophet"]
            summary_parts.append("Prophet Model:")
            if "mape" in prophet_metrics:
                summary_parts.append(f"  MAPE: {prophet_metrics.get('mape', 0):.2f}%")
            if "mae" in prophet_metrics:
                summary_parts.append(f"  MAE: ${prophet_metrics.get('mae', 0):,.0f}")
            if "rmse" in prophet_metrics:
                summary_parts.append(f"  RMSE: ${prophet_metrics.get('rmse', 0):,.0f}")
            if "mse" in prophet_metrics:
                summary_parts.append(f"  MSE: ${prophet_metrics.get('mse', 0):,.0f}")
        
        if "xgboost" in metrics and metrics["xgboost"].get("available", False):
            xgb_metrics = metrics["xgboost"]
            summary_parts.append("XGBoost Model:")
            if "accuracy" in xgb_metrics:
                summary_parts.append(f"  Accuracy: {xgb_metrics.get('accuracy', 0):.2%}")
            if "roc_auc" in xgb_metrics:
                summary_parts.append(f"  ROC-AUC: {xgb_metrics.get('roc_auc', 0):.3f}")
            if "precision" in xgb_metrics:
                summary_parts.append(f"  Precision: {xgb_metrics.get('precision', 0):.2%}")
            if "recall" in xgb_metrics:
                summary_parts.append(f"  Recall: {xgb_metrics.get('recall', 0):.2%}")
            if "f1_score" in xgb_metrics:
                summary_parts.append(f"  F1-Score: {xgb_metrics.get('f1_score', 0):.2%}")
        summary_parts.append("")
        
        # Dataset Statistics
        dataset_stats = metadata.get("dataset_stats", {})
        if dataset_stats.get("available", False):
            summary_parts.append("=== DATASET STATISTICS ===")
            
            ds_info = dataset_stats.get("dataset_info", {})
            summary_parts.append(f"Total Records: {ds_info.get('total_records', 0):,}")
            
            date_range = ds_info.get("date_range", {})
            if date_range:
                summary_parts.append(f"Inquiry Date Range: {date_range.get('inquiry_start', 'N/A')} to {date_range.get('inquiry_end', 'N/A')}")
                if "trip_start" in date_range:
                    summary_parts.append(f"Trip Date Range: {date_range.get('trip_start', 'N/A')} to {date_range.get('trip_end', 'N/A')}")
                    summary_parts.append(f"Historical Span: {date_range.get('trip_span_years', 0):.2f} years")
            
            stage_dist = dataset_stats.get("stage_distribution", {})
            if stage_dist:
                summary_parts.append("Stage Distribution:")
                for stage, count in stage_dist.items():
                    summary_parts.append(f"  {stage}: {count:,}")
            
            conv_rate = dataset_stats.get("conversion_rate", {})
            if conv_rate:
                summary_parts.append(f"Conversion Rate: {conv_rate.get('rate', 0):.1f}% ({conv_rate.get('completed', 0):,} completed / {conv_rate.get('total', 0):,} total)")
            
            revenue_stats = dataset_stats.get("revenue_stats", {})
            if revenue_stats:
                summary_parts.append("Revenue Statistics:")
                summary_parts.append(f"  Total Revenue: ${revenue_stats.get('total_revenue', 0):,.0f}")
                summary_parts.append(f"  Average Trip Value: ${revenue_stats.get('average_trip_value', 0):,.0f}")
                summary_parts.append(f"  Median Trip Value: ${revenue_stats.get('median_trip_value', 0):,.0f}")
                summary_parts.append(f"  Min Trip Value: ${revenue_stats.get('min_trip_value', 0):,.0f}")
                summary_parts.append(f"  Max Trip Value: ${revenue_stats.get('max_trip_value', 0):,.0f}")
                summary_parts.append(f"  Std Deviation: ${revenue_stats.get('std_trip_value', 0):,.0f}")
            
            monthly_stats = dataset_stats.get("monthly_revenue_stats", {})
            if monthly_stats:
                summary_parts.append("Monthly Revenue Statistics:")
                summary_parts.append(f"  Total Months: {monthly_stats.get('total_months', 0)}")
                summary_parts.append(f"  Average Monthly: ${monthly_stats.get('average_monthly', 0):,.0f}")
                summary_parts.append(f"  Median Monthly: ${monthly_stats.get('median_monthly', 0):,.0f}")
                summary_parts.append(f"  Min Monthly: ${monthly_stats.get('min_monthly', 0):,.0f}")
                summary_parts.append(f"  Max Monthly: ${monthly_stats.get('max_monthly', 0):,.0f}")
                summary_parts.append(f"  Std Deviation: ${monthly_stats.get('std_monthly', 0):,.0f}")
                summary_parts.append(f"  First Month: {monthly_stats.get('first_month', 'N/A')}")
                summary_parts.append(f"  Last Month: {monthly_stats.get('last_month', 'N/A')}")
            
            dest_dist = dataset_stats.get("destination_distribution", {})
            if dest_dist:
                summary_parts.append("Destination Distribution:")
                for dest, count in list(dest_dist.items())[:10]:  # Top 10
                    summary_parts.append(f"  {dest}: {count:,}")
            
            source_dist = dataset_stats.get("lead_source_distribution", {})
            if source_dist:
                summary_parts.append("Lead Source Distribution:")
                for source, count in list(source_dist.items())[:10]:  # Top 10
                    summary_parts.append(f"  {source}: {count:,}")
            
            active_pipeline = dataset_stats.get("active_pipeline", {})
            if active_pipeline.get("available", True) and "total_leads" in active_pipeline:
                summary_parts.append("Active Pipeline:")
                summary_parts.append(f"  Total Leads: {active_pipeline.get('total_leads', 0):,}")
                summary_parts.append(f"  Total Value: ${active_pipeline.get('total_value', 0):,.0f}")
                if "by_stage" in active_pipeline:
                    summary_parts.append("  By Stage:")
                    for stage, count in active_pipeline["by_stage"].items():
                        summary_parts.append(f"    {stage}: {count:,}")
        summary_parts.append("")
        
        # Forecast Summary
        other = metadata.get("other", {})
        summary_parts.append("=== FORECAST SUMMARY ===")
        forecast_summary = other.get("forecast_summary", {})
        if forecast_summary:
            summary_parts.append(f"Total Forecast: ${forecast_summary.get('total_forecast', 0):,.0f}")
            summary_parts.append(f"Average Monthly: ${forecast_summary.get('average_monthly', 0):,.0f}")
            summary_parts.append(f"Coefficient of Variation: {forecast_summary.get('coefficient_of_variation', 0):.2%}")
        
        ensemble_weights = other.get("ensemble_weights", {})
        if ensemble_weights:
            summary_parts.append("Ensemble Weights:")
            summary_parts.append(f"  Prophet: {ensemble_weights.get('prophet', 0):.1%}")
            summary_parts.append(f"  XGBoost: {ensemble_weights.get('xgboost', 0):.1%}")
            summary_parts.append(f"  Pipeline: {ensemble_weights.get('pipeline', 0):.1%}")
        
        summary_parts.append(f"Generated At: {other.get('generated_at', 'N/A')}")
        summary_parts.append("")
        
        return "\n".join(summary_parts)
    
    def prepare_forecast_data(self, forecast: list) -> str:
        """
        Prepare forecast data summary for the LLM prompt.
        
        Args:
            forecast: List of forecast dictionaries with date, forecast, lower, upper
            
        Returns:
            Formatted string summary of forecast data
        """
        if not forecast:
            return "No forecast data available."
        
        summary_parts = []
        summary_parts.append("=== 12-MONTH FORECAST DATA ===")
        
        # First 3 months
        summary_parts.append("First 3 Months:")
        for month in forecast[:3]:
            date = month.get("date", "N/A")
            fcst = month.get("forecast", 0)
            lower = month.get("lower", 0)
            upper = month.get("upper", 0)
            summary_parts.append(f"  {date}: ${fcst:,.0f} (${lower:,.0f} - ${upper:,.0f})")
        
        # Middle months summary
        if len(forecast) > 6:
            mid_start = len(forecast) // 3
            mid_end = 2 * len(forecast) // 3
            summary_parts.append(f"\nMiddle Period ({forecast[mid_start].get('date', 'N/A')} to {forecast[mid_end-1].get('date', 'N/A')}):")
            mid_forecasts = [m.get("forecast", 0) for m in forecast[mid_start:mid_end]]
            summary_parts.append(f"  Average: ${sum(mid_forecasts) / len(mid_forecasts):,.0f}")
        
        # Last 3 months
        summary_parts.append("\nLast 3 Months:")
        for month in forecast[-3:]:
            date = month.get("date", "N/A")
            fcst = month.get("forecast", 0)
            lower = month.get("lower", 0)
            upper = month.get("upper", 0)
            summary_parts.append(f"  {date}: ${fcst:,.0f} (${lower:,.0f} - ${upper:,.0f})")
        
        # Trend analysis
        first_quarter_avg = sum([m.get("forecast", 0) for m in forecast[:3]]) / 3
        last_quarter_avg = sum([m.get("forecast", 0) for m in forecast[-3:]]) / 3
        trend_pct = ((last_quarter_avg - first_quarter_avg) / first_quarter_avg * 100) if first_quarter_avg > 0 else 0
        summary_parts.append(f"\nTrend: First Quarter Avg: ${first_quarter_avg:,.0f}, Last Quarter Avg: ${last_quarter_avg:,.0f}")
        summary_parts.append(f"Change: {trend_pct:+.1f}%")
        
        return "\n".join(summary_parts)
    
    def generate_report(self, metadata: Dict[str, Any], forecast: list) -> Dict[str, Any]:
        """
        Generate a strategic analysis report from forecast metadata using Azure OpenAI.
        
        Args:
            metadata: The metadata dictionary from the forecast API response
            forecast: List of forecast dictionaries with date, forecast, lower, upper
            
        Returns:
            Dictionary containing the strategic analysis report in JSON format
        """
        # Prepare metadata and forecast summaries
        metadata_summary = self.prepare_metadata_summary(metadata)
        forecast_summary = self.prepare_forecast_data(forecast)
        
        # Construct the prompt
        system_prompt = """You are a strategic business analyst specializing in revenue forecasting and travel industry analytics. 
Your task is to analyze revenue forecast data and provide a comprehensive strategic analysis report in JSON format.

Analyze the provided forecast metadata and data to identify:
1. Key driving factors affecting revenue projections
2. Outliers and anomalies in the forecast
3. Operational recommendations based on the data

Be specific, data-driven, and actionable in your recommendations."""
        
        user_prompt = f"""Please analyze the following revenue forecast data and metadata, then provide a strategic analysis report in JSON format.

{metadata_summary}

{forecast_summary}

Provide your analysis as a JSON object with the following structure:
{{
    "executive_summary": {{
        "overview": "High-level summary of the forecast and key findings",
        "total_forecast": "Total forecasted revenue",
        "forecast_period": "Forecast period range",
        "key_insights": ["List of 3-5 key insights"]
    }},
    "driving_factors": {{
        "positive_factors": [
            {{
                "factor": "Description of positive factor",
                "impact": "Expected impact on revenue",
                "evidence": "Supporting data/metrics"
            }}
        ],
        "negative_factors": [
            {{
                "factor": "Description of negative factor",
                "impact": "Expected impact on revenue",
                "evidence": "Supporting data/metrics"
            }}
        ],
        "seasonal_patterns": "Description of seasonal patterns observed",
        "trend_analysis": "Analysis of revenue trends (increasing/decreasing/stable)"
    }},
    "outliers_and_anomalies": {{
        "forecast_outliers": [
            {{
                "period": "Month/date of outlier",
                "value": "Forecast value",
                "deviation": "How much it deviates from expected",
                "potential_causes": ["List of potential causes"]
            }}
        ],
        "data_quality_issues": ["Any data quality concerns"],
        "model_uncertainty": "Assessment of model confidence and uncertainty"
    }},
    "operational_recommendations": {{
        "immediate_actions": [
            {{
                "action": "Specific action to take",
                "priority": "High/Medium/Low",
                "rationale": "Why this action is recommended",
                "expected_impact": "Expected impact on revenue"
            }}
        ],
        "strategic_initiatives": [
            {{
                "initiative": "Strategic initiative description",
                "timeframe": "Short-term/Mid-term/Long-term",
                "rationale": "Why this initiative is important",
                "expected_impact": "Expected impact on revenue"
            }}
        ],
        "risk_mitigation": [
            {{
                "risk": "Identified risk",
                "mitigation": "How to mitigate the risk",
                "priority": "High/Medium/Low"
            }}
        ],
        "optimization_opportunities": [
            {{
                "opportunity": "Optimization opportunity",
                "description": "Details of the opportunity",
                "expected_benefit": "Expected benefit"
            }}
        ]
    }},
    "model_performance_assessment": {{
        "overall_confidence": "High/Medium/Low",
        "model_reliability": "Assessment of model reliability",
        "recommendations_for_improvement": ["Suggestions for improving model accuracy"]
    }},
    "generated_at": "ISO timestamp",
    "analyst_notes": "Additional observations or context"
}}

Ensure all monetary values are formatted as numbers (not strings), dates are in ISO format, and the JSON is valid and parseable."""
        
        try:
            # Call Azure OpenAI API
            response = self.client.chat.completions.create(
                model=self.deployment_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=4000,
                response_format={"type": "json_object"}  # Request JSON response
            )
            
            # Extract the JSON response
            report_json_str = response.choices[0].message.content
            
            # Parse JSON
            report = json.loads(report_json_str)
            
            # Add metadata about report generation
            report["report_metadata"] = {
                "generated_at": datetime.now().isoformat(),
                "model_used": self.deployment_name,
                "api_version": self.api_version,
                "forecast_parameters": metadata.get("forecast_parameters", {})
            }
            
            return report
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON response from LLM: {e}")
        except Exception as e:
            raise RuntimeError(f"Error generating report from Azure OpenAI: {e}")


def main():
    """Main function for command-line usage."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Generate strategic analysis report from forecast metadata"
    )
    parser.add_argument(
        "metadata_file",
        type=str,
        help="Path to JSON file containing forecast metadata (from API response)"
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default=None,
        help="Output file path for the report JSON (default: prints to stdout)"
    )
    parser.add_argument(
        "--forecast-file",
        type=str,
        default=None,
        help="Path to JSON file containing forecast data (if separate from metadata)"
    )
    
    args = parser.parse_args()
    
    # Load metadata
    try:
        with open(args.metadata_file, 'r') as f:
            data = json.load(f)
        
        # Handle both direct metadata dict and API response format
        if "metadata" in data:
            metadata = data["metadata"]
            forecast = data.get("forecast", [])
        else:
            metadata = data
            forecast = []
        
        # Load forecast from separate file if provided
        if args.forecast_file:
            with open(args.forecast_file, 'r') as f:
                forecast_data = json.load(f)
                if isinstance(forecast_data, list):
                    forecast = forecast_data
                elif "forecast" in forecast_data:
                    forecast = forecast_data["forecast"]
        
    except FileNotFoundError:
        print(f"Error: File not found: {args.metadata_file}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in file: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Generate report
    try:
        generator = ReportGenerator()
        report = generator.generate_report(metadata, forecast)
        
        # Output report
        report_json = json.dumps(report, indent=2)
        
        if args.output:
            with open(args.output, 'w') as f:
                f.write(report_json)
            print(f"Report generated successfully: {args.output}")
        else:
            print(report_json)
            
    except Exception as e:
        print(f"Error generating report: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

