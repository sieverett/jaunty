# Adding JAUNTY Repository to Render

## Step-by-Step Instructions

### Option 1: Add via "Add credential" Button (Recommended)

1. **On the Account Security page you're viewing:**
   - Scroll down to "Git Deployment Credentials" section
   - Click the **"Add credential"** button (with GitHub/GitLab icons)

2. **Select GitHub:**
   - Choose GitHub from the dropdown
   - You'll be redirected to GitHub to authorize Render

3. **Grant Access:**
   - GitHub will ask you to authorize Render
   - **Important:** Make sure to grant access to:
     - Your personal repositories (if JAUNTY is under your personal account)
     - OR your organization (if JAUNTY is under an organization)
   - Click "Authorize Render" or "Grant access"

4. **Refresh Render:**
   - Go back to Render dashboard
   - The JAUNTY repository should now appear in the list

### Option 2: Reconnect GitHub Account

1. **Disconnect and Reconnect:**
   - On the Account Security page
   - Find GitHub in "Login Methods" or "Git Deployment Credentials"
   - Click the three dots (⋯) next to your GitHub account
   - Select "Disconnect" or "Remove"
   - Then click "Add credential" → GitHub
   - Re-authorize and make sure to grant access to ALL repositories

2. **Check Repository Visibility:**
   - Make sure your JAUNTY repository is not set to "Private" with restricted access
   - Or ensure Render has access to private repos

### Option 3: Manual Repository URL (If Above Fails)

If the repository still doesn't appear, you can deploy using the repository URL directly:

1. **Get your repository URL:**
   - Go to your GitHub repository: `https://github.com/sieverett/JAUNTY`
   - Click the green "Code" button
   - Copy the HTTPS URL: `https://github.com/sieverett/JAUNTY.git`

2. **In Render:**
   - Click "New" → "Web Service"
   - Instead of selecting from the dropdown, look for:
     - "Public Git repository" option, OR
     - "Connect repository" → "Enter repository URL"
   - Paste: `https://github.com/sieverett/JAUNTY.git`
   - Select branch: `main` (or your default branch)

## Quick Checklist

- [ ] Clicked "Add credential" → GitHub
- [ ] Authorized Render on GitHub
- [ ] Granted access to ALL repositories (or specifically JAUNTY)
- [ ] Refreshed Render dashboard
- [ ] JAUNTY appears in repository list

## If Still Not Working

**Try Railway instead** - it's often easier:
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Railway's GitHub integration is usually more reliable
4. Your JAUNTY repo should appear immediately

Or **use Fly.io** - no GitHub connection needed:
- See `DEPLOYMENT.md` for Fly.io CLI deployment

