"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const starknet_1 = require("starknet");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const RPC_URL = 'http://127.0.0.1:5050';
const ACCOUNT_ADDRESS = '0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691';
const PRIVATE_KEY = '0x71d7bb07b9a64f6f78ac4c816aff4da9';
async function main() {
    console.log(`🚀 Starting Surgical Deployment on Local Devnet`);
    const provider = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
    // SURGICAL OVERRIDES
    const originalGetNonce = provider.getNonceForAddress.bind(provider);
    provider.getNonceForAddress = async (address, blockIdentifier) => {
        return originalGetNonce(address, 'latest');
    };
    // Override waitForTransaction to avoid internal 'pending' checks
    provider.waitForTransaction = async (txHash) => {
        console.log(`⏳ Waiting for tx: ${txHash}...`);
        for (let i = 0; i < 10; i++) {
            try {
                const status = await provider.getTransactionStatus(txHash);
                console.log(`   Current Status: ${status.finality_status || status.execution_status}`);
                if (status.finality_status === 'ACCEPTED_ON_L2' || status.execution_status === 'SUCCEEDED') {
                    return status;
                }
            }
            catch (e) {
                // Ignore errors during polling
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        return {};
    };
    const account = new starknet_1.Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);
    const btcSierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    const btcCasmPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.compiled_contract_class.json');
    const vaultSierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_PrivateBTCVault.contract_class.json');
    const vaultCasmPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_PrivateBTCVault.compiled_contract_class.json');
    try {
        console.log('1. Declaring MockBTC...');
        const btcSierra = starknet_1.json.parse(fs.readFileSync(btcSierraPath, 'utf8'));
        const btcCasm = starknet_1.json.parse(fs.readFileSync(btcCasmPath, 'utf8'));
        const btcDeclare = await account.declare({ contract: btcSierra, casm: btcCasm });
        console.log(`✅ MockBTC Declared. Class Hash: ${btcDeclare.class_hash}`);
        await provider.waitForTransaction(btcDeclare.transaction_hash);
        console.log('2. Deploying MockBTC...');
        const btcDeploy = await account.deployContract({
            classHash: btcDeclare.class_hash,
            constructorCalldata: [ACCOUNT_ADDRESS]
        });
        console.log(`✅ MockBTC Deployed at: ${btcDeploy.contract_address}`);
        await provider.waitForTransaction(btcDeploy.transaction_hash);
        console.log('3. Declaring PrivateBTCVault...');
        const vaultSierra = starknet_1.json.parse(fs.readFileSync(vaultSierraPath, 'utf8'));
        const vaultCasm = starknet_1.json.parse(fs.readFileSync(vaultCasmPath, 'utf8'));
        const vaultDeclare = await account.declare({ contract: vaultSierra, casm: vaultCasm });
        console.log(`✅ PrivateBTCVault Declared. Class Hash: ${vaultDeclare.class_hash}`);
        await provider.waitForTransaction(vaultDeclare.transaction_hash);
        console.log('4. Deploying PrivateBTCVault...');
        const vaultDeploy = await account.deployContract({
            classHash: vaultDeclare.class_hash,
            constructorCalldata: [btcDeploy.contract_address]
        });
        console.log(`✅ PrivateBTCVault Deployed at: ${vaultDeploy.contract_address}`);
        await provider.waitForTransaction(vaultDeploy.transaction_hash);
        console.log(`\n🎉 Success! All contracts deployed.`);
        // Update .env
        const envPath = path.join(__dirname, '../.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/STARKNET_RPC_URL=.*/, `STARKNET_RPC_URL=${RPC_URL}`);
        envContent = envContent.replace(/MOCK_BTC_ADDR=.*/, `MOCK_BTC_ADDR=${btcDeploy.contract_address}`);
        envContent = envContent.replace(/VAULT_ADDR=.*/, `VAULT_ADDR=${vaultDeploy.contract_address}`);
        fs.writeFileSync(envPath, envContent);
        console.log(`\n📝 Updated .env with new local contract addresses.`);
    }
    catch (e) {
        console.error('❌ Deployment failed:', e.message);
        process.exit(1);
    }
}
main();
