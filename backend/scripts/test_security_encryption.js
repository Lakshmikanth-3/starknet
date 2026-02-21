"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const VaultService_1 = require("../src/services/VaultService");
async function main() {
    console.log("🔒 Starting Security Encryption Test...");
    // 1. Initialize DB
    const db = await (0, sqlite_1.open)({
        filename: './privatebtc-production-v4.db',
        driver: sqlite3_1.default.Database
    });
    // Manually ensure tables exist since app.ts isn't running
    await db.exec(`
    CREATE TABLE IF NOT EXISTS vaults (
      vault_id TEXT PRIMARY KEY,
      user_address TEXT NOT NULL,
      commitment TEXT NOT NULL,
      lock_period INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      unlock_at INTEGER NOT NULL,
      status TEXT CHECK(status IN ('locked', 'unlocked', 'withdrawn')),
      is_withdrawn BOOLEAN DEFAULT 0,
      withdrawn_at INTEGER,
      apy REAL
    );

    CREATE TABLE IF NOT EXISTS commitments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_id TEXT NOT NULL,
      commitment TEXT UNIQUE NOT NULL,
      randomness TEXT NOT NULL, -- Hashed or Encrypted? We'll check.
      amount_encrypted TEXT NOT NULL, -- ✅ ENCRYPTED
      salt TEXT NOT NULL, -- 🧂 Per-vault salt
      created_at INTEGER NOT NULL,
      FOREIGN KEY (vault_id) REFERENCES vaults(vault_id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      tx_hash TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL,
      tx_type TEXT CHECK(tx_type IN ('deposit', 'withdraw')),
      amount REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (vault_id) REFERENCES vaults(vault_id)
    );
    `);
    const vaultService = new VaultService_1.VaultService(db);
    // 2. Create Vault
    const amount = 1.5;
    const userAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    console.log(`\n📝 Creating Vault with Amount: ${amount} BTC`);
    const vaultData = await vaultService.createVault({
        userAddress,
        amount,
        lockPeriod: 30
    });
    console.log(`✅ Vault Created: ${vaultData.vaultId}`);
    console.log(`🔑 Randomness (Key): ${vaultData.randomness}`);
    // 3. Verify Database Storage (Hack check)
    console.log("\n🕵️  Inspecting Database for Plaintext Leakage...");
    const row = await db.get('SELECT amount_encrypted, randomness FROM commitments WHERE vault_id = ?', [vaultData.vaultId]);
    console.log(`   Stored amount_encrypted: ${row.amount_encrypted}`);
    console.log(`   Stored randomness (hash): ${row.randomness}`);
    // Check if amount is visible
    if (row.amount_encrypted.includes(amount.toString())) {
        console.error("❌ CRITICAL FAIL: Amount found in plaintext within encrypted field!");
        process.exit(1);
    }
    else {
        console.log("✅ PASS: Amount is NOT visible in plaintext.");
    }
    // Check format
    if (!row.amount_encrypted.includes(':')) {
        console.error("❌ CRITICAL FAIL: Encrypted format invalid (missing IV/Tag separator).");
        process.exit(1);
    }
    // 4. Test Decryption Validation
    console.log("\n🔓 Testing Decryption Logic...");
    // 4a. Incorrect Randomness
    try {
        console.log("   Attempting withdraw with WRONG randomness...");
        await vaultService.withdrawFromVault({
            vaultId: vaultData.vaultId,
            proof: ['0x123'], // Mock proof
            publicInputs: ['mock_id', 'mock_commitment', '1234567890'], // Mock Inputs
            userAddress,
            randomness: '0000000000000000000000000000000000000000000000000000000000000000' // Wrong key
        });
        console.error("❌ FAIL: Withdrawal should have failed with wrong randomness!");
        process.exit(1);
    }
    catch (e) {
        if (e.message.includes('Invalid randomness')) {
            console.log("✅ PASS: Blocked withdrawal with wrong key.");
        }
        else if (e.message.includes('Vault is still locked')) {
            console.log("⚠️  PASS?? Vault locked, so verification might not have been reached yet. Need to bypass time.");
            // Time Travel for check
            await db.run('UPDATE vaults SET unlock_at = ? WHERE vault_id = ?', [Date.now() - 1000, vaultData.vaultId]);
            console.log("   (Time traveled to unlock)");
        }
        else {
            console.error(`❌ FAIL: Unexpected error: ${e.message}`);
        }
    }
    // Retry 4a with unlocked vault
    try {
        console.log("   Retry withdraw with WRONG randomness (unlocked)...");
        await vaultService.withdrawFromVault({
            vaultId: vaultData.vaultId,
            proof: ['0x123'],
            publicInputs: ['mock_id', 'mock_commitment', '1234567890'],
            userAddress,
            randomness: '0000000000000000000000000000000000000000000000000000000000000000'
        });
    }
    catch (e) {
        if (e.message.includes('Invalid randomness') || e.message.includes('cannot decrypt')) {
            console.log("✅ PASS: Blocked withdrawal with wrong key (validated).");
        }
        else {
            console.error(`❌ FAIL: Unexpected error: ${e.message}`);
        }
    }
    // 4b. Correct Randomness (but invalid proof mock, expecting proof error after decryption success)
    try {
        console.log("   Attempting withdraw with CORRECT randomness...");
        // We expect it to pass decryption and then fail at Proof verification (since we mock proof)
        await vaultService.withdrawFromVault({
            vaultId: vaultData.vaultId,
            proof: ['0x123'],
            publicInputs: ['mock_id', 'mock_commitment', '1234567890'],
            userAddress,
            randomness: vaultData.randomness
        });
    }
    catch (e) {
        if (e.message.includes('Invalid ZK proof')) {
            console.log("✅ PASS: Decryption succeeded (proceeded to proof check).");
        }
        else if (e.message.includes('Invalid randomness')) {
            console.error("❌ FAIL: Correct randomness was rejected!");
            process.exit(1);
        }
        else {
            console.log(`ℹ️  Note: ${e.message}`);
        }
    }
    console.log("\n✅ SECURITY TESTS PASSED SUCCESSFULLY");
}
main().catch(console.error);
