/**
 * Calculate function selectors and check token contract
 */

import { RpcProvider, hash } from 'starknet';
import { config } from '../src/config/env';

async function debugTokenContract() {
    console.log('🔍 Debugging token contract interaction...\n');
    
    // Calculate selectors for different function names
    const selectors = [
        'transfer_from',
        'transferFrom',
        'transfer',
        'approve',
    ];
    
    console.log('📊 Function Selectors:');
    for (const name of selectors) {
        const selector = hash.getSelectorFromName(name);
        console.log(`  ${name}: ${selector}`);
    }
    
    console.log(`\n🔎 Problematic selector from error: 0x3704ffe8fba161be0e994951751a5033b1462b918ff785c0a636be718dfdb68`);
    const errorSelector = '0x3704ffe8fba161be0e994951751a5033b1462b918ff785c0a636be718dfdb68';
    
    console.log('\n📋 Checking token contract class...');
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    try {
        console.log(`Token contract address: ${config.SBTC_CONTRACT_ADDRESS}`);
        
        // Try to get class
        const classHash = await provider.getClassHashAt(config.SBTC_CONTRACT_ADDRESS);
        console.log(`Class hash: ${classHash}`);
        
        // Try a simple call to see if contract exists
        const balance = await provider.callContract({
            contractAddress: config.SBTC_CONTRACT_ADDRESS,
            entrypoint: 'balanceOf',
            calldata: [config.STARKNET_ACCOUNT_ADDRESS]
        });
        
        console.log('✓ Token contract is reachable');
        console.log('Balance result:', balance);
        
    } catch (err: any) {
        console.error('❌ Error accessing token contract:', err.message);
    }
}

debugTokenContract();
