# 🚂 Deploy PrivateBTC Backend to Railway.app - Complete Guide

## ✅ Why Railway.app?

- ✅ **$5 free credit/month** (enough for hackathon)
- ✅ **No spin-down** (always responsive)
- ✅ **Persistent storage** (database survives deploys)
- ✅ **Faster deployments** than Render
- ✅ **Auto-deploys** on git push

---

## 🚀 METHOD 1: Deploy via Railway Dashboard (Easiest - 3 minutes)

### Step 1: Push to GitHub (if not done yet)

```powershell
cd c:\Users\sl\OneDrive\Documents\Hackathons\starknet\privatebtc-backend

# Create GitHub repo first at https://github.com/new
# Name it: privatebtc-backend
# Then run:

git remote add origin https://github.com/YOUR_USERNAME/privatebtc-backend.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Railway

1. **Go to Railway.app**
   - Visit: https://railway.app
   - Click **"Start a New Project"**

2. **Sign in with GitHub**
   - Click **"Login"** (top right)
   - Choose **"Login with GitHub"**
   - Authorize Railway

3. **Deploy from GitHub**
   - Click **"+ New Project"**
   - Select **"Deploy from GitHub repo"**
   - Choose `privatebtc-backend` from the list
   - Click **"Deploy Now"**

4. **Wait for Build** (~2 minutes)
   - Railway auto-detects Node.js
   - Builds with: `npm install && npm run build`
   - Starts with: `npm start`
   - Watch the logs in real-time

5. **Get Your URL**
   - Click **"Settings"** tab
   - Scroll to **"Domains"**
   - Click **"Generate Domain"**
   - Copy your URL: `https://privatebtc-backend-production-XXXX.up.railway.app`

### Step 3: Test Your Deployment

```powershell
# Replace with your Railway URL
$url = "https://privatebtc-backend-production-XXXX.up.railway.app"

# Test health endpoint
Invoke-RestMethod -Uri "$url/health"
```

✅ **Done! Your backend is live!**

---

## 🚀 METHOD 2: Deploy via Railway CLI (Advanced - 1 minute)

### Step 1: Install Railway CLI

```powershell
npm install -g @railway/cli
```

### Step 2: Login to Railway

```powershell
railway login
```

This opens your browser - sign in with GitHub.

### Step 3: Initialize and Deploy

```powershell
cd c:\Users\sl\OneDrive\Documents\Hackathons\starknet\privatebtc-backend

# Link to Railway project
railway init

# Deploy!
railway up
```

### Step 4: Generate Public URL

```powershell
railway domain
```

Railway will give you a public URL automatically!

✅ **That's it - deployed in 3 commands!**

---

## 🔧 Railway Configuration (Automatic)

Railway auto-detects everything, but here's what it does:

**Build Command:** `npm install && npm run build`  
**Start Command:** `npm start`  
**Node Version:** Detected from package.json  
**Port:** Railway sets `PORT` environment variable automatically

No configuration files needed! 🎉

---

## 📊 Monitor Your Deployment

### View Logs
```powershell
railway logs
```

### Check Service Status
1. Go to https://railway.app/project/YOUR_PROJECT
2. Click on your service
3. See real-time logs, metrics, and deployments

---

## ✅ Test All Endpoints

### 1. Health Check
```powershell
$url = "https://your-app.up.railway.app"
Invoke-RestMethod -Uri "$url/health"
```

Expected:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "service": "PrivateBTC Vault Backend",
  "version": "1.0.0"
}
```

### 2. Create Vault
```powershell
$body = @{
  userAddress = "0xtest123"
  amount = 1.5
  lockPeriod = 90
} | ConvertTo-Json

Invoke-RestMethod -Uri "$url/api/vaults" -Method Post -Body $body -ContentType "application/json"
```

### 3. Get Vaults
```powershell
Invoke-RestMethod -Uri "$url/api/vaults/0xtest123"
```

### 4. Get Stats
```powershell
Invoke-RestMethod -Uri "$url/api/stats"
```

---

## 💾 Database Persistence

**Good news:** Railway has persistent storage by default!

Your SQLite database will survive:
- ✅ Redeploys
- ✅ Restarts
- ✅ Updates

No additional configuration needed!

---

## 🔄 Auto-Deploy on Git Push

Railway automatically rebuilds when you push to GitHub:

```powershell
# Make changes to your code
git add .
git commit -m "Updated API"
git push

# Railway rebuilds and deploys automatically! 🚀
```

---

## 💰 Free Tier Details

**Railway Free Plan:**
- **$5 credit/month**
- Usage meter shows remaining credit
- ~500 hours of runtime per month
- Persistent storage included
- No credit card required initially

**Your app will use approximately:**
- ~$0.20/day if running 24/7
- **Total: ~$6/month** (you get $5 free)

For hackathon (1-2 weeks): **100% FREE!** ✅

---

## 🛠️ Useful Railway CLI Commands

```powershell
# View project info
railway status

# Open dashboard in browser
railway open

# View environment variables
railway variables

# Link to different project
railway link

# View all deployments
railway list

# Restart service
railway restart
```

---

## 🔐 Environment Variables (Optional)

If you need to add environment variables:

### Via Dashboard:
1. Go to your project
2. Click **"Variables"** tab
3. Add key-value pairs

### Via CLI:
```powershell
railway variables set NODE_ENV=production
```

---

## 🎯 Complete Example Flow

```powershell
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Navigate to your project
cd c:\Users\sl\OneDrive\Documents\Hackathons\starknet\privatebtc-backend

# 3. Login
railway login

# 4. Initialize
railway init

# 5. Deploy
railway up

# 6. Generate domain
railway domain

# 7. Test
$url = (railway domain)
Invoke-RestMethod -Uri "$url/health"
```

**Total time: ~2-3 minutes!** ⚡

---

## 🆚 Railway vs Render Comparison

| Feature | Railway | Render |
|---------|---------|--------|
| Free Tier | $5 credit/month | 750 hours/month |
| Spin Down | ❌ No | ✅ Yes (after 15 min) |
| Persistent Storage | ✅ Included | ⚠️ Requires upgrade |
| Cold Start | ⚡ None | 🐌 ~30 seconds |
| Build Speed | ⚡ Fast | 🐌 Slower |
| Setup | 🎯 1-click | 📝 More config |

**Winner for Hackathon: Railway!** 🏆

---

## 🚨 Troubleshooting

### Build Fails

**Check build logs:**
```powershell
railway logs
```

**Common issue:** better-sqlite3 compilation
- Railway servers have C++ build tools ✅
- Should work automatically
- If fails, check Node version in package.json

### App Won't Start

**Check start command:**
- Should be: `npm start`
- Check in Railway dashboard → Settings → Start Command

### Can't Access URL

1. Make sure you generated a domain: `railway domain`
2. Check service is running in Railway dashboard
3. Look for errors in logs: `railway logs`

---

## 🎉 You're Done!

Your PrivateBTC backend is now:
- 🌐 **Live on Railway.app**
- 🚀 **Always responsive** (no spin-down)
- 💾 **Persistent database**
- 🔄 **Auto-deploys** on git push
- 💰 **Free for hackathon**

**Next steps:**
1. Copy your Railway URL
2. Update your frontend to use this URL
3. Start building your UI!

---

## 📝 Quick Reference

```powershell
# Deploy
railway up

# Get URL
railway domain

# View logs
railway logs

# Restart
railway restart

# Open dashboard
railway open
```

**Railway makes deployment so easy!** 🚂✨
