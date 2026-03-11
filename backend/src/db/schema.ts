/**
 * Database schema for PrivateBTC Vault.
 * Uses better-sqlite3 (synchronous). Schema runs on import.
 * Exports getDb() singleton.
 *
 * ZERO TOLERANCE: BEFORE INSERT trigger on `transactions` rejects
 * any tx_hash that doesn't match the real Starknet format.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { config } from '../config/env';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = path.resolve(config.DB_PATH);
  console.log(`📂 Opening DB at: ${dbPath}`);

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');

  initSchema(_db);
  console.log('✅ Database initialized');
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    -- ─────────────────────────────────────────────────────
    -- VAULTS TABLE
    -- ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS vaults (
      id                  TEXT PRIMARY KEY,
      owner_address       TEXT NOT NULL,
      commitment          TEXT NOT NULL UNIQUE,
      encrypted_amount    TEXT NOT NULL,
      salt                TEXT NOT NULL,
      randomness_hint     TEXT NOT NULL,
      lock_duration_days  INTEGER NOT NULL,
      created_at          INTEGER NOT NULL,
      unlock_at           INTEGER NOT NULL,
      status              TEXT NOT NULL DEFAULT 'pending',
      deposit_tx_hash     TEXT,
      withdraw_tx_hash    TEXT,
      bitcoin_txid        TEXT DEFAULT NULL,
      nullifier_hash      TEXT UNIQUE,
      CHECK(lock_duration_days IN (30, 90, 365)),
      CHECK(status IN ('pending', 'active', 'withdrawn')),
      CHECK(deposit_tx_hash IS NULL OR (length(deposit_tx_hash) >= 34 AND deposit_tx_hash LIKE '0x%')),
      CHECK(withdraw_tx_hash IS NULL OR (length(withdraw_tx_hash) >= 34 AND withdraw_tx_hash LIKE '0x%'))
    );

    -- ─────────────────────────────────────────────────────
    -- COMMITMENTS TABLE
    -- ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS commitments (
      commitment    TEXT PRIMARY KEY,
      vault_id      TEXT NOT NULL REFERENCES vaults(id),
      block_number  INTEGER,
      revealed      INTEGER NOT NULL DEFAULT 0
    );

    -- ─────────────────────────────────────────────────────
    -- NULLIFIERS TABLE
    -- ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS nullifiers (
      nullifier_hash    TEXT PRIMARY KEY,
      vault_id          TEXT NOT NULL REFERENCES vaults(id),
      used_at           INTEGER NOT NULL,
      withdraw_tx_hash  TEXT NOT NULL
    );

    -- ─────────────────────────────────────────────────────
    -- TRANSACTIONS TABLE
    -- ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS transactions (
      id                TEXT PRIMARY KEY,
      vault_id          TEXT REFERENCES vaults(id),
      tx_hash           TEXT NOT NULL UNIQUE,
      type              TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw')),
      amount_encrypted  TEXT NOT NULL,
      block_number      INTEGER,
      block_timestamp   INTEGER,
      execution_status  TEXT CHECK(execution_status IN ('SUCCEEDED', 'REVERTED')),
      timestamp         INTEGER NOT NULL
    );

    -- ─────────────────────────────────────────────────────
    -- TRIGGER: Reject fake tx_hash at DB level
    -- Real Starknet hashes: 0x followed by 63 or 64 hex chars
    -- ─────────────────────────────────────────────────────
    CREATE TRIGGER IF NOT EXISTS enforce_real_tx_hash
    BEFORE INSERT ON transactions
    BEGIN
      SELECT CASE
        WHEN NEW.tx_hash NOT LIKE '0x%' OR length(NEW.tx_hash) < 34
        THEN RAISE(ABORT, 'FAKE_TX_HASH: tx_hash must be a real Starknet transaction hash (0x + 63-64 hex chars)')
      END;
    END;

    -- ─────────────────────────────────────────────────────
    -- INDEXES
    -- ─────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_vaults_owner ON vaults(owner_address);
    CREATE INDEX IF NOT EXISTS idx_vaults_status ON vaults(status);
    CREATE INDEX IF NOT EXISTS idx_vaults_commitment ON vaults(commitment);
    CREATE INDEX IF NOT EXISTS idx_commitments_vault ON commitments(vault_id);
    CREATE INDEX IF NOT EXISTS idx_nullifiers_vault ON nullifiers(vault_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_vault ON transactions(vault_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);

    -- ─────────────────────────────────────────────────────
    -- HTLCS TABLE (Hash Time Lock Contracts)
    -- ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS htlcs (
      id          TEXT PRIMARY KEY,
      sender      TEXT NOT NULL,
      receiver    TEXT NOT NULL,
      amount      TEXT NOT NULL,
      hashlock    TEXT NOT NULL,
      timelock    INTEGER NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending', 'claimed', 'refunded')),
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_htlcs_sender   ON htlcs(sender);
    CREATE INDEX IF NOT EXISTS idx_htlcs_receiver ON htlcs(receiver);
    CREATE INDEX IF NOT EXISTS idx_htlcs_status   ON htlcs(status);

    -- ─────────────────────────────────────────────────────
    -- STANDALONE COMMITMENTS TABLE (CommitmentService)
    -- Separate from vault-linked commitments above
    -- ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sc_commitments (
      id             TEXT PRIMARY KEY,
      commitment     TEXT NOT NULL UNIQUE,
      nullifier_hash TEXT NOT NULL UNIQUE,
      used           INTEGER NOT NULL DEFAULT 0,
      created_at     INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_sc_commitment     ON sc_commitments(commitment);
    CREATE INDEX IF NOT EXISTS idx_sc_nullifier_hash ON sc_commitments(nullifier_hash);

    -- ─────────────────────────────────────────────────────
    -- SHARP PROOFS TABLE
    -- ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sharp_proofs (
      id              TEXT PRIMARY KEY,
      job_key         TEXT UNIQUE NOT NULL,
      secret_hash     TEXT NOT NULL,
      salt_hash       TEXT NOT NULL,
      status          TEXT DEFAULT 'SUBMITTED',
      on_chain        INTEGER DEFAULT 0,
      created_at      INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_sharp_job_key ON sharp_proofs(job_key);
    CREATE INDEX IF NOT EXISTS idx_sharp_status  ON sharp_proofs(status);

    -- ─────────────────────────────────────────────────────
    -- STARKNET PROOFS TABLE
    -- ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS starknet_proofs (
        authorization_id TEXT PRIMARY KEY,
        proof_data TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );

    -- ─────────────────────────────────────────────────────
    -- WITHDRAWAL AUTHORIZATIONS TABLE
    -- Security: Bitcoin can only be sent with valid authorization
    -- Authorization is created ONLY after mBTC burn on Starknet
    -- ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS withdrawal_authorizations (
      id                    TEXT PRIMARY KEY,
      vault_id              TEXT NOT NULL REFERENCES vaults(id),
      nullifier_hash        TEXT NOT NULL UNIQUE,
      starknet_tx_hash      TEXT NOT NULL UNIQUE,
      bitcoin_address       TEXT NOT NULL,
      amount_sats           INTEGER NOT NULL,
      status                TEXT NOT NULL DEFAULT 'pending'
                            CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
      confirmed_at          INTEGER,
      bitcoin_txid          TEXT,
      error_message         TEXT,
      CHECK(starknet_tx_hash LIKE '0x%' AND length(starknet_tx_hash) >= 34),
      CHECK(bitcoin_address LIKE 'tb1%')
    );

    CREATE INDEX IF NOT EXISTS idx_auth_status ON withdrawal_authorizations(status);
    CREATE INDEX IF NOT EXISTS idx_auth_nullifier ON withdrawal_authorizations(nullifier_hash);
    CREATE INDEX IF NOT EXISTS idx_auth_vault ON withdrawal_authorizations(vault_id);
    CREATE INDEX IF NOT EXISTS idx_auth_starknet_tx ON withdrawal_authorizations(starknet_tx_hash);
  `);

  // Migrations for backward compatibility
  try {
    db.exec(`ALTER TABLE vaults ADD COLUMN bitcoin_txid TEXT DEFAULT NULL`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error (bitcoin_txid):', e.message);
    }
  }

  try {
    db.exec(`ALTER TABLE vaults ADD COLUMN bitcoin_withdrawal_address TEXT DEFAULT NULL`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error (bitcoin_withdrawal_address):', e.message);
    }
  }

  // Privacy: track Bitcoin address that initiated the deposit so we can
  // prevent the user from withdrawing to the same address.
  try {
    db.exec(`ALTER TABLE vaults ADD COLUMN deposit_sender_address TEXT DEFAULT NULL`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error (deposit_sender_address):', e.message);
    }
  }
}

// Initialize on import
export default getDb();
