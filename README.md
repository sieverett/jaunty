# Jaunty - Travel Revenue Forecasting Platform

A full-stack application for generating 12-month revenue forecasts from historical travel booking data.

## Project Structure

**Note:** `jaunty/` is the git repository root.

```
jaunty/                # Git repository root
├── data/              # CSV data files (data_template.csv, test_data.csv)
├── model/             # Core forecasting models
├── report/            # Strategic report generator (Azure OpenAI)
├── tmp/               # Temporary uploaded files (auto-managed)
├── backend/          # FastAPI backend service
├── docs/              # Documentation
├── components/       # React components
├── services/          # Frontend services
├── utils/             # Frontend utilities
└── [frontend files]   # React + TypeScript frontend (root level)
```

## Components

### Data (`data/`)
Centralized data directory containing CSV files:
- `data_template.csv` - Template showing expected data structure
- `test_data.csv` - Generated test data with active leads

**See [data/README.md](data/README.md) for details.**

### Backend API (`backend/`)
FastAPI service that provides REST endpoints for:
- File uploads with automatic cleanup (`/upload`)
- Training ensemble forecasting models (`/train`)
- Generating 12-month revenue forecasts (`/forecast`)
- Dashboard-formatted forecasts (`/dashboard/forecast`) - **NEW**
- Strategic analysis reports (`/report`)
- Model health checks and metadata (`/health`)

**Key Features:**
- File upload management: Upload CSV files to `tmp/` directory
- Automatic cleanup: Maintains maximum file limit (default: 50 files)
- Dashboard endpoint: Returns data formatted for frontend consumption
- Swagger UI: Interactive API documentation at `/docs`

**Dashboard Endpoint (`/dashboard/forecast`):**
- Returns historical monthly revenue data
- Returns 12-month forecast data
- Generates insights from dataset statistics
- Extracts key revenue drivers
- Provides suggested parameters for scenario simulation
- Includes funnel data for active pipeline stages (inquiry → quote_sent → booked → final_payment)
  - Excludes historical `completed` leads (not current pipeline state)
  - Conversion rates show percentage from previous stage to current stage

**See [backend/README.md](backend/README.md) for details.**

### Frontend (`/`)
React 19 + TypeScript + Vite application with:
- Modern UI using Tailwind CSS v4
- Backend API integration (NEW)
- Mock data service for development
- Google Gemini AI integration (fallback)
- Revenue forecasting dashboard
- Data visualization components

**Tech Stack:**
- React 19.2.0
- TypeScript 5.8
- Vite 6.2
- Tailwind CSS v4
- Recharts for visualizations

**Data Service:**
- Unified `dataService.ts` that switches between:
  - Mock data (for frontend development)
  - Backend API (`/dashboard/forecast`)
  - Gemini AI (fallback)
- Enhanced error handling with timeout support
- Automatic response validation

**Configuration:**
- `VITE_USE_MOCK_DATA=true` - Use mock data (development)
- `VITE_API_URL=http://localhost:8000` - Backend API URL
- `VITE_API_TIMEOUT=60000` - Request timeout (milliseconds)

### Analysis Pipeline (`analysis/`)
Legacy/alternative implementation of the forecasting pipeline using a different architecture. This is kept for reference but the main production pipeline is in `model/`.

**See [analysis/README.md](analysis/README.md) for details.**

### Core Models (`model/`)
The production forecasting pipeline used by the backend API. Contains:
- Ensemble pipeline (Prophet + XGBoost + Pipeline models)
- Data loading and validation
- Model training and inference
- Jupyter notebooks for testing

**See [model/README.md](model/README.md) for details.**

## Quick Start

### Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Setup

```bash
npm install
npm run dev
```

### Using the API

```bash
# Upload a file
curl -X POST "http://localhost:8000/upload" \
  -F "file=@data/test_data.csv"

# Train models
curl -X POST "http://localhost:8000/train" \
  -F "file=@data/test_data.csv"

# Generate forecast (with metadata)
curl -X POST "http://localhost:8000/forecast" \
  -F "file=@data/test_data.csv" \
  -F "forecast_date=2024-11-20"

# Generate dashboard-formatted forecast (for frontend)
curl -X POST "http://localhost:8000/dashboard/forecast" \
  -F "file=@data/test_data.csv" \
  -F "train_models=false"

# Generate strategic report
curl -X POST "http://localhost:8000/report" \
  -F "file=@data/test_data.csv" \
  -F "train_models=false"
```

**Interactive Testing:**
- Swagger UI: http://localhost:8000/docs
- See [backend/TESTING.md](backend/TESTING.md) for detailed testing guide

## Development

### Environment Variables

Create `.env.local` in the frontend root:
```env
# Backend API Configuration
VITE_API_URL=http://localhost:8000
VITE_USE_MOCK_DATA=false
VITE_API_TIMEOUT=60000

# Gemini AI (fallback if API not configured)
VITE_GEMINI_API_KEY=your_api_key_here
```

**Data Source Priority:**
1. Mock data if `VITE_USE_MOCK_DATA=true`
2. Backend API if `VITE_API_URL` is set and file provided
3. Gemini AI (fallback)

### Backend Configuration

The backend uses models from `model/artifacts/` directory. Ensure models are trained before generating forecasts.

**Environment Variables:**
- `MAX_TMP_FILES`: Maximum files to keep in `tmp/` directory (default: 50)
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI endpoint (for `/report` endpoint)
- `AZURE_OPENAI_API_KEY`: Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME`: Azure OpenAI deployment name

## Documentation

- [Backend API Documentation](backend/README.md)
- [Backend Testing Guide](backend/TESTING.md)
- [Backend Integration Analysis](docs/BACKEND_INTEGRATION_ANALYSIS.md)
- [Backend Integration Implementation](docs/BACKEND_INTEGRATION_IMPLEMENTATION.md)
- [Analysis Pipeline Documentation](analysis/README.md)
- [Core Models Documentation](model/README.md)
- [Project Structure](docs/PROJECT_STRUCTURE.md)
- [Fixes & Troubleshooting](docs/FIXES_DOCUMENTATION.md)

## Project Status

- ✅ Backend API (v1.0.0)
- ✅ Dashboard Endpoint (`/dashboard/forecast`) - **NEW**
- ✅ Frontend-Backend Integration - **NEW**
- ✅ File Upload Management with Auto-Cleanup
- ✅ Frontend UI (v0.0.0)
- ✅ Mock Data Service for Development
- ✅ Core Forecasting Models
- ✅ Strategic Report Generation (Azure OpenAI)

## License

Private project - All rights reserved

