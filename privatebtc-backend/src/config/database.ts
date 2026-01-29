import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

let db: SqlJsDatabase;

export async function initializeDatabase(): Promise<SqlJsDatabase> {
    const SQL = await initSqlJs();
    const dbPath = process.env.DATABASE_PATH || 'privatebtc.db';

    // Try to load existing database
    try {
        if (fs.existsSync(dbPath)) {
            const buffer = fs.readFileSync(dbPath);
            db = new SQL.Database(buffer);
            console.log('✅ Loaded existing database');
        } else {
            db = new SQL.Database();
            console.log('✅ Created new database');
        }
    } catch (error) {
        db = new SQL.Database();
        console.log('✅ Created new database');
    }

    // Create tables
    db.run(`
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
      is_withdrawn INTEGER DEFAULT 0,
      withdrawn_at INTEGER
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS commitments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_id TEXT NOT NULL,
      commitment TEXT UNIQUE NOT NULL,
      randomness TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (vault_id) REFERENCES vaults(vault_id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_id TEXT NOT NULL,
      tx_type TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      amount REAL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (vault_id) REFERENCES vaults(vault_id)
    )
  `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_vaults_user ON vaults(user_address)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_vaults_status ON vaults(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_commitments_vault ON commitments(vault_id)`);

    console.log('✅ Database tables initialized');

    // Save database periodically
    setInterval(() => saveDatabase(dbPath), 5000);

    // Save on process exit
    process.on('exit', () => saveDatabase(dbPath));
    process.on('SIGINT', () => {
        saveDatabase(dbPath);
        process.exit();
    });

    return db;
}

export function saveDatabase(dbPath: string) {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

export function getDatabase(): SqlJsDatabase {
    return db;
}
