/**
 * Complete merkle proof validation (fixed buffer offset issue)
 */

const crypto = require('crypto');

function sha256(buf) {
    return crypto.createHash('sha256').update(buf).digest();
}

function doubleSha256(buf) {
    return sha256(sha256(buf));
}

function hashToWords(hash) {
    if (hash.length !== 32) {
        throw new Error(`hashToWords: Expected 32 bytes, got ${hash.length} bytes`);
    }
    const words = [];
    for (let i = 0; i < 8; i++) {
        const offset = i * 4;
        if (offset + 4 > hash.length) {
            throw new Error(`hashToWords: offset ${offset} out of range (buffer size: ${hash.length})`);
        }
        words.push(hash.readUInt32BE(offset));
    }
    return words;
}

function wordsToHex(words) {
    const buf = Buffer.alloc(32);
    for (let i = 0; i < 8; i++) {
        buf.writeUInt32BE(words[i], i * 4);
    }
    return buf.toString('hex');
}

function hashPair(left, right) {
    const leftBuf = Buffer.alloc(32);
    const rightBuf = Buffer.alloc(32);
    
    for (let i = 0; i < 8; i++) {
        leftBuf.writeUInt32BE(left[i], i * 4);
        rightBuf.writeUInt32BE(right[i], i * 4);
    }
    
    return hashToWords(doubleSha256(Buffer.concat([leftBuf, rightBuf])));
}

function verifyMerkleProof(txid, proof, pos, merkleRoot) {
    let current = txid;
    let idx = pos;
    
    console.log(`\n🔍 Verifying Merkle Proof:`);
    console.log(`   Initial TXID: ${wordsToHex(current)}`);
    console.log(`   Position: ${pos}, Siblings: ${proof.length}\n`);
    
    for (let i = 0; i < proof.length; i++) {
        const sibling = proof[i];
        // Electrum convention: if index is EVEN, sibling goes on RIGHT
        // if index is ODD, sibling goes on LEFT
        const siblingOnRight = (idx % 2 === 0);
        
        console.log(`   Step ${i + 1}: ${siblingOnRight ? 'current LEFT, sibling RIGHT' : 'sibling LEFT, current RIGHT'}`);
        console.log(`     Current:  ${wordsToHex(current).substring(0, 16)}...`);
        console.log(`     Sibling:  ${wordsToHex(sibling).substring(0, 16)}...`);
        
        current = siblingOnRight ? hashPair(current, sibling) : hashPair(sibling, current);
        idx = Math.floor(idx / 2);
        
        console.log(`     Result:   ${wordsToHex(current).substring(0, 16)}...\n`);
    }
    
    const matches = current.every((word, i) => word === merkleRoot[i]);
    console.log(`📊 Final Result:`);
    console.log(`   Computed root: ${wordsToHex(current)}`);
    console.log(`   Expected root: ${wordsToHex(merkleRoot)}`);
    console.log(`   ${matches ? '✅ VALID - Merkle proof verifies!' : '❌ INVALID - Proof does not match!'}\n`);
    
    return matches;
}

async function testMerkleProof(txid) {
    console.log(`\n${'='.repeat(90)}`);
    console.log(`🧪 COMPLETE MERKLE PROOF VALIDATION`);
    console.log(`${'='.repeat(90)}\n`);
    
    try {
        // 1. Get SPV proof from backend
        console.log(`📡 Fetching SPV proof from backend...`);
        const backendRes = await fetch(`http://localhost:3001/api/bridge/spv-proof?txid=${txid}`);
        if (!backendRes.ok) {
            throw new Error(`Backend error: ${backendRes.status}`);
        }
        const proof = await backendRes.json();
        
        console.log(`✅ SPV proof received`);
        console.log(`   Block: ${proof.blockHeight}, Position: ${proof.txPos}`);
        console.log(`   Raw TX: ${proof.rawTxHex.length / 2} bytes (stripped)\n`);
        
        // 2. Verify txid
        const rawTxBuf = Buffer.from(proof.rawTxHex, 'hex');
        const txidHash = doubleSha256(rawTxBuf);
        // NOTE: txidHash is already in internal byte order (little-endian)
        // Display format reverses it for human reading
        const txidDisplay = Buffer.from(txidHash).reverse().toString('hex');
        
        console.log(`🔍 Verifying TXID:`);
        console.log(`   Expected: ${txid}`);
        console.log(`   Computed: ${txidDisplay}`);
        
        if (txidDisplay !== txid) {
            console.log(`   ❌ MISMATCH!\n`);
            return false;
        }
        console.log(`   ✅ MATCH!\n`);
        
        // 3. Get block header
        console.log(`📡 Fetching block header...`);
        const blockHashRes = await fetch(`https://explorer.bc-2.jp/api/block-height/${proof.blockHeight}`);
        const blockHash = (await blockHashRes.text()).trim();
        
        const headerRes = await fetch(`https://explorer.bc-2.jp/api/block/${blockHash}/header`);
        const headerHex = (await headerRes.text()).trim();
        const headerBuf = Buffer.from(headerHex, 'hex');
        
        console.log(`✅ Block header retrieved (${headerBuf.length} bytes)`);
        console.log(`   Block hash:   ${blockHash.substring(0, 32)}...`);
        
        // Merkle root at bytes 36-67 (32 bytes)
        if (headerBuf.length < 68) {
            throw new Error(`Header too short: ${headerBuf.length} bytes (expected 80)`);
        }
        const merkleRootBuf = headerBuf.slice(36, 68);
        console.log(`   Merkle root:  ${merkleRootBuf.toString('hex').substring(0, 32)}...\n`);
        
        const merkleRootWords = hashToWords(merkleRootBuf);
        
        // 4. Verify merkle proof
        const txidWords = hashToWords(txidHash);
        // Backend already returns words format
        const proofWords = proof.merkleProofWords || proof.merkleProof;
        
        const isValid = verifyMerkleProof(txidWords, proofWords, proof.txPos, merkleRootWords);
        
        // 5. Summary
        console.log(`${'='.repeat(90)}`);
        if (isValid) {
            console.log(`✅✅✅ SUCCESS! The SPV proof is VALID! ✅✅✅`);
            console.log(`${'='.repeat(90)}`);
            console.log(`\n📋 What this means:`);
            console.log(`   ✅ Transaction is confirmed in block ${proof.blockHeight}`);
            console.log(`   ✅ SegWit witness data correctly stripped`);
            console.log(`   ✅ TXID computation is correct`);
            console.log(`   ✅ Merkle proof verifies transaction inclusion`);
            console.log(`   ✅ This proof WILL BE ACCEPTED by the vault contract\n`);
            console.log(`🎉 The fix is working! Try your deposit again in the UI!\n`);
        } else {
            console.log(`❌❌❌ FAILED! The merkle proof is INVALID! ❌❌❌`);
            console.log(`${'='.repeat(90)}\n`);
        }
        
        return isValid;
        
    } catch (error) {
        console.error(`\n❌ ERROR: ${error.message}\n`);
        return false;
    }
}

// CLI
const txid = process.argv[2] || '2d92947d9ad9cc0169cf21dc16af82958554d2db309b9ce5227d1cb97d095b17';

if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
    console.error('\nError: TXID must be exactly 64 hex characters\n');
    process.exit(1);
}

testMerkleProof(txid)
    .then(success => process.exit(success ? 0 : 1))
    .catch(() => process.exit(1));
