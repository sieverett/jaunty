import Anthropic from '@anthropic-ai/sdk';
import { ForecastResponse } from '../types';

// Initialize Anthropic Client
const client = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY });

const forecastSchemaDescription = `Return a JSON object with this exact structure:
{
  "historical": [{ "date": "YYYY-MM", "revenue": number, "bookings": number, "type": "historical" }],
  "forecast": [{ "date": "YYYY-MM", "revenue": number, "bookings": number, "type": "forecast" }],
  "insights": ["string"],
  "keyDrivers": ["string"],
  "suggestedParameters": [{ "name": "string", "key": "string", "min": number, "max": number, "default": number, "description": "string" }]
}

Required fields: historical, forecast, insights, suggestedParameters.`;

export const analyzeTravelData = async (csvContent: string): Promise<ForecastResponse> => {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `You are a world-class Chief Financial Officer and Data Scientist specializing in the Travel & Tourism industry.
        Your goal is to analyze raw CSV data of historical revenue/bookings and generate a robust 12-month revenue forecast.

        The forecast should account for:
        1. Seasonality (typical for travel).
        2. Trend lines (growth/decline).
        3. Anomalies (smooth them out).

        You must also provide 'suggestedParameters' for a simulation dashboard. These are multipliers or percentages the user can tweak.
        Examples: 'Market Growth %' (0-20), 'Ad Spend Impact' (0.8-1.5), 'Seasonal Variation' (0.5-1.5).

        ${forecastSchemaDescription}

        The output must be strict JSON. Do not include any text outside the JSON object.`,
      messages: [
        {
          role: "user",
          content: `Analyze the following CSV data and produce a forecast.

              CSV Data:
              ${csvContent}
              `
        }
      ]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : null;
    if (!text) {
      throw new Error("No response from Anthropic Claude");
    }

    return JSON.parse(text) as ForecastResponse;
  } catch (error) {
    console.error("Anthropic Analysis Failed:", error);
    throw error;
  }
};
