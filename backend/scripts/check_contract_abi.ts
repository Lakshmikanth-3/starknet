/**
 * Fetch the deployed contract's actual ABI from Starknet
 * and compare with our local ABI definition
 */

import { RpcProvider, Contract } from 'starknet';
import { config } from '../src/config/env';

async function checkContractABI() {
    console.log('🔍 Checking deployed contract ABI...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    try {
        // Get the class hash of the deployed contract
        const classHash = await provider.getClassHashAt(config.VAULT_CONTRACT_ADDRESS);
        console.log(`✓ Contract Class Hash: ${classHash}\n`);
        
        // Get the full contract class (includes ABI)
        const contractClass = await provider.getClassAt(config.VAULT_CONTRACT_ADDRESS);
        
        console.log('📋 Contract ABI:');
        console.log(JSON.stringify(contractClass.abi, null, 2));
        
        // Check if deposit function exists
        const depositFn = contractClass.abi.find((item: any) => 
            item.type === 'function' && item.name === 'deposit'
        );
        
        if (depositFn) {
            console.log('\n✓ deposit() function found in ABI:');
            console.log(JSON.stringify(depositFn, null, 2));
        } else {
            console.log('\n✗ deposit() function NOT FOUND in ABI!');
            console.log('Available functions:');
            contractClass.abi
                .filter((item: any) => item.type === 'function')
                .forEach((fn: any) => {
                    console.log(`  - ${fn.name}`);
                });
        }
        
    } catch (err: any) {
        console.error('❌ Error fetching contract:', err.message);
        process.exit(1);
    }
}

checkContractABI();
