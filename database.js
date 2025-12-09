// Database configuration and queries for PostgreSQL
const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

// Initialize database tables
async function initDatabase() {
    const client = await pool.connect();
    try {
        // Create players table
        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                score INTEGER DEFAULT 0,
                vaults_opened INTEGER DEFAULT 0,
                win_status BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create game_sessions table for detailed tracking
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_sessions (
                id SERIAL PRIMARY KEY,
                player_id INTEGER REFERENCES players(id),
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                score INTEGER DEFAULT 0,
                vaults_opened INTEGER DEFAULT 0,
                win_status BOOLEAN DEFAULT false,
                game_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                game_completed_at TIMESTAMP,
                duration_seconds INTEGER
            )
        `);

        // Create index for faster queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_players_email ON players(email)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_players_score ON players(score DESC)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_sessions_created ON game_sessions(game_started_at DESC)
        `);

        console.log('✅ Database tables initialized successfully');
    } catch (err) {
        console.error('❌ Database initialization error:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Create or update player
async function upsertPlayer(name, email) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            INSERT INTO players (name, email, score, vaults_opened, win_status, created_at, updated_at)
            VALUES ($1, $2, 0, 0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
            RETURNING id
        `, [name, email]);

        // If no result, player exists, get their ID
        if (result.rows.length === 0) {
            const existingPlayer = await client.query(
                'SELECT id FROM players WHERE email = $1',
                [email]
            );
            return existingPlayer.rows[0].id;
        }

        return result.rows[0].id;
    } catch (err) {
        console.error('Error upserting player:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Start a new game session
async function createGameSession(name, email) {
    const client = await pool.connect();
    try {
        // Get or create player
        const playerId = await upsertPlayer(name, email);

        // Create new game session
        const result = await client.query(`
            INSERT INTO game_sessions (player_id, name, email, score, vaults_opened, win_status, game_started_at)
            VALUES ($1, $2, $3, 0, 0, false, CURRENT_TIMESTAMP)
            RETURNING id
        `, [playerId, name, email]);

        return result.rows[0].id;
    } catch (err) {
        console.error('Error creating game session:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Update game session when game completes
async function completeGameSession(email, score, vaultsOpened, winStatus) {
    const client = await pool.connect();
    try {
        // Calculate duration and update session
        const result = await client.query(`
            UPDATE game_sessions
            SET score = $1,
                vaults_opened = $2,
                win_status = $3,
                game_completed_at = CURRENT_TIMESTAMP,
                duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - game_started_at))
            WHERE email = $4
            AND game_completed_at IS NULL
            ORDER BY game_started_at DESC
            LIMIT 1
            RETURNING id, player_id
        `, [score, vaultsOpened, winStatus, email]);

        if (result.rows.length > 0) {
            const { player_id } = result.rows[0];

            // Update player's best score and stats
            await client.query(`
                UPDATE players
                SET score = GREATEST(score, $1),
                    vaults_opened = GREATEST(vaults_opened, $2),
                    win_status = CASE WHEN $3 = true THEN true ELSE win_status END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
            `, [score, vaultsOpened, winStatus, player_id]);

            return result.rows[0].id;
        }

        return null;
    } catch (err) {
        console.error('Error completing game session:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Get leaderboard (top players)
async function getLeaderboard(limit = 100) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                name,
                email,
                score,
                vaults_opened,
                win_status,
                created_at,
                updated_at
            FROM players
            WHERE score > 0
            ORDER BY score DESC, updated_at DESC
            LIMIT $1
        `, [limit]);

        return result.rows;
    } catch (err) {
        console.error('Error getting leaderboard:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Get all game sessions (for analytics)
async function getAllGameSessions(limit = 1000) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                id,
                name,
                email,
                score,
                vaults_opened,
                win_status,
                game_started_at,
                game_completed_at,
                duration_seconds
            FROM game_sessions
            WHERE game_completed_at IS NOT NULL
            ORDER BY game_completed_at DESC
            LIMIT $1
        `, [limit]);

        return result.rows;
    } catch (err) {
        console.error('Error getting game sessions:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Get player statistics
async function getPlayerStats(email) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                p.name,
                p.email,
                p.score as best_score,
                p.vaults_opened as max_vaults,
                p.win_status,
                COUNT(gs.id) as total_games,
                AVG(gs.score) as avg_score,
                AVG(gs.duration_seconds) as avg_duration
            FROM players p
            LEFT JOIN game_sessions gs ON p.id = gs.player_id
            WHERE p.email = $1
            GROUP BY p.id, p.name, p.email, p.score, p.vaults_opened, p.win_status
        `, [email]);

        return result.rows[0] || null;
    } catch (err) {
        console.error('Error getting player stats:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Health check for database
async function healthCheck() {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
        return true;
    } catch (err) {
        console.error('Database health check failed:', err);
        return false;
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    initDatabase,
    upsertPlayer,
    createGameSession,
    completeGameSession,
    getLeaderboard,
    getAllGameSessions,
    getPlayerStats,
    healthCheck
};
