# Backend Deployment Guide

This guide covers deploying the FastAPI backend to various platforms. Netlify is not suitable for Python backends with ML dependencies, so we recommend using Render, Railway, or Fly.io.

## Recommended Platforms

### 1. Render (Recommended - Easiest)

**Why Render:**
- Free tier available
- Easy Python deployment
- Automatic HTTPS
- Good for ML applications
- Simple configuration

**Steps:**

1. **Create a Render account** at https://render.com

2. **Create a new Web Service:**
   - Connect your GitHub repository
   - Select the `jaunty/backend` directory as the root directory
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Python Version: `3.11.0`
   - **Note:** All dependencies (backend + model + report) are consolidated in `requirements.txt`

3. **Environment Variables** (add in Render dashboard):
   ```
   MAX_TMP_FILES=50
   ALLOWED_ORIGINS=https://your-netlify-app.netlify.app,http://localhost:3006
   PYTHONPATH=/opt/render/project/src/jaunty
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/  # Optional
   AZURE_OPENAI_API_KEY=your-api-key  # Optional
   AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name  # Optional
   ```
   
   **Important:** Replace `your-netlify-app.netlify.app` with your actual Netlify domain.

4. **Deploy:**
   - Render will automatically deploy on every push to your main branch
   - Your API will be available at `https://your-service-name.onrender.com`

5. **Update Frontend (Netlify):**
   - Go to your Netlify dashboard
   - Select your site → Site settings → Environment variables
   - Add new variable:
     - **Key**: `VITE_API_URL`
     - **Value**: `https://your-service-name.onrender.com` (your Render backend URL)
   - Redeploy your Netlify site (or it will auto-deploy on next push)

**Note:** Render's free tier spins down after 15 minutes of inactivity. First request may take 30-60 seconds to wake up.

---

### 2. Railway (Alternative - Also Easy)

**Why Railway:**
- Simple deployment
- Good free tier
- Fast cold starts
- Easy environment variable management

**Steps:**

1. **Create a Railway account** at https://railway.app

2. **Create a new project:**
   - Connect your GitHub repository
   - Add a new service from your repo
   - Select the `jaunty/backend` directory

3. **Configure:**
   - Railway auto-detects Python projects
   - It will use `requirements.txt` automatically
   - Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

4. **Environment Variables:**
   - Add in Railway dashboard (same as Render above)

5. **Deploy:**
   - Railway auto-deploys on push
   - Your API will be available at `https://your-service-name.up.railway.app`

---

### 3. Fly.io (Alternative)

**Why Fly.io:**
- Good performance
- Global edge deployment
- Free tier available

**Steps:**

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create `fly.toml`** (see below)

3. **Deploy:**
   ```bash
   cd jaunty/backend
   fly launch
   fly deploy
   ```

---

## Important Configuration Changes

### CORS Settings

CORS is configured via the `ALLOWED_ORIGINS` environment variable. Set it in your deployment platform:

```
ALLOWED_ORIGINS=https://your-netlify-app.netlify.app,http://localhost:3006
```

If not set, it defaults to `*` (allows all origins) for development.

### Update Frontend API URL

In your frontend (Netlify), set the environment variable:

1. **Netlify Dashboard** → Site Settings → Environment Variables
2. Add: `VITE_API_URL=https://your-backend-service.onrender.com`
3. Redeploy frontend

Or update `jaunty/.env.production`:
```
VITE_API_URL=https://your-backend-service.onrender.com
```

---

## File Structure Requirements

For deployment, ensure your project structure includes:

```
JAUNTY/
├── model/              # Model pipeline code
│   ├── artifacts/      # Trained models (will be empty initially)
│   └── ...
├── jaunty/
│   ├── backend/       # FastAPI backend
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── ...
│   └── ...
└── report/            # Report generator (optional)
```

---

## Troubleshooting

### Issue: Models not found
- Models are trained on first request if `train_models=true`
- Or train models manually using `/train` endpoint

### Issue: Timeout errors
- Render free tier has 10-minute timeout
- Consider upgrading to paid tier for production

### Issue: CORS errors
- Ensure CORS origins include your frontend URL
- Check that `allow_credentials=True` is set

### Issue: Large dependencies
- Prophet and XGBoost are large libraries
- Build may take 5-10 minutes on first deploy
- This is normal

---

## Production Recommendations

1. **Use a paid tier** for production (better performance, no cold starts)
2. **Set up monitoring** (Render/Railway have built-in monitoring)
3. **Configure custom domain** for your backend
4. **Set up environment variables** securely (never commit API keys)
5. **Enable HTTPS** (automatic on Render/Railway)
6. **Set up logging** and error tracking (Sentry, etc.)

---

## Quick Start: Render Deployment

1. Push your code to GitHub
2. Go to https://render.com
3. Click "New" → "Web Service"
4. Connect your GitHub repo
5. Configure:
   - **Name**: `jaunty-backend`
   - **Root Directory**: `jaunty/backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt` (all dependencies consolidated)
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables
7. Click "Create Web Service"
8. Wait for deployment (5-10 minutes)
9. Copy your service URL
10. Update frontend `VITE_API_URL` environment variable
11. Redeploy frontend on Netlify

Done! Your backend is now deployed and accessible from your Netlify frontend.

