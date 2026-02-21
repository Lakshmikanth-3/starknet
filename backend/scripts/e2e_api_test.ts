import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function main() {
    console.log("🚀 Starting E2E API Verification...");

    // 1. Create Vault (Deposit)
    console.log("\n1️⃣  Creating Vault (Deposit)...");
    const userAddress = "0x1234567890abcdef1234567890abcdef12345678";
    const depositRes = await fetch(`${BASE_URL}/api/vaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userAddress,
            amount: 0.1,
            lockPeriod: 30
        })
    });

    const depositData: any = await depositRes.json();
    if (!depositData.success) {
        console.error("❌ Deposit Failed:", depositData);
        process.exit(1);
    }

    const { vaultId, randomness, commitment } = depositData.data;
    console.log(`✅ Vault Created: ${vaultId}`);
    console.log(`   Randomness (Saved): ${randomness}`);

    // 2. Generate Proof (Simulating Client Side)
    console.log("\n2️⃣  Generating ZK Proof...");
    const proofRes = await fetch(`${BASE_URL}/api/vaults/generate-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            vaultId,
            amount: 0.1,
            randomness,
            userAddress
        })
    });

    const proofData: any = await proofRes.json();
    if (!proofData.success) {
        console.error("❌ Proof Generation Failed:", proofData);
        process.exit(1);
    }

    const { proof, publicInputs } = proofData.data;
    console.log(`✅ Proof Generated:`, proof);
    console.log(`   Public Inputs:`, publicInputs);

    // 2.5 Time Travel (Unlock Vault)
    console.log("\n⏳ Time Traveling (Unlocking Vault)...");
    const travelRes = await fetch(`${BASE_URL}/api/debug/time-travel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultId })
    });
    const travelData: any = await travelRes.json();
    if (travelData.success) {
        console.log(`✅ ${travelData.message}`);
    } else {
        console.error("❌ Time Travel Failed:", travelData);
        process.exit(1);
    }

    // 3. Withdraw
    console.log("\n3️⃣  Withdrawing...");
    const withdrawRes = await fetch(`${BASE_URL}/api/vaults/${vaultId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            proof,
            publicInputs, // required for ZK verification
            userAddress,
            randomness
        })
    });

    const withdrawData: any = await withdrawRes.json();

    if (withdrawData.success) {
        console.log("✅ Withdrawal Successful!");
        console.log("   TX Hash:", withdrawData.data.txHash);
        console.log("\n🎉 E2E TEST PASSED!");
    } else {
        console.error("❌ Withdrawal Failed:", withdrawData);
        process.exit(1);
    }
}

main().catch(console.error);
