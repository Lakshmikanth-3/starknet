
import { Account, CallData, RpcProvider, json, hash } from 'starknet';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { BigNumberish } from 'starknet';

// Load environment variables
dotenv.config();

const RPC_URL = process.env.STARKNET_RPC_URL || 'http://127.0.0.1:5050';
const PROVIDER = new RpcProvider({ nodeUrl: RPC_URL });

// Devnet Admin Account (Predeployed 0)
const ADMIN_ADDRESS = '0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691';
const ADMIN_PRIVATE_KEY = '0x71d7bb07b9a64f6f78ac4c816aff4da9';

const ARTIFACTS_PATH = path.resolve(__dirname, '../../private_btc_core/target/dev');

async function main() {
    console.log(`🚀 Deploying contracts to Starknet Devnet at ${RPC_URL}...`);

    // 1. Initialize Account
    const account = new Account(PROVIDER, ADMIN_ADDRESS, ADMIN_PRIVATE_KEY);
    console.log(`👤 Using Account: ${account.address}`);

    // Helper to get nonce manually
    const getNonce = async () => {
        return await PROVIDER.getNonceForAddress(account.address, 'latest');
    };

    // 2. Load Artifacts
    const mockBtcSierra = json.parse(fs.readFileSync(path.join(ARTIFACTS_PATH, 'private_btc_core_MockBTC.contract_class.json')).toString('ascii'));
    const mockBtcCasm = json.parse(fs.readFileSync(path.join(ARTIFACTS_PATH, 'private_btc_core_MockBTC.compiled_contract_class.json')).toString('ascii'));
    const vaultSierra = json.parse(fs.readFileSync(path.join(ARTIFACTS_PATH, 'private_btc_core_PrivateBTCVault.contract_class.json')).toString('ascii'));
    const vaultCasm = json.parse(fs.readFileSync(path.join(ARTIFACTS_PATH, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json')).toString('ascii'));

    // Helper to declare if not exists
    const declareIfNotExists = async (name: string, contract: any, casm: any) => {
        const classHash = hash.computeContractClassHash(contract);
        console.log(`🔎 Checking ${name} (Hash: ${classHash})...`);
        try {
            await PROVIDER.getClassByHash(classHash);
            console.log(`✅ ${name} already declared.`);
            return classHash;
        } catch (e) {
            console.log(`📝 Declaring ${name}...`);
            const nonce = await getNonce();
            try {
                const res = await account.declare({ contract, casm }, { nonce, maxFee: 10n ** 16n }); // Let starknet.js choose version
                console.log(`   Tx: ${res.transaction_hash}`);
                await PROVIDER.waitForTransaction(res.transaction_hash);
                console.log(`✅ ${name} Declared.`);
                return res.class_hash;
            } catch (declareError: any) {
                if (declareError.message.includes('already declared')) {
                    console.log(`✅ ${name} already declared (caught error).`);
                    return classHash;
                }
                throw declareError;
            }
        }
    };

    // 3. Declare MockBTC
    const mockBtcClassHash = await declareIfNotExists('MockBTC', mockBtcSierra, mockBtcCasm);

    // 4. Deploy MockBTC
    console.log('🚀 Deploying MockBTC...');
    let nonce = await getNonce();
    const deployMockResponse = await account.deployContract({
        classHash: mockBtcClassHash,
        constructorCalldata: CallData.compile([account.address]),
    }, { nonce, maxFee: 10n ** 16n }); // Explicit maxFee

    console.log(`   Hash: ${deployMockResponse.transaction_hash}`);
    await PROVIDER.waitForTransaction(deployMockResponse.transaction_hash);
    const mockBtcAddress = deployMockResponse.contract_address;
    console.log(`✅ MockBTC Deployed at: ${mockBtcAddress}`);

    // 5. Declare PrivateBTCVault
    const vaultClassHash = await declareIfNotExists('PrivateBTCVault', vaultSierra, vaultCasm);

    // 6. Deploy PrivateBTCVault
    console.log('🚀 Deploying PrivateBTCVault...');
    nonce = await getNonce();
    const deployVaultResponse = await account.deployContract({
        classHash: vaultClassHash,
        constructorCalldata: CallData.compile([mockBtcAddress]),
    }, { nonce, maxFee: 10n ** 16n }); // Explicit maxFee

    console.log(`   Hash: ${deployVaultResponse.transaction_hash}`);
    await PROVIDER.waitForTransaction(deployVaultResponse.transaction_hash);
    const vaultAddress = deployVaultResponse.contract_address;
    console.log(`✅ PrivateBTCVault Deployed at: ${vaultAddress}`);

    // 7. Update .env file
    console.log('💾 Updating .env file...');
    const envPath = path.resolve(__dirname, '../.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    const updateEnvVar = (key: string, value: string) => {
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    };

    updateEnvVar('MOCK_BTC_ADDR', mockBtcAddress);
    updateEnvVar('VAULT_ADDR', vaultAddress);
    updateEnvVar('STARKNET_RPC_URL', RPC_URL);

    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env updated successfully!');
}

main().catch((error) => {
    console.error('❌ Deployment failed:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Full Error:', error);
    process.exit(1);
});
