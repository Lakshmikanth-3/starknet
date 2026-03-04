/**
 * Test different byte ordering for merkle proof
 */

const crypto = require('crypto');

function sha256(buf) {
    return crypto.createHash('sha256').update(buf).digest();
}

function doubleSha256(buf) {
    return sha256(sha256(buf));
}

function hashToWords(hash, reverse = false) {
    const buf = reverse ? Buffer.from(hash).reverse() : hash;
    const words = [];
    for (let i = 0; i < 8; i++) {
        words.push(buf.readUInt32BE(i * 4));
    }
    return words;
}

function wordsToBuffer(words) {
    const buf = Buffer.alloc(32);
    for (let i = 0; i < 8; i++) {
        buf.writeUInt32BE(words[i], i * 4);
    }
    return buf;
}

function hashPair(left, right) {
    const leftBuf = wordsToBuffer(left);
    const rightBuf = wordsToBuffer(right);
    const hash = doubleSha256(Buffer.concat([leftBuf, rightBuf]));
    return hashToWords(hash);
}

async function testByteOrders() {
    const txid = '2d92947d9ad9cc0169cf21dc16af82958554d2db309b9ce5227d1cb97d095b17';
    
    // Get SPV proof
    const backendRes = await fetch(`http://localhost:3001/api/bridge/spv-proof?txid=${txid}`);
    const proof = await backendRes.json();
    
    // Get block header
    const blockHashRes = await fetch(`https://explorer.bc-2.jp/api/block-height/${proof.blockHeight}`);
    const blockHash = (await blockHashRes.text()).trim();
    const headerRes = await fetch(`https://explorer.bc-2.jp/api/block/${blockHash}/header`);
    const headerHex = (await headerRes.text()).trim();
    const headerBuf = Buffer.from(headerHex, 'hex');
    const merkleRootBuf = headerBuf.slice(36, 68);
    const merkleRootWords = hashToWords(merkleRootBuf);
    
    // Get TXID hash
    const rawTxBuf = Buffer.from(proof.rawTxHex, 'hex');
    const txidHash = doubleSha256(rawTxBuf);
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing different byte order combinations\n`);
    console.log(`Expected merkle root: ${merkleRootBuf.toString('hex')}\n`);
    
    // Try 4 combinations:
    const combos = [
        { txidReverse: false, siblingReverse: false, desc: 'No reversal' },
        { txidReverse: true, siblingReverse: false, desc: 'Reverse TXID only' },
        { txidReverse: false, siblingReverse: true, desc: 'Reverse siblings only' },
        { txidReverse: true, siblingReverse: true, desc: 'Reverse both' },
    ];
    
    for (const combo of combos) {
        let current = hashToWords(txidHash, combo.txidReverse);
        let idx = proof.txPos;
        
        for (let i = 0; i < proof.merkleProofWords.length; i++) {
            const siblingWords = combo.siblingReverse 
                ? hashToWords(wordsToBuffer(proof.merkleProofWords[i]), true)
                : proof.merkleProofWords[i];
            
            const siblingOnRight = (idx % 2 === 0);
            current = siblingOnRight ? hashPair(current, siblingWords) : hashPair(siblingWords, current);
            idx = Math.floor(idx / 2);
        }
        
        const matches = current.every((word, i) => word === merkleRootWords[i]);
        const currentHex = wordsToBuffer(current).toString('hex');
        
        console.log(`${combo.desc}:`);
        console.log(`  Computed: ${currentHex.substring(0, 48)}...`);
        console.log(`  ${matches ? '✅ MATCH!' : '❌ No match'}\n`);
        
        if (matches) {
            console.log(`${'='.repeat(80)}`);
            console.log(`✅ SUCCESS! The correct byte order is: ${combo.desc}`);
            console.log(`${'='.repeat(80)}\n`);
            process.exit(0);
        }
    }
    
    console.log(`${'='.repeat(80)}`);
    console.log(`❌ None of the byte order combinations worked!`);
    console.log(`${'='.repeat(80)}\n`);
    process.exit(1);
}

testByteOrders().catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
});
