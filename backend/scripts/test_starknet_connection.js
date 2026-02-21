"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const starknet_1 = require("../src/config/starknet");
const starknet_2 = require("starknet");
async function main() {
    console.log("🔌 Testing Starknet Connection...");
    try {
        const chainId = await starknet_1.provider.getChainId();
        console.log(`✅ Connected to Chain ID: ${chainId}`);
        // mocked ABI for ERC20 name/symbol
        const erc20Abi = [
            {
                name: "name",
                type: "function",
                inputs: [],
                outputs: [{ name: "name", type: "felt252" }],
                state_mutability: "view"
            },
            {
                name: "symbol",
                type: "function",
                inputs: [],
                outputs: [{ name: "symbol", type: "felt252" }],
                state_mutability: "view"
            }
        ];
        if (!starknet_1.MOCK_BTC_ADDRESS) {
            console.error("❌ MOCK_BTC_ADDESS is missing in .env");
            return;
        }
        console.log(`📝 Querying MockBTC at ${starknet_1.MOCK_BTC_ADDRESS}...`);
        const contract = new starknet_2.Contract(erc20Abi, starknet_1.MOCK_BTC_ADDRESS, starknet_1.provider);
        // Call name()
        console.log("   Calling name()...");
        try {
            const name = await contract.name();
            console.log("✅ Name:", name);
        }
        catch (e) {
            console.error("❌ Failed to get name:", e.message);
            // Try getting block number to see if that works
            const blockNum = await starknet_1.provider.getBlockNumber();
            console.log("   Current Block Number:", blockNum);
        }
        const symbol = await contract.symbol();
        console.log("✅ Symbol:", symbol);
    }
    catch (error) {
        console.error("❌ Connection Failed:", error);
    }
}
main();
