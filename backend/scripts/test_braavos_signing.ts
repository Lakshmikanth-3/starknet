/**
 * Test different Braavos account initialization methods
 * to find the correct signing approach
 */

import { Account, RpcProvider, CallData, cairo } from 'starknet';
import { config } from '../src/config/env';

async function testBraavosAccount() {
    console.log('🧪 Testing Braavos account signing methods...\n');
    console.log(`Account: ${config.STARKNET_ACCOUNT_ADDRESS}\n`);
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    // Test with different cairo versions
    const cairoVersions = ['1', '0', undefined];
    
    for (const version of cairoVersions) {
        try {
            console.log(`\n🔧 Testing with cairoVersion: ${version || 'default'}`);
            
            const account = new Account(
                provider,
                config.STARKNET_ACCOUNT_ADDRESS,
                config.SEPOLIA_PRIVATE_KEY,
                version as any
            );
            
            // Get current nonce
            const nonce = await provider.getNonceForAddress(config.STARKNET_ACCOUNT_ADDRESS, 'latest');
            console.log(`  Current nonce: ${nonce}`);
            
            // Try to estimate fee for a simple mint transaction
            console.log(`  Estimating fee for mint transaction...`);
            
            const calldata = CallData.compile({
                recipient: config.VAULT_CONTRACT_ADDRESS,
                amount: cairo.uint256(1000000000000000) // 0.001
            });
            
            const call = {
                contractAddress: config.MOCKBTC_CONTRACT_ADDRESS,
                entrypoint: 'mint',
                calldata
            };
            
            try {
                const estimate = await account.estimateFee([call], { blockIdentifier: 'latest' });
                console.log(`  ✅ Fee estimation succeeded!`);
                console.log(`     Overall fee: ${estimate.overall_fee}`);
                console.log(`     Gas consumed: ${estimate.gas_consumed}`);
                console.log(`  ✅ This cairoVersion works: ${version || 'default'}`);
                
                // Try actual execution
                console.log(`\n  🚀 Attempting actual transaction...`);
                const result = await account.execute([call], undefined, { 
                    nonce, 
                    blockIdentifier: 'latest' 
                });
                
                console.log(`  ✅✅ Transaction submitted successfully!`);
                console.log(`     TX Hash: ${result.transaction_hash}`);
                console.log(`     Voyager: https://sepolia.voyager.online/tx/${result.transaction_hash}`);
                
                return; // Success - exit
                
            } catch (err: any) {
                console.log(`  ❌ Estimation failed: ${err.message.slice(0, 200)}`);
            }
            
        } catch (err: any) {
            console.log(`  ❌ Account creation failed: ${err.message}`);
        }
    }
    
    console.log('\n❌ All methods failed. This might be a different issue.');
}

testBraavosAccount();
