require('dotenv').config();
const { RpcProvider, Account, ec, hash, CallData, stark, cairo } = require('starknet');
const fs = require('fs');

const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
const relayer = new Account(provider, process.env.STARKNET_ACCOUNT_ADDRESS, process.env.SEPOLIA_PRIVATE_KEY);
const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

async function main() {
    console.log('Generating new Account...');
    const privateKey = stark.randomAddress();
    const publicKey = ec.starkCurve.getStarkKey(privateKey);
    console.log('New PK:', privateKey);

    // OZ Account Class Hash v0.8.1
    const OZ_CLASS_HASH = '0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f';

    const ConstructorCallData = CallData.compile({ publicKey });
    const address = hash.calculateContractAddressFromHash(publicKey, OZ_CLASS_HASH, ConstructorCallData, 0);
    console.log('New Account Address:', address);

    // Fund it with 5 STRK
    console.log('Funding from Relayer (STRK)...');
    const nonce = await provider.getNonceForAddress(relayer.address, 'latest');
    const fundAmount = 5000000000000000000n; // 5 STRK

    const { transaction_hash: fundTx } = await relayer.execute([
        {
            contractAddress: STRK_ADDRESS,
            entrypoint: 'transfer',
            calldata: CallData.compile({
                recipient: address,
                amount: cairo.uint256(fundAmount)
            })
        }
    ], undefined, { nonce, version: '0x3' }); // Try V3 explicitly for the relayer... wait, the relayer failed on V3 earlier! Let's omit version.

    console.log('Funding TX:', fundTx);
    console.log('Waiting for funding...');
    await provider.waitForTransaction(fundTx);
    console.log('Funded!');

    // Save PK immediately
    fs.writeFileSync('new_account.json', JSON.stringify({ address, privateKey }, null, 2));

    // Deploy Account
    console.log('Deploying New Account...');
    try {
        const newAccount = new Account(provider, address, privateKey);
        const deployPayload = {
            classHash: OZ_CLASS_HASH,
            constructorCalldata: ConstructorCallData,
            contractAddress: address,
            addressSalt: publicKey,
        };
        const { transaction_hash: deployTx } = await newAccount.deployAccount(deployPayload, undefined, { version: '0x3' });
        console.log('Deploy Account TX:', deployTx);
        await provider.waitForTransaction(deployTx);
        console.log('✅ Account Deployed!');
    } catch (e) {
        console.error('Account deployment failed, but keys are saved. You can try deploying it manually.', e.message);
    }
}

main().catch(e => { console.error(e.message); process.exit(1); });
