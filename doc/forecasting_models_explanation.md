# JAUNTY Revenue Forecasting: How It Works

## Overview

JAUNTY predicts travel company revenue for the next 12 months using an ensemble of three different forecasting models. Each model looks at your historical booking data from a different angle, then combines their predictions to give you a more reliable forecast.

## The Three Models

### 1. Prophet (Time Series) - 40% Weight
**What it does**: Looks at monthly revenue patterns and trends over time.

**How it works**: Prophet is designed by Facebook for business forecasting. It's good at spotting seasonal patterns (like "summer is always busier") and long-term trends (like "revenue has been growing 15% per year").

**What makes it smart**:
- Detects if recent performance is different from historical trends
- Switches between growth modes automatically (linear vs capped growth)
- Prevents unrealistic projections by being conservative with trend changes
- Accounts for monthly seasonality in travel bookings

**Strengths**: Excellent at capturing seasonal patterns and stable trends
**Limitations**: Can struggle with sudden market changes or unusual events

### 2. XGBoost (Machine Learning) - 30% Weight
**What it does**: Predicts which active leads will likely convert into bookings.

**How it works**: XGBoost looks at your current sales pipeline (inquiries, quotes, bookings awaiting payment) and predicts the probability each lead will actually become revenue. It learns from patterns in your historical data about which types of leads tend to close.

**What it analyzes**:
- Trip destination and duration
- Lead source (where the inquiry came from)
- Time of year
- Customer type (new vs repeat)
- Current stage in sales process
- Peak vs off-season timing

**Strengths**: Good at understanding lead conversion patterns
**Limitations**: Only as good as the pipeline data quality

### 3. Pipeline (Rule-Based) - 30% Weight
**What it does**: Simple probability calculations based on sales stages.

**How it works**: Uses fixed conversion rates for each stage of your sales process:
- Inquiry: 15% chance of becoming revenue
- Quote Sent: 35% chance
- Booked (awaiting payment): 90% chance
- Final Payment: 98% chance

**Strengths**: Always available, easy to understand, provides baseline expectations
**Limitations**: Doesn't adapt to changing conversion patterns

## How The Ensemble Works

The system combines all three forecasts using weighted averages:
- Prophet: 40% (highest weight for seasonal trends)
- XGBoost: 30% (machine learning insights)
- Pipeline: 30% (conservative baseline)

**Example**: If Prophet predicts $100k, XGBoost predicts $80k, and Pipeline predicts $90k for next month, the ensemble forecast would be:
`(100k × 0.4) + (80k × 0.3) + (90k × 0.3) = $91k`

## Safety Features

The system includes several safeguards to prevent unrealistic forecasts:

1. **Incomplete Month Detection**: Automatically excludes partial months at the end of your data that might skew results
2. **Growth Caps**: Prevents forecasts from exceeding reasonable bounds (1.5x historical maximum)
3. **Trend Damping**: If trends become too aggressive, applies decay factors
4. **Smooth Transitions**: Prevents sudden jumps between historical data and forecast
5. **Realistic Variation**: Adds month-to-month fluctuations based on your historical patterns

## What You Need

**Minimum Requirements**:
- At least 1 year of completed trip data
- Data must include: inquiry dates, trip dates, prices, booking stages
- Active pipeline with current leads

**Data Quality Matters**:
- More historical data = better seasonal pattern detection
- Clean pipeline data = better conversion predictions
- Consistent data format = more accurate results

## Confidence Intervals

Each forecast includes upper and lower bounds (80% confidence intervals) showing the range of likely outcomes. For example:
- **Forecast**: $85,000
- **Lower Bound**: $70,000 (20% chance revenue will be below this)
- **Upper Bound**: $100,000 (20% chance revenue will be above this)

## When It Works Best

The ensemble approach is most reliable when:
- You have consistent historical patterns
- Your sales process stages are well-defined
- Market conditions remain relatively stable
- Pipeline data is kept current

The system is designed to be conservative rather than overly optimistic, helping you make realistic business planning decisions.

## Technical Notes

The models are retrained each time you upload new data, allowing them to adapt to recent changes in your business patterns. Model artifacts are saved locally (`model/artifacts/`) so forecasts can be generated quickly without retraining.

For details about the recent flash-back-to-loading bug fix, see `fixes_documentation.md` in this directory.