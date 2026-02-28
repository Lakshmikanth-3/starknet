/**
 * Generate a fresh account with no time delays
 * 
 * OPTION 1: Create completely new account (RECOMMENDED)
 * OPTION 2: Use existing key with different account contract
 */

import { RpcProvider, ec, hash, CallData, Account } from 'starknet';
import { config } from '../src/config/env';
import * as crypto from 'crypto';

async function generateFreshAccount() {
    console.log('🎯 SOLUTION: Create Fresh Account Without Time Delays\n');
    console.log('Choose an option:\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    // OPTION 1: Generate completely new private key
    console.log('═══════════════════════════════════════════════════');
    console.log('OPTION 1: NEW PRIVATE KEY (RECOMMENDED)');
    console.log('═══════════════════════════════════════════════════\n');
    
    // Generate a valid Stark curve private key
    let newPrivateKey: string;
    let newPublicKey: string;
    
    // Keep generating until we get a valid one
    do {
        const randomBytes = crypto.randomBytes(31); // 31 bytes to stay within curve order
        const randomHex = randomBytes.toString('hex');
        newPrivateKey = '0x' + randomHex.padStart(62, '0');
        
        try {
            newPublicKey = ec.starkCurve.getStarkKey(newPrivateKey.slice(2));
            break; // Success!
        } catch {
            continue; // Try again
        }
    } while (true);
    
    // OpenZeppelin account class (simple, no time delays)
    const OZ_CLASS = '0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f';
    
    // getStarkKey returns without 0x prefix
    const publicKeyWith0x = newPublicKey.startsWith('0x') ? newPublicKey : `0x${newPublicKey}`;
    
    const constructorCalldata = CallData.compile({ publicKey: publicKeyWith0x });
    const salt = publicKeyWith0x;
    
    const newAccountAddress = hash.calculateContractAddressFromHash(
        salt,
        OZ_CLASS,
        constructorCalldata,
        0
    );
    
    console.log('📝 NEW ACCOUNT CREDENTIALS:');
    console.log(`Address: ${newAccountAddress}`);
    console.log(`Private Key: ${newPrivateKey}`);
    console.log(`Public Key: ${publicKeyWith0x}\n`);
    
    console.log('⚠️  SAVE THESE CREDENTIALS SECURELY! ⚠️\n');
    
    console.log('📋 DEPLOYMENT STEPS:');
    console.log('1. Send 0.01 ETH to the new address:');
    console.log(`   ${newAccountAddress}\n`);
    console.log(`2. View on Starkscan: https://sepolia.starkscan.co/contract/${newAccountAddress}\n`);
    console.log('3. Once ETH arrives, deploy using Starknet.js:\n');
    console.log('   npx tsx scripts/deploy_account_helper.ts\n');
    
    console.log('4. Update .env file:');
    console.log(`   STARKNET_ACCOUNT_ADDRESS=${newAccountAddress}`);
    console.log(`   SEPOLIA_PRIVATE_KEY=${newPrivateKey}\n`);
    
    // Save to a file
    const fs = require('fs');
    const credentials = {
        address: newAccountAddress,
        privateKey: newPrivateKey,
        publicKey: publicKeyWith0x,
        classHash: OZ_CLASS,
        deploymentInstructions: [
            `1. Send 0.01 ETH to: ${newAccountAddress}`,
            `2. Wait for ETH to arrive`,
            `3. Run: npx tsx scripts/deploy_account_helper.ts`,
            `4. Update .env with new address and private key`
        ]
    };
    
    fs.writeFileSync(
        './NEW_ACCOUNT_CREDENTIALS.json',
        JSON.stringify(credentials, null, 2)
    );
    
    console.log('✅ Credentials saved to: NEW_ACCOUNT_CREDENTIALS.json\n');
    
    // OPTION 2: Reuse existing key with OZ account
    console.log('═══════════════════════════════════════════════════');
    console.log('OPTION 2: REUSE EXISTING KEY (Alternative)');
    console.log('═══════════════════════════════════════════════════\n');
    
    const existingPrivateKey = config.SEPOLIA_PRIVATE_KEY;
    const existingPublicKey = ec.starkCurve.getStarkKey(
        existingPrivateKey.startsWith('0x') ? existingPrivateKey.slice(2) : existingPrivateKey
    );
    const existingPublicKeyWith0x = existingPublicKey.startsWith('0x') ? existingPublicKey : `0x${existingPublicKey}`;
    
    const existingCalldata = CallData.compile({ publicKey: existingPublicKeyWith0x });
    const existingSalt = existingPublicKeyWith0x;
    
    const existingOzAddress = hash.calculateContractAddressFromHash(
        existingSalt,
        OZ_CLASS,
        existingCalldata,
        0
    );
    
    console.log('📝 OZ ACCOUNT WITH YOUR EXISTING KEY:');
    console.log(`Address: ${existingOzAddress}`);
    console.log(`Private Key: ${existingPrivateKey} (same as current)`);
    console.log(`Public Key: ${existingPublicKeyWith0x}\n`);
    
    // Check if it exists
    try {
        await provider.getClassHashAt(existingOzAddress);
        console.log('✅ This account already exists!\n');
        
        // Test if it has time delay
        try {
            const delay = await provider.callContract({
                contractAddress: existingOzAddress,
                entrypoint: 'get_execution_time_delay',
                calldata: []
            });
            console.log(`⚠️  Has time delay: ${delay[0]}\n`);
        } catch {
            console.log('✅ No time delay! You can use this account.\n');
            console.log('📋 Update .env:');
            console.log(`   STARKNET_ACCOUNT_ADDRESS=${existingOzAddress}\n`);
        }
    } catch {
        console.log('⚠️  Account not deployed. Follow same steps as Option 1.\n');
    }
    
    console.log('═══════════════════════════════════════════════════');
    console.log('RECOMMENDATION:');
    console.log('═══════════════════════════════════════════════════');
    console.log('Use OPTION 1 (new private key) for security best practices.');
    console.log('The old Braavos account with time delay can remain unused.\n');
}

generateFreshAccount().catch(console.error);
