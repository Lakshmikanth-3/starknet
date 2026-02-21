import { Contract, RpcProvider, Account, json, num } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = 'http://127.0.0.1:5050';
const ACCOUNT_ADDRESS = '0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691';
const PRIVATE_KEY = '0x71d7bb07b9a64f6f78ac4c816aff4da9';

async function main() {
    console.log(`🚀 Starting Forced 'latest' Deployment on Local Devnet`);

    // Create Provider with override
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const originalGetNonce = provider.getNonceForAddress.bind(provider);

    // FORCE ALL NONCE REQUESTS TO USE 'latest'
    provider.getNonceForAddress = async (address, blockIdentifier) => {
        console.log(`DEBUG: Intercepted getNonce for ${address} (original ID: ${blockIdentifier}) -> Using 'latest'`);
        return originalGetNonce(address, 'latest');
    };

    const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

    const btcSierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    const btcCasmPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.compiled_contract_class.json');

    const vaultSierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_PrivateBTCVault.contract_class.json');
    const vaultCasmPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_PrivateBTCVault.compiled_contract_class.json');

    try {
        // 1. Declare MockBTC
        console.log('📝 Declaring MockBTC...');
        const btcSierra = json.parse(fs.readFileSync(btcSierraPath).toString('utf-8'));
        const btcCasm = json.parse(fs.readFileSync(btcCasmPath).toString('utf-8'));

        const btcDeclare = await account.declare({ contract: btcSierra, casm: btcCasm });
        console.log(`✅ MockBTC Declared. Class Hash: ${btcDeclare.class_hash}`);
        await provider.waitForTransaction(btcDeclare.transaction_hash);

        // 2. Deploy MockBTC
        console.log('🚀 Deploying MockBTC...');
        const btcDeploy = await account.deployContract({
            classHash: btcDeclare.class_hash,
            constructorCalldata: [ACCOUNT_ADDRESS]
        });
        console.log(`✅ MockBTC Deployed at: ${btcDeploy.contract_address}`);
        await provider.waitForTransaction(btcDeploy.transaction_hash);

        // 3. Declare PrivateBTCVault
        console.log('📝 Declaring PrivateBTCVault...');
        const vaultSierra = json.parse(fs.readFileSync(vaultSierraPath).toString('utf-8'));
        const vaultCasm = json.parse(fs.readFileSync(vaultCasmPath).toString('utf-8'));

        const vaultDeclare = await account.declare({ contract: vaultSierra, casm: vaultCasm });
        console.log(`✅ PrivateBTCVault Declared. Class Hash: ${vaultDeclare.class_hash}`);
        await provider.waitForTransaction(vaultDeclare.transaction_hash);

        // 4. Deploy PrivateBTCVault
        console.log('🚀 Deploying PrivateBTCVault...');
        const vaultDeploy = await account.deployContract({
            classHash: vaultDeclare.class_hash,
            constructorCalldata: [btcDeploy.contract_address]
        });
        console.log(`✅ PrivateBTCVault Deployed at: ${vaultDeploy.contract_address}`);
        await provider.waitForTransaction(vaultDeploy.transaction_hash);

        console.log(`\n🎉 Success! All contracts deployed on Local Devnet.`);
        console.log(`MockBTC: ${btcDeploy.contract_address}`);
        console.log(`Vault: ${vaultDeploy.contract_address}`);

        // Update .env
        const envPath = path.join(__dirname, '../.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/STARKNET_RPC_URL=.*/, `STARKNET_RPC_URL=${RPC_URL}`);
        envContent = envContent.replace(/MOCK_BTC_ADDR=.*/, `MOCK_BTC_ADDR=${btcDeploy.contract_address}`);
        envContent = envContent.replace(/VAULT_ADDR=.*/, `VAULT_ADDR=${vaultDeploy.contract_address}`);
        fs.writeFileSync(envPath, envContent);
        console.log(`\n📝 Updated .env with new local contract addresses.`);

    } catch (e: any) {
        console.error('❌ Deployment failed:', e.message);
        if (e.data) console.dir(e.data, { depth: null });
        process.exit(1);
    }
}

main();
