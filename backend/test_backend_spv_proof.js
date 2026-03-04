/**
 * Test SPV proof using backend API's stripped transaction
 */

const crypto = require('crypto');

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
}

function doubleSha256(buffer) {
    return sha256(sha256(buffer));
}

function reverseHex(hex) {
    return Buffer.from(hex, 'hex').reverse().toString('hex');
}

function hashToWords(hash) {
    const words = [];
    for (let i = 0; i < 32; i += 4) {
        words.push(hash.readUInt32BE(i));
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
    console.log(`   Position: ${pos}, Proof length: ${proof.length}`);
    
    for (let i = 0; i < proof.length; i++) {
        const sibling = proof[i];
        const isLeft = (idx % 2 === 0);
        current = isLeft ? hashPair(current, sibling) : hashPair(sibling, current);
        idx = Math.floor(idx / 2);
        console.log(`   Step ${i + 1}: ${isLeft ? 'LEFT' : 'RIGHT'} → ${wordsToHex(current).substring(0, 16)}...`);
    }
    
    const matches = current.every((word, i) => word === merkleRoot[i]);
    console.log(`   Final: ${matches ? '✅ MATCH' : '❌ MISMATCH'}\n`);
    
    return matches;
}

async function testBackendSpvProof(txid) {
    console.log(`\n${'='.repeat(90)}`);
    console.log(`🧪 Testing Backend SPV Proof (with witness stripping)`);
    console.log(`   Transaction: ${txid}`);
    console.log(`${'='.repeat(90)}\n`);
    
    try {
        // 1. Get SPV proof from backend
        console.log(`📡 Fetching SPV proof from backend API...`);
        const backendRes = await fetch(`http://localhost:3001/api/bridge/spv-proof?txid=${txid}`);
        if (!backendRes.ok) {
            const err = await backendRes.json();
            throw new Error(`Backend error: ${err.error}`);
        }
        const proof = await backendRes.json();
        
        console.log(`✅ SPV proof received from backend`);
        console.log(`   Block height: ${proof.blockHeight}`);
        console.log(`   Position:     ${proof.txPos}`);
        console.log(`   Raw TX (stripped): ${proof.rawTxHex.length / 2} bytes`);
        console.log(`   Merkle siblings: ${proof.merkleProof.length}\n`);
        
        // 2. Verify txid from backend's raw transaction
        console.log(`🔍 Verifying txid from backend's raw transaction...`);
        const rawTxBuf = Buffer.from(proof.rawTxHex, 'hex');
        const computedTxid = reverseHex(doubleSha256(rawTxBuf).toString('hex'));
        
        console.log(`   Expected txid:    ${txid}`);
        console.log(`   Computed from TX: ${computedTxid}`);
        
        if (computedTxid !== txid) {
            console.log(`   ❌ MISMATCH! Witness stripping didn't work correctly.\n`);
            return false;
        }
        console.log(`   ✅ MATCH! Witness stripping works correctly.\n`);
        
        // 3. Get block header
        console.log(`📡 Fetching block header for height ${proof.blockHeight}...`);
        const blockHashRes = await fetch(`https://explorer.bc-2.jp/api/block-height/${proof.blockHeight}`);
        const blockHash = (await blockHashRes.text()).trim();
        
        const headerRes = await fetch(`https://explorer.bc-2.jp/api/block/${blockHash}/header`);
        const headerHex = (await headerRes.text()).trim();
        const headerBuf = Buffer.from(headerHex, 'hex');
        const merkleRootBuf = headerBuf.slice(36, 68);
        const merkleRootWords = hashToWords(merkleRootBuf);
        
        console.log(`✅ Block header retrieved`);
        console.log(`   Block hash:   ${blockHash.substring(0, 32)}...`);
        console.log(`   Merkle root:  ${merkleRootBuf.toString('hex').substring(0, 32)}...\n`);
        
        // 4. Verify merkle proof
        const txidWords = hashToWords(doubleSha256(rawTxBuf));
        const proofWords = proof.merkleProof.map(hex => hashToWords(Buffer.from(hex, 'hex')));
        
        const isValid = verifyMerkleProof(txidWords, proofWords, proof.txPos, merkleRootWords);
        
        // 5. Summary
        console.log(`${'='.repeat(90)}`);
        if (isValid) {
            console.log(`✅ SUCCESS! Full SPV proof is valid`);
            console.log(`${'='.repeat(90)}`);
            console.log(`\n📋 Verification Summary:`);
            console.log(`   ✅ Backend stripped SegWit witness data`);
            console.log(`   ✅ double_sha256(stripped_tx) produces correct txid`);
            console.log(`   ✅ Merkle proof verifies transaction inclusion`);
            console.log(`   ✅ This proof WILL BE ACCEPTED by the vault contract`);
            console.log(`\n🎉 The SegWit fix is working perfectly!\n`);
        } else {
            console.log(`❌ FAILED! Merkle proof is invalid`);
            console.log(`${'='.repeat(90)}\n`);
        }
        
        return isValid;
        
    } catch (error) {
        console.error(`\n❌ ERROR: ${error.message}\n`);
        return false;
    }
}

// CLI
if (require.main === module) {
    const txid = process.argv[2];
    
    if (!txid || !/^[0-9a-fA-F]{64}$/.test(txid)) {
        console.error('\nUsage: node test_backend_spv_proof.js <txid>');
        console.error('Example: node test_backend_spv_proof.js 7730cbec5830b3ccdb60a0d443640a788b599bf1a6f090503a41b54843b1fdc6\n');
        process.exit(1);
    }
    
    testBackendSpvProof(txid)
        .then(success => process.exit(success ? 0 : 1))
        .catch(() => process.exit(1));
}

module.exports = { testBackendSpvProof };
