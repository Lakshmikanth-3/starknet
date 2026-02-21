"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const starknet_1 = require("starknet");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const RPC_URL = process.env.STARKNET_RPC_URL || 'http://127.0.0.1:5050';
const PROVIDER = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
// Devnet Admin Account (Predeployed 0)
const ADMIN_ADDRESS = '0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691';
const ADMIN_PRIVATE_KEY = '0x71d7bb07b9a64f6f78ac4c816aff4da9';
const ARTIFACTS_PATH = path_1.default.resolve(__dirname, '../../private_btc_core/target/dev');
async function main() {
    console.log(`🚀 Deploying contracts to Starknet Devnet at ${RPC_URL}...`);
    // 1. Initialize Account
    const account = new starknet_1.Account(PROVIDER, ADMIN_ADDRESS, ADMIN_PRIVATE_KEY);
    console.log(`👤 Using Account: ${account.address}`);
    // Helper to get nonce manually
    const getNonce = async () => {
        return await PROVIDER.getNonceForAddress(account.address, 'latest');
    };
    // 2. Load Artifacts
    const mockBtcSierra = starknet_1.json.parse(fs_1.default.readFileSync(path_1.default.join(ARTIFACTS_PATH, 'private_btc_core_MockBTC.contract_class.json')).toString('ascii'));
    const mockBtcCasm = starknet_1.json.parse(fs_1.default.readFileSync(path_1.default.join(ARTIFACTS_PATH, 'private_btc_core_MockBTC.compiled_contract_class.json')).toString('ascii'));
    const vaultSierra = starknet_1.json.parse(fs_1.default.readFileSync(path_1.default.join(ARTIFACTS_PATH, 'private_btc_core_PrivateBTCVault.contract_class.json')).toString('ascii'));
    const vaultCasm = starknet_1.json.parse(fs_1.default.readFileSync(path_1.default.join(ARTIFACTS_PATH, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json')).toString('ascii'));
    // Helper to declare if not exists
    const declareIfNotExists = async (name, contract, casm) => {
        const classHash = starknet_1.hash.computeContractClassHash(contract);
        console.log(`🔎 Checking ${name} (Hash: ${classHash})...`);
        try {
            await PROVIDER.getClassByHash(classHash);
            console.log(`✅ ${name} already declared.`);
            return classHash;
        }
        catch (e) {
            console.log(`📝 Declaring ${name}...`);
            const nonce = await getNonce();
            try {
                const res = await account.declare({ contract, casm }, { nonce, maxFee: 10n ** 16n }); // Let starknet.js choose version
                console.log(`   Tx: ${res.transaction_hash}`);
                await PROVIDER.waitForTransaction(res.transaction_hash);
                console.log(`✅ ${name} Declared.`);
                return res.class_hash;
            }
            catch (declareError) {
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
        constructorCalldata: starknet_1.CallData.compile([account.address]),
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
        constructorCalldata: starknet_1.CallData.compile([mockBtcAddress]),
    }, { nonce, maxFee: 10n ** 16n }); // Explicit maxFee
    console.log(`   Hash: ${deployVaultResponse.transaction_hash}`);
    await PROVIDER.waitForTransaction(deployVaultResponse.transaction_hash);
    const vaultAddress = deployVaultResponse.contract_address;
    console.log(`✅ PrivateBTCVault Deployed at: ${vaultAddress}`);
    // 7. Update .env file
    console.log('💾 Updating .env file...');
    const envPath = path_1.default.resolve(__dirname, '../.env');
    let envContent = fs_1.default.existsSync(envPath) ? fs_1.default.readFileSync(envPath, 'utf8') : '';
    const updateEnvVar = (key, value) => {
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        }
        else {
            envContent += `\n${key}=${value}`;
        }
    };
    updateEnvVar('MOCK_BTC_ADDR', mockBtcAddress);
    updateEnvVar('VAULT_ADDR', vaultAddress);
    updateEnvVar('STARKNET_RPC_URL', RPC_URL);
    fs_1.default.writeFileSync(envPath, envContent);
    console.log('✅ .env updated successfully!');
}
main().catch((error) => {
    console.error('❌ Deployment failed:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Full Error:', error);
    process.exit(1);
});
