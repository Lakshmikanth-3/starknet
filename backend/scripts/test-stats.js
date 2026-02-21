// Test Platform Stats
const BASE_URL = 'http://localhost:3001';

async function testStats() {
    console.log('\n====================================');
    console.log('Testing Platform Statistics');
    console.log('====================================\n');

    try {
        const res = await fetch(`${BASE_URL}/api/stats`);
        const data = await res.json();

        if (data.success && data.data) {
            console.log('✅ Platform Stats Retrieved!\n');
            console.log('📊 Statistics:');
            console.log('  Total Vaults:', data.data.totalVaults);
            console.log('  Active Vaults:', data.data.activeVaults);
            console.log('  Total Value Locked:', data.data.totalValueLocked || 0, 'BTC');
        } else {
            console.error('\n❌ Failed to get stats!');
            console.error('Error:', data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('\n❌ Request failed:', error.message);
    }

    console.log('\n====================================\n');
}

testStats();
