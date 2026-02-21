// Test Create Vault
const fs = require('fs');
const BASE_URL = 'http://localhost:3001';

async function testCreateVault() {
    console.log('\n====================================');
    console.log('Testing Create Vault (Deposit)');
    console.log('====================================\n');

    const payload = {
        userAddress: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        amount: 2.5,
        lockPeriod: 90
    };

    console.log('📨 Request Body:', JSON.stringify(payload, null, 2));

    try {
        const res = await fetch(`${BASE_URL}/api/vaults`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success && data.data) {
            console.log('\n✅ Vault created successfully!');
            console.log('Vault ID:', data.data.vaultId);
            console.log('Commitment:', data.data.commitment);
            console.log('Amount:', payload.amount, 'BTC');
            console.log('APY:', (data.data.apy * 100) + '%');
            console.log('Lock Until:', new Date(data.data.unlockAt).toLocaleString());
            console.log('Randomness:', data.data.randomness || 'N/A');

            // Save vault info for other tests
            const vaultInfo = {
                vaultId: data.data.vaultId,
                randomness: data.data.randomness || `rand_${Date.now()}`,
                userAddress: payload.userAddress,
                amount: payload.amount
            };

            fs.writeFileSync('scripts/last-vault.json', JSON.stringify(vaultInfo, null, 2));
            console.log('\n💾 Vault info saved to scripts/last-vault.json');
        } else {
            console.error('\n❌ Failed to create vault!');
            console.error('Data:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('\n❌ Request failed:', error.message);
    }

    console.log('\n====================================\n');
}

testCreateVault();
