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
function log(msg) {
    console.log(msg);
    fs.appendFileSync('deploy_step.log', msg + '\n');
}
const RPC_URL = process.env.SEPOLIA_RPC_URL || '';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';
const provider = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
const account = new starknet_1.Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);
async function deployMockBTC() {
    log('🚀 Starting MockBTC Deployment');
    const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
    const classHash = starknet_1.hash.computeContractClassHash(sierra);
    log(`📝 Class Hash: ${classHash}`);
    // Deploy
    log('🚀 Deploying MockBTC...');
    const constructorCalldata = starknet_1.CallData.compile({ owner: ACCOUNT_ADDRESS });
    try {
        log('Attempting V2 deployment...');
        const deploy = await account.deployContract({
            classHash: classHash,
            constructorCalldata: constructorCalldata
        });
        log(`⏳ Transaction Hash: ${deploy.transaction_hash}`);
        await provider.waitForTransaction(deploy.transaction_hash);
        log(`✅ MockBTC Deployed at: ${deploy.contract_address}`);
        fs.writeFileSync('mock_btc_address.txt', deploy.contract_address);
    }
    catch (err) {
        log(`⚠️ V2 Failed: ${err.message}`);
        log('Attempting V3 deployment...');
        try {
            const deploy = await account.deployContract({
                classHash: classHash,
                constructorCalldata: constructorCalldata
            }, { version: 3 });
            log(`⏳ Transaction Hash (V3): ${deploy.transaction_hash}`);
            await provider.waitForTransaction(deploy.transaction_hash);
            log(`✅ MockBTC Deployed (V3) at: ${deploy.contract_address}`);
            fs.writeFileSync('mock_btc_address.txt', deploy.contract_address);
        }
        catch (v3Err) {
            log(`❌ V3 Failed: ${v3Err.message}`);
            throw v3Err;
        }
    }
}
deployMockBTC().catch(err => {
    log(`❌ Fatal Error: ${err.message}`);
    process.exit(1);
});
