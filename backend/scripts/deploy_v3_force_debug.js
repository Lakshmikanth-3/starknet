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
const LOG_FILE = 'deploy_force_detail.log';
// Clear log file
fs.writeFileSync(LOG_FILE, 'Script Started\n');
function log(msg) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}
// Use Blast API
const RPC_URL = 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';
const provider = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
const account = new starknet_1.Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);
async function main() {
    log('🚀 Explicit V3 Deployment (BlastAPI) - FORCE DEPLOY DEBUG');
    // MockBTC Class hash
    const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
    const classHash = starknet_1.hash.computeContractClassHash(sierra);
    const constructorCalldata = starknet_1.CallData.compile({ owner: ACCOUNT_ADDRESS });
    log(`📝 Class Hash: ${classHash}`);
    try {
        // Check if declared
        try {
            await provider.getClassByHash(classHash);
            log('✅ MockBTC Already Declared');
        }
        catch {
            log('⚠️ Class hash not found on node. Assuming it might be declared or attempting without check (risky).');
        }
        log('⚖️  Fetching Gas Price (Skipping Estimation)...');
        let block;
        try {
            // Use latest instead of pending
            block = await provider.getBlock('latest');
            log(`📦 Block fetched: ${block.block_hash}`);
        }
        catch (e) {
            log(`⚠️ Failed to fetch block: ${e.message}`);
        }
        let gasPriceL1 = 1000000000n; // Default 1 Gwei in Fri
        if (block && block.l1_gas_price) {
            // @ts-ignore
            if (block.l1_gas_price.price_in_fri) {
                // @ts-ignore
                gasPriceL1 = BigInt(block.l1_gas_price.price_in_fri);
            }
            else if (block.l1_gas_price.price_in_wei) {
                // Fallback to wei if fri missing
                // @ts-ignore
                gasPriceL1 = BigInt(block.l1_gas_price.price_in_wei);
            }
        }
        log(`⛽ L1 Gas Price (Fri/Wei): ${gasPriceL1}`);
        // Hardcode generous bounds
        // Max Price: 3x current (generous!)
        const maxPrice = gasPriceL1 * 3n;
        const maxAmount = 200000n; // 200k gas
        // Both L1 and L2 bounds
        const resourceBounds = {
            l1_gas: {
                max_amount: '0x' + maxAmount.toString(16),
                max_price_per_unit: '0x' + maxPrice.toString(16)
            },
            l2_gas: {
                max_amount: '0x' + maxAmount.toString(16),
                max_price_per_unit: '0x' + maxPrice.toString(16)
            }
        };
        log(`🚀 Deploying with bounds: ${JSON.stringify(resourceBounds)}`);
        const deploy = await account.deployContract({
            classHash: classHash,
            constructorCalldata: constructorCalldata
        }, {
            version: 3,
            resourceBounds: resourceBounds
        });
        log(`✅ Transaction Hash: ${deploy.transaction_hash}`);
        await provider.waitForTransaction(deploy.transaction_hash);
        log(`🎉 MockBTC Deployed at: ${deploy.contract_address}`);
        fs.writeFileSync('mock_btc_address.txt', deploy.contract_address);
    }
    catch (err) {
        log(`❌ Failed: ${err.message}`);
        if (err.data)
            log(`Error Data: ${JSON.stringify(err.data)}`);
        // if (err.stack) log(err.stack);
    }
}
main();
