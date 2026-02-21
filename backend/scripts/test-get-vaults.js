// Test Get User Vaults
const BASE_URL = 'http://localhost:3001';
const userAddress = process.argv[2] || '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

async function testGetVaults() {
    console.log('\n====================================');
    console.log('Testing Get User Vaults');
    console.log('====================================\n');

    console.log('🔍 Fetching vaults for:', userAddress);

    try {
        const res = await fetch(`${BASE_URL}/api/vaults/${userAddress}`);
        const data = await res.json();

        if (data.success && data.data) {
            console.log(`\n✅ Found ${data.data.length} vault(s)!\n`);

            data.data.forEach((vault, idx) => {
                console.log(`📦 Vault ${idx + 1}:`);
                console.log('  ID:', vault.vault_id);
                console.log('  Status:', vault.status);
                console.log('  User Address:', vault.user_address);
                console.log('  Lock Period:', vault.lock_period, 'days');
                console.log('  APY:', (vault.apy * 100) + '%');
                console.log('  Created:', new Date(vault.created_at).toLocaleString());
                console.log('  Unlocks:', new Date(vault.unlock_at).toLocaleString());
                console.log('');
            });
        } else {
            console.error('\n❌ Failed to get vaults!');
            console.error('Error:', data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('\n❌ Request failed:', error.message);
    }

    console.log('====================================\n');
}

testGetVaults();
