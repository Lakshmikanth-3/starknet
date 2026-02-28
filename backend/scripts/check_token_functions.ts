/**
 * Check what functions the MockBTC token actually has
 */

import { RpcProvider } from 'starknet';
import { config } from '../src/config/env';

async function checkTokenFunctions() {
    console.log('🔍 Checking MockBTC token functions...\n');
    console.log(`Token address: ${config.MOCKBTC_CONTRACT_ADDRESS}\n`);
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    try {
        // Get the contract class
        const contractClass = await provider.getClassAt(config.MOCKBTC_CONTRACT_ADDRESS);
        
        console.log('📋 Token Contract ABI Functions:\n');
        
        // Find all functions
        const functions: any[] = [];
        
        for (const item of contractClass.abi) {
            if (item.type === 'function') {
                functions.push(item);
            } else if (item.type === 'interface' && item.items) {
                for (const fn of item.items) {
                    if (fn.type === 'function') {
                        functions.push(fn);
                    }
                }
            }
        }
        
        if (functions.length === 0) {
            console.log('❌ No functions found in ABI!');
        } else {
            functions.forEach(fn => {
                const inputs = fn.inputs?.map((i: any) => `${i.name}: ${i.type}`).join(', ') || '';
                console.log(`  ✓ ${fn.name}(${inputs})`);
            });
        }
        
        // Check specifically for transfer_from variants
        console.log('\n🔎 Checking for transfer functions:');
        const transferFns = functions.filter(f => 
            f.name.toLowerCase().includes('transfer') || 
            f.name.includes('approve')
        );
        
        if (transferFns.length > 0) {
            transferFns.forEach(fn => {
                console.log(`\n  Function: ${fn.name}`);
                console.log(`  Inputs: ${JSON.stringify(fn.inputs, null, 4)}`);
            });
        } else {
            console.log('  ❌ No transfer-related functions found!');
        }
        
    } catch (err: any) {
        console.error('❌ Error:', err.message);
        if (err.stack) console.error(err.stack);
    }
}

checkTokenFunctions();
