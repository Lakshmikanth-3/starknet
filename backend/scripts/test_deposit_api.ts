/**
 * Test deposit transaction with actual backend API
 */

async function testDeposit() {
    console.log('🧪 Testing deposit API call...\n');
    
    const testData = {
        vault_id: crypto.randomUUID(),
        commitment: '0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        amount: 0.001,
        secret: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    };
    
    console.log('Test Data:', JSON.stringify(testData, null, 2));
    console.log('\n📤 Sending POST to http://localhost:3001/api/commitment/deposit\n');
    
    try {
        const response = await fetch('http://localhost:3001/api/commitment/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ Request failed with status:', response.status);
            console.error('Error response:', JSON.stringify(data, null, 2));
            process.exit(1);
        }
        
        console.log('✅ Success! Response:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.transaction_hash) {
            console.log(`\n🔗 View on Voyager: https://sepolia.voyager.online/tx/${data.transaction_hash}`);
        }
        
    } catch (err: any) {
        console.error('❌ Test failed:', err.message);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    }
}

testDeposit();
