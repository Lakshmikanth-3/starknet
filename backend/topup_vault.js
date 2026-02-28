/**
 * topup_vault.js — One-time fix to fund vault's total_assets counter
 */
require('dotenv').config();
const { RpcProvider, Account, CallData, cairo } = require('starknet');
const crypto = require('crypto');

const STARKNET_RPC_URL = process.env.STARKNET_RPC_URL;
const STARKNET_ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS;
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;
const VAULT_CONTRACT_ADDRESS = process.env.VAULT_ADDRESS;
const MOCKBTC_CONTRACT_ADDRESS = process.env.SBTC_ADDRESS;

async function main() {
    console.log('RPC:', STARKNET_RPC_URL?.slice(0, 60) + '...');
    console.log('Account:', STARKNET_ACCOUNT_ADDRESS);
    console.log('Vault:', VAULT_CONTRACT_ADDRESS);
    console.log('MockBTC:', MOCKBTC_CONTRACT_ADDRESS);

    // Use node-fetch explicitly (same as backend uses)
    const nodeFetch = require('node-fetch');

    const provider = new RpcProvider({
        nodeUrl: STARKNET_RPC_URL,
        // Pass node-fetch for compatibility
    });

    // Override fetch if needed
    if (typeof globalThis.fetch === 'undefined') {
        globalThis.fetch = nodeFetch;
        console.log('Using node-fetch polyfill');
    } else {
        console.log('Using native fetch');
    }

    // Top up with 10 tokens = enough for all existing withdrawals
    const TOPUP_AMOUNT = 10000000000000000000n; // 10 * 1e18

    const topupCommitment = '0x' + crypto.randomBytes(31).toString('hex').padStart(62, '0');
    console.log('\nTop-up commitment:', topupCommitment);
    console.log('Top-up amount:', TOPUP_AMOUNT.toString());

    const account = new Account(provider, STARKNET_ACCOUNT_ADDRESS, SEPOLIA_PRIVATE_KEY);

    console.log('\nFetching nonce...');
    let nonce;
    try {
        nonce = await provider.getNonceForAddress(STARKNET_ACCOUNT_ADDRESS, 'latest');
        console.log('Nonce:', nonce);
    } catch (e) {
        console.error('getNonce error:', e.message);
        throw e;
    }

    console.log('\nSubmitting multicall: mint → approve → vault.deposit...');
    const result = await account.execute(
        [
            {
                contractAddress: MOCKBTC_CONTRACT_ADDRESS,
                entrypoint: 'mint',
                calldata: CallData.compile({
                    recipient: STARKNET_ACCOUNT_ADDRESS,
                    amount: cairo.uint256(TOPUP_AMOUNT),
                }),
            },
            {
                contractAddress: MOCKBTC_CONTRACT_ADDRESS,
                entrypoint: 'approve',
                calldata: CallData.compile({
                    spender: VAULT_CONTRACT_ADDRESS,
                    amount: cairo.uint256(TOPUP_AMOUNT),
                }),
            },
            {
                contractAddress: VAULT_CONTRACT_ADDRESS,
                entrypoint: 'deposit',
                calldata: CallData.compile({
                    amount: cairo.uint256(TOPUP_AMOUNT),
                    commitment: topupCommitment,
                }),
            },
        ],
        undefined,
        { nonce, version: '0x3' }
    );

    console.log('\n✅ TX submitted:', result.transaction_hash);
    console.log(`🔍 https://sepolia.voyager.online/tx/${result.transaction_hash}`);
    console.log('\n⏳ Wait 30-60s for this to confirm, then retry the withdrawal!');
}

main().catch(err => {
    console.error('\n❌ Error:', err.message);
    if (err.cause) console.error('Cause:', err.cause);
    process.exit(1);
});
