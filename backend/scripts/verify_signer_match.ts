/**
 * Check if the private key actually matches the account's signer
 */

import { RpcProvider, ec, CallData, hash } from 'starknet';
import { config } from '../src/config/env';

async function verifySignerMatch() {
    console.log('🔍 Verifying signer match...\n');
    
    // Derive public key from our private key
    const derivedPubKey = ec.starkCurve.getStarkKey(config.SEPOLIA_PRIVATE_KEY);
    console.log(`Derived Public Key from private key: ${derivedPubKey}\n`);
    
    // Try to read the actual signer from the Braavos account
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    try {
        // Braavos accounts store the signer public key
        // Try common storage locations
        const signerSelectors = [
            'get_signers',
            'get_public_key', 
            'getSigner',
            'get_signer',
            'getPublicKey'
        ];
        
        for (const fnName of signerSelectors) {
            try {
                const selector = hash.getSelectorFromName(fnName);
                console.log(`Trying ${fnName} (${selector})...`);
                
                const result = await provider.callContract({
                    contractAddress: config.STARKNET_ACCOUNT_ADDRESS,
                    entrypoint: fnName,
                    calldata: []
                }, 'latest');
                
                console.log(`✅ ${fnName} returned:`, result);
                
                if (result && result.length > 0) {
                    // For Braavos get_signers, the public key is at index 1
                    const accountPubKey = fnName === 'get_signers' ? result[1] : result[0];
                    console.log(`\nAccount's Public Key: ${accountPubKey}`);
                    console.log(`Derived Public Key:   ${derivedPubKey}`);
                    console.log(`Match: ${accountPubKey === derivedPubKey ? '✅ YES' : '❌ NO'}`);
                    
                    if (accountPubKey !== derivedPubKey) {
                        console.log('\n❌ MISMATCH! The private key does NOT belong to this account.');
                        console.log('   You need to export the correct private key from your Braavos wallet.');
                    } else {
                        console.log('\n✅ PERFECT MATCH! Keys are correct.');
                        console.log('   The signing issue must be something else (maybe nonce or tx format).');
                    }
                    break;
                }
            } catch (err: any) {
                // Continue trying
            }
        }
        
        // If we couldn't find it via function calls, try reading storage directly
        console.log('\n\nTrying direct storage read...');
        
        // Braavos typically stores signer at storage position 0 or 1
        for (let i = 0; i < 5; i++) {
            try {
                const storageKey = `0x${i}`;
                const value = await provider.getStorageAt(
                    config.STARKNET_ACCOUNT_ADDRESS,
                    storageKey,
                    'latest'
                );
                console.log(`Storage[${i}]: ${value}`);
                
                if (value !== '0x0' && value.length > 10) {
                    console.log(`\nComparing with derived: ${derivedPubKey}`);
                    if (value === derivedPubKey) {
                        console.log('✅ MATCH! Found signer at storage position', i);
                    }
                }
            } catch (err) {
                // Continue
            }
        }
        
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

verifySignerMatch();
