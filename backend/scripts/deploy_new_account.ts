/**
 * Deploy a new OpenZeppelin account without time delays
 * 
 * This will create a fresh account using your existing private key,
 * but with a simpler account contract that has no security delays.
 */

import { Account, RpcProvider, ec, hash, CallData, stark, constants } from 'starknet';
import { config } from '../src/config/env';

async function deployNewAccount() {
    console.log('🚀 Deploying new OpenZeppelin account (no time delays)...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    // Use the same private key
    const privateKey = config.SEPOLIA_PRIVATE_KEY;
    const publicKey = ec.starkCurve.getStarkKey(privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey);
    
    console.log(`Private Key: ${privateKey}`);
    console.log(`Public Key: 0x${publicKey}\n`);
    
    // OpenZeppelin account class hash on Sepolia
    // This is the standard OZ account contract - no time delays, no guardians
    const OZ_ACCOUNT_CLASS_HASH = '0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f';
    
    // Calculate the account address
    const constructorCalldata = CallData.compile({
        publicKey: `0x${publicKey}`
    });
    
    const accountAddress = hash.calculateContractAddressFromHash(
        `0x${publicKey}`, // salt = public key
        OZ_ACCOUNT_CLASS_HASH,
        constructorCalldata,
        0
    );
    
    console.log(`📍 New Account Address: ${accountAddress}\n`);
    
    // Check if already deployed
    try {
        const existingClass = await provider.getClassHashAt(accountAddress);
        console.log(`✅ Account already deployed!`);
        console.log(`   Class: ${existingClass}\n`);
        
        // Check nonce
        const nonce = await provider.getNonceForAddress(accountAddress);
        console.log(`   Nonce: ${nonce}`);
        
        // Test it works
        console.log('\n🧪 Testing new account...');
        await testAccount(provider, accountAddress, privateKey);
        
        return accountAddress;
        
    } catch (err: any) {
        if (!err.message.includes('Contract not found')) {
            throw err;
        }
        
        console.log(`⚠️  Account not deployed yet.\n`);
        console.log(`📋 To deploy this account:`);
        console.log(`1. Send some ETH to: ${accountAddress}`);
        console.log(`2. Go to Starkscan: https://sepolia.starkscan.co/contract/${accountAddress}`);
        console.log(`3. Wait for ETH to arrive`);
        console.log(`4. Run this script again\n`);
        
        console.log(`OR use this deployment transaction:`);
        console.log(`Class Hash: ${OZ_ACCOUNT_CLASS_HASH}`);
        console.log(`Constructor: [${constructorCalldata.join(', ')}]`);
        console.log(`Salt: 0x${publicKey}\n`);
    }
}

async function testAccount(provider: RpcProvider, accountAddress: string, privateKey: string) {
    try {
        const account = new Account(provider, accountAddress, privateKey, '1');
        
        // Try to estimate a simple self-transfer
        const ethAddress = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
        const call = {
            contractAddress: ethAddress,
            entrypoint: 'transfer',
            calldata: CallData.compile({
                recipient: accountAddress,
                amount: { low: 0, high: 0 }
            })
        };
        
        const estimate = await account.estimateInvokeFee([call]);
        console.log(`✅ Account works! Fee estimate: ${estimate.overall_fee.toString()} wei`);
        
        // Check time delay
        try {
            const delayResult = await provider.callContract({
                contractAddress: accountAddress,
                entrypoint: 'get_execution_time_delay',
                calldata: []
            });
            console.log(`⚠️  This account has time delay: ${delayResult[0]}`);
        } catch {
            console.log(`✅ No time delay on this account!`);
        }
        
    } catch (err: any) {
        console.error(`❌ Test failed: ${err.message}`);
    }
}

deployNewAccount().catch(console.error);
