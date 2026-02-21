const { RpcProvider, Contract } = require('starknet');

const SEPOLIA_RPC = "https://starknet-sepolia.public.blastapi.io/rpc/v0_7";
const MOCK_BTC_ADDR = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const VAULT_ADDR = "0x03476906a58bc9e96e05396556f8f4a132c32cf46dd4d9ad216f8d4d6ad15d6";

async function check() {
    console.log("Checking existing contracts...");
    try {
        const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });

        console.log(`Checking MockBTC at ${MOCK_BTC_ADDR}...`);
        const mockClassHash = await provider.getClassHashAt(MOCK_BTC_ADDR);
        console.log(`✅ MockBTC Class Hash: ${mockClassHash}`);

        console.log(`Checking Vault at ${VAULT_ADDR}...`);
        const vaultClassHash = await provider.getClassHashAt(VAULT_ADDR);
        console.log(`✅ Vault Class Hash: ${vaultClassHash}`);

        return true;
    } catch (e) {
        console.log(`❌ Failed: ${e.message}`);
        return false;
    }
}

check();
