import { provider, MOCK_BTC_ADDRESS } from '../src/config/starknet';
import { Contract, json } from 'starknet';

async function main() {
    console.log("🔌 Testing Starknet Connection...");

    try {
        const chainId = await provider.getChainId();
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

        if (!MOCK_BTC_ADDRESS) {
            console.error("❌ MOCK_BTC_ADDESS is missing in .env");
            return;
        }

        console.log(`📝 Querying MockBTC at ${MOCK_BTC_ADDRESS}...`);
        const contract = new Contract(erc20Abi, MOCK_BTC_ADDRESS, provider);

        // Call name()
        console.log("   Calling name()...");
        try {
            const name = await contract.name();
            console.log("✅ Name:", name);
        } catch (e: any) {
            console.error("❌ Failed to get name:", e.message);
            // Try getting block number to see if that works
            const blockNum = await provider.getBlockNumber();
            console.log("   Current Block Number:", blockNum);
        }

        const symbol = await contract.symbol();
        console.log("✅ Symbol:", symbol);

    } catch (error) {
        console.error("❌ Connection Failed:", error);
    }
}

main();
