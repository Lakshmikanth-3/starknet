require('dotenv').config();
const { RpcProvider, Account, CallData, cairo } = require('starknet');
const crypto = require('crypto');

const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
const account = new Account(provider, process.env.STARKNET_ACCOUNT_ADDRESS, process.env.SEPOLIA_PRIVATE_KEY, '1');

async function main() {
    const TOPUP_AMOUNT = 1000000n; // 1e6 wei
    const nonce = await provider.getNonceForAddress(process.env.STARKNET_ACCOUNT_ADDRESS, 'latest');
    console.log('Nonce:', nonce);

    // We want to skip estimateFee by passing explicit maxFee
    // But the old Vault deposit function will crash on transfer_from, so we skip it.
    // Instead we will call a simple mint just to see if the transaction works!
    const result = await account.execute([{
        contractAddress: process.env.SBTC_ADDRESS,
        entrypoint: 'mint',
        calldata: CallData.compile({
            recipient: process.env.STARKNET_ACCOUNT_ADDRESS,
            amount: cairo.uint256(TOPUP_AMOUNT)
        })
    }], undefined, { nonce, maxFee: 1000000000000000n });

    console.log('TX Hash:', result.transaction_hash);
}

main().catch(console.error);
