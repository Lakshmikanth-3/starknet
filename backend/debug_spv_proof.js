/**
 * DEBUG SCRIPT: SPV Merkle Proof Verification
 * 
 * This script helps debug "Invalid Bitcoin Merkle proof" errors by:
 * 1. Fetching the real merkle proof from mempool API
 * 2. Computing double_sha256 of the raw transaction
 * 3. Manually verifying the merkle proof
 * 4. Checking byte ordering and data formats
 * 
 * Usage: node debug_spv_proof.js <txid>
 */

const crypto = require('crypto');

const MEMPOOL_API = 'https://explorer.bc-2.jp/api';

// ────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ────────────────────────────────────────────────────────────────────────────

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
}

function doubleSha256(buffer) {
    return sha256(sha256(buffer));
}

/** Convert a 32-byte hash Buffer to 8 × u32 big-endian words */
function hashToWords(hash) {
    if (hash.length !== 32) throw new Error(`Expected 32-byte hash, got ${hash.length}`);
    const words = [];
    for (let i = 0; i < 32; i += 4) {
        words.push(hash.readUInt32BE(i));
    }
    return words;
}

/** Convert 8 × u32 words back to hex string (for display) */
function wordsToHex(words) {
    const buf = Buffer.alloc(32);
    for (let i = 0; i < 8; i++) {
        buf.writeUInt32BE(words[i], i * 4);
    }
    return buf.toString('hex');
}

/** Reverse a hex string (for Bitcoin display format) */
function reverseHex(hex) {
    return Buffer.from(hex, 'hex').reverse().toString('hex');
}

/** Hash two merkle nodes together: double_sha256(left || right) */
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

/** Verify merkle proof */
function verifyMerkleProof(txid, proof, pos, merkleRoot) {
    let current = txid;
    let idx = pos;
    
    console.log(`\n🔍 Starting Merkle Proof Verification:`);
    console.log(`   Initial txid:  ${wordsToHex(current)}`);
    console.log(`   Position:      ${pos}`);
    console.log(`   Proof length:  ${proof.length} siblings`);
    console.log(`   Target root:   ${wordsToHex(merkleRoot)}\n`);
    
    for (let i = 0; i < proof.length; i++) {
        const sibling = proof[i];
        const isLeft = (idx % 2 === 0);
        
        console.log(`   Step ${i + 1}:`);
        console.log(`     Current: ${wordsToHex(current)}`);
        console.log(`     Sibling: ${wordsToHex(sibling)}`);
        console.log(`     Order:   ${isLeft ? 'current LEFT, sibling RIGHT' : 'sibling LEFT, current RIGHT'}`);
        
        current = isLeft ? hashPair(current, sibling) : hashPair(sibling, current);
        idx = Math.floor(idx / 2);
        
        console.log(`     Result:  ${wordsToHex(current)}\n`);
    }
    
    console.log(`\n📊 Final Comparison:`);
    console.log(`   Computed root: ${wordsToHex(current)}`);
    console.log(`   Expected root: ${wordsToHex(merkleRoot)}`);
    
    const matches = current.every((word, i) => word === merkleRoot[i]);
    console.log(`   Match: ${matches ? '✅ YES' : '❌ NO'}\n`);
    
    return matches;
}

// ────────────────────────────────────────────────────────────────────────────
// Main Debug Function
// ────────────────────────────────────────────────────────────────────────────

async function debugSpvProof(txid) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔬 SPV PROOF DEBUG FOR TRANSACTION: ${txid}`);
    console.log(`${'='.repeat(80)}\n`);
    
    try {
        // 1. Fetch merkle proof from mempool API
        console.log(`📡 Fetching merkle proof from ${MEMPOOL_API}...`);
        const merkleRes = await fetch(`${MEMPOOL_API}/tx/${txid}/merkle-proof`);
        if (!merkleRes.ok) {
            throw new Error(`HTTP ${merkleRes.status}: ${await merkleRes.text()}`);
        }
        const merkleData = await merkleRes.json();
        
        console.log(`✅ Merkle proof received:`);
        console.log(`   Block height: ${merkleData.block_height}`);
        console.log(`   Position:     ${merkleData.pos}`);
        console.log(`   Siblings:     ${merkleData.merkle.length}\n`);
        
        // 2. Fetch raw transaction
        console.log(`📡 Fetching raw transaction...`);
        const rawTxRes = await fetch(`${MEMPOOL_API}/tx/${txid}/hex`);
        if (!rawTxRes.ok) {
            throw new Error(`HTTP ${rawTxRes.status}`);
        }
        const rawTxHex = (await rawTxRes.text()).trim();
        console.log(`✅ Raw transaction: ${rawTxHex.length / 2} bytes`);
        console.log(`   First 40 chars: ${rawTxHex.substring(0, 40)}...\n`);
        
        // 3. Compute txid from raw transaction
        console.log(`🧮 Computing txid from raw transaction...`);
        const rawTxBuf = Buffer.from(rawTxHex, 'hex');
        const txidHash = doubleSha256(rawTxBuf);
        const txidWords = hashToWords(txidHash);
        
        console.log(`   Computed hash (internal/big-endian):  ${txidHash.toString('hex')}`);
        console.log(`   Computed hash (display/little-endian): ${reverseHex(txidHash.toString('hex'))}`);
        console.log(`   Provided txid (should match display):  ${txid}`);
        
        const computedDisplayTxid = reverseHex(txidHash.toString('hex'));
        if (computedDisplayTxid !== txid) {
            console.log(`   ❌ MISMATCH! Computed txid doesn't match provided txid!`);
            console.log(`      This could mean the raw transaction is incorrect.\n`);
        } else {
            console.log(`   ✅ Match! Computed txid matches provided txid.\n`);
        }
        
        // 4. Convert merkle siblings to word arrays
        console.log(`🔄 Converting merkle siblings to u32 word arrays...`);
        const merkleProofWords = merkleData.merkle.map((hex, i) => {
            const buf = Buffer.from(hex, 'hex');
            const words = hashToWords(buf);
            console.log(`   Sibling ${i}: ${hex}`);
            console.log(`              -> ${words.join(', ')}`);
            return words;
        });
        console.log('');
        
        // 5. Fetch block header to get merkle root
        console.log(`📡 Fetching block header for height ${merkleData.block_height}...`);
        const blockRes = await fetch(`${MEMPOOL_API}/block-height/${merkleData.block_height}`);
        if (!blockRes.ok) {
            throw new Error(`HTTP ${blockRes.status}`);
        }
        const blockHash = (await blockRes.text()).trim();
        
        const headerRes = await fetch(`${MEMPOOL_API}/block/${blockHash}/header`);
        if (!headerRes.ok) {
            throw new Error(`HTTP ${headerRes.status}`);
        }
        const headerHex = (await headerRes.text()).trim();
        
        // Parse merkle root from header (bytes 36-67)
        const headerBuf = Buffer.from(headerHex, 'hex');
        const merkleRootBuf = headerBuf.slice(36, 68);
        const merkleRootWords = hashToWords(merkleRootBuf);
        
        console.log(`✅ Block header retrieved:`);
        console.log(`   Block hash:   ${blockHash}`);
        console.log(`   Header:       ${headerHex}`);
        console.log(`   Merkle root:  ${merkleRootBuf.toString('hex')}`);
        console.log(`   Root (words): [${merkleRootWords.join(', ')}]\n`);
        
        // 6. Verify the merkle proof
        const isValid = verifyMerkleProof(txidWords, merkleProofWords, merkleData.pos, merkleRootWords);
        
        console.log(`\n${'='.repeat(80)}`);
        if (isValid) {
            console.log(`✅ MERKLE PROOF IS VALID! Transaction is in the block.`);
        } else {
            console.log(`❌ MERKLE PROOF IS INVALID! This would be rejected by the contract.`);
            console.log(`\n🔍 Possible Issues:`);
            console.log(`   1. Byte ordering mismatch (endianness)`);
            console.log(`   2. Merkle siblings in wrong format`);
            console.log(`   3. Position (pos) incorrect`);
            console.log(`   4. Merkle root doesn't match block header`);
            console.log(`   5. Raw transaction doesn't match txid`);
        }
        console.log(`${'='.repeat(80)}\n`);
        
        // 7. Return structured data for further debugging
        return {
            txid,
            blockHeight: merkleData.block_height,
            pos: merkleData.pos,
            rawTxHex,
            computedTxid: computedDisplayTxid,
            merkleProofWords,
            merkleRootWords,
            isValid,
        };
        
    } catch (error) {
        console.error(`\n❌ ERROR: ${error.message}\n`);
        throw error;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// CLI Entry Point
// ────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
    const txid = process.argv[2];
    
    if (!txid || !/^[0-9a-fA-F]{64}$/.test(txid)) {
        console.error('Usage: node debug_spv_proof.js <txid>');
        console.error('Example: node debug_spv_proof.js d366cebd03617dabe01469019898b081e0fe5db08afbffa0631a2b98386e3bd');
        process.exit(1);
    }
    
    debugSpvProof(txid)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { debugSpvProof, verifyMerkleProof, hashToWords, wordsToHex };
