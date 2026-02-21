# Quick Deployment to Railway.app 🚂

## Method 1: Railway Dashboard (Easiest)

### Step 1: Push to GitHub
Go to: https://github.com/new
- Name: privatebtc-backend
- Public repository

```powershell
cd c:\Users\sl\OneDrive\Documents\Hackathons\starknet\privatebtc-backend
git remote add origin https://github.com/YOUR_USERNAME/privatebtc-backend.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Railway
1. Go to: https://railway.app
2. Click "Login with GitHub"
3. Click "+ New Project"
4. Select "Deploy from GitHub repo"
5. Choose `privatebtc-backend`
6. Click "Deploy Now"
7. Go to Settings → Generate Domain

✅ Done! Your app is live!

---

## Method 2: Railway CLI (Fastest - 1 minute!)

```powershell
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
cd c:\Users\sl\OneDrive\Documents\Hackathons\starknet\privatebtc-backend
railway init
railway up

# Get URL
railway domain
```

✅ **That's it!** 

---

## Test Your Deployment

```powershell
$url = "https://your-app.up.railway.app"
Invoke-RestMethod -Uri "$url/health"
```

---

## Why Railway?

- ✅ $5 free credit/month
- ✅ No spin-down (always fast!)
- ✅ Persistent database
- ✅ Auto-deploys on git push

**Perfect for hackathons!** 🚀

---

Full guide: See RAILWAY_DEPLOYMENT.md
