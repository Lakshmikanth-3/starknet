/**
 * Test with explicit signer setup
 */

import { Account, RpcProvider, Contract, cairo, Signer, ec } from 'starknet';
import { config } from '../src/config/env';

async function testWithSigner() {
    console.log('🔬 Testing with explicit signer...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    // Create explicit signer from private key
    const privateKey = config.SEPOLIA_PRIVATE_KEY.startsWith('0x') 
        ? config.SEPOLIA_PRIVATE_KEY.slice(2) 
        : config.SEPOLIA_PRIVATE_KEY;
    
    const publicKey = ec.starkCurve.getStarkKey(privateKey);
    console.log(`Private key: ${config.SEPOLIA_PRIVATE_KEY}`);
    console.log(`Derived public key: 0x${publicKey}\n`);
    
    // Try different signer initialization methods
    console.log('📝 Method 1: Signer with private key string...');
    try {
        const signer1 = new Signer(config.SEPOLIA_PRIVATE_KEY);
        const account1 = new Account(provider, config.STARKNET_ACCOUNT_ADDRESS, signer1, '1');
        console.log(`✅ Account created with signer`);
        console.log(`   Nonce: ${await account1.getNonce()}`);
        
        // Try a simple mint transaction
        const tokenAbi = [
            {
                type: 'function',
                name: 'mint',
                inputs: [
                    { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
                    { name: 'amount', type: 'core::integer::u256' }
                ],
                outputs: [],
                state_mutability: 'external'
            }
        ];
        
        const token = new Contract(tokenAbi, config.MOCKBTC_CONTRACT_ADDRESS, account1);
        const vaultAddress = '0x03e735d12f81f2f4beb45634bef9997ae3bde996c2f84a204957dc5ef2209de2';
        const amount = cairo.uint256(1000000); // 0.001 BTC in smallest units
        
        console.log(`\n🪙 Attempting to mint ${amount} tokens to vault...`);
        const call = token.populate('mint', [vaultAddress, amount]);
        
        const estimate = await account1.estimateInvokeFee([call]);
        console.log(`✅ Fee estimate: ${estimate.overall_fee.toString()} wei`);
        
        console.log(`🚀 Executing mint transaction...`);
        const tx = await account1.execute([call]);
        console.log(`✅ Transaction submitted: ${tx.transaction_hash}`);
        console.log(`   Waiting for confirmation...`);
        
        const receipt = await provider.waitForTransaction(tx.transaction_hash);
        console.log(`✅ Transaction confirmed!`);
        console.log(`   Status: ${receipt.execution_status}`);
        console.log(`   Finality: ${receipt.finality_status}`);
        
    } catch (err: any) {
        console.error(`❌ Failed: ${err.message}`);
        if (err.message.includes('INVALID_SIG')) {
            console.log(`\n⚠️  Still getting INVALID_SIG with explicit signer`);
        }
    }
    
    // Try alternative: using keyDeriver
    console.log('\n📝 Method 2: Using raw private key...');
    try {
        const account2 = new Account(provider, config.STARKNET_ACCOUNT_ADDRESS, config.SEPOLIA_PRIVATE_KEY, '1');
        console.log(`✅ Account created`);
        console.log(`   Signer exists: ${!!account2.signer}`);
        
        if (account2.signer) {
            console.log(`   Signer getPubKey: 0x${await account2.signer.getPubKey()}`);
        }
        
    } catch (err: any) {
        console.error(`❌ Failed: ${err.message}`);
    }
}

testWithSigner().catch(console.error);
