/**
 * Test basic operations to isolate the signature issue
 */

import { Account, RpcProvider, Contract, cairo, stark } from 'starknet';
import { config } from '../src/config/env';

async function testBasicOperations() {
    console.log('🔬 Testing basic account operations...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    const account = new Account(
        provider,
        config.STARKNET_ACCOUNT_ADDRESS,
        config.STARKNET_PRIVATE_KEY,
        '1' // Cairo version
    );
    
    console.log(`Account: ${account.address}`);
    console.log(`Nonce: ${await account.getNonce()}\n`);
    
    // Test 1: View call (doesn't require signature)
    console.log('📊 Test 1: View call (balance_of)...');
    try {
        const tokenAbi = [
            {
                type: 'function',
                name: 'balance_of',
                inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
                outputs: [{ type: 'core::integer::u256' }],
                state_mutability: 'view'
            }
        ];
        
        const token = new Contract(tokenAbi, config.MOCKBTC_CONTRACT_ADDRESS, provider);
        const balance = await token.balance_of(account.address);
        console.log(`✅ Balance: ${balance.toString()}\n`);
    } catch (err: any) {
        console.error(`❌ View call failed: ${err.message}\n`);
    }
    
    // Test 2: Try estimating a self-transfer of 0 STRK
    console.log('💸 Test 2: Estimate self-transfer (0 ETH)...');
    try {
        const ethAddress = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'; // ETH contract on starknet
        const ethAbi = [
            {
                type: 'function',
                name: 'transfer',
                inputs: [
                    { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
                    { name: 'amount', type: 'core::integer::u256' }
                ],
                outputs: [{ type: 'core::bool' }],
                state_mutability: 'external'
            }
        ];
        
        const eth = new Contract(ethAbi, ethAddress, account);
        const call = eth.populate('transfer', [account.address, cairo.uint256(0)]);
        
        const estimate = await account.estimateInvokeFee([call]);
        console.log(`✅ Fee estimate succeeded: ${estimate.overall_fee.toString()} wei\n`);
        
        // Try to actually execute it
        console.log('🚀 Attempting to execute self-transfer...');
        const tx = await account.execute([call]);
        console.log(`✅ Transaction sent: ${tx.transaction_hash}`);
        console.log(`   Waiting for confirmation...`);
        await provider.waitForTransaction(tx.transaction_hash);
        console.log(`✅ Transaction confirmed!\n`);
        
    } catch (err: any) {
        console.error(`❌ Self-transfer failed:`);
        console.error(err.message);
        
        if (err.message.includes('INVALID_SIG')) {
            console.log('\n🔍 INVALID_SIG error detected.');
            console.log('   This suggests the account contract is rejecting our signature.');
            console.log('   Possible causes:');
            console.log('   1. Wrong private key for this account');
            console.log('   2. Account uses different signer index than expected');
            console.log('   3. Starknet.js version incompatible with Braavos account');
            console.log('   4. Account is in a locked or guardian-protected state');
        }
        console.log('');
    }
    
    // Test 3: Check account details
    console.log('🔍 Test 3: Account contract details...');
    try {
        const accountClass = await provider.getClassHashAt(account.address);
        console.log(`Class hash: ${accountClass}`);
        
        // Get implementation if it's a proxy
        try {
            const impl = await provider.callContract({
                contractAddress: account.address,
                entrypoint: 'get_implementation',
                calldata: []
            });
            console.log(`Implementation: ${impl[0]}`);
        } catch {
            console.log('No proxy pattern detected');
        }
        
    } catch (err: any) {
        console.error(`❌ Error: ${err.message}`);
    }
}

testBasicOperations().catch(console.error);
