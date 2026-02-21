const { RpcProvider, Account, Contract, constants } = require('starknet');

const SEPOLIA_RPC = "https://starknet-sepolia.public.blastapi.io/rpc/v0_7";
const ACCOUNT_ADDRESS = "0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b";

async function main() {
    try {
        const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });

        console.log("Checking balance...");
        // ETH Token Address on Sepolia
        const ethAddress = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

        const { abi } = await provider.getClassAt(ethAddress);
        if (!abi) {
            console.log("Error: Could not get ETH contract ABI");
            return;
        }

        const contract = new Contract(abi, ethAddress, provider);
        const balance = await contract.balanceOf(ACCOUNT_ADDRESS);

        console.log(`Balance: ${balance.balance.low} wei`);

        if (balance.balance.low < 1000000000000000n) { // 0.001 ETH
            console.log("⚠️ WARNING: Low balance! Might not be enough for deployment.");
        } else {
            console.log("✅ Balance looks sufficient.");
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}

main();
