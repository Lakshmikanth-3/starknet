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
const RPC_URL = 'http://127.0.0.1:5050';
const PROVIDER = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
// Standard OZ account pattern for devnet with seed 0
const OZ_ACCOUNT_ADDRESS = '0x0517efefd330a9a10c88e1dbd77d5305a51ab7e4a98883e12c8fa1a85f9e5871';
const OZ_PRIVATE_KEY = '0x00c1cf1490de1352865301bb8705143f3ef938f97fdf892f1090dcb5ac7bcd1d';
async function main() {
    console.log(`🔌 Connecting to ${RPC_URL}...`);
    // Try with OZ account
    try {
        const account = new starknet_1.Account(PROVIDER, OZ_ACCOUNT_ADDRESS, OZ_PRIVATE_KEY);
        const nonce = await PROVIDER.getNonceForAddress(OZ_ACCOUNT_ADDRESS, 'latest');
        console.log(`✅ OZ Account online: ${OZ_ACCOUNT_ADDRESS}`);
        console.log(`   Nonce: ${nonce}`);
        // Try declaring MockBTC
        const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
        const casmPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.compiled_contract_class.json');
        const contract = starknet_1.json.parse(fs.readFileSync(sierraPath).toString('utf-8'));
        const casm = starknet_1.json.parse(fs.readFileSync(casmPath).toString('utf-8'));
        console.log(`📝 Attempting to declare MockBTC...`);
        const declareResponse = await account.declare({ contract, casm });
        console.log(`✅ Declared! Class Hash: ${declareResponse.class_hash}`);
    }
    catch (error) {
        console.error('❌ OZ Account failed:', error.message);
        console.error('   Stack:', error.stack);
    }
}
main();
