
import { RpcProvider } from 'starknet';

const RPC_URL = 'http://127.0.0.1:5050';
const provider = new RpcProvider({ nodeUrl: RPC_URL });

async function main() {
    console.log(`🔌 Connecting to ${RPC_URL}...`);
    try {
        const chainId = await provider.getChainId();
        console.log(`✅ Chain ID: ${chainId}`);

        const blockNumber = await provider.getBlockNumber();
        console.log(`✅ Block Number: ${blockNumber}`);

        const specVersion = await provider.getSpecVersion();
        console.log(`✅ Spec Version: ${specVersion}`);

    } catch (error) {
        console.error('❌ Connection failed:', error);
    }
}

main();
