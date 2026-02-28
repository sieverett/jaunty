# Jaunty

**Travel revenue forecasting with ensemble ML models and an interactive React dashboard.**

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Anthropic](https://img.shields.io/badge/Anthropic-Claude-191919?style=for-the-badge&logo=anthropic&logoColor=white)

---

## About

Jaunty is a full-stack application that generates 12-month revenue forecasts from historical travel booking data. It combines an ensemble of Prophet, XGBoost, and scikit-learn pipeline models on the backend with a React dashboard that visualizes forecasts, confidence intervals, pipeline funnels, and AI-generated strategic insights.

## Features

- **Ensemble forecasting pipeline** -- Prophet, XGBoost, and scikit-learn models trained on uploaded CSV data
- **Interactive dashboard** -- Revenue charts with confidence intervals, brush-based date range selection, and scenario simulation
- **Pipeline funnel visualization** -- Tracks leads from inquiry through booking to final payment with empirical conversion rates
- **AI-powered insights** -- Strategic analysis via Anthropic Claude (frontend and backend report endpoint)
- **PDF report export** -- Export forecasts and charts as styled PDF documents with SVG extraction
- **File upload and management** -- Upload CSVs through the UI or API; automatic temp file cleanup
- **Docker deployment** -- Compose configuration for frontend (Nginx) and backend containers

## Architecture

```
jaunty/
  backend/         FastAPI service (upload, train, forecast, report endpoints)
  model/           Ensemble forecasting pipeline (Prophet + XGBoost + Pipeline)
  report/          Strategic report generator (Anthropic Claude)
  components/      React components (Dashboard, Charts, FileUpload, Auth)
  services/        Frontend data service and Anthropic Claude integration
  utils/           PDF export utilities (SVG extraction, HTML rendering)
  data/            CSV templates and test data
  docs/            Deployment guides (Azure, Docker)
  scripts/         Deployment script
```

## Getting Started

### Prerequisites

- Python 3.7+
- Node.js 18+

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000` with interactive docs at `/docs`.

### Frontend

```bash
npm install
npm run dev
```

Create a `.env.local` file in the project root to configure the data source:

```env
VITE_API_URL=http://localhost:8000
VITE_USE_MOCK_DATA=false
VITE_API_TIMEOUT=60000
```

### Docker

```bash
docker compose up --build
```

## API Overview

| Endpoint | Method | Description |
|---|---|---|
| `/upload` | POST | Upload a CSV file |
| `/train` | POST | Train ensemble models on uploaded data |
| `/forecast` | POST | Generate a 12-month revenue forecast |
| `/dashboard/forecast` | POST | Forecast formatted for the frontend dashboard |
| `/report` | POST | Generate a strategic analysis report |
| `/health` | GET | Service health check |

## License

Private project -- All rights reserved
