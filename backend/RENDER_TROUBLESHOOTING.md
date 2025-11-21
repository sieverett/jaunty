# Render GitHub Connection Troubleshooting

## Common Issues and Solutions

### Issue 1: "Repository not found" or "Access denied"

**Solution:**
1. **Check Repository Visibility:**
   - Private repos: Ensure Render has access
   - Go to Render Dashboard → Account Settings → Connected Accounts
   - Verify GitHub is connected and has access to private repos

2. **Reconnect GitHub:**
   - Render Dashboard → Account Settings → Connected Accounts
   - Click "Disconnect" next to GitHub
   - Click "Connect GitHub" and authorize Render
   - Grant access to your organization/repositories

3. **Check Repository Permissions:**
   - If repo is in an organization, ensure Render has access
   - Organization Settings → Third-party access → Render

### Issue 2: Repository doesn't appear in dropdown

**Solution:**
1. **Refresh the page** - Sometimes there's a caching issue
2. **Check repository name** - Make sure you're searching for the correct name
3. **Try manual connection:**
   - Instead of selecting from dropdown, try entering the repo URL manually:
   - Format: `https://github.com/your-username/JAUNTY`
   - Or: `your-username/JAUNTY`

### Issue 3: OAuth Permissions

**Solution:**
1. Go to GitHub → Settings → Applications → Authorized OAuth Apps
2. Find "Render" in the list
3. Click "Grant" or "Configure" to ensure it has repository access
4. If Render isn't listed, reconnect from Render dashboard

### Issue 4: Branch Selection

**Solution:**
- Make sure you're selecting the correct branch (usually `main` or `master`)
- If your code is on a different branch, select that branch
- Render will deploy from the selected branch

### Issue 5: Manual Repository Connection

If automatic connection fails, try manual connection:

1. **Get your repository URL:**
   - Format: `https://github.com/your-username/JAUNTY.git`
   - Or SSH: `git@github.com:your-username/JAUNTY.git`

2. **In Render:**
   - Click "New" → "Web Service"
   - Instead of selecting from GitHub, look for "Public Git repository" option
   - Paste your repository URL
   - Select branch (usually `main`)

## Alternative: Deploy from Local Machine

If GitHub connection continues to fail, you can deploy directly:

### Option 1: Render CLI

1. **Install Render CLI:**
   ```bash
   npm install -g render-cli
   ```

2. **Login:**
   ```bash
   render login
   ```

3. **Deploy:**
   ```bash
   cd jaunty/backend
   render deploy
   ```

### Option 2: Manual Git Push to Render

1. **Get Render Git URL:**
   - After creating service in Render dashboard, go to Settings
   - Copy the "Git Repository URL"

2. **Add Render as remote:**
   ```bash
   git remote add render https://git.render.com/your-service-name.git
   ```

3. **Push to Render:**
   ```bash
   git push render main
   ```

## Alternative Platforms (If Render Still Fails)

### Railway (Easier GitHub Connection)

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Railway's GitHub integration is often more reliable
4. Select your repository
5. Add service → Select `jaunty/backend` directory
6. Railway auto-detects Python and requirements.txt

### Fly.io (CLI-based, no GitHub needed)

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login:**
   ```bash
   fly auth login
   ```

3. **Create app:**
   ```bash
   cd jaunty/backend
   fly launch
   ```

4. **Deploy:**
   ```bash
   fly deploy
   ```

## Step-by-Step: Render GitHub Connection

1. **Go to Render Dashboard:**
   - https://dashboard.render.com

2. **Check Connected Accounts:**
   - Click your profile → Account Settings
   - Go to "Connected Accounts"
   - Verify GitHub is connected (green checkmark)

3. **If not connected:**
   - Click "Connect GitHub"
   - Authorize Render application
   - Grant access to repositories (or specific repos)

4. **Create New Web Service:**
   - Click "New" → "Web Service"
   - You should see "Connect a repository" section
   - Your repositories should appear in dropdown

5. **If repositories don't appear:**
   - Click "Configure" next to GitHub
   - Grant access to organization/private repos if needed
   - Refresh the page

6. **Select Repository:**
   - Search for "JAUNTY" or your repo name
   - Select it from dropdown

7. **Configure:**
   - Name: `jaunty-backend`
   - Branch: `main` (or your default branch)
   - Root Directory: `jaunty/backend`
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt && pip install -r ../../model/requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Still Having Issues?

**Try Railway instead** - it's often easier:
- Better GitHub integration
- Simpler setup
- Free tier available
- See `DEPLOYMENT.md` for Railway instructions

Or **use Fly.io** - CLI-based, no GitHub connection needed:
- See `DEPLOYMENT.md` for Fly.io instructions

