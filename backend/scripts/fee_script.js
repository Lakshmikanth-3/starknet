require('dotenv').config();
const { Account, RpcProvider, CallData, cairo } = require('starknet');

async function main() {
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    const account = new Account(
        provider,
        process.env.STARKNET_ACCOUNT_ADDRESS,
        process.env.SEPOLIA_PRIVATE_KEY,
        '1'
    );

    try {
        const tx = [{
            contractAddress: process.env.MOCKBTC_CONTRACT_ADDRESS,
            entrypoint: 'mint',
            calldata: CallData.compile({
                recipient: process.env.VAULT_CONTRACT_ADDRESS,
                amount: cairo.uint256(100)
            })
        }];
        const fee = await account.estimateInvokeFee(tx, { version: '0x3' });
        console.log('Fee Estimate:', fee);
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

main();
