require('dotenv').config();
const { RpcProvider, Account, uint256 } = require('starknet');
const { BitcoinProofService } = require('./src/services/BitcoinProofService.ts');

async function run() {
    const fetch = (await import('node-fetch')).default;
    global.fetch = fetch;
    
    // We will just do a dry-run or estimate fee to see if it fails!
    const txid = '2d92947d9ad9cc0169cf21dc16af82958554d2db309b9ce5227d1cb97d095b17';
    // Let's use the local test API which we know works to get the proof!
    const res = await fetch(`http://localhost:3001/api/bridge/spv-proof?txid=${txid}`);
    const proof = await res.json();
    
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    const account = new Account(provider, process.env.STARKNET_ACCOUNT_ADDRESS, process.env.SEPOLIA_PRIVATE_KEY, '1');
    
    const rawTxSpan = [
        proof.rawTxBytes.length.toString(),
        ...proof.rawTxBytes.map(b => b.toString()),
    ];

    const merkleSpan = [
        proof.merkleProofWords.length.toString(),
        ...proof.merkleProofWords.flatMap(words => words.map(w => w.toString())),
    ];

    const calldata = [
        '0x1234567890abcdef', // commitment
        BigInt(proof.blockHeight).toString(),
        BigInt(proof.txPos).toString(),
        ...rawTxSpan,
        proof.voutIndex.toString(),
        ...merkleSpan,
    ];
    
    const call = {
        contractAddress: process.env.VAULT_CONTRACT_ADDRESS,
        entrypoint: 'deposit',
        calldata
    };
    
    try {
        console.log('Estimating fee to verify if tx would revert...');
        const fee = await account.estimateFee([call]);
        console.log('Success! It would not revert.', fee);
    } catch(e) {
        console.error('Failure:', e.message);
    }
}
run();
