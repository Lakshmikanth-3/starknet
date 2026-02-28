/**
 * Test Braavos transaction with full error logging
 */

import { Account, RpcProvider, CallData, cairo } from 'starknet';
import { config } from '../src/config/env';
import fs from 'fs';

async function testTransaction() {
    console.log('🧪 Testing Braavos transaction...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    const account = new Account(
        provider,
        config.STARKNET_ACCOUNT_ADDRESS,
        config.SEPOLIA_PRIVATE_KEY,
        '1'
    );
    
    try {
        const nonce = await provider.getNonceForAddress(config.STARKNET_ACCOUNT_ADDRESS, 'latest');
        console.log(`Nonce: ${nonce}\n`);
        
        const calldata = CallData.compile({
            recipient: config.VAULT_CONTRACT_ADDRESS,
            amount: cairo.uint256(1000000000000000)
        });
        
        console.log('Executing transaction...\n');
        
        const result = await account.execute(
            [{
                contractAddress: config.MOCKBTC_CONTRACT_ADDRESS,
                entrypoint: 'mint',
                calldata
            }],
            undefined,
            { nonce, blockIdentifier: 'latest' }
        );
        
        console.log('✅ SUCCESS!');
        console.log(`TX Hash: ${result.transaction_hash}`);
        console.log(`https://sepolia.voyager.online/tx/${result.transaction_hash}`);
        
    } catch (err: any) {
        console.log('❌ FAILED\n');
        console.log('Error message:', err.message);
        console.log('\n--- Full Error ---');
        console.log(JSON.stringify(err, null, 2));
        
        // Save to file
        fs.writeFileSync('tx_error_full.json', JSON.stringify({
            message: err.message,
            stack: err.stack,
            fullError: err
        }, null, 2));
        console.log('\nFull error saved to tx_error_full.json');
    }
}

testTransaction();
