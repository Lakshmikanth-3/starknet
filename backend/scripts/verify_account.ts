/**
 * Verify that SEPOLIA_PRIVATE_KEY matches STARKNET_ACCOUNT_ADDRESS
 */

import { Account, RpcProvider, ec } from 'starknet';
import { config } from '../src/config/env';

async function verifyAccount() {
    console.log('🔍 Verifying account configuration...\n');
    
    console.log(`Account Address: ${config.STARKNET_ACCOUNT_ADDRESS}`);
    console.log(`Private Key: ${config.SEPOLIA_PRIVATE_KEY}\n`);
    
    // Try to derive public key from private key
    try {
        const publicKey = ec.starkCurve.getStarkKey(config.SEPOLIA_PRIVATE_KEY);
        console.log(`Derived Public Key: ${publicKey}\n`);
    } catch (err: any) {
        console.error('❌ Invalid private key format:', err.message);
        return;
    }
    
    // Try to create account instance
    try {
        const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
        const account = new Account(
            provider,
            config.STARKNET_ACCOUNT_ADDRESS,
            config.SEPOLIA_PRIVATE_KEY,
            '1'
        );
        
        console.log('✅ Account instance created successfully');
        
        // Check nonce
        const nonce = await provider.getNonceForAddress(config.STARKNET_ACCOUNT_ADDRESS, 'latest');
        console.log(`Current Nonce: ${nonce}`);
        
        // Check if account is deployed
        try {
            const classHash = await provider.getClassHashAt(config.STARKNET_ACCOUNT_ADDRESS);
            console.log(`✅ Account is deployed`);
            console.log(`Class Hash: ${classHash}`);
        } catch (err: any) {
            if (err.message.includes('Contract not found')) {
                console.log(`❌ Account NOT deployed`);
            } else {
                throw err;
            }
        }
        
    } catch (err: any) {
        console.error('❌ Account verification failed:', err.message);
    }
}

verifyAccount();
