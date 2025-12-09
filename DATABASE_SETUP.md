# Database Setup Guide for Render

This guide will help you set up a PostgreSQL database on Render to store player data in real-time.

## What Gets Recorded in the Database

The database automatically tracks:
- **Player Name** - The name entered by each player
- **Player Email** - The email provided by each player  
- **Score** - Final score achieved in the game
- **Vaults Opened** - Number of vaults successfully completed
- **Win/Loss Status** - Whether the player won or lost
- **Timestamps** - When each game started and completed
- **Game Duration** - How long each game session lasted

## Step 1: Create a PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** button → Select **"PostgreSQL"**
3. Configure the database:
   - **Name**: `vault-breaker-db` (or any name you prefer)
   - **Database**: `vaultbreaker`
   - **User**: `vaultbreaker` (auto-generated)
   - **Region**: Choose same region as your web service (for better performance)
   - **Plan**: Select **Free** (enough for development/testing)
4. Click **"Create Database"**
5. Wait for the database to be created (takes ~1 minute)

## Step 2: Get the Database Connection String

1. Once created, click on your database name
2. Scroll down to **"Connections"** section
3. Copy the **"Internal Database URL"** (recommended for better security)
   - Format: `postgresql://username:password@host:port/database`
4. Keep this URL handy for the next step

## Step 3: Connect Database to Your Web Service

1. Go to your **Render Dashboard**
2. Click on your web service (`vault-game-1` or whatever you named it)
3. Go to **"Environment"** tab
4. Click **"Add Environment Variable"**
5. Add the following:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL you copied
6. Click **"Save Changes"**

The web service will automatically redeploy with database support!

## Step 4: Verify Database Connection

After deployment completes (~2 minutes):

1. Visit your health check endpoint:
   ```
   https://your-app.onrender.com/api/health
   ```
   
2. You should see:
   ```json
   {
     "status": "ok",
     "database": "connected",
     ...
   }
   ```

3. If `"database": "connected"` shows, you're all set! ✅

## Step 5: View Your Data

### Option 1: Using Render Dashboard
1. Go to your PostgreSQL database on Render
2. Click **"Connect"** → **"External Connection"**
3. Use any PostgreSQL client (like pgAdmin, DBeaver, or TablePlus)
4. Enter the external connection details

### Option 2: Using API Endpoint
Visit (replace with your URL):
```
https://your-app.onrender.com/api/data?password=admin123
```

This will show:
- **leaderboard**: Top players by score
- **allSessions**: All game sessions with details
- **totalPlayers**: Total number of players
- **gamesCompleted**: Games completed today

## Database Schema

### `players` table:
- `id` - Unique player ID
- `name` - Player name
- `email` - Player email
- `score` - Best score achieved
- `vaults_opened` - Maximum vaults completed
- `win_status` - Did they ever win?
- `created_at` - When first played
- `updated_at` - Last game played

### `game_sessions` table:
- `id` - Unique session ID
- `player_id` - References player
- `name` - Player name
- `email` - Player email
- `score` - Score for this session
- `vaults_opened` - Vaults completed in this session
- `win_status` - Won this game?
- `game_started_at` - Start time
- `game_completed_at` - End time
- `duration_seconds` - How long the game lasted

## Automatic Data Recording

The system automatically:
1. ✅ Creates a new session when player starts game
2. ✅ Records score, vaults, and win/loss when game completes
3. ✅ Updates player's best score if they beat it
4. ✅ Tracks all games in `game_sessions` table
5. ✅ Works in real-time with Socket.io

## Troubleshooting

### Database shows "disconnected"
- Check if `DATABASE_URL` environment variable is set correctly
- Make sure the database is in "Available" status on Render
- Check web service logs for any database errors

### Data not being recorded
- Check web service logs: Click your service → "Logs" tab
- Look for "✅ Game session created in DB" messages
- If you see errors, verify DATABASE_URL is correct

### Can't connect to database
- Make sure you're using the **Internal Database URL** for the web service
- External connections require whitelisting your IP (in database settings)

## Cost

- **Free Tier**: 
  - 90 days free PostgreSQL database
  - 256 MB RAM, 1 GB storage
  - Good for thousands of game sessions
  
- **Paid Tier** ($7/month):
  - Persistent beyond 90 days
  - 256 MB RAM, 10 GB storage
  - Automated backups

## Need Help?

Check the logs:
```bash
# In Render Dashboard → Your Web Service → Logs
```

Look for messages like:
- `✅ Database tables initialized successfully`
- `✅ Game session created in DB`
- `✅ Game completed in DB`

If you see these, everything is working! 🎉
