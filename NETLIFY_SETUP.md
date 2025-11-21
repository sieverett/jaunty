# Netlify Environment Variable Setup

## Problem
If `VITE_API_URL` is not set in Netlify, the frontend defaults to `http://localhost:8000`, which won't work from the deployed site.

## Solution: Set Environment Variable in Netlify

### Step-by-Step Instructions

1. **Go to Netlify Dashboard**
   - Visit: https://app.netlify.com
   - Sign in to your account

2. **Select Your Site**
   - Click on your Jaunty frontend site

3. **Navigate to Environment Variables**
   - Click **Site settings** (left sidebar)
   - Scroll down to **Build & deploy**
   - Click **Environment variables**

4. **Add the Variable**
   - Click **Add variable** (or **Add a variable**)
   - **Key**: `VITE_API_URL`
   - **Value**: `https://jaunty.onrender.com`
   - Click **Save**

5. **Redeploy Your Site**
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - Or push a new commit to trigger auto-deploy

### Visual Guide

```
Netlify Dashboard
  └── Your Site
      └── Site settings
          └── Build & deploy
              └── Environment variables
                  └── Add variable
                      ├── Key: VITE_API_URL
                      └── Value: https://jaunty.onrender.com
```

## Verify It's Working

### Method 1: Check Browser Console
1. Open your Netlify site in a browser
2. Open Developer Tools (F12)
3. Go to **Console** tab
4. Look for API calls - they should go to `https://jaunty.onrender.com`
5. If you see errors about `localhost:8000`, the variable isn't set correctly

### Method 2: Check Network Tab
1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Trigger an API call (upload a file, etc.)
4. Check the request URL - it should be `https://jaunty.onrender.com/...`
5. If it's `http://localhost:8000/...`, the variable isn't set

### Method 3: Check Build Logs
1. Go to **Deploys** tab in Netlify
2. Click on the latest deploy
3. Check the build logs
4. Look for `VITE_API_URL` in the environment variables section
5. It should show: `VITE_API_URL=https://jaunty.onrender.com`

## Troubleshooting

### Issue: Variable Not Taking Effect
- **Solution**: Environment variables are injected at **build time**, not runtime
- You **must redeploy** after adding/changing environment variables
- Simply saving the variable won't update the running site

### Issue: Still Using Localhost
- Check that the variable name is exactly `VITE_API_URL` (case-sensitive)
- Check that it starts with `VITE_` (required for Vite to expose it)
- Make sure you redeployed after adding the variable
- Check build logs to confirm the variable is being used

### Issue: CORS Errors
- Make sure `ALLOWED_ORIGINS` in Render includes your Netlify domain
- Format: `https://your-site.netlify.app,http://localhost:3006`
- Update Render environment variable and redeploy backend

## Current Default Behavior

The code in `services/dataService.ts` defaults to localhost:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

This means:
- ✅ **Local development**: Works without setting variable (uses localhost)
- ❌ **Netlify deployment**: **Must** set `VITE_API_URL` or it will fail

## Quick Checklist

- [ ] `VITE_API_URL` is set in Netlify environment variables
- [ ] Value is `https://jaunty.onrender.com` (no trailing slash)
- [ ] Site has been redeployed after adding the variable
- [ ] Browser console shows API calls going to Render URL
- [ ] No CORS errors in browser console
- [ ] Backend `ALLOWED_ORIGINS` includes Netlify domain

