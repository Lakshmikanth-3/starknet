/**
 * Get account class to determine account type
 */

import { RpcProvider } from 'starknet';
import { config } from '../src/config/env';

async function checkAccountType() {
    console.log('🔍 Checking account type...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    try {
        const classHash = '0x3957f9f5a1cbfe918cedc2015c85200ca51a5f7506ecb6de98a5207b759bf8a';
        const contractClass = await provider.getClassByHash(classHash);
        
        console.log('Account Class ABI:');
        console.log(JSON.stringify(contractClass.abi?.slice(0, 10) || [], null, 2));
        
        // Check if it's Braavos, OpenZeppelin, or Argent
        const abiStr = JSON.stringify(contractClass.abi);
        
        if (abiStr.includes('braavos') || abiStr.includes('Braavos')) {
            console.log('\n✓ This is a Braavos account');
        } else if (abiStr.includes('openzeppelin') || abiStr.includes('account::AccountComponent')) {
            console.log('\n✓ This is an OpenZeppelin account');
        } else if (abiStr.includes('argent') || abiStr.includes('Argent')) {
            console.log('\n✓ This is an Argent account');
        } else {
            console.log('\n⚠️  Unknown account type');
        }
        
    } catch (err: any) {
        console.error('❌ Error:', err.message);
    }
}

checkAccountType();
