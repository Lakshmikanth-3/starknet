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
const ACCOUNT_ADDRESS = '0x040b5d051f333646dda1b93a85419ba12d98a7e19a8d95ee638a8fef6ea15f4c';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;
console.log('Testing Sepolia Connection...');
console.log('RPC URL:', RPC_URL);
console.log('Account:', ACCOUNT_ADDRESS);
console.log('Private Key Set:', !!PRIVATE_KEY);
console.log('');
const provider = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
async function test() {
    try {
        console.log('1. Testing RPC endpoint...');
        const chainId = await provider.getChainId();
        console.log('✅ Chain ID:', chainId);
    }
    catch (error) {
        console.error('❌ RPC endpoint test failed:');
        console.error('   Message:', error.message);
        console.error('   Name:', error.name);
        return;
    }
    try {
        console.log('\n2. Testing account nonce...');
        const nonce = await provider.getNonceForAddress(ACCOUNT_ADDRESS, 'latest');
        console.log('✅ Account nonce:', nonce);
    }
    catch (error) {
        console.error('❌ Account nonce test failed:');
        console.error('   Message:', error.message);
        console.error('   Name:', error.name);
        return;
    }
    console.log('\n✅ All connectivity tests passed!');
}
test();
