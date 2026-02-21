"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const starknet_1 = require("starknet");
const RPC_URL = 'http://127.0.0.1:5050';
const PROVIDER = new starknet_1.RpcProvider({ nodeUrl: RPC_URL });
// Standard Starknet Devnet account addresses (used by many devnets with seed 0)
const POTENTIAL_ACCOUNTS = [
    '0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691', // Old devnet admin
    '0x0517efefd330a9a10c88e1dbd77d5305a51ab7e4a98883e12c8fa1a85f9e5871', // Standard devnet 0
    '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8', // Alternative  
];
async function main() {
    console.log(`🔌 Testing accounts on ${RPC_URL}...`);
    for (const addr of POTENTIAL_ACCOUNTS) {
        try {
            const nonce = await PROVIDER.getNonceForAddress(addr, 'latest');
            console.log(`✅ Found valid account: ${addr}`);
            console.log(`   Nonce: ${nonce}`);
        }
        catch (error) {
            console.log(`❌ Account not found: ${addr}`);
            console.log(`   Error: ${error.message}`);
        }
    }
}
main();
