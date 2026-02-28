// Minimal tracing script for the BigInt error
const { Account, RpcProvider, CallData, cairo } = require('starknet');
require('dotenv').config();

async function main() {
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    const account = new Account(
        provider,
        process.env.STARKNET_ACCOUNT_ADDRESS,
        process.env.SEPOLIA_PRIVATE_KEY,
        '1'
    );

    console.log('Account address:', process.env.STARKNET_ACCOUNT_ADDRESS);
    const nonce = await provider.getNonceForAddress(process.env.STARKNET_ACCOUNT_ADDRESS, 'latest');
    console.log('Nonce:', nonce);

    // Try a simple mint call
    try {
        console.log('Calling account.execute()...');
        const result = await account.execute(
            [
                {
                    contractAddress: process.env.MOCKBTC_CONTRACT_ADDRESS,
                    entrypoint: 'mint',
                    calldata: CallData.compile({
                        recipient: process.env.VAULT_CONTRACT_ADDRESS,
                        amount: cairo.uint256(BigInt(1000000)),
                    }),
                },
            ],
            undefined,
            {
                nonce,
                version: '0x3'
            }
        );
        console.log('SUCCESS! TX hash:', result.transaction_hash);
    } catch (e) {
        console.error('ERROR:', e.message);
        if (e.stack) {
            console.error('STACK:', e.stack);
        }
    }
}

main().catch(e => {
    console.error('FATAL:', e.message);
    console.error('STACK:', e.stack);
});
