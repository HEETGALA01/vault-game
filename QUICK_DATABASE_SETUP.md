# Quick Start: Database Setup on Render

## 🚀 5-Minute Setup

### Step 1: Create PostgreSQL Database
1. Go to https://dashboard.render.com/
2. Click **New +** → **PostgreSQL**
3. Settings:
   - Name: `vault-breaker-db`
   - Database: `vaultbreaker`
   - Region: Same as your web service
   - Plan: **Free**
4. Click **Create Database**

### Step 2: Connect to Your Web Service
1. Once database is created, copy the **Internal Database URL**
2. Go to your web service on Render
3. Click **Environment** tab
4. Add new variable:
   - Key: `DATABASE_URL`
   - Value: [paste the Internal Database URL]
5. Click **Save Changes**

### Step 3: Wait for Deploy
- Your app will automatically redeploy (~2 minutes)
- Database tables will be created automatically
- No manual SQL needed!

### Step 4: Verify It's Working
Visit: `https://your-app.onrender.com/api/health`

You should see:
```json
{
  "status": "ok",
  "database": "connected"
}
```

## ✅ That's It!

Your database is now recording:
- Player names
- Player emails
- Scores
- Vaults opened
- Win/loss status
- Timestamps
- Game duration

All data is recorded **automatically in real-time** when players play!

## 📊 View Your Data

### Method 1: API Endpoint
Visit: `https://your-app.onrender.com/api/data?password=admin123`

Shows:
- Top players (leaderboard)
- All game sessions
- Statistics

### Method 2: Connect Database Client
Use pgAdmin, DBeaver, or TablePlus with the External Connection details from Render.

## 🔍 What Gets Recorded

Every time a player plays:
1. **Game starts** → New session created in database
2. **Game completes** → Score, vaults, win/loss saved
3. **Player record** → Best score updated if beaten

## 💰 Cost

**Free Plan**: 90 days free, then $7/month if you want to keep it permanently.

## 🆘 Troubleshooting

If database shows "disconnected":
1. Check DATABASE_URL is set in Environment tab
2. Make sure database status is "Available"
3. Check logs for errors

---

**Need the detailed guide?** See `DATABASE_SETUP.md`
