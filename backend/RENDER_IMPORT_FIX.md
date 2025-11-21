# Fix for "ModuleNotFoundError: No module named 'model'"

## The Problem

Render can't find the `model` module because Python doesn't know where to look for it.

## Solution Options

### Option 1: Set Root Directory to Repo Root (Recommended)

1. In Render dashboard, go to **Settings** → **Build & Deploy**
2. Change **Root Directory** from `jaunty/backend` to: **(leave empty or use `.`)**
3. Update **Start Command** to:
   ```bash
   cd jaunty/backend && uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
4. Add Environment Variable:
   - **Key**: `PYTHONPATH`
   - **Value**: `/opt/render/project/src/jaunty`
5. Save and redeploy

### Option 2: Keep Root Directory as `jaunty/backend` + Add PYTHONPATH

1. Keep **Root Directory** as `jaunty/backend`
2. Add Environment Variable:
   - **Key**: `PYTHONPATH`
   - **Value**: `/opt/render/project/src/jaunty`
3. The code will automatically search for the `model` directory
4. Save and redeploy

### Option 3: Verify Your GitHub Repo Structure

Check your GitHub repo at: https://github.com/sieverett/jaunty

If your structure is:
```
jaunty/
  backend/
  model/
```

Then Root Directory should be `jaunty/backend` (Option 2).

If your structure is:
```
backend/
model/
```

Then Root Directory should be `backend` or empty (Option 1).

## Why This Happens

When Render sets Root Directory to `jaunty/backend`, it changes to that directory before running commands. Python needs to know where the `model` directory is relative to the Python path. Setting `PYTHONPATH` or adjusting the Root Directory fixes this.

## Verify It's Working

After deploying, check the logs. You should see the app starting successfully without `ModuleNotFoundError`.

