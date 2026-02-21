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
// Standard Devnet Account #0 (Seed 0)
const ACCOUNT_ADDRESS = '0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691';
const PRIVATE_KEY = '0x71d7bb07b9a64f6f78ac4c816aff4da9';
// Force 'latest' for everything
const PROVIDER = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
const account = new starknet_1.Account(PROVIDER, ACCOUNT_ADDRESS, PRIVATE_KEY);
async function main() {
    console.log(`🚀 Starting Safe Local Devnet Deployment`);
    console.log(`📡 RPC: ${RPC_URL}`);
    console.log(`👤 Account: ${ACCOUNT_ADDRESS}\n`);
    const btcSierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    const btcCasmPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.compiled_contract_class.json');
    const vaultSierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_PrivateBTCVault.contract_class.json');
    const vaultCasmPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_PrivateBTCVault.compiled_contract_class.json');
    try {
        // Manually fetch nonce from 'latest'
        let nonce = await PROVIDER.getNonceForAddress(ACCOUNT_ADDRESS, 'latest');
        console.log(`Initial Nonce: ${nonce}`);
        // 1. Declare MockBTC
        console.log('📝 Declaring MockBTC...');
        const btcSierra = starknet_1.json.parse(fs.readFileSync(btcSierraPath).toString('utf-8'));
        const btcCasm = starknet_1.json.parse(fs.readFileSync(btcCasmPath).toString('utf-8'));
        // We use a low-level call to ensure no 'pending' is used
        const btcDeclare = await account.declare({
            contract: btcSierra,
            casm: btcCasm
        }, { nonce });
        console.log(`✅ MockBTC Declared. Class Hash: ${btcDeclare.class_hash}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        nonce = starknet_1.num.toHex(BigInt(nonce) + 1n);
        // 2. Deploy MockBTC
        console.log('🚀 Deploying MockBTC...');
        const btcDeploy = await account.deployContract({
            classHash: btcDeclare.class_hash,
            constructorCalldata: [ACCOUNT_ADDRESS]
        }, { nonce });
        console.log(`✅ MockBTC Deployed at: ${btcDeploy.contract_address}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        nonce = starknet_1.num.toHex(BigInt(nonce) + 1n);
        // 3. Declare PrivateBTCVault
        console.log('📝 Declaring PrivateBTCVault...');
        const vaultSierra = starknet_1.json.parse(fs.readFileSync(vaultSierraPath).toString('utf-8'));
        const vaultCasm = starknet_1.json.parse(fs.readFileSync(vaultCasmPath).toString('utf-8'));
        const vaultDeclare = await account.declare({
            contract: vaultSierra,
            casm: vaultCasm
        }, { nonce });
        console.log(`✅ PrivateBTCVault Declared. Class Hash: ${vaultDeclare.class_hash}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        nonce = starknet_1.num.toHex(BigInt(nonce) + 1n);
        // 4. Deploy PrivateBTCVault
        console.log('🚀 Deploying PrivateBTCVault...');
        const vaultDeploy = await account.deployContract({
            classHash: vaultDeclare.class_hash,
            constructorCalldata: [btcDeploy.contract_address]
        }, { nonce });
        console.log(`✅ PrivateBTCVault Deployed at: ${vaultDeploy.contract_address}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log(`\n🎉 Safe Deployment Successful!`);
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
    }
    catch (error) {
        console.error('❌ Safe Deployment failed:', error.message);
        if (error.data)
            console.error('Full error data:', JSON.stringify(error.data, null, 2));
        process.exit(1);
    }
}
main();
