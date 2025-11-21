# Quick Deployment Guide

## Deploy Backend to Render (Recommended)

### Step 1: Deploy Backend

1. Go to https://render.com and sign up/login
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `jaunty-backend`
   - **Root Directory**: `jaunty/backend`
   - **Environment**: `Python 3`
   - **Build Command**: 
     ```bash
     pip install -r requirements.txt
     ```
     (All dependencies are now consolidated in a single requirements.txt file)
   - **Start Command**: 
     ```bash
     uvicorn main:app --host 0.0.0.0 --port $PORT
     ```
5. Add Environment Variables:
   - `ALLOWED_ORIGINS`: `https://your-netlify-app.netlify.app,http://localhost:3006`
     (Replace `your-netlify-app` with your actual Netlify domain)
   - `MAX_TMP_FILES`: `50`
6. Click "Create Web Service"
7. Wait 5-10 minutes for deployment
8. Copy your service URL (e.g., `https://jaunty-backend.onrender.com`)

### Step 2: Update Netlify Frontend

1. Go to your Netlify dashboard
2. Select your site → **Site settings** → **Environment variables**
3. Click **Add variable**:
   - **Key**: `VITE_API_URL`
   - **Value**: Your Render backend URL (e.g., `https://jaunty-backend.onrender.com`)
4. Go to **Deploys** → **Trigger deploy** → **Deploy site**
   (Or push a commit to trigger auto-deploy)

### Step 3: Test

1. Visit your Netlify site
2. Upload a CSV file
3. Check browser console for any CORS errors
4. If CORS errors occur, verify `ALLOWED_ORIGINS` includes your Netlify URL

## Alternative: Railway Deployment

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add new service → Select `jaunty/backend` directory
5. Railway auto-detects Python - verify:
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables (same as Render)
7. Deploy automatically happens
8. Copy Railway URL and update Netlify `VITE_API_URL`

## Troubleshooting

**CORS Errors:**
- Ensure `ALLOWED_ORIGINS` includes your exact Netlify URL
- Check for trailing slashes (should match exactly)

**Build Fails:**
- Prophet/XGBoost are large - build may take 10+ minutes
- Check build logs for specific errors

**Cold Start:**
- Render free tier spins down after 15 min inactivity
- First request after spin-down takes 30-60 seconds
- Consider paid tier for production

**Models Not Found:**
- Models train automatically on first request with `train_models=true`
- Or use `/train` endpoint to pre-train

## Project Structure for Deployment

Ensure your repository has this structure:
```
JAUNTY/
├── model/              # Model pipeline (required)
│   ├── artifacts/       # Empty initially, models created on first train
│   └── ...
├── jaunty/
│   ├── backend/        # Backend service (deploy this)
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── ...
│   └── ...             # Frontend (deploy separately to Netlify)
└── report/             # Optional report generator
```

