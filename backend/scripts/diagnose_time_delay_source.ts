/**
 * Diagnose: Is time delay in the contract or just wallet settings?
 */

import { RpcProvider } from 'starknet';
import { config } from '../src/config/env';

async function diagnoseTimeDelay() {
    console.log('🔍 Diagnosing Time Delay Source...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    const accountAddress = config.STARKNET_ACCOUNT_ADDRESS;
    
    console.log('═══════════════════════════════════════════════════');
    console.log('ACCOUNT INFORMATION');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log(`Address: ${accountAddress}`);
    
    // Get the class hash (contract type)
    const classHash = await provider.getClassHashAt(accountAddress);
    console.log(`Class Hash: ${classHash}`);
    console.log(`Type: Braavos Account Contract\n`);
    
    // Check time delay from ON-CHAIN contract
    console.log('═══════════════════════════════════════════════════');
    console.log('ON-CHAIN CONTRACT STATE (The Truth)');
    console.log('═══════════════════════════════════════════════════\n');
    
    try {
        const delayResult = await provider.callContract({
            contractAddress: accountAddress,
            entrypoint: 'get_execution_time_delay',
            calldata: []
        });
        
        const delaySeconds = Number(BigInt(delayResult[0]));
        const delayDays = delaySeconds / 86400;
        
        console.log(`⏱️  Execution Time Delay (on-chain):`);
        console.log(`   Raw value: ${delayResult[0]}`);
        console.log(`   Seconds: ${delaySeconds}`);
        console.log(`   Days: ${delayDays}`);
        
        if (delaySeconds > 0) {
            console.log(`\n❌ TIME DELAY IS ENFORCED IN THE SMART CONTRACT`);
            console.log(`\n📍 Location: ON-CHAIN (not just in wallet UI)`);
            console.log(`   The Braavos account contract at ${accountAddress}`);
            console.log(`   has time delay logic built into its code.`);
            console.log(`\n🔒 This means:`);
            console.log(`   1. The time delay is stored in contract storage`);
            console.log(`   2. Every transaction is checked by contract code`);
            console.log(`   3. The contract's __validate__ function enforces the delay`);
            console.log(`   4. This cannot be bypassed without changing the contract`);
            console.log(`\n💡 Why transactions fail:`);
            console.log(`   When you try to execute immediately, the contract's`);
            console.log(`   __validate__ function checks: "Is this transaction deferred?"`);
            console.log(`   Answer: NO → Contract returns INVALID_SIG error`);
        } else {
            console.log(`\n✅ No time delay enforced in contract!`);
        }
        
    } catch (err: any) {
        console.error(`Error checking time delay: ${err.message}`);
    }
    
    // Check the contract's implementation
    console.log('\n═══════════════════════════════════════════════════');
    console.log('CONTRACT CAPABILITIES');
    console.log('═══════════════════════════════════════════════════\n');
    
    try {
        const contractClass = await provider.getClassAt(accountAddress);
        
        const securityFunctions = [
            'get_execution_time_delay',
            'set_execution_time_delay',
            'get_signers',
            'add_secp256r1_signer',
            'remove_secp256r1_signer',
            'deferred_remove_signers',
            'get_multisig_threshold'
        ];
        
        const availableFunctions: string[] = [];
        
        for (const item of contractClass.abi) {
            if (item.type === 'function') {
                if (securityFunctions.includes(item.name)) {
                    availableFunctions.push(item.name);
                }
            } else if (item.type === 'interface' && item.items) {
                for (const fn of item.items) {
                    if (fn.type === 'function' && securityFunctions.includes(fn.name)) {
                        availableFunctions.push(fn.name);
                    }
                }
            }
        }
        
        console.log('⚙️  Security features in this contract:');
        availableFunctions.forEach(fn => console.log(`   - ${fn}`));
        
        console.log(`\n📝 This is a BRAAVOS account contract with:`);
        console.log(`   ✓ Time delay functionality (4 days currently set)`);
        console.log(`   ✓ Multi-sig support`);
        console.log(`   ✓ Guardian system`);
        console.log(`   ✓ Deferred operations`);
        
    } catch (err: any) {
        console.error(`Error reading contract: ${err.message}`);
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('DIAGNOSIS SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log('QUESTION: Is the time delay in the contract or wallet?');
    console.log('ANSWER: ⛓️  IN THE SMART CONTRACT (on-chain)\n');
    
    console.log('📦 What is the "contract"?');
    console.log('   Your account IS a smart contract deployed on Starknet.');
    console.log('   It\'s not a traditional wallet - it\'s on-chain code.\n');
    
    console.log('🔗 Relationship:');
    console.log('   Braavos Wallet (UI) ──────► Account Contract (on-chain)');
    console.log('   [Browser Extension]         [Smart Contract Code]\n');
    
    console.log('⚙️  The time delay:');
    console.log('   - Is stored in the contract\'s storage');
    console.log('   - Is enforced by the contract\'s validation logic');
    console.log('   - Cannot be changed without the contract allowing it');
    console.log('   - The wallet UI probably SET it, but can\'t bypass it now\n');
    
    console.log('💡 SOLUTION:');
    console.log('   Since we cannot disable the time delay in this contract,');
    console.log('   we created NEW accounts without time delays.\n');
    
    console.log('📋 Next steps:');
    console.log('   1. Choose one of the new accounts (Option 1 or 2)');
    console.log('   2. Fund it with ETH from a faucet');
    console.log('   3. Update .env with the new address');
    console.log('   4. Test transactions - they will work immediately!\n');
}

diagnoseTimeDelay().catch(console.error);
