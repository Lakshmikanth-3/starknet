/**
 * BitcoinProofService
 *
 * Given a confirmed Bitcoin Signet txid, fetches everything needed to prove
 * the transaction on Starknet via the vault's SPV-gated deposit():
 *
 *   - Raw transaction hex (for double_sha256 + output parsing in Cairo)
 *   - Electrum-format Merkle proof (sibling hashes + tx position in block)
 *   - Block height (to look up the stored Merkle root in HeaderStore)
 *
 * All sibling hashes are converted from hex → 8×u32 big-endian arrays so
 * they can be passed directly as Cairo calldata.
 */

const MEMPOOL_API = process.env.MEMPOOL_API_URL || 'https://explorer.bc-2.jp/api';

// ─── Types ──────────────────────────────────────────────────────────────────

/** One 32-byte hash as 8 × u32 big-endian. */
export type Hash256Words = [number, number, number, number, number, number, number, number];

export interface SpvProof {
    /** Bitcoin block height containing the tx. */
    blockHeight: number;
    /** Position (index) of the tx in the block. */
    txPos: number;
    /** Raw transaction bytes as a hex string. */
    rawTxHex: string;
    /** Sibling hashes for the Merkle proof, each as 8×u32 big-endian. */
    merkleProof: Hash256Words[];
    /** Which output in the tx pays the vault (detected automatically). */
    voutIndex: number;
    /** Amount in satoshis at voutIndex. */
    amountSats: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
        await res.text().catch(() => { });
        throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    return res.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
        await res.text().catch(() => { });
        throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    return res.text();
}

/** 
 * Convert a 32-byte hex hash into 8 × u32 big-endian words.
 * ✅ CRITICAL FIX: Bitcoin APIs return hashes in display format (byte-reversed).
 * For merkle tree computation, we need internal format, so we reverse the bytes.
 */
export function hexHashToWords(hex: string): Hash256Words {
    const buf = Buffer.from(hex, 'hex');
    if (buf.length !== 32) throw new Error(`Expected 32-byte hash, got ${buf.length}`);
    // ✅ Reverse bytes: display format → internal format
    buf.reverse();
    const words: number[] = [];
    for (let i = 0; i < 32; i += 4) {
        words.push(buf.readUInt32BE(i));
    }
    return words as Hash256Words;
}

/** Parse a raw Bitcoin transaction hex to extract the amount and voutIndex that pays a given address.
 *  Returns { voutIndex, amountSats }.
 *  Uses simple script matching: P2WPKH scriptPubKey = 0x0014<20-byte-hash>.
 */
function findVaultOutput(rawTxHex: string, vaultScriptPubKeyHex: string): { voutIndex: number; amountSats: number } {
    const buf = Buffer.from(rawTxHex, 'hex');
    let cursor = 4; // skip version

    // SegWit detection
    const isSegWit = buf[4] === 0x00 && buf[5] === 0x01;
    if (isSegWit) cursor += 2;

    // Skip inputs
    const { value: inputCount, size: inSz } = readVarInt(buf, cursor);
    cursor += inSz;
    for (let i = 0; i < inputCount; i++) {
        cursor += 36; // txid + vout
        const { value: scriptLen, size: sl } = readVarInt(buf, cursor);
        cursor += sl + scriptLen + 4; // script + sequence
    }

    // Parse outputs
    const { value: outputCount, size: outSz } = readVarInt(buf, cursor);
    cursor += outSz;

    for (let vout = 0; vout < outputCount; vout++) {
        const amountSats = Number(buf.readBigUInt64LE(cursor));
        cursor += 8;
        const { value: scriptLen, size: sl } = readVarInt(buf, cursor);
        cursor += sl;
        const scriptHex = buf.slice(cursor, cursor + scriptLen).toString('hex');
        cursor += scriptLen;

        if (scriptHex === vaultScriptPubKeyHex) {
            return { voutIndex: vout, amountSats };
        }
    }
    throw new Error('No output in tx pays the vault address. Did the user send to the right address?');
}

function readVarInt(buf: Buffer, offset: number): { value: number; size: number } {
    const first = buf[offset];
    if (first < 0xfd) return { value: first, size: 1 };
    if (first === 0xfd) return { value: buf.readUInt16LE(offset + 1), size: 3 };
    if (first === 0xfe) return { value: buf.readUInt32LE(offset + 1), size: 5 };
    // 0xff — rare, treat as u32 (block tx count won't exceed 2^32)
    return { value: Number(buf.readBigUInt64LE(offset + 1)), size: 9 };
}

/**
 * Strip SegWit witness data from a raw Bitcoin transaction.
 * 
 * CRITICAL: Bitcoin txids are computed from the "stripped" transaction format
 * (without witness data). When verifying merkle proofs, the vault contract
 * computes double_sha256(raw_tx) which must equal the txid in the proof.
 * 
 * SegWit transactions have this format:
 *   With witness:    [version][marker=0x00][flag=0x01][inputs][outputs][witness][locktime]
 *   Without witness: [version][inputs][outputs][locktime]
 * 
 * This function removes marker, flag, and witness data to produce the
 * canonical format used for txid calculation.
 * 
 * @param rawTxHex - Raw transaction hex (may include witness data)
 * @returns Stripped transaction hex (without witness data)
 */
function stripWitnessData(rawTxHex: string): string {
    const buf = Buffer.from(rawTxHex, 'hex');
    let cursor = 0;
    
    // Read version (4 bytes)
    const version = buf.slice(cursor, cursor + 4);
    cursor += 4;
    
    // Check for SegWit marker and flag
    const isSegWit = buf[cursor] === 0x00 && buf[cursor + 1] === 0x01;
    
    if (!isSegWit) {
        // Not a SegWit transaction, return as-is
        return rawTxHex;
    }
    
    console.log(`[BitcoinProofService] SegWit transaction detected, stripping witness data...`);
    
    // Skip marker and flag
    cursor += 2;
    
    // Read input count
    const { value: inputCount, size: inCountSize } = readVarInt(buf, cursor);
    const inputCountBytes = buf.slice(cursor, cursor + inCountSize);
    cursor += inCountSize;
    
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
    
    console.log(`[BitcoinProofService] Stripped ${buf.length - stripped.length} bytes of witness data (${buf.length} → ${stripped.length} bytes)`);
    
    return stripped.toString('hex');
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Build a complete SPV proof for a given txid.
 *
 * @param txid               - Bitcoin txid (64-char hex, as displayed — reversed byte order)
 * @param vaultScriptPubKey  - Expected P2WPKH scriptPubKey hex for the vault address
 *                             e.g. "0014473a7ca841d83c513373c8396c52d42f6ed1d48b"
 *                             Compute: "0014" + Buffer.from(bech32.decode(addr).data).toString('hex')
 */
export async function buildSpvProof(txid: string, vaultScriptPubKey: string): Promise<SpvProof> {
    console.log(`[BitcoinProofService] Building SPV proof for txid: ${txid}`);

    // 1. Get Merkle proof in Electrum format
    //    Response: { block_height: number, pos: number, merkle: string[] }
    //    Each entry in merkle[] is a 64-char hex hash (internal byte order).
    const merkleData = await fetchJson<{
        block_height: number;
        pos: number;
        merkle: string[];
    }>(`${MEMPOOL_API}/tx/${txid}/merkle-proof`);

    console.log(`[BitcoinProofService] Block height: ${merkleData.block_height}, pos: ${merkleData.pos}`);

    // 2. Get raw transaction hex
    const rawTxHex = (await fetchText(`${MEMPOOL_API}/tx/${txid}/hex`)).trim();
    console.log(`[BitcoinProofService] Raw tx length: ${rawTxHex.length / 2} bytes`);

    // 2b. ✅ CRITICAL FIX: Strip witness data for SegWit transactions
    //     Bitcoin txids are computed from the stripped format (without witness).
    //     The vault contract computes double_sha256(raw_tx) which must match the txid.
    const strippedRawTxHex = stripWitnessData(rawTxHex);

    // 3. Find which output pays the vault
    // NOTE: We use the original rawTxHex (with witness) for output parsing since
    // the output format is the same, and findVaultOutput can handle both formats.
    const { voutIndex, amountSats } = findVaultOutput(rawTxHex, vaultScriptPubKey);
    console.log(`[BitcoinProofService] Vault output: vout=${voutIndex}, amount=${amountSats} sats`);

    // 4. Convert merkle siblings from hex to 8×u32 words
    //    The Electrum API returns hashes in internal byte order (same as txid display but reversed).
    //    Our Cairo contract uses the same convention as compute_sha256_u32_array output:
    //    big-endian words. Since these are bare 32-byte hashes without any display reversal,
    //    we read them directly as big-endian.
    const merkleProof: Hash256Words[] = merkleData.merkle.map(hexHashToWords);

    return {
        blockHeight: merkleData.block_height,
        txPos: merkleData.pos,
        rawTxHex: strippedRawTxHex, // ✅ Return stripped tx (without witness) for SPV verification
        merkleProof,
        voutIndex,
        amountSats,
    };
}

/**
 * Encode an SpvProof as Starknet calldata arrays for vault.deposit().
 *
 * Returns:
 *   rawTxCalldata   — Array of felt252 strings encoding raw_tx as Span<u8>
 *   proofCalldata   — Array of felt252 strings encoding merkle_proof as Span<[u32;8]>
 */
export function encodeSpvProofAsCalldata(proof: SpvProof): {
    rawTxBytes: number[];
    merkleProofWords: number[][];
} {
    const rawTxBytes = Array.from(Buffer.from(proof.rawTxHex, 'hex'));
    const merkleProofWords = proof.merkleProof.map(words => Array.from(words));
    return { rawTxBytes, merkleProofWords };
}

export const BitcoinProofService = {
    buildSpvProof,
    encodeSpvProofAsCalldata,
    hexHashToWords,
};
