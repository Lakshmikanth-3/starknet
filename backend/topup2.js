require('dotenv').config();
const { RpcProvider, Account, CallData, cairo } = require('starknet');
const crypto = require('crypto');

const STARKNET_RPC_URL = process.env.STARKNET_RPC_URL;
const STARKNET_ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS;
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;
const VAULT_CONTRACT_ADDRESS = process.env.VAULT_ADDRESS;
const MOCKBTC_CONTRACT_ADDRESS = process.env.SBTC_ADDRESS;

async function main() {
    const provider = new RpcProvider({ nodeUrl: STARKNET_RPC_URL });
    const account = new Account(provider, STARKNET_ACCOUNT_ADDRESS, SEPOLIA_PRIVATE_KEY);
    const TOPUP_AMOUNT = 10000000000000000000n;
    const commitment = '0x' + crypto.randomBytes(31).toString('hex').padStart(62, '0');

    const nonce = await provider.getNonceForAddress(STARKNET_ACCOUNT_ADDRESS, 'latest');
    process.stdout.write('Nonce: ' + nonce + '\n');

    const result = await account.execute([
        { contractAddress: MOCKBTC_CONTRACT_ADDRESS, entrypoint: 'mint', calldata: CallData.compile({ recipient: STARKNET_ACCOUNT_ADDRESS, amount: cairo.uint256(TOPUP_AMOUNT) }) },
        { contractAddress: MOCKBTC_CONTRACT_ADDRESS, entrypoint: 'approve', calldata: CallData.compile({ spender: VAULT_CONTRACT_ADDRESS, amount: cairo.uint256(TOPUP_AMOUNT) }) },
        { contractAddress: VAULT_CONTRACT_ADDRESS, entrypoint: 'deposit', calldata: CallData.compile({ amount: cairo.uint256(TOPUP_AMOUNT), commitment }) },
    ], undefined, { nonce, version: '0x3' });

    process.stdout.write('TX: ' + result.transaction_hash + '\n');
}

main().then(() => process.exit(0)).catch(e => { process.stderr.write(e.message + '\n' + JSON.stringify(e.baseError || '', null, 2) + '\n'); process.exit(1); });
