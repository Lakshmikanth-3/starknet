"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CryptoService_1 = require("../src/services/CryptoService");
async function main() {
    console.log("🔐 Testing ZK Proof Flow...");
    try {
        // 1. Setup Inputs
        const amount = 1.5;
        // Must be valid hex for BigInt conversion in CryptoService
        const userAddress = "0x1234567890abcdef1234567890abcdef12345678";
        console.log(`👤 User: ${userAddress}`);
        console.log(`💰 Amount: ${amount} BTC`);
        // 2. Generate Randomness & Commitment
        const randomness = CryptoService_1.CryptoService.generateRandomness();
        console.log(`🎲 Randomness (Felt): ${randomness}`);
        const commitment = CryptoService_1.CryptoService.generateCommitment(amount, randomness, userAddress);
        console.log(`🔒 Commitment (Poseidon): ${commitment}`);
        // 3. Generate Proof (Simulated)
        console.log("⏳ Generating Proof...");
        const vaultId = "test-vault-123";
        const proofResult = await CryptoService_1.CryptoService.generateProof(vaultId, amount, randomness, userAddress);
        console.log("📄 Proof Generated:");
        console.log("   Proof:", proofResult.proof);
        console.log("   Public Inputs:", proofResult.publicInputs);
        console.log(`   Time: ${proofResult.generationTime}ms`);
        // 4. Verify Proof
        console.log("🔍 Verifying Proof...");
        const isValid = CryptoService_1.CryptoService.verifyProof(proofResult.proof, proofResult.publicInputs, commitment);
        if (isValid) {
            console.log("✅ Proof Verification PASSED!");
        }
        else {
            console.error("❌ Proof Verification FAILED!");
        }
    }
    catch (error) {
        console.error("❌ Test Failed:", error);
    }
}
main();
