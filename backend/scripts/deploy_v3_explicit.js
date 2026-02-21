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
const RPC_URL = process.env.SEPOLIA_RPC_URL || '';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';
const provider = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
const account = new starknet_1.Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);
async function main() {
    console.log('🚀 Explicit V3 Deployment (STRK)');
    // MockBTC Class hash
    const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
    const classHash = starknet_1.hash.computeContractClassHash(sierra);
    const constructorCalldata = starknet_1.CallData.compile({ owner: ACCOUNT_ADDRESS });
    try {
        console.log('⚖️  Estimating Fee...');
        const estimatedFee = await account.estimateDeployFee({
            classHash: classHash,
            constructorCalldata: constructorCalldata
        }, { version: 3 });
        console.log('✅ Fee Estimated:', JSON.stringify(estimatedFee, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
        console.log('🚀 Deploying...');
        // Add 50% buffer to resource bounds
        const resourceBounds = {
            l1_gas: {
                max_amount: starknet_1.cairo.uint256(BigInt(estimatedFee.resourceBounds.l1_gas.max_amount) * 3n / 2n).low,
                max_price_per_unit: starknet_1.cairo.uint256(BigInt(estimatedFee.resourceBounds.l1_gas.max_price_per_unit) * 3n / 2n).low
            },
            l2_gas: {
                max_amount: starknet_1.cairo.uint256(BigInt(estimatedFee.resourceBounds.l2_gas.max_amount) * 3n / 2n).low,
                max_price_per_unit: starknet_1.cairo.uint256(BigInt(estimatedFee.resourceBounds.l2_gas.max_price_per_unit) * 3n / 2n).low
            }
        };
        // Simplify: just pass specific max_amount and max_price_per_unit as hex strings if cairo.uint256 fails
        // Actually estimateDeployFee returns struct with hex strings usually?
        // Let's just use what estimate returned directly but multiplied
        // estimatedFee.resourceBounds.l1_gas is { max_amount: '0x...', ... }
        const boostedBounds = {
            l1_gas: {
                max_amount: '0x' + (BigInt(estimatedFee.resourceBounds.l1_gas.max_amount) * 2n).toString(16),
                max_price_per_unit: '0x' + (BigInt(estimatedFee.resourceBounds.l1_gas.max_price_per_unit) * 2n).toString(16)
            },
            l2_gas: {
                max_amount: '0x' + (BigInt(estimatedFee.resourceBounds.l2_gas.max_amount) * 2n).toString(16),
                max_price_per_unit: '0x' + (BigInt(estimatedFee.resourceBounds.l2_gas.max_price_per_unit) * 2n).toString(16)
            }
        };
        const deploy = await account.deployContract({
            classHash: classHash,
            constructorCalldata: constructorCalldata
        }, {
            version: 3,
            resourceBounds: boostedBounds
        });
        console.log(`✅ Transaction Hash: ${deploy.transaction_hash}`);
        await provider.waitForTransaction(deploy.transaction_hash);
        console.log(`🎉 MockBTC Deployed at: ${deploy.contract_address}`);
    }
    catch (err) {
        console.error('❌ Failed:', err.message);
        if (err.data)
            console.error('Error Data:', err.data);
        fs.writeFileSync('v3_error.txt', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    }
}
main();
