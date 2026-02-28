"""
Report Generator for Revenue Forecasting Pipeline

This script takes metadata from the forecasting pipeline and generates
a strategic analysis report using Anthropic Claude.
"""

import os
import json
import sys
from typing import Dict, Any, Optional
from datetime import datetime
from dotenv import load_dotenv
from anthropic import Anthropic

# Load environment variables from .env file
load_dotenv()


class ReportGenerator:
    """Generates strategic analysis reports from forecast metadata using Anthropic Claude."""

    def __init__(self):
        """Initialize the report generator with Anthropic client."""
        # Anthropic configuration from environment variables
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.model_name = "claude-sonnet-4-20250514"

        if not self.api_key:
            raise ValueError(
                "Missing required Anthropic environment variable. "
                "Please set ANTHROPIC_API_KEY in .env file"
            )

        # Initialize Anthropic client
        self.client = Anthropic(api_key=self.api_key)
    
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
        Prepare forecast data summary for the LLM prompt with comprehensive analysis.

        Args:
            forecast: List of forecast dictionaries with date, forecast, lower, upper

        Returns:
            Formatted string summary of forecast data
        """
        if not forecast:
            return "No forecast data available."

        summary_parts = []
        summary_parts.append("=== COMPLETE 12-MONTH FORECAST DATA ===")

        # Calculate average and total
        forecasts = [m.get("forecast", 0) for m in forecast]
        total_forecast = sum(forecasts)
        avg_forecast = total_forecast / len(forecasts) if forecasts else 0

        # Identify peak and trough months
        max_month = max(forecast, key=lambda x: x.get("forecast", 0))
        min_month = min(forecast, key=lambda x: x.get("forecast", 0))

        summary_parts.append(f"Total Forecast: ${total_forecast:,.0f}")
        summary_parts.append(f"Average Monthly: ${avg_forecast:,.0f}")
        summary_parts.append(f"Peak Month: {max_month.get('date', 'N/A')} - ${max_month.get('forecast', 0):,.0f}")
        summary_parts.append(f"Trough Month: {min_month.get('date', 'N/A')} - ${min_month.get('forecast', 0):,.0f}")
        summary_parts.append("")

        # All 12 months with month-over-month changes
        summary_parts.append("MONTH-BY-MONTH BREAKDOWN:")
        for i, month in enumerate(forecast):
            date = month.get("date", "N/A")
            fcst = month.get("forecast", 0)
            lower = month.get("lower", 0)
            upper = month.get("upper", 0)

            # Calculate month-over-month change
            if i > 0:
                prev_fcst = forecast[i-1].get("forecast", 0)
                mom_change = ((fcst - prev_fcst) / prev_fcst * 100) if prev_fcst > 0 else 0
                mom_str = f" (MoM: {mom_change:+.1f}%)"
            else:
                mom_str = " (Baseline)"

            # Mark above/below average
            vs_avg = "ABOVE AVG" if fcst > avg_forecast else "BELOW AVG" if fcst < avg_forecast else "AT AVG"
            deviation_pct = ((fcst - avg_forecast) / avg_forecast * 100) if avg_forecast > 0 else 0

            summary_parts.append(
                f"  {date}: ${fcst:,.0f} [{vs_avg} {deviation_pct:+.1f}%]{mom_str}"
            )
            summary_parts.append(f"    Confidence Range: ${lower:,.0f} - ${upper:,.0f}")

        summary_parts.append("")

        # Quarterly breakdown
        summary_parts.append("QUARTERLY ANALYSIS:")
        quarters = [
            ("Q1", forecast[0:3]),
            ("Q2", forecast[3:6]),
            ("Q3", forecast[6:9]),
            ("Q4", forecast[9:12])
        ]

        for q_name, q_data in quarters:
            if q_data:
                q_total = sum([m.get("forecast", 0) for m in q_data])
                q_avg = q_total / len(q_data)
                summary_parts.append(f"  {q_name}: ${q_total:,.0f} total, ${q_avg:,.0f} avg")

        # Quarter-over-quarter growth
        q1_avg = sum([m.get("forecast", 0) for m in forecast[0:3]]) / 3 if len(forecast) >= 3 else 0
        q2_avg = sum([m.get("forecast", 0) for m in forecast[3:6]]) / 3 if len(forecast) >= 6 else 0
        q3_avg = sum([m.get("forecast", 0) for m in forecast[6:9]]) / 3 if len(forecast) >= 9 else 0
        q4_avg = sum([m.get("forecast", 0) for m in forecast[9:12]]) / 3 if len(forecast) >= 12 else 0

        if q1_avg > 0 and q4_avg > 0:
            yoy_growth = ((q4_avg - q1_avg) / q1_avg * 100)
            summary_parts.append(f"\nQ1 to Q4 Growth: {yoy_growth:+.1f}%")

        summary_parts.append("")

        # Trend analysis
        first_quarter_avg = sum([m.get("forecast", 0) for m in forecast[:3]]) / 3 if len(forecast) >= 3 else 0
        last_quarter_avg = sum([m.get("forecast", 0) for m in forecast[-3:]]) / 3 if len(forecast) >= 3 else 0
        trend_pct = ((last_quarter_avg - first_quarter_avg) / first_quarter_avg * 100) if first_quarter_avg > 0 else 0

        trend_direction = "INCREASING" if trend_pct > 5 else "DECREASING" if trend_pct < -5 else "STABLE"
        summary_parts.append(f"OVERALL TREND: {trend_direction}")
        summary_parts.append(f"First Quarter Avg: ${first_quarter_avg:,.0f}")
        summary_parts.append(f"Last Quarter Avg: ${last_quarter_avg:,.0f}")
        summary_parts.append(f"Change: {trend_pct:+.1f}%")

        # Volatility analysis
        import statistics
        if len(forecasts) > 1:
            std_dev = statistics.stdev(forecasts)
            cv = (std_dev / avg_forecast * 100) if avg_forecast > 0 else 0
            summary_parts.append(f"\nVolatility (Coefficient of Variation): {cv:.1f}%")
            volatility_level = "HIGH" if cv > 20 else "MODERATE" if cv > 10 else "LOW"
            summary_parts.append(f"Volatility Level: {volatility_level}")

        return "\n".join(summary_parts)

    def _validate_report_completeness(self, report: Dict[str, Any]) -> list:
        """
        Validate that the generated report has complete information in all sections.

        Args:
            report: The generated report dictionary

        Returns:
            List of validation warning messages (empty if valid)
        """
        warnings = []

        # Validate driving factors
        driving_factors = report.get("driving_factors", {})
        positive_factors = driving_factors.get("positive_factors", [])
        negative_factors = driving_factors.get("negative_factors", [])

        if len(positive_factors) < 3:
            warnings.append(f"Insufficient positive factors: {len(positive_factors)} (minimum 3 required)")

        for i, factor in enumerate(positive_factors):
            if not factor.get("factor") or len(factor.get("factor", "")) < 10:
                warnings.append(f"Positive factor {i+1} has incomplete 'factor' description")
            if not factor.get("impact") or len(factor.get("impact", "")) < 10:
                warnings.append(f"Positive factor {i+1} has incomplete 'impact' description")
            if not factor.get("evidence") or len(factor.get("evidence", "")) < 10:
                warnings.append(f"Positive factor {i+1} has incomplete 'evidence' description")

        if len(negative_factors) < 2:
            warnings.append(f"Insufficient negative factors: {len(negative_factors)} (minimum 2 required)")

        for i, factor in enumerate(negative_factors):
            if not factor.get("factor") or len(factor.get("factor", "")) < 10:
                warnings.append(f"Negative factor {i+1} has incomplete 'factor' description")
            if not factor.get("impact") or len(factor.get("impact", "")) < 10:
                warnings.append(f"Negative factor {i+1} has incomplete 'impact' description")
            if not factor.get("evidence") or len(factor.get("evidence", "")) < 10:
                warnings.append(f"Negative factor {i+1} has incomplete 'evidence' description")

        # Validate operational recommendations
        ops_recs = report.get("operational_recommendations", {})
        immediate_actions = ops_recs.get("immediate_actions", [])
        strategic_initiatives = ops_recs.get("strategic_initiatives", [])
        risk_mitigation = ops_recs.get("risk_mitigation", [])
        optimization_opps = ops_recs.get("optimization_opportunities", [])

        if len(immediate_actions) < 3:
            warnings.append(f"Insufficient immediate actions: {len(immediate_actions)} (minimum 3 required)")

        for i, action in enumerate(immediate_actions):
            if not action.get("action") or len(action.get("action", "")) < 20:
                warnings.append(f"Immediate action {i+1} has incomplete 'action' description (too short or empty)")
            if not action.get("rationale") or len(action.get("rationale", "")) < 20:
                warnings.append(f"Immediate action {i+1} has incomplete 'rationale'")
            if not action.get("expected_impact") or len(action.get("expected_impact", "")) < 10:
                warnings.append(f"Immediate action {i+1} has incomplete 'expected_impact'")

        if len(strategic_initiatives) < 2:
            warnings.append(f"Insufficient strategic initiatives: {len(strategic_initiatives)} (minimum 2 required)")

        for i, initiative in enumerate(strategic_initiatives):
            if not initiative.get("initiative") or len(initiative.get("initiative", "")) < 20:
                warnings.append(f"Strategic initiative {i+1} has incomplete 'initiative' description (too short or empty)")
            if not initiative.get("rationale") or len(initiative.get("rationale", "")) < 20:
                warnings.append(f"Strategic initiative {i+1} has incomplete 'rationale'")
            if not initiative.get("expected_impact") or len(initiative.get("expected_impact", "")) < 10:
                warnings.append(f"Strategic initiative {i+1} has incomplete 'expected_impact'")

        if len(risk_mitigation) < 2:
            warnings.append(f"Insufficient risk mitigations: {len(risk_mitigation)} (minimum 2 required)")

        for i, risk in enumerate(risk_mitigation):
            if not risk.get("risk") or len(risk.get("risk", "")) < 20:
                warnings.append(f"Risk mitigation {i+1} has incomplete 'risk' description (too short or empty)")
            if not risk.get("mitigation") or len(risk.get("mitigation", "")) < 20:
                warnings.append(f"Risk mitigation {i+1} has incomplete 'mitigation' description (too short or empty)")

        if len(optimization_opps) < 2:
            warnings.append(f"Insufficient optimization opportunities: {len(optimization_opps)} (minimum 2 required)")

        for i, opp in enumerate(optimization_opps):
            if not opp.get("opportunity") or len(opp.get("opportunity", "")) < 20:
                warnings.append(f"Optimization opportunity {i+1} has incomplete 'opportunity' description (too short or empty)")
            if not opp.get("description") or len(opp.get("description", "")) < 20:
                warnings.append(f"Optimization opportunity {i+1} has incomplete 'description'")

        # Validate key insights
        exec_summary = report.get("executive_summary", {})
        key_insights = exec_summary.get("key_insights", [])
        if len(key_insights) < 3:
            warnings.append(f"Insufficient key insights: {len(key_insights)} (minimum 3 required)")

        return warnings

    def generate_report(self, metadata: Dict[str, Any], forecast: list) -> Dict[str, Any]:
        """
        Generate a strategic analysis report from forecast metadata using Anthropic Claude.
        
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

CRITICAL REQUIREMENTS:
1. EVERY field in the JSON structure must be filled with meaningful, specific content
2. NO empty strings, NO placeholder text, NO generic boilerplate
3. Each recommendation must include a COMPLETE description of the action/initiative/risk
4. Use specific numbers, dates, and metrics from the provided data
5. Provide detailed analysis grounded in the actual data provided

MINIMUM REQUIRED COUNTS:
- At least 3 positive factors with complete factor/impact/evidence fields
- At least 2 negative/risk factors with complete factor/impact/evidence fields
- At least 3 immediate actions with complete action/priority/rationale/expected_impact
- At least 2 strategic initiatives with complete initiative/timeframe/rationale/expected_impact
- At least 2 risk mitigations with complete risk/mitigation/priority fields
- At least 2 optimization opportunities with complete opportunity/description/expected_benefit

Analyze the provided forecast metadata and data to identify:
1. Key driving factors affecting revenue projections (be specific about what in the data supports each factor)
2. Outliers and anomalies in the forecast (reference actual months and values)
3. Operational recommendations based on the data (tie recommendations to specific metrics)

Be specific, data-driven, and actionable in your recommendations. Reference actual values, dates, and trends from the data provided."""
        
        # Extract historical data summary
        dataset_stats = metadata.get("dataset_stats", {})
        revenue_stats = dataset_stats.get("revenue_stats", {})
        monthly_stats = dataset_stats.get("monthly_revenue_stats", {})

        historical_summary = "=== HISTORICAL PERFORMANCE SUMMARY ===\n"
        if revenue_stats:
            total_historical = revenue_stats.get("total_revenue", 0)
            avg_trip = revenue_stats.get("average_trip_value", 0)
            historical_summary += f"Total Historical Revenue: ${total_historical:,.0f}\n"
            historical_summary += f"Average Trip Value: ${avg_trip:,.0f}\n"

        if monthly_stats:
            avg_monthly_hist = monthly_stats.get("average_monthly", 0)
            total_months = monthly_stats.get("total_months", 0)
            historical_summary += f"Historical Average Monthly Revenue: ${avg_monthly_hist:,.0f}\n"
            historical_summary += f"Historical Period: {total_months} months\n"
            historical_summary += f"First Month: {monthly_stats.get('first_month', 'N/A')}\n"
            historical_summary += f"Last Month: {monthly_stats.get('last_month', 'N/A')}\n"

        # Calculate forecast vs historical comparison
        forecast_vals = [m.get("forecast", 0) for m in forecast]
        avg_forecast_monthly = sum(forecast_vals) / len(forecast_vals) if forecast_vals else 0
        if monthly_stats and avg_forecast_monthly > 0:
            avg_monthly_hist = monthly_stats.get("average_monthly", 0)
            if avg_monthly_hist > 0:
                growth_vs_hist = ((avg_forecast_monthly - avg_monthly_hist) / avg_monthly_hist * 100)
                historical_summary += f"\nForecast vs Historical Comparison:\n"
                historical_summary += f"  Historical Monthly Avg: ${avg_monthly_hist:,.0f}\n"
                historical_summary += f"  Forecast Monthly Avg: ${avg_forecast_monthly:,.0f}\n"
                historical_summary += f"  Growth/Decline: {growth_vs_hist:+.1f}%\n"

        user_prompt = f"""Please analyze the following revenue forecast data and metadata, then provide a strategic analysis report in JSON format.

{historical_summary}

{metadata_summary}

{forecast_summary}

REQUIRED ANALYSIS COMPONENTS:
1. Compare forecast performance to historical averages and trends
2. Identify all months that significantly deviate from average (above or below)
3. Explain the quarter-over-quarter growth pattern
4. Reference specific numerical targets and percentage changes
5. Include a month-by-month forecast table in your response where appropriate
6. Analyze volatility levels and their business implications

Provide your analysis as a JSON object with the following structure:
{{
    "executive_summary": {{
        "overview": "High-level summary of the forecast and key findings (2-3 complete sentences referencing specific metrics)",
        "total_forecast": "Total forecasted revenue (numeric value)",
        "forecast_period": "Forecast period range (start to end dates)",
        "key_insights": ["List of 3-5 key insights - each must reference specific data points, months, or metrics"]
    }},
    "driving_factors": {{
        "positive_factors": [
            {{
                "factor": "Complete description of positive factor (not just a title)",
                "impact": "Specific expected impact on revenue with quantification",
                "evidence": "Supporting data/metrics from the provided data with actual values"
            }}
            // MINIMUM 3 items required with complete fields
        ],
        "negative_factors": [
            {{
                "factor": "Complete description of negative/risk factor (not just a title)",
                "impact": "Specific expected impact on revenue with quantification",
                "evidence": "Supporting data/metrics from the provided data with actual values"
            }}
            // MINIMUM 2 items required with complete fields
        ],
        "seasonal_patterns": "Detailed description of seasonal patterns observed - reference specific months and percentage variations",
        "trend_analysis": "Comprehensive analysis of revenue trends - include growth rates, direction, and comparison to historical"
    }},
    "outliers_and_anomalies": {{
        "forecast_outliers": [
            {{
                "period": "Specific month/date of outlier",
                "value": "Forecast value (numeric)",
                "deviation": "How much it deviates from expected (percentage and absolute)",
                "potential_causes": ["List of specific potential causes based on the data and business context"]
            }}
            // Include all significant outliers identified in the month-by-month data
        ],
        "data_quality_issues": ["List any data quality concerns or gaps observed in the dataset"],
        "model_uncertainty": "Detailed assessment of model confidence and uncertainty - reference confidence intervals and volatility metrics"
    }},
    "operational_recommendations": {{
        "immediate_actions": [
            {{
                "action": "Complete description of specific action to take (full sentence, not a title)",
                "priority": "High/Medium/Low",
                "rationale": "Detailed explanation of why this action is recommended based on the data",
                "expected_impact": "Specific expected impact on revenue or operations with quantification where possible"
            }}
            // MINIMUM 3 items required with complete action descriptions
        ],
        "strategic_initiatives": [
            {{
                "initiative": "Complete description of strategic initiative (full explanation, not just a title)",
                "timeframe": "Short-term/Mid-term/Long-term",
                "rationale": "Detailed explanation of why this initiative is important based on trends in the data",
                "expected_impact": "Specific expected impact on revenue with quantification where possible"
            }}
            // MINIMUM 2 items required with complete initiative descriptions
        ],
        "risk_mitigation": [
            {{
                "risk": "Complete description of the identified risk (full explanation of what could go wrong)",
                "mitigation": "Detailed explanation of how to mitigate the risk (specific actions, not generic)",
                "priority": "High/Medium/Low"
            }}
            // MINIMUM 2 items required with complete risk and mitigation descriptions
        ],
        "optimization_opportunities": [
            {{
                "opportunity": "Complete description of optimization opportunity (full explanation, not a title)",
                "description": "Detailed explanation of the opportunity and how to capture it",
                "expected_benefit": "Specific expected benefit with quantification where possible"
            }}
            // MINIMUM 2 items required with complete descriptions
        ]
    }},
    "model_performance_assessment": {{
        "overall_confidence": "High/Medium/Low with specific reasoning based on metrics",
        "model_reliability": "Detailed assessment of model reliability referencing MAPE, MAE, RMSE values",
        "recommendations_for_improvement": ["Specific suggestions for improving model accuracy based on observed patterns"]
    }},
    "generated_at": "ISO timestamp",
    "analyst_notes": "Additional observations or context that provide deeper insight into the forecast"
}}

Ensure all monetary values are formatted as numbers (not strings), dates are in ISO format, and the JSON is valid and parseable."""
        
        try:
            # Call Anthropic Claude API with increased token limit
            response = self.client.messages.create(
                model=self.model_name,
                max_tokens=8000,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ],
            )

            # Extract the JSON response
            report_json_str = response.content[0].text

            # Parse JSON
            report = json.loads(report_json_str)

            # Validate report completeness
            validation_warnings = self._validate_report_completeness(report)
            if validation_warnings:
                print("WARNING: Report validation issues detected:")
                for warning in validation_warnings:
                    print(f"  - {warning}")

            # Add metadata about report generation
            report["report_metadata"] = {
                "generated_at": datetime.now().isoformat(),
                "model_used": self.model_name,
                "forecast_parameters": metadata.get("forecast_parameters", {}),
                "validation_warnings": validation_warnings if validation_warnings else []
            }

            return report
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON response from LLM: {e}")
        except Exception as e:
            raise RuntimeError(f"Error generating report from Anthropic Claude: {e}")


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

