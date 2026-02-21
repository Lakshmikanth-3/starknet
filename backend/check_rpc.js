const { RpcProvider } = require('starknet');

const endpoints = [
    "https://starknet-sepolia.public.blastapi.io/rpc/v0_7",
    "https://free-rpc.nethermind.io/sepolia-juno/v0_7",
    "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ"
];

async function check() {
    console.log("Checking RPCs...");
    for (const url of endpoints) {
        try {
            console.log(`Checking ${url}...`);
            const provider = new RpcProvider({ nodeUrl: url });
            const chainId = await provider.getChainId();
            console.log(`✅ Success! Chain ID: ${chainId}`);
            return;
        } catch (e) {
            console.log(`❌ Failed: ${e.message}`);
        }
    }
}

check();
