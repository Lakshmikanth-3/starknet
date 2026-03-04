/**
 * Strip SegWit witness data from a raw Bitcoin transaction
 * 
 * SegWit transactions have this format:
 * [version][marker=0x00][flag=0x01][inputs][outputs][witness][locktime]
 * 
 * For txid calculation, we need the stripped format:
 * [version][inputs][outputs][locktime]
 * 
 * This function removes the marker, flag, and witness data.
 */

function readVarInt(buf, offset) {
    const first = buf[offset];
    if (first < 0xfd) return { value: first, size: 1 };
    if (first === 0xfd) return { value: buf.readUInt16LE(offset + 1), size: 3 };
    if (first === 0xfe) return { value: buf.readUInt32LE(offset + 1), size: 5 };
    return { value: Number(buf.readBigUInt64LE(offset + 1)), size: 9 };
}

function writeVarInt(value) {
    if (value < 0xfd) {
        const buf = Buffer.alloc(1);
        buf.writeUInt8(value, 0);
        return buf;
    }
    if (value <= 0xffff) {
        const buf = Buffer.alloc(3);
        buf.writeUInt8(0xfd, 0);
        buf.writeUInt16LE(value, 1);
        return buf;
    }
    if (value <= 0xffffffff) {
        const buf = Buffer.alloc(5);
        buf.writeUInt8(0xfe, 0);
        buf.writeUInt32LE(value, 1);
        return buf;
    }
    const buf = Buffer.alloc(9);
    buf.writeUInt8(0xff, 0);
    buf.writeBigUInt64LE(BigInt(value), 1);
    return buf;
}

/**
 * Strip witness data from a SegWit transaction
 * Returns the stripped transaction (for txid calculation)
 */
function stripWitnessData(rawTxHex) {
    const buf = Buffer.from(rawTxHex, 'hex');
    let cursor = 0;
    
    // Read version (4 bytes)
    const version = buf.slice(cursor, cursor + 4);
    cursor += 4;
    
    // Check for SegWit marker and flag
    const isSegWit = buf[cursor] === 0x00 && buf[cursor + 1] === 0x01;
    
    if (!isSegWit) {
        // Not a SegWit transaction, return as-is
        console.log('[stripWitness] Not a SegWit transaction, returning original');
        return rawTxHex;
    }
    
    console.log('[stripWitness] SegWit transaction detected, stripping witness data...');
    
    // Skip marker and flag
    cursor += 2;
    
    // Read input count
    const { value: inputCount, size: inCountSize } = readVarInt(buf, cursor);
    const inputCountBytes = buf.slice(cursor, cursor + inCountSize);
    cursor += inCountSize;
    
    console.log(`[stripWitness] Input count: ${inputCount}`);
    
    // Parse inputs (without witness)
    const inputsStart = cursor;
    for (let i = 0; i < inputCount; i++) {
        cursor += 36; // txid (32) + vout (4)
        const { value: scriptLen, size: sl } = readVarInt(buf, cursor);
        cursor += sl + scriptLen + 4; // scriptSig + sequence
    }
    const inputs = buf.slice(inputsStart, cursor);
    
    // Parse outputs
    const outputsStart = cursor;
    const { value: outputCount, size: outCountSize } = readVarInt(buf, cursor);
    cursor += outCountSize;
    
    console.log(`[stripWitness] Output count: ${outputCount}`);
    
    for (let i = 0; i < outputCount; i++) {
        cursor += 8; // amount (8 bytes)
        const { value: scriptLen, size: sl } = readVarInt(buf, cursor);
        cursor += sl + scriptLen;
    }
    const outputs = buf.slice(outputsStart, cursor);
    
    // Skip witness data
    for (let i = 0; i < inputCount; i++) {
        const { value: witnessItemCount, size: wicSize } = readVarInt(buf, cursor);
        cursor += wicSize;
        for (let j = 0; j < witnessItemCount; j++) {
            const { value: itemLen, size: ilSize } = readVarInt(buf, cursor);
            cursor += ilSize + itemLen;
        }
    }
    
    // Read locktime (4 bytes)
    const locktime = buf.slice(cursor, cursor + 4);
    
    // Construct stripped transaction
    const stripped = Buffer.concat([
        version,
        inputCountBytes,
        inputs,
        outputs,
        locktime
    ]);
    
    console.log(`[stripWitness] Original length: ${buf.length} bytes`);
    console.log(`[stripWitness] Stripped length: ${stripped.length} bytes`);
    console.log(`[stripWitness] Removed ${buf.length - stripped.length} bytes of witness data`);
    
    return stripped.toString('hex');
}

// Test with the transaction we just tried
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

async function testStripping(txid) {
    const MEMPOOL_API = 'https://explorer.bc-2.jp/api';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Testing Witness Data Stripping for txid: ${txid}`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Fetch raw transaction
    const rawTxRes = await fetch(`${MEMPOOL_API}/tx/${txid}/hex`);
    const rawTxHex = (await rawTxRes.text()).trim();
    
    console.log(`Original raw tx (first 80 chars): ${rawTxHex.substring(0, 80)}...\n`);
    
    // Strip witness data
    const strippedTxHex = stripWitnessData(rawTxHex);
    console.log(`\nStripped raw tx (first 80 chars): ${strippedTxHex.substring(0, 80)}...\n`);
    
    // Compute txid from original (will be wrong)
    const originalBuf = Buffer.from(rawTxHex, 'hex');
    const originalTxid = reverseHex(doubleSha256(originalBuf).toString('hex'));
    
    // Compute txid from stripped (should be correct)
    const strippedBuf = Buffer.from(strippedTxHex, 'hex');
    const strippedTxid = reverseHex(doubleSha256(strippedBuf).toString('hex'));
    
    console.log(`\n📊 Results:`);
    console.log(`   Expected txid:         ${txid}`);
    console.log(`   From original tx:      ${originalTxid}`);
    console.log(`   From stripped tx:      ${strippedTxid}`);
    console.log(`   Original matches:      ${originalTxid === txid ? '❌ NO (wrong)' : '❌ NO'}`);
    console.log(`   Stripped matches:      ${strippedTxid === txid ? '✅ YES' : '❌ NO'}\n`);
    
    if (strippedTxid === txid) {
        console.log(`✅ SUCCESS! Stripping witness data produces correct txid!`);
        return true;
    } else {
        console.log(`❌ FAILED! Stripped tx still doesn't produce correct txid.`);
        return false;
    }
}

// Test with the transaction from earlier
if (require.main === module) {
    const testTxid = process.argv[2] || '143f56fa5478d907e5c7089b9f5d0a7d41b7a1dfc8cf083158c41e4075ea71ac';
    testStripping(testTxid)
        .then(success => process.exit(success ? 0 : 1))
        .catch(err => {
            console.error('Error:', err.message);
            process.exit(1);
        });
}

module.exports = { stripWitnessData };
