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
// NO DOTENV
const LOG_FILE = 'deploy_blast_declare.log';
// Clear log
fs.writeFileSync(LOG_FILE, 'Script Started\n');
function log(msg) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}
// Explicit Blast API
const RPC_URL = 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = '0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48';
log(`Using RPC: ${RPC_URL}`);
const provider = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
const account = new starknet_1.Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);
async function main() {
    log('🚀 Explicit V3 Deployment (BlastAPI) - WITH DECLARE');
    const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    if (!fs.existsSync(sierraPath)) {
        log('❌ Sierra file not found!');
        return;
    }
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
    const casmPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.compiled_contract_class.json');
    const casm = JSON.parse(fs.readFileSync(casmPath, 'utf-8'));
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
            log('📝 Declaring MockBTC (V3 via Blast)...');
            try {
                const declare = await account.declare({ contract: sierra, casm: casm }, { version: 3 });
                log(`⏳ Declare Tx: ${declare.transaction_hash}`);
                await provider.waitForTransaction(declare.transaction_hash);
                log('✅ MockBTC Declared');
            }
            catch (e) {
                log(`❌ Declaration Failed: ${e.message}`);
                if (e.data)
                    log(`Error Data: ${JSON.stringify(e.data)}`);
                throw e;
            }
        }
        log('⚖️  Fetching Gas Price (Skipping Estimation)...');
        let block;
        try {
            block = await provider.getBlock('latest');
            log(`📦 Block: ${block.block_hash}, L1 Gas (Fri): ${block.l1_gas_price?.price_in_fri}`);
        }
        catch (e) {
            log(`⚠️ Failed to fetch block: ${e.message}`);
        }
        let gasPriceL1 = 1000000000n;
        if (block && block.l1_gas_price && block.l1_gas_price.price_in_fri) {
            // @ts-ignore
            gasPriceL1 = BigInt(block.l1_gas_price.price_in_fri);
        }
        log(`⛽ L1 Gas Price Used: ${gasPriceL1}`);
        // Hardcode generous bounds
        const maxPrice = gasPriceL1 * 10n; // 10x safety
        const maxAmount = 100000n;
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
    }
}
main();
