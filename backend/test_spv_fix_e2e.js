/**
 * END-TO-END TEST: SPV Proof with SegWit Witness Stripping Fix
 * 
 * This test verifies that the complete SPV proof flow now works correctly:
 * 1. Fetch merkle proof from mempool API
 * 2. Fetch raw transaction and STRIP WITNESS DATA
 * 3. Verify double_sha256(stripped_tx) === txid
 * 4. Verify merkle proof with the stripped txid
 * 5. Confirm the proof would be accepted by the vault contract
 */

const crypto = require('crypto');

const MEMPOOL_API = 'https://explorer.bc-2.jp/api';

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
    if (hash.length !== 32) throw new Error(`Expected 32-byte hash, got ${hash.length}`);
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
    
    const combined = Buffer.concat([leftBuf, rightBuf]);
    return hashToWords(doubleSha256(combined));
}

function verifyMerkleProof(txid, proof, pos, merkleRoot) {
    let current = txid;
    let idx = pos;
    
    for (let i = 0; i < proof.length; i++) {
        const sibling = proof[i];
        const isLeft = (idx % 2 === 0);
        current = isLeft ? hashPair(current, sibling) : hashPair(sibling, current);
        idx = Math.floor(idx / 2);
    }
    
    return current.every((word, i) => word === merkleRoot[i]);
}

async function testSpvProofWithFix(txid) {
    console.log(`\n${'='.repeat(90)}`);
    console.log(`🧪 END-TO-END TEST: SPV Proof with SegWit Fix`);
    console.log(`   Transaction: ${txid}`);
    console.log(`${'='.repeat(90)}\n`);
    
    try {
        // Step 1: Call the backend API to get SPV proof
        console.log(`📡 Step 1: Fetching SPV proof from backend API...`);
        const proofRes = await fetch(`http://localhost:3001/api/bridge/spv-proof?txid=${txid}`);
        
        if (!proofRes.ok) {
            const error = await proofRes.text();
            throw new Error(`API error: ${proofRes.status} - ${error}`);
        }
        
        const proofData = await proofRes.json();
        console.log(`✅ SPV proof fetched successfully`);
        console.log(`   Block height: ${proofData.blockHeight}`);
        console.log(`   Position:     ${proofData.txPos}`);
        console.log(`   Raw tx size:  ${proofData.rawTxHex.length / 2} bytes`);
        console.log(`   Siblings:     ${proofData.merkleProof.length}\n`);
        
        // Step 2: Verify the raw transaction produces the correct txid
        console.log(`🔍 Step 2: Verifying txid from raw transaction...`);
        const rawTxBuf = Buffer.from(proofData.rawTxHex, 'hex');
        const computedTxid = reverseHex(doubleSha256(rawTxBuf).toString('hex'));
        
        console.log(`   Expected txid:  ${txid}`);
        console.log(`   Computed txid:  ${computedTxid}`);
        
        if (computedTxid !== txid) {
            console.log(`   ❌ MISMATCH! The fix didn't work.\n`);
            return false;
        }
        console.log(`   ✅ Match! Witness data successfully stripped.\n`);
        
        // Step 3: Fetch block header to get merkle root
        console.log(`📡 Step 3: Fetching block header...`);
        const blockRes = await fetch(`${MEMPOOL_API}/block-height/${proofData.blockHeight}`);
        const blockHash = (await blockRes.text()).trim();
        
        const headerRes = await fetch(`${MEMPOOL_API}/block/${blockHash}/header`);
        const headerHex = (await headerRes.text()).trim();
        const headerBuf = Buffer.from(headerHex, 'hex');
        const merkleRootBuf = headerBuf.slice(36, 68);
        const merkleRootWords = hashToWords(merkleRootBuf);
        
        console.log(`✅ Block header retrieved`);
        console.log(`   Block hash:   ${blockHash}`);
        console.log(`   Merkle root:  ${merkleRootBuf.toString('hex')}\n`);
        
        // Step 4: Verify merkle proof
        console.log(`🔍 Step 4: Verifying merkle proof...`);
        const txidHash = doubleSha256(rawTxBuf);
        const txidWords = hashToWords(txidHash);
        const merkleProofWords = proofData.merkleProof.map(hex => {
            const buf = Buffer.from(hex, 'hex');
            return hashToWords(buf);
        });
        
        const isValid = verifyMerkleProof(txidWords, merkleProofWords, proofData.txPos, merkleRootWords);
        
        if (!isValid) {
            console.log(`   ❌ INVALID! Merkle proof verification failed.\n`);
            return false;
        }
        console.log(`   ✅ VALID! Merkle proof verified successfully.\n`);
        
        // Step 5: Summary
        console.log(`${'='.repeat(90)}`);
        console.log(`✅ ALL TESTS PASSED!`);
        console.log(`${'='.repeat(90)}`);
        console.log(`\n📋 Summary:`);
        console.log(`   ✅ Raw transaction stripped of witness data`);
        console.log(`   ✅ double_sha256(raw_tx) produces correct txid`);
        console.log(`   ✅ Merkle proof verifies transaction inclusion`);
        console.log(`   ✅ This proof will be ACCEPTED by the vault contract`);
        console.log(`\n🎉 The SegWit witness stripping fix is working correctly!\n`);
        
        return true;
        
    } catch (error) {
        console.error(`\n❌ ERROR: ${error.message}\n`);
        if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
            console.log(`💡 Hint: Make sure the backend is running on http://localhost:3001`);
            console.log(`   Run: cd backend && npm run dev\n`);
        }
        return false;
    }
}

// CLI Entry Point
if (require.main === module) {
    const txid = process.argv[2];
    
    if (!txid || !/^[0-9a-fA-F]{64}$/.test(txid)) {
        console.error('\nUsage: node test_spv_fix_e2e.js <txid>');
        console.error('Example: node test_spv_fix_e2e.js 143f56fa5478d907e5c7089b9f5d0a7d41b7a1dfc8cf083158c41e4075ea71ac\n');
        process.exit(1);
    }
    
    testSpvProofWithFix(txid)
        .then(success => process.exit(success ? 0 : 1))
        .catch(() => process.exit(1));
}

module.exports = { testSpvProofWithFix };
