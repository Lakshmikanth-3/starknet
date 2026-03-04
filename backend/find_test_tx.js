/**
 * Find a recent confirmed transaction to test SPV proof verification
 */

const MEMPOOL_API = 'https://explorer.bc-2.jp/api';

async function findRecentTx() {
    try {
        // Get recent blocks
        console.log('Fetching recent blocks...');
        const tipRes = await fetch(`${MEMPOOL_API}/blocks/tip/height`);
        const tipHeight = parseInt(await tipRes.text());
        console.log(`Current tip height: ${tipHeight}`);
        
        // Get the latest block
        const blocksRes = await fetch(`${MEMPOOL_API}/blocks/${tipHeight}`);
        const blocks = await blocksRes.json();
        
        if (!Array.isArray(blocks) || blocks.length === 0) {
            throw new Error('No blocks found');
        }
        
        const latestBlock = blocks[0];
        console.log(`\nLatest block:`);
        console.log(`  Height: ${latestBlock.height}`);
        console.log(`  Hash: ${latestBlock.id}`);
        console.log(`  TX count: ${latestBlock.tx_count}`);
        
        // Get transactions in this block
        const txsRes = await fetch(`${MEMPOOL_API}/block/${latestBlock.id}/txs`);
        const txs = await txsRes.json();
        
        if (!Array.isArray(txs) || txs.length === 0) {
            throw new Error('No transactions in block');
        }
        
        console.log(`\nTransactions in block:`);
        for (let i = 0; i < Math.min(5, txs.length); i++) {
            console.log(`  ${i}: ${txs[i].txid}`);
        }
        
        // Pick the second transaction (first is coinbase)
        const testTxid = txs.length > 1 ? txs[1].txid : txs[0].txid;
        console.log(`\nSelected transaction for testing: ${testTxid}`);
        console.log(`\nRun: node debug_spv_proof.js ${testTxid}`);
        
        return testTxid;
    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    }
}

findRecentTx()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
