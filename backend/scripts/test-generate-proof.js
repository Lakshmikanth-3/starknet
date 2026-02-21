// Test Generate ZK Proof
const fs = require('fs');
const BASE_URL = 'http://localhost:3001';

async function testGenerateProof() {
    console.log('\n====================================');
    console.log('Testing Generate ZK Proof');
    console.log('====================================\n');

    // Try to load last created vault
    let vaultInfo;
    try {
        const data = fs.readFileSync('scripts/last-vault.json', 'utf8');
        vaultInfo = JSON.parse(data);
        console.log('📂 Loaded vault info from last-vault.json');
    } catch (error) {
        console.error('⚠️  No vault info found. Please run test-create-vault.js first!');
        console.log('Using default test values...\n');
        vaultInfo = {
            vaultId: 'test',
            randomness: 'abc123',
            amount: 1.5
        };
    }

    const payload = {
        vaultId: vaultInfo.vaultId,
        amount: vaultInfo.amount,
        randomness: vaultInfo.randomness,
        userAddress: vaultInfo.userAddress
    };

    console.log('📨 Request Body:', JSON.stringify(payload, null, 2));

    try {
        const res = await fetch(`${BASE_URL}/api/vaults/generate-proof`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success) {
            console.log('\n✅ ZK Proof generated successfully!');
            const proofStr = Array.isArray(data.data.proof) ? data.data.proof.join(', ') : data.data.proof;
            console.log('Proof (truncated):', proofStr.substring(0, 60) + '...');
            console.log('Verified:', data.data.verified);

            // Update vault info with proof and public inputs
            vaultInfo.proof = data.data.proof;
            vaultInfo.publicInputs = data.data.publicInputs;
            fs.writeFileSync('scripts/last-vault.json', JSON.stringify(vaultInfo, null, 2));
            console.log('\n💾 Proof saved to scripts/last-vault.json');
        } else {
            console.error('\n❌ Failed to generate proof!');
            console.error('Error:', data.error);
        }
    } catch (error) {
        console.error('\n❌ Request failed:', error.message);
    }

    console.log('\n====================================\n');
}

testGenerateProof();
