import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ForecastResponse } from '../types';

// Initialize Gemini Client
// process.env.API_KEY is guaranteed to be available by the runtime environment instructions
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const forecastSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    historical: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "YYYY-MM format" },
          revenue: { type: Type.NUMBER },
          bookings: { type: Type.NUMBER },
          type: { type: Type.STRING, enum: ["historical"] }
        },
        required: ["date", "revenue", "type"]
      }
    },
    forecast: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "YYYY-MM format" },
          revenue: { type: Type.NUMBER },
          bookings: { type: Type.NUMBER },
          type: { type: Type.STRING, enum: ["forecast"] }
        },
        required: ["date", "revenue", "type"]
      }
    },
    insights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Key strategic insights derived from the data analysis."
    },
    keyDrivers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of main factors influencing the revenue (e.g., Seasonality, Marketing)."
    },
    suggestedParameters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          key: { type: Type.STRING },
          min: { type: Type.NUMBER },
          max: { type: Type.NUMBER },
          default: { type: Type.NUMBER },
          description: { type: Type.STRING }
        },
        required: ["name", "key", "min", "max", "default"]
      }
    }
  },
  required: ["historical", "forecast", "insights", "suggestedParameters"]
};

export const analyzeTravelData = async (csvContent: string): Promise<ForecastResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: `You are a world-class Chief Financial Officer and Data Scientist specializing in the Travel & Tourism industry. 
        Your goal is to analyze raw CSV data of historical revenue/bookings and generate a robust 12-month revenue forecast.
        
        The forecast should account for:
        1. Seasonality (typical for travel).
        2. Trend lines (growth/decline).
        3. Anomalies (smooth them out).

        You must also provide 'suggestedParameters' for a simulation dashboard. These are multipliers or percentages the user can tweak. 
        Examples: 'Market Growth %' (0-20), 'Ad Spend Impact' (0.8-1.5), 'Seasonal Variation' (0.5-1.5).
        
        The output must be strict JSON following the schema provided.`,
        responseMimeType: "application/json",
        responseSchema: forecastSchema,
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analyze the following CSV data and produce a forecast. 
              
              CSV Data:
              ${csvContent}
              `
            }
          ]
        }
      ]
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }

    return JSON.parse(text) as ForecastResponse;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw error;
  }
};
