# Quick Deployment Commands

## Step 1: Create GitHub Repo
Go to: https://github.com/new
- Name: privatebtc-backend
- Public repository
- Don't initialize with README

## Step 2: Push to GitHub
```powershell
cd c:\Users\sl\OneDrive\Documents\Hackathons\starknet\privatebtc-backend

# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/privatebtc-backend.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Render
1. Go to: https://render.com
2. Sign in with GitHub
3. Click "New +" → "Web Service"
4. Connect `privatebtc-backend` repository
5. Settings should auto-fill:
   - Build: `npm install && npm run build`
   - Start: `npm start`
6. Click "Create Web Service"

## Step 4: Test
Your app will be at: `https://privatebtc-backend-XXXX.onrender.com`

Test health:
```
https://your-app-url.onrender.com/health
```

## That's it! 🚀

Full guide: See DEPLOYMENT.md
