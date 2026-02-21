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
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.join(__dirname, '../.env') });
async function checkBalance() {
    const RPC_URL = process.env.SEPOLIA_RPC_URL || '';
    const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
    const provider = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
    console.log(`Checking balance for: ${ACCOUNT_ADDRESS}`);
    try {
        // ETH Address on Sepolia
        const ethAddr = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
        // STRK Address on Sepolia
        const strkAddr = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
        const ethBal = await provider.callContract({
            contractAddress: ethAddr,
            entrypoint: 'balanceOf',
            calldata: [ACCOUNT_ADDRESS]
        });
        console.log(`ETH Balance: ${BigInt(ethBal[0]).toString()}`);
        const strkBal = await provider.callContract({
            contractAddress: strkAddr,
            entrypoint: 'balanceOf',
            calldata: [ACCOUNT_ADDRESS]
        });
        console.log(`STRK Balance: ${BigInt(strkBal[0]).toString()}`);
    }
    catch (err) {
        console.error('Failed to check balance:', err.message);
    }
}
checkBalance();
