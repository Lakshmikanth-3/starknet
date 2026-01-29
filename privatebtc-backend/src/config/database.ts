import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'privatebtc.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS vaults (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id TEXT UNIQUE NOT NULL,
    user_address TEXT NOT NULL,
    commitment TEXT NOT NULL,
    lock_period INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    unlock_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    apy REAL NOT NULL,
    is_withdrawn BOOLEAN DEFAULT 0,
    withdrawn_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS commitments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id TEXT NOT NULL,
    commitment TEXT UNIQUE NOT NULL,
    randomness TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (vault_id) REFERENCES vaults(vault_id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id TEXT NOT NULL,
    tx_type TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    amount REAL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (vault_id) REFERENCES vaults(vault_id)
  );

  CREATE INDEX IF NOT EXISTS idx_vaults_user ON vaults(user_address);
  CREATE INDEX IF NOT EXISTS idx_vaults_status ON vaults(status);
  CREATE INDEX IF NOT EXISTS idx_commitments_vault ON commitments(vault_id);
`);

console.log('✅ Database initialized:', dbPath);

export default db;
