"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_persistent_v4_1 = require("../src/config/database-persistent-v4");
const VaultService_1 = require("../src/services/VaultService");
const VaultController_1 = require("../src/controllers/VaultController");
// Mock Express Request/Response
class MockResponse {
    constructor() {
        this.statusCode = 200;
        this.jsonData = {};
    }
    status(code) {
        this.statusCode = code;
        return this;
    }
    json(data) {
        this.jsonData = data;
        return this;
    }
}
async function main() {
    console.log("🚀 Starting Full Backend Verification...");
    // 1. Initialize DB
    console.log("1️⃣  Initializing Database...");
    const db = await (0, database_persistent_v4_1.initDatabase)();
    const vaultService = new VaultService_1.VaultService(db);
    const vaultController = new VaultController_1.VaultController(vaultService);
    // Helper to simulate request
    const mockReq = (body = {}, params = {}) => ({
        body,
        params,
        headers: {} // Mock headers for auth check
    });
    // 2. Test Create Vault
    console.log("\n2️⃣  Testing Deposit (Create Vault)...");
    const userAddress = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const depositReq = mockReq({
        userAddress,
        amount: 0.5,
        lockPeriod: 30
    });
    const depositRes = new MockResponse();
    await vaultController.createVault(depositReq, depositRes);
    if (depositRes.statusCode !== 201 || !depositRes.jsonData.success) {
        console.error("❌ Deposit Failed:", depositRes.jsonData);
        process.exit(1);
    }
    const vaultData = depositRes.jsonData.data;
    console.log(`✅ Vault Created: ${vaultData.vaultId}`);
    // 3. Test Generate Proof
    console.log("\n3️⃣  Testing ZK Proof Generation...");
    const proofReq = mockReq({
        vaultId: vaultData.vaultId,
        amount: 0.5,
        randomness: vaultData.randomness,
        userAddress
    });
    const proofRes = new MockResponse();
    await vaultController.generateProof(proofReq, proofRes);
    if (!proofRes.jsonData.success) {
        console.error("❌ Proof Generation Failed:", proofRes.jsonData);
        process.exit(1);
    }
    const proofData = proofRes.jsonData.data;
    console.log("✅ Proof Generated");
    console.log(`   Proof Length: ${proofData.proof[0].length}`);
    console.log(`   Public Inputs: ${JSON.stringify(proofData.publicInputs)}`);
    // 4. Time Travel
    console.log("\n4️⃣  Testing Time Travel (Unlock)...");
    const travelReq = mockReq({ vaultId: vaultData.vaultId });
    const travelRes = new MockResponse();
    await vaultController.timeTravel(travelReq, travelRes);
    if (!travelRes.jsonData.success) {
        console.error("❌ Time Travel Failed:", travelRes.jsonData);
        process.exit(1);
    }
    console.log("✅ Time Travel Successful");
    // 5. Test Withdrawal
    console.log("\n5️⃣  Testing Withdrawal...");
    const withdrawReq = mockReq({
        proof: proofData.proof,
        publicInputs: proofData.publicInputs,
        userAddress,
        randomness: vaultData.randomness
    }, { vaultId: vaultData.vaultId });
    const withdrawRes = new MockResponse();
    await vaultController.withdrawFromVault(withdrawReq, withdrawRes);
    if (!withdrawRes.jsonData.success) {
        console.error("❌ Withdrawal Failed:", withdrawRes.jsonData);
        process.exit(1);
    }
    const withdrawData = withdrawRes.jsonData.data;
    console.log("✅ Withdrawal Successful");
    console.log(`   TX Hash: ${withdrawData.txHash}`);
    console.log(`   Total Amount: ${withdrawData.totalAmount} (Principal + Yield)`);
    // 6. Stats Check
    console.log("\n6️⃣  Checking Stats...");
    const statsReq = mockReq();
    const statsRes = new MockResponse();
    await vaultController.getStats(statsReq, statsRes);
    console.log("✅ Stats:", statsRes.jsonData.data);
    // Done
    console.log("\n✨ FULL BACKEND VERIFICATION PASSED ✨");
}
main().catch(console.error);
