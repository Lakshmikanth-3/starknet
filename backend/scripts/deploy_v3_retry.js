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
// Use Blast API
const RPC_URL = 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';
const provider = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
const account = new starknet_1.Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);
const delay = (ms) => new Promise(res => setTimeout(res, ms));
async function main() {
    console.log('🚀 Explicit V3 Deployment (BlastAPI) - WITH DELAY');
    // MockBTC Class hash
    const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
    const classHash = starknet_1.hash.computeContractClassHash(sierra);
    const constructorCalldata = starknet_1.CallData.compile({ owner: ACCOUNT_ADDRESS });
    try {
        // Check if declared
        try {
            await provider.getClassByHash(classHash);
            console.log('✅ MockBTC Already Declared');
        }
        catch {
            console.log('📝 Declaring MockBTC (V3 via Blast)...');
            try {
                const declare = await account.declare({ contract: sierra, casm: JSON.parse(fs.readFileSync(path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.compiled_contract_class.json'), 'utf-8')) }, { version: 3 });
                console.log(`⏳ Declare Tx: ${declare.transaction_hash}`);
                try {
                    await provider.waitForTransaction(declare.transaction_hash);
                    console.log('✅ MockBTC Declared');
                }
                catch (e) {
                    console.log(`⚠️ Wait for declare failed: ${e.message}`);
                }
                console.log('⏳ Waiting 20s for propagation...');
                await delay(20000);
            }
            catch (declErr) {
                console.log(`❌ Declaration Failed: ${declErr.message}`);
            }
        }
        console.log('⚖️  Estimating Deploy Fee...');
        const estimatedFee = await account.estimateDeployFee({
            classHash: classHash,
            constructorCalldata: constructorCalldata
        }, { version: 3 });
        console.log('Estimated:', estimatedFee);
        // Increase buffer to 1.5x
        const resourceBounds = {
            l1_gas: {
                max_amount: '0x' + (BigInt(estimatedFee.resourceBounds.l1_gas.max_amount) * 3n / 2n).toString(16),
                max_price_per_unit: '0x' + (BigInt(estimatedFee.resourceBounds.l1_gas.max_price_per_unit) * 3n / 2n).toString(16)
            },
            l2_gas: {
                max_amount: '0x' + (BigInt(estimatedFee.resourceBounds.l2_gas.max_amount) * 3n / 2n).toString(16),
                max_price_per_unit: '0x' + (BigInt(estimatedFee.resourceBounds.l2_gas.max_price_per_unit) * 3n / 2n).toString(16)
            }
        };
        console.log('🚀 Deploying with bounds:', resourceBounds);
        const deploy = await account.deployContract({
            classHash: classHash,
            constructorCalldata: constructorCalldata
        }, {
            version: 3,
            resourceBounds: resourceBounds
        });
        console.log(`✅ Transaction Hash: ${deploy.transaction_hash}`);
        await provider.waitForTransaction(deploy.transaction_hash);
        console.log(`🎉 MockBTC Deployed at: ${deploy.contract_address}`);
        // Save address to file
        fs.writeFileSync('mock_btc_address.txt', deploy.contract_address);
    }
    catch (err) {
        console.error('❌ Failed:', err);
    }
}
main();
