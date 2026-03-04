/**
 * Comprehensive byte ordering debug for merkle proof
 */

const crypto = require('crypto');

function sha256(buf) {
    return crypto.createHash('sha256').update(buf).digest();
}

function doubleSha256(buf) {
    return sha256(sha256(buf));
}

async function debugByteOrdering(txid) {
    console.log(`\n${'='.repeat(90)}`);
    console.log(`🔬 BYTE ORDERING DEBUG FOR MERKLE PROOF`);
    console.log(`${'='.repeat(90)}\n`);
    
    // 1. Get backend proof
    const backendRes = await fetch(`http://localhost:3001/api/bridge/spv-proof?txid=${txid}`);
    const proof = await backendRes.json();
    
    console.log(`📦 Transaction Details:`);
    console.log(`   TXID (display):   ${txid}`);
    console.log(`   Block height:     ${proof.blockHeight}`);
    console.log(`   Position:         ${proof.txPos}\n`);
    
    // 2. Compute txid from raw TX
    const rawTxBuf = Buffer.from(proof.rawTxHex, 'hex');
    const txidInternal = doubleSha256(rawTxBuf); // This is internal byte order (big-endian)
    const txidDisplay = Buffer.from(txidInternal).reverse(); // Reverse for display
    
    console.log(`🧮 TXID Computation:`);
    console.log(`   Raw TX (stripped): ${proof.rawTxHex.substring(0, 40)}...`);
    console.log(`   TX size:           ${rawTxBuf.length} bytes`);
    console.log(`   double_sha256:`);
    console.log(`     Internal (big-endian):  ${txidInternal.toString('hex')}`);
    console.log(`     Display (little-endian): ${txidDisplay.toString('hex')}`);
    console.log(`     Expected display:        ${txid}`);
    console.log(`     Match: ${txidDisplay.toString('hex') === txid ? '✅' : '❌'}\n`);
    
    // 3. Show merkle proof siblings
    console.log(`📝 Merkle Proof Siblings (${proof.merkleProof.length} hashes):`);
    for (let i = 0; i < Math.min(2, proof.merkleProof.length); i++) {
        const hex = proof.merkleProof[i];
        const buf = Buffer.from(hex, 'hex');
        console.log(`   Sibling ${i}:`);
        console.log(`     Hex: ${hex}`);
        console.log(`     As u32 words (big-endian):`);
        const words = [];
        for (let j = 0; j < 32; j += 4) {
            words.push(buf.readUInt32BE(j));
        }
        console.log(`       [${words.join(', ')}]`);
    }
    console.log('');
    
    // 4. Get block header and merkle root
    const blockHashRes = await fetch(`https://explorer.bc-2.jp/api/block-height/${proof.blockHeight}`);
    const blockHash = (await blockHashRes.text()).trim();
    
    const headerRes = await fetch(`https://explorer.bc-2.jp/api/block/${blockHash}/header`);
    const headerHex = (await headerRes.text()).trim();
    const headerBuf = Buffer.from(headerHex, 'hex');
    
    // Merkle root is at bytes 36-67 in header (little-endian in header)
    const merkleRootFromHeader = headerBuf.slice(36, 68);
    
    console.log(`🔍 Block Header Analysis:`);
    console.log(`   Block hash: ${blockHash}`);
    console.log(`   Header hex: ${headerHex.substring(0, 40)}...`);
    console.log(`   Merkle root (from header, bytes 36-67):`);
    console.log(`     Hex (as stored in header): ${merkleRootFromHeader.toString('hex')}`);
    console.log(`     As u32 words (big-endian):  [${Array.from({length: 8}, (_, i) => 
        merkleRootFromHeader.readUInt32BE(i * 4)
    ).join(', ')}]`);
    
    // The header stores it in "internal" format which for merkle root means it's the raw SHA256 output
    console.log(`\n`);
    
    // 5. Show what the contract will see
    console.log(`⚙️  What the Cairo Contract Receives:`);
    console.log(`   Raw TX bytes: ${rawTxBuf.length} bytes`);
    console.log(`   Computed TXID (internal, from double_sha256):`);
    const txidWords = [];
    for (let i = 0; i < 32; i += 4) {
        txidWords.push(txidInternal.readUInt32BE(i));
    }
    console.log(`     Hex:   ${txidInternal.toString('hex')}`);
    console.log(`     Words: [${txidWords.join(', ')}]`);
    console.log(``);
    console.log(`   Merkle Siblings (first one):`);
    const firstSibling = Buffer.from(proof.merkleProof[0], 'hex');
    const firstWords = [];
    for (let i = 0; i < 32; i += 4) {
        firstWords.push(firstSibling.readUInt32BE(i));
    }
    console.log(`     Hex:   ${proof.merkleProof[0]}`);
    console.log(`     Words: [${firstWords.join(', ')}]`);
    console.log(``);
    console.log(`   Expected Merkle Root:`);
    const rootWords = [];
    for (let i = 0; i < 32; i += 4) {
        rootWords.push(merkleRootFromHeader.readUInt32BE(i));
    }
    console.log(`     Hex:   ${merkleRootFromHeader.toString('hex')}`);
    console.log(`     Words: [${rootWords.join(', ')}]`);
    
    console.log(`\n${'='.repeat(90)}\n`);
    
    return {
        txidInternal: txidInternal.toString('hex'),
        txidDisplay: txidDisplay.toString('hex'),
        merkleRoot: merkleRootFromHeader.toString('hex'),
        firstSibling: proof.merkleProof[0]
    };
}

// CLI
const txid = process.argv[2] || '7730cbec5830b3ccdb60a0d443640a788b599bf1a6f090503a41b54843b1fdc6';

debugByteOrdering(txid)
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
    });
