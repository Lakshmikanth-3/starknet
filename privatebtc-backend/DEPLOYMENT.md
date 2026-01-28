# 🚀 PrivateBTC Backend - Cloud Deployment Guide

## Quick Deploy to Render.com (5 minutes)

### Step 1: Push to GitHub

1. **Initialize Git** (if not already done):
```bash
cd c:\Users\sl\OneDrive\Documents\Hackathons\starknet\privatebtc-backend
git init
git add .
git commit -m "Initial commit - PrivateBTC Vault Backend"
```

2. **Create GitHub Repository**:
   - Go to https://github.com/new
   - Repository name: `privatebtc-backend`
   - Description: `Privacy-preserving Bitcoin savings backend for Starknet`
   - Keep it **Public** (required for Render free tier)
   - Don't initialize with README
   - Click "Create repository"

3. **Push to GitHub**:
```bash
git remote add origin https://github.com/YOUR_USERNAME/privatebtc-backend.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Render.com

1. **Sign Up**:
   - Go to https://render.com
   - Click "Get Started"
   - Sign up with GitHub (easiest)

2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub account (if not already)
   - Select `privatebtc-backend` repository
   - Click "Connect"

3. **Configure Service**:
   ```
   Name: privatebtc-backend
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   Plan: Free
   ```

4. **Environment Variables** (click "Advanced"):
   ```
   NODE_ENV = production
   PORT = 3001
   ```

5. **Click "Create Web Service"**

### Step 3: Wait for Deployment

- Build takes ~2-3 minutes
- Watch the logs in real-time
- You'll see: "✅ Build successful"
- Then: "🚀 PrivateBTC Vault Backend is RUNNING!"

### Step 4: Get Your URL

Your backend will be live at:
```
https://privatebtc-backend-XXXX.onrender.com
```

Test it:
```
https://privatebtc-backend-XXXX.onrender.com/health
```

---

## Alternative: Deploy to Railway.app

### Option 1: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Option 2: Railway Dashboard

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `privatebtc-backend`
5. Railway auto-detects settings
6. Click "Deploy"

---

## Testing Your Deployed Backend

### Test 1: Health Check
```bash
curl https://your-app-url.onrender.com/health
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

### Test 2: Create Vault
```bash
curl -X POST https://your-app-url.onrender.com/api/vaults \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"0xtest123","amount":1.5,"lockPeriod":90}'
```

### Test 3: Get Stats
```bash
curl https://your-app-url.onrender.com/api/stats
```

---

## Important Notes

### Free Tier Limitations

**Render.com Free Tier:**
- ✅ 750 hours/month (enough for hackathon)
- ⚠️ Spins down after 15 min inactivity
- ⚠️ First request after spin-down takes ~30 seconds
- ✅ Auto-deploys on git push

**Railway Free Tier:**
- ✅ $5 free credit/month
- ✅ No spin-down
- ✅ Faster for hackathon demos

### Database Persistence

**Important:** SQLite database will be **reset on each deploy** on Render free tier.

For persistent data, add this to `render.yaml`:
```yaml
services:
  - type: web
    name: privatebtc-backend
    # ... other config ...
    disk:
      name: privatebtc-data
      mountPath: /app
      sizeGB: 1
```

Or use Railway which has persistent storage included.

### Custom Domain (Optional)

On Render:
1. Go to Settings → Custom Domain
2. Add your domain
3. Update DNS records

---

## Troubleshooting

### Build Fails

If build fails with `better-sqlite3` errors:
1. Check the build logs
2. Ensure render.yaml is in root directory
3. Build command should be: `npm install && npm run build`

### App Won't Start

Check start command:
```
npm start
```

Should run `node dist/app.js`

### Database Errors

Ensure database file path is writable:
```typescript
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/privatebtc.db'  // Render uses /tmp for temp files
  : path.join(process.cwd(), 'privatebtc.db');
```

---

## Next Steps

Once deployed:

1. **Update Frontend** to use deployed URL
2. **Test All Endpoints** from your frontend
3. **Monitor Logs** on Render dashboard
4. **Set Up Auto-Deploy** (already done with GitHub integration)

---

## Cost

✅ **100% FREE** for hackathon use!

- Render: Free tier unlimited
- Railway: $5 credit (lasts ~1 month)
- Both support custom domains
- Both have auto-deploy from GitHub

---

## Ready to Deploy?

Follow Step 1 above to push to GitHub, then Step 2 to deploy! 🚀
