# Docker Build Instructions

## Prerequisites

- Docker installed and running on your system
- Docker Compose (typically bundled with Docker Desktop)

## Local Development with Docker Compose

The easiest way to run the entire application stack:

```bash
docker-compose up --build
```

This will:
- Build both frontend and backend images
- Start both services with proper networking
- Frontend available at http://localhost:3000
- Backend API available at http://localhost:8000

To run in detached mode:
```bash
docker-compose up --build -d
```

To stop:
```bash
docker-compose down
```

## Building Images Individually

### Backend

**IMPORTANT**: The backend Dockerfile must be built from the project root directory, not from the `backend/` directory. This is because the build requires access to the `model/` and `data/` directories at the project root level.

```bash
docker build -f backend/Dockerfile -t jaunty-backend .
```

### Frontend

The frontend build requires the `VITE_API_URL` build argument to configure the API endpoint:

```bash
docker build -f Dockerfile.frontend -t jaunty-frontend --build-arg VITE_API_URL=http://localhost:8000 .
```

For production, adjust the `VITE_API_URL` to point to your production backend:

```bash
docker build -f Dockerfile.frontend -t jaunty-frontend --build-arg VITE_API_URL=https://api.example.com .
```

## Running Individual Containers

### Backend

```bash
docker run -p 8000:8000 jaunty-backend
```

Access the backend at http://localhost:8000

### Frontend

```bash
docker run -p 3000:80 jaunty-frontend
```

Access the frontend at http://localhost:3000

## Important Notes

### Backend Build Context
The backend Dockerfile must be built from the project root directory because:
- It needs access to `model/` directory for ML pipeline components
- It needs access to `data/` directory for test data
- The Dockerfile copies these directories into the container: `COPY model/ ./model/` and `COPY data/ ./data/`

Do not run `docker build` from inside the `backend/` directory - it will fail to find these required directories.

### Frontend Configuration
- The frontend requires the `VITE_API_URL` build argument at build time
- This value is baked into the frontend bundle during the build process
- Different values needed for development vs production
- In docker-compose, this defaults to `http://backend:8000` for internal networking

### Nginx Configuration
The `nginx.conf` file provides:
- SPA routing: All non-asset requests are served `index.html` for client-side routing
- Gzip compression for text-based assets
- Cache headers for static assets (1 year)
- Health check endpoint at `/health`
- Support for CSV file serving

### Docker Compose Networking
When using docker-compose:
- Frontend uses `http://backend:8000` as the API URL (internal Docker network)
- Services communicate via the `jaunty-network` bridge network
- Port 3000 (frontend) and 8000 (backend) are exposed to the host

### Excluded Files
The `.dockerignore` file excludes:
- Node modules and Python virtual environments
- Build outputs
- Git files
- Documentation
- Log files
- Environment files
- Model artifacts (`.pkl`, `.joblib`)

These exclusions keep the build context small and prevent unnecessary files from being copied into containers.
