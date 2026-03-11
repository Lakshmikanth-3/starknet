require('dotenv').config();
const { RpcProvider, Account } = require('starknet');

async function run() {
    try {
        const fetch = (await import('node-fetch')).default;
        // height 293999
        // 1. fetch block hash
        const hashRes = await fetch("https://mempool.space/signet/api/block-height/293999");
        const hash = (await hashRes.text()).trim();
        // 2. fetch block header
        const headerRes = await fetch(`https://mempool.space/signet/api/block/${hash}/header`);
        const headerHex = (await headerRes.text()).trim();
        // 3. parse merkle root
        const merkleRoot = headerHex.slice(72, 136);
        console.log("Merkle root:", merkleRoot);
        
        // 4. merkle root to u32 array
        const bytes = Buffer.from(merkleRoot, 'hex');
        const words = [];
        for (let i = 0; i < 32; i += 4) {
            words.push(BigInt(bytes.readUInt32BE(i)));
        }
        
        const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
        const account = new Account({
            nodeUrl: process.env.STARKNET_RPC_URL,
            provider,
            address: process.env.STARKNET_ACCOUNT_ADDRESS,
            signer: process.env.SEPOLIA_PRIVATE_KEY,
            cairoVersion: '1'
        });
        
        const calldata = [
            '293999',
            ...words.map(w => w.toString())
        ];
        
        const call = {
            contractAddress: process.env.HEADER_STORE_CONTRACT_ADDRESS,
            entrypoint: 'store_header',
            calldata
        };
        
        console.log("Storing header 293999...");
        const response = await account.execute([call]);
        console.log("Response Hash:", response.transaction_hash);
        await provider.waitForTransaction(response.transaction_hash);
        console.log("Header Stored!");
        
    } catch(e) {
        console.error(e);
    }
}
run();
