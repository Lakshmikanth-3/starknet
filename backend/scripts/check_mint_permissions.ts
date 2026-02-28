/**
 * Check who can mint tokens on the MockBTC contract
 */

import { RpcProvider } from 'starknet';
import { config } from '../src/config/env';

async function checkMintPermissions() {
    console.log('🔍 Checking MockBTC mint permissions...\n');
    console.log(`Token: ${config.MOCKBTC_CONTRACT_ADDRESS}`);
    console.log(`Account: ${config.STARKNET_ACCOUNT_ADDRESS}\n`);
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    // Check if there's an owner function
    const functionNames = ['owner', 'get_owner', 'getOwner'];
    
    for (const fnName of functionNames) {
        try {
            const result = await provider.callContract({
                contractAddress: config.MOCKBTC_CONTRACT_ADDRESS,
                entrypoint: fnName,
                calldata: []
            }, 'latest');
            
            console.log(`✅ ${fnName}() returned: ${result[0]}`);
            console.log(`   Is our account the owner? ${result[0] === config.STARKNET_ACCOUNT_ADDRESS ? 'YES ✅' : 'NO ❌'}\n`);
            
            if (result[0] !== config.STARKNET_ACCOUNT_ADDRESS) {
                console.log(`⚠️  Our account (${config.STARKNET_ACCOUNT_ADDRESS}) is NOT the owner!`);
                console.log(`   The owner is: ${result[0]}`);
                console.log(`   This might explain why minting fails!\n`);
            }
            
            break;
        } catch (err: any) {
            // Try next function name
        }
    }
    
    // Try to get the contract class to see the full ABI
    try {
        const contractClass = await provider.getClassAt(config.MOCKBTC_CONTRACT_ADDRESS);
        
        console.log('\n📋 Token Contract Functions:');
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
        
        // Check if mint requires owner
        const mintFn = contractClass.abi.find((item: any) => {
            if (item.type === 'function' && item.name === 'mint') return true;
            if (item.type === 'interface' && item.items) {
                return item.items.some((i: any) => i.name === 'mint');
            }
            return false;
        });
        
        if (mintFn) {
            console.log('\n📝 mint() function details:', JSON.stringify(mintFn, null, 2));
        }
        
    } catch (err: any) {
        console.error('Error checking contract:', err.message);
    }
}

checkMintPermissions();
