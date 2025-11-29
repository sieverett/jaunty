# Backend Dockerfile - FastAPI Python App
# NOTE: Build from project root with: docker build -f backend/Dockerfile .

FROM python:3.13-slim

WORKDIR /app

# Install system dependencies for Prophet and other ML libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ .

# Copy model directory (required for ML pipeline)
COPY model/ ./model/

# Copy data directory (for test data)
COPY data/ ./data/

# Expose port 8000
EXPOSE 8000

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
