/**
 * Test the fixed deposit flow with correct vault.deposit(commitment) signature
 */

const { Account, uint256, CallData } = require('starknet');
const crypto = require('crypto');

async function testDeposit() {
    console.log('🧪 Testing Fixed Deposit Flow\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Load environment
    require('dotenv').config();
    const STARKNET_RPC_URL = process.env.STARKNET_RPC_URL;
    const ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS;
    const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;
    const VAULT_ADDRESS = process.env.VAULT_CONTRACT_ADDRESS;
    const MOCKBTC_ADDRESS = process.env.MOCKBTC_CONTRACT_ADDRESS;

    console.log('Configuration:');
    console.log(`  RPC: ${STARKNET_RPC_URL}`);
    console.log(`  Account: ${ACCOUNT_ADDRESS}`);
    console.log(`  Vault: ${VAULT_ADDRESS}`);
    console.log(`  MockBTC: ${MOCKBTC_ADDRESS}\n`);

    // Create account
    const account = new Account({
        provider: { nodeUrl: STARKNET_RPC_URL },
        address: ACCOUNT_ADDRESS,
        signer: PRIVATE_KEY
    });

    console.log('Checking account...');
    const nonce = await account.getNonce();
    console.log(`  ✓ Account nonce: ${nonce}\n`);

    // Generate test commitment
    const secret = '0x' + crypto.randomBytes(31).toString('hex');
    const commitment = '0x' + crypto.randomBytes(31).toString('hex');
    const amount = BigInt(Math.floor(0.001 * 1e18)); // 0.001 BTC
    const amountU256 = uint256.bnToUint256(amount);

    console.log('Test Data:');
    console.log(`  Secret: ${secret}`);
    console.log(`  Commitment: ${commitment}`);
    console.log(`  Amount: ${amount} (${amount / BigInt(1e18)} BTC)\n`);

    // Execute the correct 2-call flow
    console.log('Executing deposit multicall...');
    console.log('  ① Mint tokens to vault');
    console.log('  ② Record commitment on-chain\n');

    const mintCall = {
        contractAddress: MOCKBTC_ADDRESS,
        entrypoint: 'mint',
        calldata: CallData.compile({
            recipient: VAULT_ADDRESS,
            amount: amountU256
        })
    };

    const depositCall = {
        contractAddress: VAULT_ADDRESS,
        entrypoint: 'deposit',
        calldata: CallData.compile({
            commitment: commitment
        })
    };

    try {
        console.log('Sending transaction...');
        const response = await account.execute([mintCall, depositCall], {
            nonce
        });

        console.log(`\n✅ Transaction submitted successfully!`);
        console.log(`   TX Hash: ${response.transaction_hash}`);
        console.log(`   Voyager: https://sepolia.voyager.online/tx/${response.transaction_hash}\n`);

        // Wait for confirmation
        console.log('Waiting for confirmation (this may take 10-30 seconds)...');
        const receipt = await account.waitForTransaction(response.transaction_hash, {
            retryInterval: 3000
        });

        if (receipt.status === 'SUCCESS' || receipt.execution_status === 'SUCCEEDED') {
            console.log('\n🎉 Deposit completed successfully!');
            console.log(`   Block: ${receipt.block_number || receipt.blockNumber}`);
            console.log(`   Status: ${receipt.status || receipt.execution_status}\n`);
            
            // Check for Deposit event
            if (receipt.events && receipt.events.length > 0) {
                console.log(`Events emitted: ${receipt.events.length}`);
                const depositEvent = receipt.events.find(e => 
                    e.keys && e.keys.some(k => k.includes('Deposit') || k === commitment)
                );
                if (depositEvent) {
                    console.log('  ✓ Deposit event found');
                    console.log(`    Commitment in event: ${depositEvent.keys[0] === commitment ? 'MATCHED' : depositEvent.data[0]}`);
                }
            }
        } else {
            console.log(`\n❌ Transaction reverted`);
            console.log(`   Status: ${receipt.status || receipt.execution_status}`);
        }

    } catch (error) {
        console.error('\n❌ Transaction failed:');
        console.error(error.message);
        if (error.message.includes('ENTRYPOINT_NOT_FOUND')) {
            console.error('\n   → The deployed contract may not match the expected ABI');
            console.error('   → Check if contracts need to be redeployed');
        }
    }
}

testDeposit().catch(console.error);
