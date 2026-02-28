/**
 * Test script to run AFTER disabling time delay in Braavos wallet
 */

import { Account, RpcProvider, Contract, cairo, Signer } from 'starknet';
import { config } from '../src/config/env';

async function testAfterFix() {
    console.log('🧪 Testing account after time delay fix...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    // Verify time delay is disabled
    console.log('🔍 Step 1: Verify time delay is disabled...');
    try {
        const delayResult = await provider.callContract({
            contractAddress: config.STARKNET_ACCOUNT_ADDRESS,
            entrypoint: 'get_execution_time_delay',
            calldata: []
        });
        
        const delay = Number(BigInt(delayResult[0]));
        console.log(`   Current delay: ${delayResult[0]} (${delay} seconds)`);
        
        if (delay === 0) {
            console.log('   ✅ Time delay is DISABLED - transactions should work!\n');
        } else {
            console.log(`   ❌ Time delay is still ${delay} seconds (${delay / 86400} days)`);
            console.log('   ⚠️  Please disable it in Braavos wallet settings first!\n');
            return;
        }
    } catch (err: any) {
        console.log(`   ⚠️  Could not check time delay: ${err.message}\n`);
    }
    
    // Create account
    const signer = new Signer(config.SEPOLIA_PRIVATE_KEY);
    const account = new Account(provider, config.STARKNET_ACCOUNT_ADDRESS, signer, '1');
    
    console.log(`Account: ${config.STARKNET_ACCOUNT_ADDRESS}`);
    console.log(`Nonce: ${await account.getNonce()}\n`);
    
    // Test 1: Mint tokens to vault
    console.log('💰 Step 2: Test minting tokens...');
    try {
        const tokenAbi = [
            {
                type: 'function',
                name: 'mint',
                inputs: [
                    { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
                    { name: 'amount', type: 'core::integer::u256' }
                ],
                outputs: [],
                state_mutability: 'external'
            }
        ];
        
        const token = new Contract(tokenAbi, config.MOCKBTC_CONTRACT_ADDRESS, account);
        const vaultAddress = config.VAULT_CONTRACT_ADDRESS;
        const amount = cairo.uint256(1000000); // 0.001 BTC
        
        const call = token.populate('mint', [vaultAddress, amount]);
        
        console.log(`   Minting ${amount} tokens to vault...`);
        const tx = await account.execute([call]);
        console.log(`   ✅ Transaction submitted: ${tx.transaction_hash}`);
        console.log(`   Waiting for confirmation...`);
        
        const receipt = await provider.waitForTransaction(tx.transaction_hash);
        
        if (receipt.execution_status === 'SUCCEEDED') {
            console.log(`   ✅ Transaction SUCCEEDED!`);
            console.log(`   Block: ${receipt.block_number}`);
            console.log(`   Gas used: ${receipt.actual_fee}\n`);
        } else {
            console.log(`   ❌ Transaction failed: ${receipt.execution_status}\n`);
        }
        
    } catch (err: any) {
        console.error(`   ❌ Mint failed: ${err.message}\n`);
        
        if (err.message.includes('INVALID_SIG')) {
            console.log('   ⚠️  STILL getting INVALID_SIG!');
            console.log('   This means the time delay is still enabled.');
            console.log('   Please check Braavos wallet settings again.\n');
        }
        return;
    }
    
    // Test 2: Test deposit API endpoint
    console.log('🌐 Step 3: Test deposit API...');
    try {
        const response = await fetch('http://localhost:3001/api/commitment/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vault_id: 'test-vault-' + Date.now(),
                commitment: '0x' + '1'.repeat(63) + '2',
                amount: 0.001,
                secret: '0x' + '3'.repeat(63) + '4'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Deposit API works!');
            console.log('   Response:', data);
        } else {
            const error = await response.json();
            console.log('   ❌ Deposit API failed:', error);
        }
    } catch (err: any) {
        console.log(`   ⚠️  Could not test API: ${err.message}`);
        console.log('   Make sure backend is running: npm run dev');
    }
    
    console.log('\n✅ ALL TESTS COMPLETE!');
    console.log('If all tests passed, your account is ready for production use.\n');
}

testAfterFix().catch(console.error);
