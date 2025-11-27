import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const dbPath = process.env.DATABASE_PATH || './data/seedhunter.db'

// Ensure data directory exists
const dir = dirname(dbPath)
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true })
}

export const db = new Database(dbPath)

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL')

export function initDB() {
  // Create tables
  db.exec(`
    -- Players table
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      x_handle TEXT UNIQUE NOT NULL,
      x_profile_pic TEXT,
      card_id TEXT,
      verified INTEGER DEFAULT 0,
      verified_at INTEGER,
      created_at INTEGER NOT NULL,
      last_location_lat REAL,
      last_location_lng REAL,
      last_location_at INTEGER
    );

    -- Admins table
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      location_lat REAL,
      location_lng REAL,
      location_visible INTEGER DEFAULT 1,
      location_updated_at INTEGER,
      created_at INTEGER NOT NULL
    );

    -- Cards table
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      founder_name TEXT NOT NULL,
      company TEXT NOT NULL,
      role TEXT,
      x_handle TEXT,
      category TEXT NOT NULL,
      image_path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Trades table
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      player_a TEXT NOT NULL,
      player_b TEXT NOT NULL,
      card_a TEXT NOT NULL,
      card_b TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (player_a) REFERENCES players(x_handle),
      FOREIGN KEY (player_b) REFERENCES players(x_handle),
      FOREIGN KEY (card_a) REFERENCES cards(id),
      FOREIGN KEY (card_b) REFERENCES cards(id)
    );

    -- Trade nonces (prevent replay attacks)
    CREATE TABLE IF NOT EXISTS trade_nonces (
      nonce TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );

    -- Chat messages
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      sender_handle TEXT NOT NULL,
      content TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_trades_player_a ON trades(player_a);
    CREATE INDEX IF NOT EXISTS idx_trades_player_b ON trades(player_b);
    CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
    CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_players_verified ON players(verified);
    CREATE INDEX IF NOT EXISTS idx_nonces_expires ON trade_nonces(expires_at);
  `)

  // Clean up expired nonces on startup
  db.exec(`DELETE FROM trade_nonces WHERE expires_at < ${Date.now()}`)

  console.log('📦 Database initialized')
}

// Utility function to generate UUIDs
export function generateId(): string {
  return crypto.randomUUID()
}
