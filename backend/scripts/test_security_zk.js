"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const VaultService_1 = require("../src/services/VaultService");
const CryptoService_1 = require("../src/services/CryptoService");
// Mock DB setup (assuming previous test script ran and DB schema is correct)
// Actually we need to ensure DB is initialized if we run this standalone.
// For simplicity, we assume DB is there or we init it.
async function main() {
    console.log("🔒 Starting ZK Security Test...");
    const db = await (0, sqlite_1.open)({
        filename: './privatebtc-production-v4.db',
        driver: sqlite3_1.default.Database
    });
    // Ensure tables in case we ran after a wipe
    await db.exec(`
    CREATE TABLE IF NOT EXISTS vaults (
      vault_id TEXT PRIMARY KEY,
      user_address TEXT NOT NULL,
      commitment TEXT NOT NULL,
      lock_period INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      unlock_at INTEGER NOT NULL,
      status TEXT,
      is_withdrawn BOOLEAN DEFAULT 0,
      withdrawn_at INTEGER,
      apy REAL
    );
    CREATE TABLE IF NOT EXISTS commitments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_id TEXT NOT NULL,
      commitment TEXT UNIQUE NOT NULL,
      randomness TEXT NOT NULL,
      amount_encrypted TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (vault_id) REFERENCES vaults(vault_id)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      tx_hash TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL,
      tx_type TEXT,
      amount REAL,
      timestamp INTEGER,
      FOREIGN KEY (vault_id) REFERENCES vaults(vault_id)
    );
    `);
    const vaultService = new VaultService_1.VaultService(db);
    // 1. Create Vault
    const amount = 0.5;
    const userAddress = '0xABC123';
    console.log("\n1️⃣  Creating Vault...");
    const vault = await vaultService.createVault({
        userAddress,
        amount,
        lockPeriod: 30
    });
    console.log(`   Vault ID: ${vault.vaultId}`);
    // 2. Generate Realistic Proof
    console.log("\n2️⃣  Generating Proof (Should take ~2s)...");
    const proofData = await CryptoService_1.CryptoService.generateProof(vault.vaultId, amount, vault.randomness, userAddress);
    console.log(`   Generation Time: ${proofData.generationTime}ms`);
    if (proofData.generationTime < 1000) {
        console.warn("⚠️  Warning: Proof generation too fast? (<1s). Should be realistic.");
    }
    else {
        console.log("✅ Proof generation time is realistic.");
    }
    console.log(`   Proof: ${proofData.proof[0].substring(0, 20)}...`);
    console.log(`   Public Inputs: ${JSON.stringify(proofData.publicInputs)}`);
    // 3. Time Travel (to unlock)
    await vaultService.timeTravel(vault.vaultId);
    console.log("\n⏳ Time Traveled to unlock vault.");
    // 4. Withdraw with Proof and Public Inputs
    console.log("\n3️⃣  Withdrawing...");
    try {
        const res = await vaultService.withdrawFromVault({
            vaultId: vault.vaultId,
            proof: proofData.proof,
            publicInputs: proofData.publicInputs, // Critical addition
            userAddress,
            randomness: vault.randomness
        });
        console.log("✅ Withdrawal Successful!");
        console.log(`   TX Hash: ${res.txHash}`);
    }
    catch (e) {
        console.error(`❌ Withdrawal Failed: ${e.message}`);
        process.exit(1);
    }
    console.log("\n✅ ZK REALISTIC SIMULATION PASSED");
}
main().catch(console.error);
