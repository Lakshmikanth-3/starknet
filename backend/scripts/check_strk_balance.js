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
dotenv.config();
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const PROVIDER = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
const ADMIN_ADDRESS = '0x040b5d051f333646dda1b93a85419ba12d98a7e19a8d95ee638a8fef6ea15f4c';
const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'; // STRK on Sepolia
async function main() {
    console.log(`🔌 Connecting to Sepolia...`);
    console.log(`📡 RPC: ${RPC_URL}`);
    try {
        const { abi: erc20Abi } = await PROVIDER.getClassAt(STRK_ADDRESS);
        if (!erc20Abi)
            throw new Error('STRK ABI not found');
        const contract = new starknet_1.Contract(erc20Abi, STRK_ADDRESS, PROVIDER);
        const balance = await contract.balanceOf(ADMIN_ADDRESS);
        // Uint256 in Starknet.js 6.x is often returned as a bigint or object
        const amount = starknet_1.num.toBigInt(balance.low || balance);
        console.log(`✅ STRK Balance: ${amount.toString()} (raw)`);
        console.log(`✅ STRK Balance: ${Number(amount) / 1e18} STRK`);
    }
    catch (error) {
        console.error('❌ Failed to check STRK balance:', error.message);
    }
}
main();
