/**
 * Test with the simplest possible transaction - just a view call
 * Then try actual state-changing call
 */

import { Account, RpcProvider, CallData, cairo } from 'starknet';
import { config } from '../src/config/env';

async function testSimpleTransaction() {
    console.log('🧪 Testing simple transactions...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    const account = new Account(
        provider,
        config.STARKNET_ACCOUNT_ADDRESS,
        config.SEPOLIA_PRIVATE_KEY,
        '1'
    );
    
    console.log(`Account: ${config.STARKNET_ACCOUNT_ADDRESS}`);
    
    // Get fresh nonce
    const nonce = await provider.getNonceForAddress(config.STARKNET_ACCOUNT_ADDRESS, 'latest');
    console.log(`Current nonce: ${nonce}\n`);
    
    // Test 1: Try minting with NO nonce specified (let starknet.js handle it)
    console.log('Test 1: Mint without explicit nonce...');
    try {
        const result = await account.execute([{
            contractAddress: config.MOCKBTC_CONTRACT_ADDRESS,
            entrypoint: 'mint',
            calldata: CallData.compile({
                recipient: config.VAULT_CONTRACT_ADDRESS,
                amount: cairo.uint256(1000000000000000)
            })
        }]);
        
        console.log('✅ SUCCESS!');
        console.log(`TX: ${result.transaction_hash}`);
        console.log(`https://sepolia.voyager.online/tx/${result.transaction_hash}\n`);
        return;
    } catch (err: any) {
        console.log('❌ Failed:', err.message.slice(0, 150));
    }
    
    // Test 2: Try with maxFee instead of resource_bounds
    console.log('\nTest 2: Using maxFee instead of resource_bounds...');
    try {
        const estimate = await account.estimateFee([{
            contractAddress: config.MOCKBTC_CONTRACT_ADDRESS,
            entrypoint: 'mint',
            calldata: CallData.compile({
                recipient: config.VAULT_CONTRACT_ADDRESS,
                amount: cairo.uint256(1000000000000000)
            })
        }]);
        
        const maxFee = BigInt(estimate.overall_fee) * BigInt(150) / BigInt(100); // 150% of estimate
        
        const result = await account.execute(
            [{
                contractAddress: config.MOCKBTC_CONTRACT_ADDRESS,
                entrypoint: 'mint',
                calldata: CallData.compile({
                    recipient: config.VAULT_CONTRACT_ADDRESS,
                    amount: cairo.uint256(1000000000000000)
                })
            }],
            undefined,
            { maxFee: maxFee.toString() }
        );
        
        console.log('✅ SUCCESS with maxFee!');
        console.log(`TX: ${result.transaction_hash}`);
        console.log(`https://sepolia.voyager.online/tx/${result.transaction_hash}\n`);
        
    } catch (err: any) {
        console.log('❌ Failed:', err.message.slice(0, 150));
    }
    
    console.log('\n❌ All tests failed');
}

testSimpleTransaction();
