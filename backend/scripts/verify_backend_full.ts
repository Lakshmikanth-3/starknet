
import { Request, Response } from 'express';
import { database } from '../src/config/database'; // Wait, need persistent
import { initDatabase } from '../src/config/database-persistent-v4';
import { VaultService } from '../src/services/VaultService';
import { VaultController } from '../src/controllers/VaultController';

// Mock Express Request/Response
class MockResponse {
    statusCode: number = 200;
    jsonData: any = {};

    status(code: number) {
        this.statusCode = code;
        return this;
    }

    json(data: any) {
        this.jsonData = data;
        return this;
    }
}

async function main() {
    console.log("🚀 Starting Full Backend Verification...");

    // 1. Initialize DB
    console.log("1️⃣  Initializing Database...");
    const db = await initDatabase();
    const vaultService = new VaultService(db);
    const vaultController = new VaultController(vaultService);

    // Helper to simulate request
    const mockReq = (body: any = {}, params: any = {}) => ({
        body,
        params,
        headers: {} // Mock headers for auth check
    } as unknown as Request);

    // 2. Test Create Vault
    console.log("\n2️⃣  Testing Deposit (Create Vault)...");
    const userAddress = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const depositReq = mockReq({
        userAddress,
        amount: 0.5,
        lockPeriod: 30
    });
    const depositRes = new MockResponse();

    await vaultController.createVault(depositReq, depositRes as Response);

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

    await vaultController.generateProof(proofReq, proofRes as Response);

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
    await vaultController.timeTravel(travelReq, travelRes as Response);

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

    await vaultController.withdrawFromVault(withdrawReq, withdrawRes as Response);

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
    await vaultController.getStats(statsReq, statsRes as Response);
    console.log("✅ Stats:", statsRes.jsonData.data);

    // Done
    console.log("\n✨ FULL BACKEND VERIFICATION PASSED ✨");
}

main().catch(console.error);
