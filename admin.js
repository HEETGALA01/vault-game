// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.socket = null;
        this.isLoggedIn = false;
        this.autoRefresh = true;
        this.refreshInterval = null;
        this.ADMIN_PASSWORD = 'admin123'; // Change this to your desired password
        
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // Login
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('admin-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // View Toggle
        document.getElementById('dashboard-view-btn').addEventListener('click', () => this.switchView('dashboard'));
        document.getElementById('fullscreen-view-btn').addEventListener('click', () => this.switchView('fullscreen'));
        document.getElementById('players-view-btn').addEventListener('click', () => this.switchView('players'));

        // Controls
        document.getElementById('kick-all-btn').addEventListener('click', () => this.kickAllPlayers());
        document.getElementById('refresh-btn').addEventListener('click', () => this.refreshData());
        document.getElementById('clear-leaderboard-btn').addEventListener('click', () => this.clearLeaderboard());
        document.getElementById('send-emails-btn').addEventListener('click', () => this.sendEmailsToPlayers());
        document.getElementById('retry-emails-btn').addEventListener('click', () => this.retryFailedEmails());
        document.getElementById('stop-emails-btn').addEventListener('click', () => this.stopEmailSending());
        document.getElementById('clear-log-btn').addEventListener('click', () => this.clearLog());

        // Auto-refresh toggle
        document.getElementById('auto-refresh').addEventListener('change', (e) => {
            this.autoRefresh = e.target.checked;
            if (this.autoRefresh) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });
    }

    switchView(view) {
        const dashboardView = document.getElementById('dashboard-view');
        const fullscreenView = document.getElementById('fullscreen-view');
        const playersView = document.getElementById('players-view');
        const dashboardBtn = document.getElementById('dashboard-view-btn');
        const fullscreenBtn = document.getElementById('fullscreen-view-btn');
        const playersBtn = document.getElementById('players-view-btn');

        // Hide all views
        dashboardView.classList.add('hidden');
        fullscreenView.classList.add('hidden');
        playersView.classList.add('hidden');
        
        // Remove active from all buttons
        dashboardBtn.classList.remove('active');
        fullscreenBtn.classList.remove('active');
        playersBtn.classList.remove('active');

        // Show selected view
        if (view === 'dashboard') {
            dashboardView.classList.remove('hidden');
            dashboardView.classList.add('active');
            dashboardBtn.classList.add('active');
        } else if (view === 'fullscreen') {
            fullscreenView.classList.remove('hidden');
            fullscreenView.classList.add('active');
            fullscreenBtn.classList.add('active');
        } else if (view === 'players') {
            playersView.classList.remove('hidden');
            playersView.classList.add('active');
            playersBtn.classList.add('active');
        }
    }

    login() {
        const password = document.getElementById('admin-password').value;
        const errorMsg = document.getElementById('login-error');

        if (password === this.ADMIN_PASSWORD) {
            this.isLoggedIn = true;
            document.getElementById('login-screen').classList.remove('active');
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('dashboard-screen').classList.remove('hidden');
            document.getElementById('dashboard-screen').classList.add('active');
            
            this.initSocket();
            this.addLog('system', 'Admin logged in successfully');
            this.startAutoRefresh();
        } else {
            errorMsg.classList.remove('hidden');
            document.getElementById('admin-password').value = '';
            setTimeout(() => errorMsg.classList.add('hidden'), 3000);
        }
    }

    logout() {
        this.isLoggedIn = false;
        this.stopAutoRefresh();
        
        if (this.socket) {
            this.socket.disconnect();
        }

        document.getElementById('dashboard-screen').classList.remove('active');
        document.getElementById('dashboard-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('admin-password').value = '';
    }

    initSocket() {
        // Server URL configuration
        // When hosted on Render/same server: use current host
        // When hosted separately (Netlify): use PRODUCTION_SERVER_URL
        const PRODUCTION_SERVER_URL = 'https://vault-game-1.onrender.com'; // Render server URL
        
        let serverUrl;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // Local development
            serverUrl = `http://${window.location.hostname}:3000`;
        } else if (window.location.hostname.includes('onrender.com')) {
            // Hosted on Render - use same origin
            serverUrl = window.location.origin;
        } else if (PRODUCTION_SERVER_URL) {
            // Hosted elsewhere (Netlify) - use production server
            serverUrl = PRODUCTION_SERVER_URL;
        } else {
            this.addLog('error', 'No server configured! Set PRODUCTION_SERVER_URL in admin.js');
            return;
        }
        
        console.log('Admin connecting to server:', serverUrl);

        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            timeout: 10000
        });

        this.socket.on('connect', () => {
            console.log('Admin connected to server');
            this.addLog('system', 'Connected to game server');
            this.socket.emit('admin:authenticate', { password: this.ADMIN_PASSWORD });
        });

        this.socket.on('disconnect', () => {
            this.addLog('system', 'Disconnected from game server');
        });

        // Admin-specific events
        this.socket.on('admin:stats', (stats) => {
            this.updateStats(stats);
        });

        this.socket.on('admin:players', (players) => {
            this.updatePlayersList(players);
        });

        this.socket.on('admin:leaderboard', (leaderboard) => {
            this.updateLeaderboard(leaderboard);
        });

        // Player events
        this.socket.on('player:joined', (data) => {
            this.addLog('player-join', `Player "${data.name}" joined the game`);
        });

        this.socket.on('player:left', (data) => {
            this.addLog('player-leave', `Player "${data.name}" left the game`);
        });

        this.socket.on('game:complete', (data) => {
            this.addLog('game-complete', `${data.name} completed game with ${data.score} points (${data.vaultsCompleted}/5 vaults)`);
        });

        this.socket.on('player:kicked', (data) => {
            this.addLog('system', `Player "${data.name}" was kicked`);
        });

        // Email status response
        this.socket.on('admin:emailStatus', (data) => {
            this.showEmailStatus(data.success, data.message);
            if (data.success) {
                this.addLog('system', data.message);
            } else {
                this.addLog('error', data.message);
            }
            
            // Show/hide retry button based on failures
            const retryBtn = document.getElementById('retry-emails-btn');
            if (data.hasFailures) {
                retryBtn.classList.remove('hidden');
            }
            
            // Re-enable the send button if not in progress
            if (!data.message.includes('in progress') && !data.message.includes('Starting')) {
                const btn = document.getElementById('send-emails-btn');
                btn.disabled = false;
                btn.textContent = '📧 SEND EMAILS';
                document.getElementById('stop-emails-btn').classList.add('hidden');
            }
        });

        // Email progress updates
        this.socket.on('admin:emailProgress', (progress) => {
            this.updateEmailProgress(progress);
        });

        // Request initial data
        this.requestData();
    }

    requestData() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('admin:getStats');
            this.socket.emit('admin:getPlayers');
            this.socket.emit('admin:getLeaderboard');
            this.socket.emit('admin:getEmailProgress');
        }
    }

    refreshData() {
        this.requestData();
        this.addLog('system', 'Data refreshed');
    }

    startAutoRefresh() {
        if (this.refreshInterval) return;
        
        this.refreshInterval = setInterval(() => {
            if (this.isLoggedIn && this.socket && this.socket.connected) {
                this.requestData();
            }
        }, 2000); // Refresh every 2 seconds
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    updateStats(stats) {
        document.getElementById('total-players').textContent = stats.totalPlayers || 0;
        document.getElementById('active-players').textContent = stats.activePlayers || 0;
        document.getElementById('completed-games').textContent = stats.completedGames || 0;
        document.getElementById('avg-score').textContent = stats.avgScore || 0;
    }

    updatePlayersList(players) {
        const container = document.getElementById('live-players-list');
        const fullscreenContainer = document.getElementById('fullscreen-players-list');
        const fullscreenActiveCount = document.getElementById('fullscreen-active-count');
        
        // Update active player count in fullscreen view
        if (fullscreenActiveCount) {
            fullscreenActiveCount.textContent = players ? players.length : 0;
        }
        
        if (!players || players.length === 0) {
            container.innerHTML = '<div class="empty-state">No active players</div>';
            fullscreenContainer.innerHTML = '<div class="empty-state">No active players...</div>';
            return;
        }

        // Update regular dashboard players list
        container.innerHTML = '';
        players.forEach(player => {
            const entry = document.createElement('div');
            entry.className = 'player-entry';
            entry.innerHTML = `
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-details">
                        <span>Score: ${player.score || 0}</span>
                        <span>Vault: ${player.vault || 0}/5</span>
                        <span class="player-status">
                            <span class="status-dot"></span>
                            ${player.playing ? 'Playing' : 'Idle'}
                        </span>
                    </div>
                </div>
                <button class="kick-btn" onclick="admin.kickPlayer('${player.id}', '${player.name}')">KICK</button>
            `;
            container.appendChild(entry);
        });

        // Update fullscreen players view
        fullscreenContainer.innerHTML = '';
        players.forEach(player => {
            const timeElapsed = player.startTime ? Math.floor((Date.now() - player.startTime) / 1000) : 0;
            const minutes = Math.floor(timeElapsed / 60);
            const seconds = timeElapsed % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            const card = document.createElement('div');
            card.className = 'fullscreen-player-card';
            card.innerHTML = `
                <div class="player-card-header">
                    <div class="player-card-name">${player.name}</div>
                    <div class="player-card-status">${player.playing ? '🎮 PLAYING' : '⏸️ IDLE'}</div>
                </div>
                <div class="player-card-body">
                    <div class="player-stat-item">
                        <div class="player-stat-label">Score</div>
                        <div class="player-stat-value score">${player.score || 0}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-label">Vaults</div>
                        <div class="player-stat-value vaults">${player.vault || 0}/5</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-label">Time</div>
                        <div class="player-stat-value time">${timeStr}</div>
                    </div>
                    <div class="player-stat-item">
                        <div class="player-stat-label">Status</div>
                        <div class="player-stat-value">${player.connected ? '✅' : '❌'}</div>
                    </div>
                </div>
            `;
            fullscreenContainer.appendChild(card);
        });
    }

    updateLeaderboard(leaderboard) {
        const container = document.getElementById('admin-leaderboard-list');
        const fullscreenContainer = document.getElementById('fullscreen-leaderboard-list');
        const fullscreenPlayerCount = document.getElementById('fullscreen-player-count');
        
        // Update player count in fullscreen view
        if (fullscreenPlayerCount) {
            fullscreenPlayerCount.textContent = leaderboard ? leaderboard.length : 0;
        }
        
        if (!leaderboard || leaderboard.length === 0) {
            container.innerHTML = '<div class="empty-state">No players in leaderboard yet</div>';
            fullscreenContainer.innerHTML = '<div class="empty-state">No players yet...</div>';
            return;
        }

        // Update regular dashboard leaderboard with all details
        container.innerHTML = '';
        leaderboard.forEach((player, index) => {
            const entry = document.createElement('div');
            entry.className = `leaderboard-entry rank-${index + 1}`;
            const statusIcon = player.won ? '✅ WON' : '❌ LOST';
            const statusClass = player.won ? 'status-won' : 'status-lost';
            const displayDate = player.date || new Date(player.timestamp).toLocaleString();
            const displayEmail = player.email || '-';
            
            entry.innerHTML = `
                <span class="rank">#${index + 1}</span>
                <span class="name">${player.name}</span>
                <span class="email">${displayEmail}</span>
                <span class="score">${player.score}</span>
                <span class="vaults">${player.vaults || player.vault || 0}/5</span>
                <span class="status ${statusClass}">${statusIcon}</span>
                <span class="date">${displayDate}</span>
            `;
            container.appendChild(entry);
        });

        // Update fullscreen leaderboard with all details
        fullscreenContainer.innerHTML = '';
        leaderboard.forEach((player, index) => {
            const entry = document.createElement('div');
            entry.className = `fullscreen-entry rank-${index + 1}`;
            const statusText = player.won ? '✅ WON' : '❌ LOST';
            const statusClass = player.won ? 'status-won' : 'status-lost';
            const displayEmail = player.email || '-';
            const vaultsOpened = player.vaults || player.vault || 0;
            
            entry.innerHTML = `
                <span class="fullscreen-rank">#${index + 1}</span>
                <span class="fullscreen-name">${player.name}</span>
                <span class="fullscreen-email">${displayEmail}</span>
                <span class="fullscreen-score">${player.score} pts</span>
                <span class="fullscreen-vaults">${vaultsOpened}/5 Vaults</span>
                <span class="fullscreen-status ${statusClass}">${statusText}</span>
            `;
            fullscreenContainer.appendChild(entry);
        });
    }

    kickPlayer(playerId, playerName) {
        if (confirm(`Are you sure you want to kick "${playerName}"?`)) {
            this.socket.emit('admin:kickPlayer', { playerId });
            this.addLog('system', `Kicked player "${playerName}"`);
        }
    }

    kickAllPlayers() {
        if (confirm('Are you sure you want to kick ALL players? This action cannot be undone!')) {
            this.socket.emit('admin:kickAll');
            this.addLog('system', 'Kicked all players');
        }
    }

    clearLeaderboard() {
        if (confirm('Are you sure you want to clear the entire leaderboard?')) {
            this.socket.emit('admin:clearLeaderboard');
            this.addLog('system', 'Leaderboard cleared');
        }
    }

    sendEmailsToPlayers() {
        if (confirm('Send score emails to all players in the leaderboard?\n\nNote: This may take a few minutes for large lists. Emails are sent at ~20 per minute to avoid rate limits.')) {
            const btn = document.getElementById('send-emails-btn');
            btn.disabled = true;
            btn.textContent = '📧 SENDING...';
            
            // Show stop button
            document.getElementById('stop-emails-btn').classList.remove('hidden');
            
            this.socket.emit('admin:sendEmails');
            this.addLog('system', 'Starting to send emails to all players...');
        }
    }

    retryFailedEmails() {
        if (confirm('Retry sending emails to players who failed to receive them?')) {
            const btn = document.getElementById('retry-emails-btn');
            btn.disabled = true;
            btn.textContent = '🔄 RETRYING...';
            
            // Show stop button
            document.getElementById('stop-emails-btn').classList.remove('hidden');
            
            this.socket.emit('admin:retryFailedEmails');
            this.addLog('system', 'Retrying failed emails...');
        }
    }

    stopEmailSending() {
        if (confirm('Stop sending emails? You can retry failed ones later.')) {
            this.socket.emit('admin:stopEmails');
            this.addLog('system', 'Email sending stopped by admin');
        }
    }

    updateEmailProgress(progress) {
        const stopBtn = document.getElementById('stop-emails-btn');
        const retryBtn = document.getElementById('retry-emails-btn');
        const sendBtn = document.getElementById('send-emails-btn');
        
        if (!progress || progress.total === 0) {
            return;
        }
        
        // Calculate progress percentage
        const processed = progress.sent + progress.failed;
        const percentage = Math.round((processed / progress.total) * 100);
        
        // Update buttons based on state
        if (progress.isRunning) {
            stopBtn.classList.remove('hidden');
            sendBtn.disabled = true;
            
            // Log progress to activity log
            if (progress.currentPlayer) {
                this.updateEmailLogEntry(`📧 Sending emails... ${percentage}% (${progress.sent} sent, ${progress.failed} failed) - Current: ${progress.currentPlayer}`);
            }
        } else {
            stopBtn.classList.add('hidden');
            sendBtn.disabled = false;
            sendBtn.textContent = '📧 SEND EMAILS';
            
            if (progress.failed > 0) {
                retryBtn.classList.remove('hidden');
                retryBtn.disabled = false;
                retryBtn.textContent = '🔄 RETRY FAILED';
                this.updateEmailLogEntry(`📧 Email sending complete: ✅ ${progress.sent} sent, ❌ ${progress.failed} failed`);
            } else if (progress.sent > 0) {
                this.updateEmailLogEntry(`📧 Email sending complete: ✅ ${progress.sent} sent successfully!`);
            }
        }
    }

    updateEmailLogEntry(message) {
        // Update or create the email progress log entry
        const log = document.getElementById('activity-log');
        let emailEntry = document.getElementById('email-progress-log');
        
        if (!emailEntry) {
            emailEntry = document.createElement('div');
            emailEntry.id = 'email-progress-log';
            emailEntry.className = 'log-entry email-progress';
            log.insertBefore(emailEntry, log.firstChild);
        }
        
        const time = new Date().toLocaleTimeString();
        emailEntry.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-message">${message}</span>
        `;
    }

    showEmailStatus(success, message) {
        const statusDiv = document.getElementById('email-status-message');
        statusDiv.textContent = message;
        statusDiv.className = `email-status ${success ? 'success' : 'error'}`;
        statusDiv.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }

    clearLog() {
        const log = document.getElementById('activity-log');
        log.innerHTML = '<div class="log-entry system"><span class="log-time">[SYSTEM]</span><span class="log-message">Activity log cleared</span></div>';
    }

    addLog(type, message) {
        const log = document.getElementById('activity-log');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        const time = new Date().toLocaleTimeString();
        entry.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-message">${message}</span>
        `;
        
        log.insertBefore(entry, log.firstChild);
        
        // Keep only last 50 entries
        while (log.children.length > 50) {
            log.removeChild(log.lastChild);
        }
    }
}

// Initialize admin dashboard
let admin;
document.addEventListener('DOMContentLoaded', () => {
    admin = new AdminDashboard();
});
