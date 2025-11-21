/**
 * Mock Data Service for Frontend Development
 * 
 * This service provides realistic mock data for testing the frontend
 * without needing backend API or Gemini AI integration.
 * 
 * Usage:
 * - Set USE_MOCK_DATA=true in .env.local to enable mock mode
 * - Or import mockAnalyzeTravelData directly in App.tsx for testing
 */

import { ForecastResponse, FunnelData } from '../types';

/**
 * Simple seeded random number generator for deterministic mock data
 * Uses Linear Congruential Generator (LCG) algorithm
 */
class SeededRandom {
  private seed: number;
  
  constructor(seed: number | null = null) {
    // If no seed provided, use current time for variation
    this.seed = seed !== null ? seed : Date.now() % Math.pow(2, 32);
  }
  
  next(): number {
    // LCG parameters (same as used in many programming languages)
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return this.seed / Math.pow(2, 32);
  }
  
  reset(seed: number | null = null): void {
    this.seed = seed !== null ? seed : Date.now() % Math.pow(2, 32);
  }
}

// Global seeded random instance for mock data generation
// Using null seed means each call will generate different data (good for robustness testing)
const seededRandom = new SeededRandom(null);

/**
 * Generate realistic historical revenue data (24 months)
 * Includes the current month, ending exactly where forecast begins
 */
function generateHistoricalData(): Array<{ date: string; revenue: number; bookings?: number; type: 'historical' }> {
  seededRandom.reset(null); // Reset with new seed for variation (use number for reproducibility)
  const historical: Array<{ date: string; revenue: number; bookings?: number; type: 'historical' }> = [];
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
  const startDate = new Date(currentMonth);
  startDate.setMonth(startDate.getMonth() - 23); // Start 23 months before current month (so we get 24 months total including current)
  
  // Base monthly revenue with seasonality
  const baseRevenue = 45000;
  const seasonalFactors = [
    0.85, 0.75, 0.90, 1.10, 1.25, 1.40, // Jan-Jun (winter/spring peak)
    1.35, 1.30, 1.15, 1.05, 0.95, 0.90, // Jul-Dec (summer/fall)
    0.88, 0.80, 0.95, 1.15, 1.30, 1.45, // Year 2
    1.40, 1.32, 1.18, 1.08, 0.98, 0.92  // Year 2 continued
  ];
  
  // Add growth trend
  const growthRate = 0.02; // 2% monthly growth
  
  for (let i = 0; i < 24; i++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i);
    
    // Calculate revenue with seasonality and growth
    const seasonalFactor = seasonalFactors[i] || 1.0;
    const growthFactor = Math.pow(1 + growthRate, i);
    const randomVariation = 0.9 + seededRandom.next() * 0.2; // ±10% random variation (deterministic)
    
    const revenue = Math.round(baseRevenue * seasonalFactor * growthFactor * randomVariation);
    const bookings = Math.round(revenue / 350); // ~$350 per booking average
    
    historical.push({
      date: date.toISOString().split('T')[0],
      revenue,
      bookings,
      type: 'historical'
    });
  }
  
  return historical;
}

/**
 * Generate realistic 12-month forecast data
 * Starts from the month immediately after historical data ends (ensures no gap)
 */
function generateForecastData(): Array<{ date: string; revenue: number; bookings?: number; type: 'forecast' }> {
  const forecast: Array<{ date: string; revenue: number; bookings?: number; type: 'forecast' }> = [];
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1); // First day of next month
  
  // Forecast with continued growth and seasonality
  const baseRevenue = 52000; // Slightly higher than recent historical average
  const seasonalFactors = [
    0.90, 0.85, 1.00, 1.20, 1.35, 1.50, // Next 6 months
    1.45, 1.38, 1.25, 1.15, 1.05, 1.00  // Following 6 months
  ];
  
  const growthRate = 0.015; // 1.5% monthly growth (conservative)
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i);
    
    const seasonalFactor = seasonalFactors[i] || 1.0;
    const growthFactor = Math.pow(1 + growthRate, i);
    const revenue = Math.round(baseRevenue * seasonalFactor * growthFactor);
    const bookings = Math.round(revenue / 350);
    
    forecast.push({
      date: date.toISOString().split('T')[0],
      revenue,
      bookings,
      type: 'forecast'
    });
  }
  
  return forecast;
}

/**
 * Generate realistic insights based on the data
 */
function generateInsights(): string[] {
  return [
    "Revenue shows strong seasonal patterns with peak performance during summer months (June-August), indicating high demand for vacation travel.",
    "Year-over-year growth trend of approximately 24% suggests healthy market expansion and effective customer acquisition strategies.",
    "Average booking value of $350 indicates a strong mix of mid-to-high-end travel packages, contributing to revenue stability.",
    "Historical data shows consistent month-to-month performance with minimal volatility, suggesting reliable revenue streams.",
    "Forecast projects continued growth trajectory with seasonal peaks aligning with traditional travel booking patterns."
  ];
}

/**
 * Generate key drivers based on typical travel industry factors
 */
function generateKeyDrivers(): string[] {
  return [
    "Seasonal Demand Patterns - Summer and holiday periods drive 30-40% revenue increases",
    "Customer Acquisition Channels - Strong performance from social media and referral programs",
    "Destination Popularity - European and Latin American destinations show highest booking volumes",
    "Repeat Customer Rate - 35% repeat booking rate indicates strong customer satisfaction",
    "Market Growth - Overall travel market expansion contributing to revenue growth"
  ];
}

/**
 * Generate suggested parameters for scenario simulation
 */
function generateSuggestedParameters() {
  return [
    {
      name: "Growth Rate",
      key: "Growth Rate",
      min: -20,
      max: 50,
      default: 0,
      description: "Expected annual growth rate (%)"
    },
    {
      name: "Market Growth",
      key: "Market Growth",
      min: -10,
      max: 30,
      default: 0,
      description: "Overall market growth impact (%)"
    },
    {
      name: "Marketing Spend",
      key: "Marketing Spend",
      min: -5,
      max: 25,
      default: 0,
      description: "Impact of marketing investment (%)"
    },
    {
      name: "Seasonality",
      key: "Seasonality",
      min: -15,
      max: 15,
      default: 0,
      description: "Seasonal variation adjustment (%)"
    },
    {
      name: "Customer Retention",
      key: "Customer Retention",
      min: -10,
      max: 20,
      default: 0,
      description: "Impact of customer retention improvements (%)"
    }
  ];
}

/**
 * Generate realistic funnel data based on typical conversion rates
 */
function generateFunnelData(): FunnelData[] {
  // Typical conversion rates for travel industry
  const baseInquiries = 1000;
  const quoteRate = 0.65;      // 65% get quotes
  const bookingRate = 0.40;    // 40% of quotes convert to bookings
  const paymentRate = 0.85;    // 85% of bookings complete payment
  const completionRate = 0.95;  // 95% of paid trips complete

  const inquiries = baseInquiries;
  const quotes = Math.round(inquiries * quoteRate);
  const bookings = Math.round(quotes * bookingRate);
  const finalPayments = Math.round(bookings * paymentRate);
  const completed = Math.round(finalPayments * completionRate);

  // Average trip prices by stage (increases as leads progress)
  const avgPriceInquiry = 4500;
  const avgPriceQuote = 4800;
  const avgPriceBooking = 5200;
  const avgPricePayment = 5200;
  const avgPriceCompleted = 5200;

  const funnel: FunnelData[] = [
    {
      stage: 'inquiry',
      count: inquiries,
      conversionRate: quoteRate * 100,
      dropOffRate: (1 - quoteRate) * 100,
      revenuePotential: inquiries * avgPriceInquiry,
      avgDaysInStage: 2.5,
      color: '#0ea5e9' // Sky blue
    },
    {
      stage: 'quote_sent',
      count: quotes,
      conversionRate: bookingRate * 100,
      dropOffRate: (1 - bookingRate) * 100,
      revenuePotential: quotes * avgPriceQuote,
      avgDaysInStage: 5.2,
      color: '#3b82f6' // Blue
    },
    {
      stage: 'booked',
      count: bookings,
      conversionRate: paymentRate * 100,
      dropOffRate: (1 - paymentRate) * 100,
      revenuePotential: bookings * avgPriceBooking,
      avgDaysInStage: 14.3,
      color: '#8b5cf6' // Purple
    },
    {
      stage: 'final_payment',
      count: finalPayments,
      conversionRate: completionRate * 100,
      dropOffRate: (1 - completionRate) * 100,
      revenuePotential: finalPayments * avgPricePayment,
      avgDaysInStage: 21.5,
      color: '#10b981' // Green
    },
    {
      stage: 'completed',
      count: completed,
      revenuePotential: completed * avgPriceCompleted,
      avgDaysInStage: 0, // Completed, no time in stage
      color: '#059669' // Dark green
    }
  ];

  return funnel;
}

/**
 * Mock function that simulates analyzing travel data
 * Returns realistic ForecastResponse data for frontend testing
 * 
 * @param csvContent - CSV content (ignored in mock mode, but kept for API compatibility)
 * @param delay - Optional delay in milliseconds to simulate API call (default: 1500ms)
 */
export const mockAnalyzeTravelData = async (
  csvContent: string,
  delay: number = 1500
): Promise<ForecastResponse> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, delay));
  
  return {
    historical: generateHistoricalData(),
    forecast: generateForecastData(),
    insights: generateInsights(),
    keyDrivers: generateKeyDrivers(),
    suggestedParameters: generateSuggestedParameters(),
    funnel: generateFunnelData()
  };
};

/**
 * Alternative mock data with different scenarios
 */
export const mockDataScenarios = {
  /**
   * High growth scenario
   */
  highGrowth: (): ForecastResponse => ({
    historical: generateHistoricalData().map(d => ({
      ...d,
      revenue: Math.round(d.revenue * 1.2)
    })),
    forecast: generateForecastData().map(d => ({
      ...d,
      revenue: Math.round(d.revenue * 1.3)
    })),
    insights: [
      "Exceptional growth trajectory with 40% YoY increase",
      "Strong market position driving above-average performance",
      "Premium customer segment showing significant expansion"
    ],
    keyDrivers: [
      "Aggressive marketing campaigns driving 50% lead increase",
      "Premium destination packages gaining traction",
      "Strategic partnerships expanding market reach"
    ],
    suggestedParameters: generateSuggestedParameters(),
    funnel: generateFunnelData().map(f => ({
      ...f,
      count: Math.round(f.count * 1.2), // 20% more leads
      revenuePotential: Math.round(f.revenuePotential * 1.2)
    }))
  }),
  
  /**
   * Stable/declining scenario
   */
  stable: (): ForecastResponse => ({
    historical: generateHistoricalData().map(d => ({
      ...d,
      revenue: Math.round(d.revenue * 0.9)
    })),
    forecast: generateForecastData().map(d => ({
      ...d,
      revenue: Math.round(d.revenue * 0.95)
    })),
    insights: [
      "Revenue showing stable but flat growth patterns",
      "Market saturation in key segments requiring diversification",
      "Focus needed on retention and premium offerings"
    ],
    keyDrivers: [
      "Market maturity in primary destinations",
      "Increased competition affecting pricing power",
      "Need for product innovation and differentiation"
    ],
    suggestedParameters: generateSuggestedParameters(),
    funnel: generateFunnelData()
  }),
  
  /**
   * Volatile scenario with high variance
   */
  volatile: (): ForecastResponse => {
    const historical = generateHistoricalData().map((d, i) => ({
      ...d,
      revenue: Math.round(d.revenue * (0.7 + seededRandom.next() * 0.6)) // ±30% variance (deterministic)
    }));
    
    const forecast = generateForecastData().map((d, i) => ({
      ...d,
      revenue: Math.round(d.revenue * (0.75 + seededRandom.next() * 0.5)) // ±25% variance (deterministic)
    }));
    
    return {
      historical,
      forecast,
      insights: [
        "High revenue volatility indicates market sensitivity to external factors",
        "Seasonal patterns less predictable, requiring adaptive strategies",
        "Focus on diversification to reduce risk exposure"
      ],
      keyDrivers: [
        "Economic factors creating demand fluctuations",
        "Weather and external events impacting travel decisions",
        "Competitive pricing dynamics affecting market share"
      ],
      suggestedParameters: generateSuggestedParameters(),
      funnel: generateFunnelData()
    };
  }
};

