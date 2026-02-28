/**
 * Disable the execution time delay on Braavos account
 */

import { Account, RpcProvider, CallData, Signer } from 'starknet';
import { config } from '../src/config/env';

async function disableTimeDelay() {
    console.log('🔧 Disabling Braavos execution time delay...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    console.log(`Account: ${config.STARKNET_ACCOUNT_ADDRESS}`);
    console.log(`Current delay: 0x54600 (345,600 seconds = 4 days)\n`);
    
    // Create account with explicit signer
    const signer = new Signer(config.SEPOLIA_PRIVATE_KEY);
    const account = new Account(provider, config.STARKNET_ACCOUNT_ADDRESS, signer, '1');
    
    console.log(`Current nonce: ${await account.getNonce()}\n`);
    
    try {
        // Call set_execution_time_delay(0) to disable
        console.log('⏱️  Setting execution time delay to 0...');
        
        const call = {
            contractAddress: config.STARKNET_ACCOUNT_ADDRESS,
            entrypoint: 'set_execution_time_delay',
            calldata: CallData.compile({
                execution_time_delay_sec: 0  // Set to 0 to disable
            })
        };
        
        // Estimate fee first
        const estimate = await account.estimateInvokeFee([call]);
        console.log(`✅ Fee estimate: ${estimate.overall_fee.toString()} wei\n`);
        
        // Execute transaction
        console.log('🚀 Submitting transaction...');
        const tx = await account.execute([call]);
        console.log(`✅ Transaction sent: ${tx.transaction_hash}`);
        console.log(`   Waiting for confirmation...`);
        
        const receipt = await provider.waitForTransaction(tx.transaction_hash);
        console.log(`✅ Transaction confirmed!`);
        console.log(`   Status: ${receipt.execution_status}`);
        console.log(`   Finality: ${receipt.finality_status}\n`);
        
        // Verify the change
        console.log('🔍 Verifying new time delay...');
        const result = await provider.callContract({
            contractAddress: config.STARKNET_ACCOUNT_ADDRESS,
            entrypoint: 'get_execution_time_delay',
            calldata: []
        });
        
        const newDelay = Number(BigInt(result[0]));
        console.log(`New delay: ${result[0]} (${newDelay} seconds)`);
        
        if (newDelay === 0) {
            console.log('✅ Time delay successfully disabled!');
            console.log('   You can now send transactions immediately.\n');
        } else {
            console.log(`⚠️  Time delay is still: ${newDelay} seconds`);
        }
        
    } catch (err: any) {
        console.error('❌ Failed to disable time delay:');
        console.error(err.message);
        
        if (err.message.includes('INVALID_SIG')) {
            console.log('\n⚠️  The INVALID_SIG error might be BECAUSE of the time delay.');
            console.log('   When time delay is enabled, Braavos may require:');
            console.log('   1. Submitting the transaction to a deferred queue');
            console.log('   2. Waiting the full delay period');
            console.log('   3. Then executing it separately\n');
            console.log('💡 SOLUTION: Disable the time delay directly in your Braavos wallet:');
            console.log('   1. Open Braavos browser extension');
            console.log('   2. Go to Settings → Security');
            console.log('   3. Look for "Transaction Delay" or "Time Lock"');
            console.log('   4. Disable it or set to 0\n');
        }
    }
}

disableTimeDelay().catch(console.error);
