"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const starknet_1 = require("starknet");
const RPC_URL = 'http://127.0.0.1:5050';
const PROVIDER = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
const ADMIN_ADDRESS = '0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691';
const ADMIN_PRIVATE_KEY = '0x71d7bb07b9a64f6f78ac4c816aff4da9';
async function main() {
    console.log(`🔌 Connecting to ${RPC_URL}...`);
    const account = new starknet_1.Account(PROVIDER, ADMIN_ADDRESS, ADMIN_PRIVATE_KEY);
    console.log(`👤 Testing Account: ${account.address}`);
    try {
        const nonce = await account.getNonce();
        console.log(`✅ Nonce: ${nonce}`);
    }
    catch (error) {
        console.error('❌ Failed to get nonce:', error);
    }
}
main();
