// Test Health Check
const BASE_URL = 'http://localhost:3001';

async function testHealth() {
    console.log('\n====================================');
    console.log('Testing Health Check');
    console.log('====================================\n');

    try {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();

        console.log('✅ Health check passed!');
        console.log('Status:', data.status);
        console.log('Service:', data.service);
        console.log('Version:', data.version);
        console.log('Timestamp:', new Date(data.timestamp).toLocaleString());
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
    }

    console.log('\n====================================\n');
}

testHealth();
