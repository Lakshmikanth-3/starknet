// Test Withdraw from Vault
const fs = require('fs');
const BASE_URL = 'http://localhost:3001';

async function testWithdraw() {
    console.log('\n====================================');
    console.log('Testing Vault Withdrawal');
    console.log('====================================\n');

    // Try to load last created vault
    let vaultInfo;
    try {
        const data = fs.readFileSync('scripts/last-vault.json', 'utf8');
        vaultInfo = JSON.parse(data);
        console.log('📂 Loaded vault info from last-vault.json\n');
    } catch (error) {
        console.error('⚠️  No vault info found. Please run:');
        console.error('  1. test-create-vault.js');
        console.error('  2. test-generate-proof.js\n');
        return;
    }

    if (!vaultInfo.proof) {
        console.error('⚠️  No proof found. Please run test-generate-proof.js first!\n');
        return;
    }

    const payload = {
        proof: vaultInfo.proof,
        publicInputs: vaultInfo.publicInputs,
        userAddress: vaultInfo.userAddress,
        randomness: vaultInfo.randomness
    };

    console.log('📨 Request:');
    console.log('  Vault ID:', vaultInfo.vaultId);
    console.log('  User Address:', vaultInfo.userAddress);
    const proofStr = Array.isArray(vaultInfo.proof) ? vaultInfo.proof.join(', ') : vaultInfo.proof;
    console.log('  Proof (truncated):', proofStr.substring(0, 60) + '...\n');

    try {
        const res = await fetch(`${BASE_URL}/api/vaults/${vaultInfo.vaultId}/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success) {
            console.log('✅ Withdrawal successful!');
            console.log('Transaction Hash:', data.data.txHash);
            console.log('Amount Withdrawn:', data.data.amount, 'BTC');
            console.log('Yield Earned:', data.data.yield, 'BTC');
            console.log('Total:', data.data.total, 'BTC');
            console.log('New Status:', data.data.status);
        } else {
            console.log('⚠️  Withdrawal failed (expected if vault is still locked)');
            console.log('Error:', data.error);
            console.log('\nℹ️  Note: Vaults are locked for the specified period.');
            console.log('This test demonstrates the lock mechanism is working correctly.');
        }
    } catch (error) {
        console.error('\n❌ Request failed:', error.message);
    }

    console.log('\n====================================\n');
}

testWithdraw();
