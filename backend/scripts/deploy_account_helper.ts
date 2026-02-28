/**
 * Deploy the new account after funding it with ETH
 * Reads credentials from NEW_ACCOUNT_CREDENTIALS.json
 */

import { Account, RpcProvider, CallData, Contract, cairo } from 'starknet';
import { config } from '../src/config/env';
import * as fs from 'fs';
import * as path from 'path';

async function deployAccount() {
    console.log('🚀 Deploying new account...\n');
    
    // Read credentials
    const credsPath = path.join(__dirname, '..', 'NEW_ACCOUNT_CREDENTIALS.json');
    
    if (!fs.existsSync(credsPath)) {
        console.error('❌ NEW_ACCOUNT_CREDENTIALS.json not found!');
        console.log('   Run: npx tsx scripts/generate_fresh_account.ts first\n');
        return;
    }
    
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
    console.log(`Account Address: ${creds.address}`);
    console.log(`Class Hash: ${creds.classHash}\n`);
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    // Check if already deployed
    try {
        const existingClass = await provider.getClassHashAt(creds.address);
        console.log('✅ Account already deployed!');
        console.log(`   Class: ${existingClass}`);
        
        const nonce = await provider.getNonceForAddress(creds.address);
        console.log(`   Nonce: ${nonce}\n`);
        
        await testNewAccount(creds);
        return;
        
    } catch (err: any) {
        if (!err.message.includes('Contract not found')) {
            console.error('❌ Error checking account:', err.message);
            return;
        }
    }
    
    // Check ETH balance
    const ETH_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
    
    try {
        const balanceResult = await provider.callContract({
            contractAddress: ETH_ADDRESS,
            entrypoint: 'balanceOf',
            calldata: CallData.compile({ account: creds.address })
        });
        
        const balance = BigInt(balanceResult[0]);
        const balanceEth = Number(balance) / 1e18;
        
        console.log(`💰 ETH Balance: ${balanceEth.toFixed(6)} ETH`);
        
        if (balance === 0n) {
            console.error('\n❌ No ETH balance!');
            console.log(`\n📋 Please send ETH to: ${creds.address}`);
            console.log('   Minimum: 0.01 ETH for deployment + transactions');
            console.log(`   Check: https://sepolia.starkscan.co/contract/${creds.address}\n`);
            return;
        }
        
        if (balanceEth < 0.005) {
            console.warn('\n⚠️  Low balance! Consider sending more ETH.');
        }
        
    } catch (err: any) {
        console.error('❌ Could not check balance:', err.message);
        return;
    }
    
    // Deploy using UDC (Universal Deployer Contract)
    console.log('\n🔧 Deploying account via UDC...');
    
    try {
        // For account deployment, we need to use a pre-funded deployer
        // Let's use the old Braavos account to deploy (it can still send transactions with time delay for deployment)
        
        console.log('\n⚠️  MANUAL DEPLOYMENT REQUIRED');
        console.log('\nThe account is funded but needs deployment. Options:\n');
        
        console.log('OPTION A: Use Starknet CLI (if installed):');
        console.log(`  starknet deploy_account \\`);
        console.log(`    --account ${creds.address} \\`);
        console.log(`    --private_key ${creds.privateKey}\n`);
        
        console.log('OPTION B: Use Voyager Account Deployer:');
        console.log(`  1. Go to: https://sepolia.voyager.online/`);
        console.log(`  2. Connect with private key: ${creds.privateKey}`);
        console.log(`  3. Follow account deployment wizard\n`);
        
        console.log('OPTION C: Self-deploy (simplest):');
        console.log('  The account will auto-deploy on first transaction.');
        console.log('  Update .env with these credentials and try a transaction.\n');
        
        console.log('📋 UPDATE .env NOW:');
        console.log(`STARKNET_ACCOUNT_ADDRESS=${creds.address}`);
        console.log(`SEPOLIA_PRIVATE_KEY=${creds.privateKey}\n`);
        
    } catch (err: any) {
        console.error('❌ Deployment failed:', err.message);
    }
}

async function testNewAccount(creds: any) {
    console.log('🧪 Testing new account...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    const account = new Account(provider, creds.address, creds.privateKey, '1');
    
    try {
        // Try estimating a fee
        const ETH_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
        const call = {
            contractAddress: ETH_ADDRESS,
            entrypoint: 'transfer',
            calldata: CallData.compile({
                recipient: creds.address,
                amount: cairo.uint256(0)
            })
        };
        
        const estimate = await account.estimateInvokeFee([call]);
        console.log(`✅ Account works! Fee estimate: ${estimate.overall_fee.toString()} wei`);
        
        // Verify no time delay
        try {
            const delay = await provider.callContract({
                contractAddress: creds.address,
                entrypoint: 'get_execution_time_delay',
                calldata: []
            });
            console.log(`⚠️  Time delay detected: ${delay[0]}`);
        } catch {
            console.log(`✅ No time delay! Ready for immediate transactions.\n`);
        }
        
        console.log('═══════════════════════════════════════════════════');
        console.log('✅ ACCOUNT READY!');
        console.log('═══════════════════════════════════════════════════');
        console.log('\n📋 Final steps:');
        console.log(`1. Update .env:`);
        console.log(`   STARKNET_ACCOUNT_ADDRESS=${creds.address}`);
        console.log(`   SEPOLIA_PRIVATE_KEY=${creds.privateKey}\n`);
        console.log(`2. Restart backend: npm run dev`);
        console.log(`3. Test deposit: npx tsx scripts/test_after_fix.ts\n`);
        
    } catch (err: any) {
        console.error(`❌ Test failed: ${err.message}`);
        
        if (err.message.includes('ContractNotFound') || err.message.includes('not deployed')) {
            console.log('\n⚠️  Account needs deployment first.');
            console.log('   It will auto-deploy on first transaction.');
            console.log('   Or use starknet CLI to deploy manually.\n');
        }
    }
}

deployAccount().catch(console.error);
