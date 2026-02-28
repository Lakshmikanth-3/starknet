/**
 * Check if the new account has ETH and is ready to use
 */

import { RpcProvider, CallData } from 'starknet';
import { config } from '../src/config/env';

async function checkNewAccount() {
    console.log('🔍 Checking new account status...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    const accountAddress = config.STARKNET_ACCOUNT_ADDRESS;
    
    console.log(`Address: ${accountAddress}\n`);
    
    // Check if deployed
    console.log('1️⃣ Checking deployment status...');
    try {
        const classHash = await provider.getClassHashAt(accountAddress);
        console.log(`   ✅ Account is deployed!`);
        console.log(`   Class: ${classHash}\n`);
        
        // Check nonce
        const nonce = await provider.getNonceForAddress(accountAddress);
        console.log(`   Nonce: ${nonce}`);
        
        // Check for time delay
        try {
            const delay = await provider.callContract({
                contractAddress: accountAddress,
                entrypoint: 'get_execution_time_delay',
                calldata: []
            });
            console.log(`   ⚠️  Time delay: ${delay[0]}`);
        } catch {
            console.log(`   ✅ No time delay function - this is good!`);
        }
        
    } catch (err: any) {
        if (err.message.includes('Contract not found') || err.message.includes('is not deployed')) {
            console.log(`   ⚠️  Account not deployed yet`);
            console.log(`   This is normal - it will auto-deploy on first transaction\n`);
        } else {
            console.log(`   Error: ${err.message}\n`);
        }
    }
    
    // Check ETH balance
    console.log('2️⃣ Checking ETH balance...');
    const ETH_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
    
    try {
        const balanceResult = await provider.callContract({
            contractAddress: ETH_ADDRESS,
            entrypoint: 'balanceOf',
            calldata: CallData.compile({ account: accountAddress })
        });
        
        const balance = BigInt(balanceResult[0]);
        const balanceEth = Number(balance) / 1e18;
        
        console.log(`   Balance: ${balanceEth.toFixed(6)} ETH`);
        
        if (balance === 0n) {
            console.log(`   ❌ No ETH - account needs funding!\n`);
            console.log('═══════════════════════════════════════════════════');
            console.log('🚨 ACTION REQUIRED: FUND THE ACCOUNT');
            console.log('═══════════════════════════════════════════════════\n');
            console.log(`Send ETH to: ${accountAddress}\n`);
            console.log('📍 Where to get Sepolia ETH:');
            console.log('   1. Alchemy Faucet: https://sepoliafaucet.com/');
            console.log('   2. Blast Faucet: https://blastapi.io/faucets/starknet-sepolia-eth');
            console.log('   3. Starknet Faucet: https://faucet.goerli.starknet.io/\n');
            console.log('💡 Amount needed: At least 0.01 ETH');
            console.log('   - Account deployment: ~0.002 ETH');
            console.log('   - Initial transactions: ~0.005 ETH');
            console.log('   - Buffer: 0.003 ETH\n');
            console.log('⏱️  After sending ETH:');
            console.log('   1. Wait 2-3 minutes for confirmation');
            console.log(`   2. Check: https://sepolia.starkscan.co/contract/${accountAddress}`);
            console.log('   3. Run this script again to verify');
            console.log('   4. Then test transactions!\n');
            
        } else if (balanceEth < 0.005) {
            console.log(`   ⚠️  Low balance - consider adding more ETH\n`);
        } else {
            console.log(`   ✅ Sufficient balance!\n`);
            
            console.log('═══════════════════════════════════════════════════');
            console.log('✅ ACCOUNT READY!');
            console.log('═══════════════════════════════════════════════════\n');
            console.log('🎉 Your new account is funded and ready to use!\n');
            console.log('📋 Next steps:');
            console.log('   1. Restart backend: npm run dev');
            console.log('   2. Test deposit: npx tsx scripts/test_after_fix.ts');
            console.log('   3. Open frontend and test full flow\n');
        }
        
    } catch (err: any) {
        console.error(`   Error checking balance: ${err.message}\n`);
    }
    
    // Check STRK balance
    console.log('3️⃣ Checking STRK balance...');
    const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
    
    try {
        const balanceResult = await provider.callContract({
            contractAddress: STRK_ADDRESS,
            entrypoint: 'balanceOf',
            calldata: CallData.compile({ account: accountAddress })
        });
        
        const balance = BigInt(balanceResult[0]);
        const balanceStrk = Number(balance) / 1e18;
        
        console.log(`   Balance: ${balanceStrk.toFixed(6)} STRK`);
        
        if (balance > 0n) {
            console.log(`   ✅ You have STRK tokens (can use for gas fees)\n`);
        } else {
            console.log(`   ℹ️  No STRK (optional - ETH is fine for gas)\n`);
        }
        
    } catch (err: any) {
        console.log(`   ℹ️  Could not check STRK balance\n`);
    }
    
    console.log('═══════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(`Account: ${accountAddress}`);
    console.log(`Starkscan: https://sepolia.starkscan.co/contract/${accountAddress}`);
    console.log(`\n`);
}

checkNewAccount().catch(console.error);
