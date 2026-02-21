
import { RpcProvider } from 'starknet';

const RPC_URL = 'http://127.0.0.1:5050';
const PROVIDER = new RpcProvider({ nodeUrl: RPC_URL });
const ADMIN_ADDRESS = '0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691';

async function main() {
    console.log(`🔌 Connecting to ${RPC_URL}...`);
    try {
        console.log("Trying 'pending'...");
        const nonce = await PROVIDER.getNonceForAddress(ADMIN_ADDRESS, 'pending');
        console.log(`✅ Provider Nonce (pending): ${nonce}`);
    } catch (error) {
        console.error('❌ Provider getNonce (pending) failed:', error);
    }
}

main();
