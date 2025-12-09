// ========================================
// VAULT BREAKER - MULTIPLAYER SERVER
// Supports 1000+ concurrent players
// ========================================

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const OpenAI = require('openai');

// Initialize OpenAI
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI API configured');
} else {
    console.log('⚠️ OpenAI API not configured. Using fallback predictions.');
}

const app = express();
const server = http.createServer(app);

// Configure Socket.io for high concurrency
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // Optimizations for 1000+ players
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    perMessageDeflate: {
        threshold: 1024,
        zlibDeflateOptions: { chunkSize: 16 * 1024 },
        zlibInflateOptions: { chunkSize: 16 * 1024 }
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Health check API endpoint (for monitoring and deployment platforms)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activePlayers: activePlayers ? activePlayers.size : 0,
        totalPlayers: totalPlayersEver || 0,
        gamesCompleted: gamesCompletedToday || 0,
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        }
    });
});

// API endpoint to get all recorded data (for verification)
app.get('/api/data', (req, res) => {
    const password = req.query.password;
    if (password !== 'admin123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.json({
        leaderboard: leaderboard,
        totalPlayers: totalPlayersEver,
        gamesCompleted: gamesCompletedToday,
        activePlayers: Array.from(activePlayers.values()),
        serverStartTime: new Date().toISOString()
    });
});

// API endpoint to download CSV files
app.get('/api/download/:file', (req, res) => {
    const password = req.query.password;
    if (password !== 'admin123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const fileName = req.params.file;
    if (fileName === 'players') {
        res.download(path.join(__dirname, 'players_data.csv'));
    } else if (fileName === 'games') {
        res.download(path.join(__dirname, 'games_data.csv'));
    } else if (fileName === 'leaderboard') {
        res.download(path.join(__dirname, 'leaderboard_data.json'));
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// ========================================
// GAME STATE MANAGEMENT
// ========================================

// Active players (in-game)
const activePlayers = new Map();

// Admin connections
const adminSockets = new Set();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Leaderboard (top 100 for display, full list for ranking)
let leaderboard = [];
const MAX_LEADERBOARD_SIZE = 1000;
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard_data.json');

// Stats
let totalPlayersEver = 0;
let gamesCompletedToday = 0;

// ========================================
// EMAIL CONFIGURATION
// ========================================

// Create email transporter
let emailTransporter = null;

function initEmailTransporter() {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        emailTransporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        
        // Verify connection
        emailTransporter.verify((error, success) => {
            if (error) {
                console.log('❌ Email configuration error:', error.message);
                emailTransporter = null;
            } else {
                console.log('✅ Email server is ready to send messages');
            }
        });
    } else {
        console.log('⚠️ Email not configured. Add EMAIL_USER and EMAIL_PASS to .env file');
    }
}

// Initialize email on startup
initEmailTransporter();

// Generate HTML email template
function generateScoreEmail(player, rank, totalPlayers) {
    const statusEmoji = player.won ? '🏆' : '💪';
    const statusText = player.won ? 'VICTORY!' : 'Good Try!';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #e0e0e0; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2f, #0f0f1f); border: 2px solid #1c46ff; border-radius: 20px; padding: 30px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 28px; color: #00ff88; text-shadow: 0 0 10px #00ff88; margin: 0; }
            .subtitle { color: #00ffff; font-size: 14px; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .stat-box { background: rgba(28, 70, 255, 0.1); border: 1px solid #1c46ff; border-radius: 10px; padding: 15px; text-align: center; }
            .stat-value { font-size: 32px; font-weight: bold; color: #00ff88; }
            .stat-label { font-size: 12px; color: #00ffff; text-transform: uppercase; }
            .rank-box { background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1)); border: 2px solid gold; border-radius: 15px; padding: 20px; text-align: center; margin: 20px 0; }
            .rank-value { font-size: 48px; font-weight: bold; color: gold; }
            .rank-label { color: #ffd700; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #1c46ff; }
            .footer p { color: #888; font-size: 12px; }
            .status { font-size: 24px; color: ${player.won ? '#00ff88' : '#ffaa00'}; text-align: center; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 class="title">🔐 VAULT BREAKER</h1>
                <p class="subtitle">Your Game Results</p>
            </div>
            
            <p style="text-align: center; font-size: 18px;">Hello, <strong style="color: #00ffff;">${player.name}</strong>!</p>
            
            <div class="status">${statusEmoji} ${statusText}</div>
            
            <div class="rank-box">
                <div class="rank-label">YOUR RANK</div>
                <div class="rank-value">#${rank}</div>
                <div class="rank-label">out of ${totalPlayers} players</div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-value">${player.score}</div>
                    <div class="stat-label">Total Score</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${player.vaults || 0}/5</div>
                    <div class="stat-label">Vaults Opened</div>
                </div>
            </div>
            
            <p style="text-align: center; color: #888;">Played on: ${player.date || new Date().toLocaleString()}</p>
            
            <div class="footer">
                <p>Thank you for playing Vault Breaker!</p>
                <p>🎮 Challenge your friends and beat your high score!</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// Send email to a single player
async function sendScoreEmail(player, rank, totalPlayers) {
    if (!emailTransporter) {
        return { success: false, error: 'Email not configured' };
    }
    
    if (!player.email || player.email === '-') {
        return { success: false, error: 'No email address' };
    }
    
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'Vault Breaker'}" <${process.env.EMAIL_USER}>`,
            to: player.email,
            subject: `🔐 Vault Breaker - Your Score: ${player.score} | Rank #${rank}`,
            html: generateScoreEmail(player, rank, totalPlayers)
        };
        
        await emailTransporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Email sending state
let emailSendingInProgress = false;
let emailProgress = {
    total: 0,
    sent: 0,
    failed: 0,
    remaining: 0,
    failedPlayers: [], // Players who failed to receive email
    currentPlayer: '',
    startTime: null,
    isRunning: false
};

const EMAIL_PROGRESS_FILE = path.join(__dirname, 'email_progress.json');

// Save email progress to file
function saveEmailProgress() {
    try {
        fs.writeFileSync(EMAIL_PROGRESS_FILE, JSON.stringify(emailProgress, null, 2));
    } catch (err) {
        console.error('Error saving email progress:', err);
    }
}

// Load email progress from file
function loadEmailProgress() {
    try {
        if (fs.existsSync(EMAIL_PROGRESS_FILE)) {
            const data = fs.readFileSync(EMAIL_PROGRESS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading email progress:', err);
    }
    return null;
}

// Send email with retry logic
async function sendEmailWithRetry(player, rank, totalPlayers, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const result = await sendScoreEmail(player, rank, totalPlayers);
        
        if (result.success) {
            return { success: true, attempts: attempt };
        }
        
        // If rate limited, wait longer before retry
        if (result.error && result.error.includes('rate')) {
            console.log(`Rate limited for ${player.name}, waiting 30s before retry ${attempt}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, 30000));
        } else if (attempt < maxRetries) {
            // Wait 5 seconds before retry
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    return { success: false, error: 'Max retries exceeded' };
}

// Send emails to all players with progress tracking
async function sendEmailsToAllPlayers(socket, startFromIndex = 0) {
    if (!emailTransporter) {
        return { success: false, sent: 0, failed: 0, error: 'Email not configured' };
    }
    
    if (emailSendingInProgress) {
        return { success: false, sent: 0, failed: 0, error: 'Email sending already in progress' };
    }
    
    emailSendingInProgress = true;
    const totalPlayers = leaderboard.length;
    
    // Initialize progress
    emailProgress = {
        total: totalPlayers,
        sent: 0,
        failed: 0,
        remaining: totalPlayers - startFromIndex,
        failedPlayers: [],
        currentPlayer: '',
        startTime: Date.now(),
        isRunning: true
    };
    
    // Send initial progress
    broadcastToAdmins('admin:emailProgress', emailProgress);
    
    for (let i = startFromIndex; i < leaderboard.length; i++) {
        const player = leaderboard[i];
        const rank = i + 1;
        
        // Skip if no valid email
        if (!player.email || player.email === '-') {
            emailProgress.failed++;
            emailProgress.remaining--;
            continue;
        }
        
        emailProgress.currentPlayer = player.name;
        broadcastToAdmins('admin:emailProgress', emailProgress);
        
        console.log(`Sending email ${i + 1}/${totalPlayers} to ${player.name} (${player.email})`);
        
        const result = await sendEmailWithRetry(player, rank, totalPlayers);
        
        if (result.success) {
            emailProgress.sent++;
            console.log(`✅ Email sent to ${player.name}`);
        } else {
            emailProgress.failed++;
            emailProgress.failedPlayers.push({
                index: i,
                name: player.name,
                email: player.email,
                rank: rank,
                error: result.error
            });
            console.log(`❌ Failed to send email to ${player.name}: ${result.error}`);
        }
        
        emailProgress.remaining = totalPlayers - i - 1;
        
        // Save progress every 10 emails
        if ((i + 1) % 10 === 0) {
            saveEmailProgress();
        }
        
        // Broadcast progress update
        broadcastToAdmins('admin:emailProgress', emailProgress);
        
        // Gmail rate limit: ~20 emails per minute, so wait 3 seconds between emails
        // This is conservative to avoid hitting limits
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    emailProgress.isRunning = false;
    emailProgress.currentPlayer = '';
    emailSendingInProgress = false;
    
    // Save final progress
    saveEmailProgress();
    
    // Final broadcast
    broadcastToAdmins('admin:emailProgress', emailProgress);
    
    return { 
        success: true, 
        sent: emailProgress.sent, 
        failed: emailProgress.failed, 
        total: totalPlayers,
        failedPlayers: emailProgress.failedPlayers
    };
}

// Retry failed emails only
async function retryFailedEmails(socket) {
    if (!emailTransporter) {
        return { success: false, error: 'Email not configured' };
    }
    
    if (emailSendingInProgress) {
        return { success: false, error: 'Email sending already in progress' };
    }
    
    const savedProgress = loadEmailProgress();
    if (!savedProgress || savedProgress.failedPlayers.length === 0) {
        return { success: false, error: 'No failed emails to retry' };
    }
    
    emailSendingInProgress = true;
    const failedPlayers = savedProgress.failedPlayers;
    const totalPlayers = leaderboard.length;
    
    emailProgress = {
        total: failedPlayers.length,
        sent: 0,
        failed: 0,
        remaining: failedPlayers.length,
        failedPlayers: [],
        currentPlayer: '',
        startTime: Date.now(),
        isRunning: true
    };
    
    broadcastToAdmins('admin:emailProgress', emailProgress);
    
    for (let i = 0; i < failedPlayers.length; i++) {
        const failedInfo = failedPlayers[i];
        const player = leaderboard[failedInfo.index];
        
        if (!player) continue;
        
        emailProgress.currentPlayer = player.name;
        broadcastToAdmins('admin:emailProgress', emailProgress);
        
        console.log(`Retrying email ${i + 1}/${failedPlayers.length} to ${player.name}`);
        
        const result = await sendEmailWithRetry(player, failedInfo.rank, totalPlayers);
        
        if (result.success) {
            emailProgress.sent++;
            console.log(`✅ Retry successful for ${player.name}`);
        } else {
            emailProgress.failed++;
            emailProgress.failedPlayers.push(failedInfo);
            console.log(`❌ Retry failed for ${player.name}`);
        }
        
        emailProgress.remaining--;
        broadcastToAdmins('admin:emailProgress', emailProgress);
        
        // Wait 3 seconds between emails
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    emailProgress.isRunning = false;
    emailProgress.currentPlayer = '';
    emailSendingInProgress = false;
    
    saveEmailProgress();
    broadcastToAdmins('admin:emailProgress', emailProgress);
    
    return {
        success: true,
        sent: emailProgress.sent,
        failed: emailProgress.failed,
        failedPlayers: emailProgress.failedPlayers
    };
}

// ========================================
// OPENAI FACE PREDICTION
// ========================================

// Generate prediction using OpenAI
async function generatePrediction(playerName) {
    if (!openai) {
        return getFallbackPrediction(playerName);
    }

    try {
        const prompt = `You are a mystical fortune teller for a heist game called "Vault Breaker". A player named "${playerName}" has just had their face scanned. Generate a fun, positive, and encouraging prediction for them.

Please respond in this exact JSON format:
{
    "goodThings": [
        "First positive trait about the player (be creative and encouraging)",
        "Second positive trait about the player (different from first)"
    ],
    "fortune": "A short mystical prediction about their upcoming heist game (1-2 sentences, be positive and fun)",
    "wish": "A good luck wish for the game (1 sentence, include their name)"
}

Make it fun, mystical, and game-themed. Use words like "vault", "heist", "codes", "treasure", etc.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 300,
            temperature: 0.8
        });

        const content = response.choices[0].message.content;
        
        // Parse JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const prediction = JSON.parse(jsonMatch[0]);
            return prediction;
        }
        
        return getFallbackPrediction(playerName);
    } catch (error) {
        console.error('OpenAI error:', error.message);
        return getFallbackPrediction(playerName);
    }
}

// Fallback predictions when OpenAI is not available
function getFallbackPrediction(playerName) {
    const goodThings = [
        ["Your eyes reveal incredible focus and determination", "You possess the quick reflexes of a master vault breaker"],
        ["Your calm demeanor hides a brilliant strategic mind", "The vaults sense your natural code-breaking abilities"],
        ["Your confidence will be your greatest weapon", "You have the patience of a legendary heist master"],
        ["Your intuition is exceptionally sharp today", "The energy around you suggests great success"],
        ["Your determination shines through clearly", "You carry the spirit of a champion vault breaker"]
    ];

    const fortunes = [
        "The ancient vaults whisper of your impending success. Trust your instincts and the codes shall reveal themselves.",
        "A streak of incredible luck awaits you in the vaults. The treasures are ready to be claimed!",
        "The stars align in your favor today. Multiple vaults shall fall before your brilliance.",
        "Your journey through the vaults will be legendary. Fortune smiles upon the bold!",
        "The path to victory is clear before you. The vaults recognize a worthy challenger."
    ];

    const wishes = [
        `May the codes bend to your will, Agent ${playerName}! 🍀`,
        `Good fortune and swift fingers to you, ${playerName}! ⭐`,
        `May every vault door open at your command, ${playerName}! 🔐`,
        `The treasure awaits your skilled hands, Agent ${playerName}! 💎`,
        `May luck be your constant companion, ${playerName}! 🌟`
    ];

    const randomIndex = Math.floor(Math.random() * goodThings.length);
    
    return {
        goodThings: goodThings[randomIndex],
        fortune: fortunes[Math.floor(Math.random() * fortunes.length)],
        wish: wishes[Math.floor(Math.random() * wishes.length)]
    };
}

// ========================================
// PERSISTENT LEADERBOARD STORAGE
// ========================================

// Load leaderboard from file on server start
function loadLeaderboard() {
    try {
        if (fs.existsSync(LEADERBOARD_FILE)) {
            const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
            const savedData = JSON.parse(data);
            leaderboard = savedData.leaderboard || [];
            totalPlayersEver = savedData.totalPlayersEver || 0;
            console.log(`Loaded ${leaderboard.length} players from leaderboard file`);
        } else {
            console.log('No existing leaderboard file, starting fresh');
        }
    } catch (err) {
        console.error('Error loading leaderboard:', err);
        leaderboard = [];
    }
}

// Save leaderboard to file
function saveLeaderboard() {
    try {
        const data = {
            leaderboard: leaderboard,
            totalPlayersEver: totalPlayersEver,
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error saving leaderboard:', err);
    }
}

// Load leaderboard on server start
loadLeaderboard();

// ========================================
// CSV FILE STORAGE
// ========================================

const PLAYERS_CSV_FILE = path.join(__dirname, 'players_data.csv');
const GAMES_CSV_FILE = path.join(__dirname, 'games_data.csv');

// Initialize CSV files with headers if they don't exist
function initCSVFiles() {
    // Players CSV - stores login data
    if (!fs.existsSync(PLAYERS_CSV_FILE)) {
        const playersHeader = 'Timestamp,SocketID,Codename,Email,IP\n';
        fs.writeFileSync(PLAYERS_CSV_FILE, playersHeader);
        console.log('Created players_data.csv');
    }
    
    // Games CSV - stores game completion data
    if (!fs.existsSync(GAMES_CSV_FILE)) {
        const gamesHeader = 'Timestamp,SocketID,Codename,Email,Score,VaultsCompleted,Won,TimeTaken\n';
        fs.writeFileSync(GAMES_CSV_FILE, gamesHeader);
        console.log('Created games_data.csv');
    }
}

// Save player login data to CSV
function savePlayerLogin(socketId, codename, email, ip) {
    const timestamp = new Date().toISOString();
    // Escape commas and quotes in fields
    const safeName = `"${(codename || '').replace(/"/g, '""')}"`;
    const safeEmail = `"${(email || '').replace(/"/g, '""')}"`;
    const safeIP = `"${(ip || '').replace(/"/g, '""')}"`;
    
    const row = `${timestamp},${socketId},${safeName},${safeEmail},${safeIP}\n`;
    
    fs.appendFile(PLAYERS_CSV_FILE, row, (err) => {
        if (err) console.error('Error saving player login:', err);
        else console.log(`Player login saved: ${codename} (${email})`);
    });
}

// Save game completion data to CSV
function saveGameCompletion(socketId, codename, email, score, vaultsCompleted, won, timeTaken) {
    const timestamp = new Date().toISOString();
    const safeName = `"${(codename || '').replace(/"/g, '""')}"`;
    const safeEmail = `"${(email || '').replace(/"/g, '""')}"`;
    
    const row = `${timestamp},${socketId},${safeName},${safeEmail},${score},${vaultsCompleted},${won},${timeTaken}\n`;
    
    fs.appendFile(GAMES_CSV_FILE, row, (err) => {
        if (err) console.error('Error saving game completion:', err);
        else console.log(`Game saved: ${codename} - Score: ${score}`);
    });
}

// Initialize CSV files on server start
initCSVFiles();

// ========================================
// LEADERBOARD FUNCTIONS
// ========================================

function addToLeaderboard(playerData) {
    // Add new entry with all details
    leaderboard.push({
        id: playerData.id,
        name: playerData.name,
        email: playerData.email || '',
        score: playerData.score,
        vaults: playerData.vaults,
        won: playerData.won || false,
        timestamp: Date.now(),
        date: new Date().toLocaleString()
    });

    // Sort by score (descending)
    leaderboard.sort((a, b) => b.score - a.score);

    // Keep only top entries
    if (leaderboard.length > MAX_LEADERBOARD_SIZE) {
        leaderboard = leaderboard.slice(0, MAX_LEADERBOARD_SIZE);
    }

    gamesCompletedToday++;
    
    // Save to file for persistence
    saveLeaderboard();
}

function getPlayerRank(score) {
    // Binary search for efficiency with large leaderboards
    let rank = 1;
    for (const entry of leaderboard) {
        if (entry.score > score) rank++;
        else break;
    }
    return rank;
}

function getTopLeaderboard(limit = 50) {
    return leaderboard.slice(0, limit);
}

function getLeaderboardAroundPlayer(playerId, range = 5) {
    const playerIndex = leaderboard.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return [];
    
    const start = Math.max(0, playerIndex - range);
    const end = Math.min(leaderboard.length, playerIndex + range + 1);
    
    return leaderboard.slice(start, end).map((entry, idx) => ({
        ...entry,
        rank: start + idx + 1
    }));
}

// ========================================
// REAL-TIME LEADERBOARD BROADCAST
// ========================================

// Throttled broadcast to prevent overload with many players
let broadcastScheduled = false;

function scheduleBroadcast() {
    if (broadcastScheduled) return;
    
    broadcastScheduled = true;
    setTimeout(() => {
        broadcastLeaderboard();
        broadcastScheduled = false;
    }, 100); // Broadcast at most every 100ms
}

function broadcastLeaderboard() {
    const topPlayers = getTopLeaderboard(50);
    const activePlayersList = Array.from(activePlayers.values())
        .map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            vaults: p.vaults,
            isPlaying: true
        }))
        .sort((a, b) => b.score - a.score);

    io.emit('leaderboard:update', {
        top: topPlayers,
        activePlayers: activePlayersList.slice(0, 100),
        totalActive: activePlayers.size,
        totalPlayers: totalPlayersEver,
        gamesCompleted: gamesCompletedToday
    });
    
    // Also broadcast to admin dashboards
    broadcastToAdmins('admin:leaderboard', getTopLeaderboard(100));
    broadcastToAdmins('admin:players', Array.from(activePlayers.values()).map(p => ({
        id: p.id,
        name: p.name,
        email: p.email || '',
        score: p.score,
        vault: p.vaults,
        playing: p.isPlaying,
        startTime: p.startTime,
        connected: true
    })));
    
    // Send stats to admins
    const avgScore = leaderboard.length > 0
        ? Math.round(leaderboard.reduce((sum, p) => sum + p.score, 0) / leaderboard.length)
        : 0;
    broadcastToAdmins('admin:stats', {
        totalPlayers: totalPlayersEver,
        activePlayers: activePlayers.size,
        completedGames: gamesCompletedToday,
        avgScore: avgScore
    });
}

// Periodic full broadcast for sync
setInterval(() => {
    broadcastLeaderboard();
}, 2000);

// ========================================
// SOCKET.IO CONNECTION HANDLING
// ========================================

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    totalPlayersEver++;

    // Send current leaderboard on connect
    socket.emit('leaderboard:init', {
        top: getTopLeaderboard(50),
        totalActive: activePlayers.size,
        totalPlayers: totalPlayersEver
    });

    // Face scan prediction request
    socket.on('prediction:request', async (data) => {
        console.log(`Prediction requested for: ${data.name}`);
        
        try {
            const prediction = await generatePrediction(data.name);
            socket.emit('prediction:result', prediction);
        } catch (error) {
            console.error('Prediction error:', error);
            socket.emit('prediction:error', { message: 'Failed to generate prediction. Using fallback.' });
        }
    });

    // Player starts game
    socket.on('game:start', (data) => {
        const playerData = {
            id: socket.id,
            name: data.name || `Agent_${socket.id.slice(0, 4)}`,
            email: data.email || '',
            score: 0,
            vaults: 0,
            currentVault: 0,
            startTime: Date.now(),
            isPlaying: true
        };

        activePlayers.set(socket.id, playerData);
        
        // Save player login to CSV
        const clientIP = socket.handshake.address || socket.request.connection.remoteAddress || 'unknown';
        savePlayerLogin(socket.id, playerData.name, playerData.email, clientIP);
        
        // Broadcast updated player count
        io.emit('players:count', { 
            active: activePlayers.size,
            total: totalPlayersEver 
        });

        // Notify admins
        broadcastToAdmins('player:joined', { name: playerData.name, id: socket.id });

        // IMMEDIATE broadcast to update admin dashboard with new player
        broadcastLeaderboard();
        
        console.log(`Game started: ${playerData.name} (Active: ${activePlayers.size})`);
    });

    // Player updates score (vault cracked)
    socket.on('game:score', (data) => {
        const player = activePlayers.get(socket.id);
        if (player) {
            player.score = data.score;
            player.vaults = data.vaults;
            player.currentVault = data.currentVault;

            // Immediate broadcast for score updates
            scheduleBroadcast();
        }
    });

    // Player completes game
    socket.on('game:complete', (data) => {
        let player = activePlayers.get(socket.id);
        
        // If player not in activePlayers, create them now (handles case where game:start was missed)
        if (!player) {
            console.log(`Player not found in activePlayers, creating from game:complete data: ${data.name}`);
            player = {
                id: socket.id,
                name: data.name || `Agent_${socket.id.slice(0, 4)}`,
                email: data.email || '',
                score: data.score || 0,
                vaults: data.vaultsCompleted || data.vaults || 0,
                startTime: Date.now() - 180000, // Assume 3 min game
                isPlaying: false,
                won: data.won || false
            };
            // Don't add to activePlayers since game is over
            totalPlayersEver++;
        } else {
            player.score = data.score;
            player.vaults = data.vaultsCompleted || data.vaults;
            player.won = data.won || false;
            player.isPlaying = false;
        }

        // Calculate time taken
        const timeTaken = Math.round((Date.now() - player.startTime) / 1000);
        
        // Save game completion to CSV
        saveGameCompletion(
            socket.id,
            player.name,
            player.email || data.email || '',
            player.score,
            player.vaults,
            data.won ? 'Yes' : 'No',
            timeTaken
        );

        // Add to permanent leaderboard with all details
        addToLeaderboard(player);

        // Get player's rank
        const rank = getPlayerRank(player.score);

        // Send final results to player
        socket.emit('game:result', {
            rank: rank,
            totalPlayers: leaderboard.length,
            top: getTopLeaderboard(10),
            nearbyPlayers: getLeaderboardAroundPlayer(socket.id)
        });

        // Remove from active players
        activePlayers.delete(socket.id);

        // IMMEDIATE broadcast - force update without throttling
        // This ensures first game scores show up immediately
        broadcastLeaderboard();
        
        console.log(`Game completed: ${player.name} - Score: ${player.score}, Rank: ${rank}, Leaderboard size: ${leaderboard.length}`);
    });

    // Player disconnects
    socket.on('disconnect', () => {
        const player = activePlayers.get(socket.id);
        if (player) {
            // Calculate time played
            const timePlayed = Math.round((Date.now() - player.startTime) / 1000);
            
            // Save to CSV even if they disconnected mid-game
            if (player.score > 0 || player.vaults > 0) {
                // Save game data to CSV (even partial games)
                saveGameCompletion(
                    socket.id,
                    player.name,
                    player.email || '',
                    player.score,
                    player.vaults || 0,
                    'Disconnected',
                    timePlayed
                );
                
                // Add to leaderboard if they had points
                addToLeaderboard(player);
            }
            
            // Notify admins
            broadcastToAdmins('player:left', { name: player.name, id: socket.id });
            
            activePlayers.delete(socket.id);
            scheduleBroadcast();
        }
        
        io.emit('players:count', { 
            active: activePlayers.size,
            total: totalPlayersEver 
        });
        
        console.log(`Player disconnected: ${socket.id} (Active: ${activePlayers.size})`);
        
        // Remove admin on disconnect
        if (adminSockets.has(socket.id)) {
            adminSockets.delete(socket.id);
            console.log(`Admin disconnected: ${socket.id}`);
        }
    });

    // Request leaderboard refresh
    socket.on('leaderboard:request', () => {
        socket.emit('leaderboard:update', {
            top: getTopLeaderboard(50),
            activePlayers: Array.from(activePlayers.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, 100),
            totalActive: activePlayers.size,
            totalPlayers: totalPlayersEver,
            gamesCompleted: gamesCompletedToday
        });
    });

    // ========================================
    // ADMIN EVENTS
    // ========================================

    // Admin authentication
    socket.on('admin:authenticate', (data) => {
        if (data.password === ADMIN_PASSWORD) {
            adminSockets.add(socket.id);
            console.log(`Admin authenticated: ${socket.id}`);
            
            // Send initial data
            sendAdminStats(socket);
            sendAdminPlayers(socket);
            sendAdminLeaderboard(socket);
        }
    });

    // Admin requests stats
    socket.on('admin:getStats', () => {
        if (adminSockets.has(socket.id)) {
            sendAdminStats(socket);
        }
    });

    // Admin requests player list
    socket.on('admin:getPlayers', () => {
        if (adminSockets.has(socket.id)) {
            sendAdminPlayers(socket);
        }
    });

    // Admin requests leaderboard
    socket.on('admin:getLeaderboard', () => {
        if (adminSockets.has(socket.id)) {
            sendAdminLeaderboard(socket);
        }
    });

    // Admin kicks a player
    socket.on('admin:kickPlayer', (data) => {
        if (adminSockets.has(socket.id)) {
            const player = activePlayers.get(data.playerId);
            if (player) {
                io.to(data.playerId).emit('admin:kicked', { 
                    message: 'You have been removed from the game by the host' 
                });
                io.sockets.sockets.get(data.playerId)?.disconnect(true);
                activePlayers.delete(data.playerId);
                
                // Notify all admins
                adminSockets.forEach(adminId => {
                    io.to(adminId).emit('player:kicked', { name: player.name });
                });
                
                scheduleBroadcast();
                console.log(`Admin kicked player: ${player.name}`);
            }
        }
    });

    // Admin kicks all players
    socket.on('admin:kickAll', () => {
        if (adminSockets.has(socket.id)) {
            activePlayers.forEach((player, playerId) => {
                io.to(playerId).emit('admin:kicked', { 
                    message: 'Game session ended by host' 
                });
                io.sockets.sockets.get(playerId)?.disconnect(true);
            });
            activePlayers.clear();
            scheduleBroadcast();
            console.log(`Admin kicked all players`);
        }
    });

    // Admin clears leaderboard
    socket.on('admin:clearLeaderboard', () => {
        if (adminSockets.has(socket.id)) {
            leaderboard = [];
            gamesCompletedToday = 0;
            
            // Save empty leaderboard to file
            saveLeaderboard();
            
            scheduleBroadcast();
            sendAdminLeaderboard(socket);
            console.log(`Admin cleared leaderboard`);
        }
    });

    // Admin sends emails to all players
    socket.on('admin:sendEmails', async () => {
        if (adminSockets.has(socket.id)) {
            console.log('Admin requested to send emails to all players');
            
            if (leaderboard.length === 0) {
                socket.emit('admin:emailStatus', { 
                    success: false, 
                    message: 'No players in leaderboard to send emails to.' 
                });
                return;
            }

            if (emailSendingInProgress) {
                socket.emit('admin:emailStatus', { 
                    success: false, 
                    message: 'Email sending is already in progress. Please wait.' 
                });
                socket.emit('admin:emailProgress', emailProgress);
                return;
            }

            socket.emit('admin:emailStatus', { 
                success: true, 
                message: `Starting to send emails to ${leaderboard.length} players...` 
            });

            try {
                const results = await sendEmailsToAllPlayers(socket);
                socket.emit('admin:emailStatus', { 
                    success: true, 
                    message: `Email sending complete! ${results.sent} sent, ${results.failed} failed.`,
                    hasFailures: results.failed > 0
                });
            } catch (error) {
                console.error('Error sending emails:', error);
                socket.emit('admin:emailStatus', { 
                    success: false, 
                    message: `Failed to send emails: ${error.message}` 
                });
            }
        }
    });

    // Admin retries failed emails
    socket.on('admin:retryFailedEmails', async () => {
        if (adminSockets.has(socket.id)) {
            console.log('Admin requested to retry failed emails');
            
            if (emailSendingInProgress) {
                socket.emit('admin:emailStatus', { 
                    success: false, 
                    message: 'Email sending is already in progress. Please wait.' 
                });
                return;
            }

            try {
                const results = await retryFailedEmails(socket);
                
                if (!results.success) {
                    socket.emit('admin:emailStatus', { 
                        success: false, 
                        message: results.error 
                    });
                    return;
                }
                
                socket.emit('admin:emailStatus', { 
                    success: true, 
                    message: `Retry complete! ${results.sent} sent, ${results.failed} still failed.`,
                    hasFailures: results.failed > 0
                });
            } catch (error) {
                console.error('Error retrying emails:', error);
                socket.emit('admin:emailStatus', { 
                    success: false, 
                    message: `Failed to retry emails: ${error.message}` 
                });
            }
        }
    });

    // Admin gets email progress
    socket.on('admin:getEmailProgress', () => {
        if (adminSockets.has(socket.id)) {
            socket.emit('admin:emailProgress', emailProgress);
        }
    });

    // Admin stops email sending
    socket.on('admin:stopEmails', () => {
        if (adminSockets.has(socket.id)) {
            if (emailSendingInProgress) {
                emailSendingInProgress = false;
                emailProgress.isRunning = false;
                saveEmailProgress();
                socket.emit('admin:emailStatus', { 
                    success: true, 
                    message: `Email sending stopped. ${emailProgress.sent} sent, ${emailProgress.remaining} remaining.` 
                });
            }
        }
    });
});

// ========================================
// ADMIN HELPER FUNCTIONS
// ========================================

function sendAdminStats(socket) {
    const avgScore = leaderboard.length > 0
        ? Math.round(leaderboard.reduce((sum, p) => sum + p.score, 0) / leaderboard.length)
        : 0;

    socket.emit('admin:stats', {
        totalPlayers: totalPlayersEver,
        activePlayers: activePlayers.size,
        completedGames: gamesCompletedToday,
        avgScore: avgScore
    });
}

function sendAdminPlayers(socket) {
    const players = Array.from(activePlayers.values()).map(p => ({
        id: p.id,
        name: p.name,
        email: p.email || '',
        score: p.score,
        vault: p.vaults,
        playing: p.isPlaying,
        startTime: p.startTime,
        connected: true
    }));

    socket.emit('admin:players', players);
}

function sendAdminLeaderboard(socket) {
    socket.emit('admin:leaderboard', getTopLeaderboard(100));
}

// Broadcast to all admins
function broadcastToAdmins(event, data) {
    adminSockets.forEach(adminId => {
        io.to(adminId).emit(event, data);
    });
}

// ========================================
// SERVER STARTUP
// ========================================

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Get local IP address
function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

server.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🔐 VAULT BREAKER MULTIPLAYER SERVER 🔐                     ║
║                                                               ║
║   ✅ Server is running and accessible!                        ║
║                                                               ║
║   📱 FOR PHONES - Use this URL:                               ║
║   👉 http://${localIP}:${PORT}                                 ║
║                                                               ║
║   💻 Local: http://localhost:${PORT}                            ║
║                                                               ║
║   🔧 Admin Dashboard:                                         ║
║   👉 http://localhost:${PORT}/admin.html                        ║
║                                                               ║
║   🎮 Ready for 1000+ concurrent players!                      ║
║   📊 Active players: 0                                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

process.on('SIGTERM', () => {
    console.log('Server shutting down...');
    io.emit('server:shutdown', { message: 'Server is restarting...' });
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Reset daily stats at midnight
function resetDailyStats() {
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0) - now;
    
    setTimeout(() => {
        gamesCompletedToday = 0;
        console.log('Daily stats reset');
        resetDailyStats(); // Schedule next reset
    }, msUntilMidnight);
}

resetDailyStats();