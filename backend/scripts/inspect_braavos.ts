/**
 * Deep inspect the Braavos account contract
 */

import { RpcProvider, CallData } from 'starknet';
import { config } from '../src/config/env';

async function inspectBraavosAccount() {
    console.log('🔍 Deep inspection of Braavos account...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    const accountAddress = config.STARKNET_ACCOUNT_ADDRESS;
    
    console.log(`Account: ${accountAddress}`);
    
    // Get class hash
    const classHash = await provider.getClassHashAt(accountAddress);
    console.log(`Class hash: ${classHash}`);
    console.log(`Known Braavos class: 0x3957f9f5a1cbfe918cedc2015c85200ca51a5f7506ecb6de98a5207b759bf8a\n`);
    
    // Try to call various Braavos-specific functions
    console.log('📋 Checking account functions...\n');
    
    // Check signers
    try {
        const result = await provider.callContract({
            contractAddress: accountAddress,
            entrypoint: 'get_signers',
            calldata: []
        });
        console.log(`✅ get_signers() returned ${result.length} values:`);
        result.forEach((val, idx) => console.log(`   [${idx}]: ${val}`));
        console.log('');
    } catch (err: any) {
        console.log(`❌ get_signers() failed: ${err.message}\n`);
    }
    
    // Check if there's a guardian
    try {
        const result = await provider.callContract({
            contractAddress: accountAddress,
            entrypoint: 'get_guardian',
            calldata: []
        });
        console.log(`✅ get_guardian() returned: ${result[0]}`);
        if (result[0] === '0x0') {
            console.log(`   No guardian set ✅`);
        } else {
            console.log(`   ⚠️  Guardian is set: ${result[0]}`);
            console.log(`   This might require additional signatures!`);
        }
        console.log('');
    } catch (err: any) {
        console.log(`❌ get_guardian() failed: ${err.message}\n`);
    }
    
    // Check execution status
    try {
        const result = await provider.callContract({
            contractAddress: accountAddress,
            entrypoint: 'get_execution_time_delay',
            calldata: []
        });
        console.log(`✅ get_execution_time_delay() returned: ${result[0]}`);
        if (result[0] !== '0x0') {
            console.log(`   ⚠️  Account has time delay enabled!`);
        }
        console.log('');
    } catch (err: any) {
        console.log(`❌ get_execution_time_delay() failed: ${err.message}\n`);
    }
    
    // Check if account is initialized
    try {
        const result = await provider.callContract({
            contractAddress: accountAddress,
            entrypoint: 'is_initialized',
            calldata: []
        });
        console.log(`✅ is_initialized() returned: ${result[0]}\n`);
    } catch (err: any) {
        console.log(`❌ is_initialized() failed: ${err.message}\n`);
    }
    
    // Check public key directly  
    try {
        const result = await provider.callContract({
            contractAddress: accountAddress,
            entrypoint: 'get_public_key',
            calldata: []
        });
        console.log(`✅ get_public_key() returned: ${result[0]}`);
        console.log(`   Expected: 0x51fff59a2581644e214629c001214a72686596fb3046c4ff092e2c2338e1ab9`);
        console.log(`   Match: ${result[0] === '0x51fff59a2581644e214629c001214a72686596fb3046c4ff092e2c2338e1ab9' ? '✅ YES' : '❌ NO'}\n`);
    } catch (err: any) {
        console.log(`❌ get_public_key() failed: ${err.message}\n`);
    }
    
    // Get full contract ABI
    try {
        const contractClass = await provider.getClassAt(accountAddress);
        console.log('📜 Contract ABI functions:');
        
        const functions: string[] = [];
        for (const item of contractClass.abi) {
            if (item.type === 'function') {
                functions.push(item.name);
            } else if (item.type === 'interface' && item.items) {
                for (const fn of item.items) {
                    if (fn.type === 'function') {
                        functions.push(fn.name);
                    }
                }
            }
        }
        
        functions.forEach(fn => console.log(`  - ${fn}`));
        
    } catch (err: any) {
        console.error(`Error: ${err.message}`);
    }
}

inspectBraavosAccount().catch(console.error);
