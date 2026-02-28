/**
 * Check account transaction history
 */

async function checkTransactionHistory() {
    console.log('🔍 Checking account transaction history...\n');
    
    const accountAddress = '0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1';
    
    // Fetch from Voyager API
    const url = `https://sepolia.voyager.online/api/contract/${accountAddress}/transactions?ps=50&p=1`;
    
    try {
        console.log(`Fetching transactions from Voyager...\n`);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            console.log(`Found ${data.items.length} transactions:\n`);
            
            data.items.slice(0, 10).forEach((tx: any, i: number) => {
                console.log(`${i + 1}. ${tx.hash}`);
                console.log(`   Type: ${tx.type}`);
                console.log(`   Status: ${tx.status}`);
                console.log(`   Timestamp: ${new Date(tx.timestamp * 1000).toISOString()}`);
                console.log('');
            });
            
            // Check if any were successful
            const successful = data.items.filter((tx: any) => tx.status === 'ACCEPTED_ON_L2' || tx.status === 'ACCEPTED_ON_L1');
            console.log(`\n✅ ${successful.length} successful transactions`);
            
            if (successful.length === 0) {
                console.log('\n⚠️  This account has NEVER successfully executed a transaction!');
                console.log('   This suggests the private key might be wrong or the account was set up differently.');
            }
        } else {
            console.log('❌ No transactions found for this account.');
            console.log('\n   Current nonce is 0x2, but no transaction history?');
            console.log('   This is unusual - nonce should be 0 if no txs succeeded.');
        }
        
    } catch (err: any) {
        console.error('❌ Error:', err.message);
    }
}

checkTransactionHistory();
