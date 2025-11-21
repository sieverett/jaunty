# Render Configuration - Exact Values

## Render Dashboard Configuration

When creating your web service in Render, use these **exact values**:

### Basic Settings

1. **Service Type**: `Web Service` ✓ (already selected)

2. **Name**: `jaunty-backend` (or any name you prefer)

3. **Language**: **Change from "Node" to "Python 3"**
   - Click the dropdown
   - Select "Python 3"

4. **Branch**: `main` ✓ (already correct)

5. **Region**: `Oregon (US West)` ✓ (or choose closest to you)

### Important Configuration

6. **Root Directory**: 
   ```
   jaunty/backend
   ```
   - This tells Render where your `main.py` file is located
   - **Important:** Enter exactly `jaunty/backend` (no leading slash)
   - **Note:** If you get `ModuleNotFoundError: No module named 'model'`, try setting Root Directory to just `backend` instead

7. **Build Command**: 
   ```bash
   pip install -r requirements.txt
   ```
   - Replace the default `$ npm install; npm run build`
   - All dependencies (backend + model + report) are consolidated in a single `requirements.txt` file

8. **Start Command**: 
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
   - Replace the default `$ yarn start`
   - **Important:** This is required (red border indicates it's mandatory)
   - Render provides `$PORT` automatically - don't change it

### Environment Variables

After creating the service, go to **Environment** tab and add:

- **Key**: `ALLOWED_ORIGINS`
  **Value**: `https://your-netlify-app.netlify.app,http://localhost:3006`
  (Replace `your-netlify-app` with your actual Netlify domain)

- **Key**: `PYTHONPATH`
  **Value**: `/opt/render/project/src/jaunty`
  (This helps Python find the `model` module)

- **Key**: `MAX_TMP_FILES`
  **Value**: `50`

- **Key**: `PYTHON_VERSION` (optional, Render auto-detects)
  **Value**: `3.11.0`

### Summary Checklist

- [ ] Language changed to **Python 3** (not Node!)
- [ ] Root Directory set to **jaunty/backend**
- [ ] Build Command updated to pip install commands
- [ ] Start Command updated to uvicorn command
- [ ] Environment variables added (after service creation)

## Common Mistakes

❌ **Wrong**: Language = "Node"  
✅ **Correct**: Language = "Python 3"

❌ **Wrong**: Root Directory = empty or "/jaunty/backend"  
✅ **Correct**: Root Directory = "jaunty/backend" (no leading slash)

❌ **Wrong**: Build Command = "$ npm install; npm run build"  
✅ **Correct**: Build Command = "pip install -r requirements.txt && pip install -r ../../model/requirements.txt"

❌ **Wrong**: Start Command = "$ yarn start"  
✅ **Correct**: Start Command = "uvicorn main:app --host 0.0.0.0 --port $PORT"

