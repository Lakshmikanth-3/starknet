
const BASE_URL = 'http://localhost:3001';

async function diagnose() {
    console.log('--- Diagnostic: BTC Status ---');
    try {
        const res = await fetch(`${BASE_URL}/api/bridge/btc-status`);
        console.log('Status Code:', res.status);
        const data = await res.json();
        console.log('Response Body:', JSON.stringify(data, null, 2));

        if (data.success && data.data && data.data.status === 'synced') {
            console.log('✅ Bridge endpoint is healthy and synced.');
        } else {
            console.log('❌ Bridge endpoint returned unexpected data.');
        }
    } catch (err) {
        console.error('❌ Request failed:', err.message);
    }
}

diagnose();
