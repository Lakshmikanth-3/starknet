/// Bitcoin SPV verification library for Cairo 2.8
/// Provides:
///   - double_sha256: bytes -> [u32; 8]
///   - verify_merkle_proof: txid in block
///   - parse_vout_amount_and_script: extract output from raw tx
///   - script_matches_p2wpkh: check scriptPubKey == OP_0 OP_PUSH20 <pubkey_hash>

// ─── SHA-256 ─────────────────────────────────────────────────────────────────

/// Compute SHA-256 over a byte array.
/// Uses Cairo's corelib compute_sha256_u32_array syscall (available since Cairo 2.7).
/// Input: bytes as u8 array, output: 8 × u32 (big-endian words = standard SHA-256 digest).
pub fn sha256_bytes(data: Span<u8>) -> [u32; 8] {
    // Pack bytes into u32 array (big-endian, 4 bytes per word)
    let mut words: Array<u32> = ArrayTrait::new();
    let len = data.len();
    let full_words = len / 4;
    let mut i: usize = 0;
    loop {
        if i >= full_words {
            break;
        }
        let w: u32 = (*data[i * 4]).into() * 0x1000000_u32
            + (*data[i * 4 + 1]).into() * 0x10000_u32
            + (*data[i * 4 + 2]).into() * 0x100_u32
            + (*data[i * 4 + 3]).into();
        words.append(w);
        i += 1;
    };

    // Handle remaining bytes → last partial word
    let rem = len % 4;
    let last_word: u32 = if rem == 0 {
        0
    } else if rem == 1 {
        (*data[full_words * 4]).into() * 0x1000000_u32
    } else if rem == 2 {
        (*data[full_words * 4]).into() * 0x1000000_u32
            + (*data[full_words * 4 + 1]).into() * 0x10000_u32
    } else {
        (*data[full_words * 4]).into() * 0x1000000_u32
            + (*data[full_words * 4 + 1]).into() * 0x10000_u32
            + (*data[full_words * 4 + 2]).into() * 0x100_u32
    };

    core::sha256::compute_sha256_u32_array(words, last_word, rem.try_into().unwrap())
}

/// Bitcoin's double-SHA-256: SHA256(SHA256(data)).
/// Returns 8 × u32 big-endian words.
pub fn double_sha256(data: Span<u8>) -> [u32; 8] {
    let inner = sha256_bytes(data);
    // Convert [u32;8] to Span<u8> for second pass
    let mut inner_bytes: Array<u8> = ArrayTrait::new();
    let words = inner.span();
    let mut w: usize = 0;
    loop {
        if w >= 8 {
            break;
        }
        let word = *words[w];
        inner_bytes.append(((word / 0x1000000) & 0xff).try_into().unwrap());
        inner_bytes.append(((word / 0x10000) & 0xff).try_into().unwrap());
        inner_bytes.append(((word / 0x100) & 0xff).try_into().unwrap());
        inner_bytes.append((word & 0xff).try_into().unwrap());
        w += 1;
    };
    sha256_bytes(inner_bytes.span())
}

// ─── Merkle proof ─────────────────────────────────────────────────────────────

/// Verify a Bitcoin Merkle inclusion proof.
///
/// @param txid        - double_sha256(raw_tx) as 8×u32 big-endian
///                      NOTE: Bitcoin txids are displayed/stored little-endian;
///                      here we use the raw hash output (big-endian words) which
///                      equals the reversed bytes of the displayed txid.
/// @param proof       - sibling hashes from the Electrum merkle-proof format
///                      Each is 8×u32 big-endian.
/// @param pos         - position (index) of the tx in the block (from Electrum API)
/// @param merkle_root - the block's Merkle root from the stored header (8×u32 big-endian)
///
/// Returns true iff the tx is in the block at the given position.
pub fn verify_merkle_proof(
    txid: [u32; 8],
    proof: Span<[u32; 8]>,
    pos: u64,
    merkle_root: [u32; 8]
) -> bool {
    let mut current = txid;
    let mut idx = pos;
    let mut i: usize = 0;
    let proof_len = proof.len();

    loop {
        if i >= proof_len {
            break;
        }
        let sibling = *proof[i];
        // idx & 1 == 0 means current is left child
        let combined = if idx % 2 == 0 {
            hash_pair(current, sibling)
        } else {
            hash_pair(sibling, current)
        };
        current = combined;
        idx = idx / 2;
        i += 1;
    };

    // Compare with stored merkle root
    arrays_eq_8(current, merkle_root)
}

/// Hash two 32-byte nodes together: double_sha256(left_bytes || right_bytes).
/// Nodes are 8×u32 big-endian (raw SHA-256 output order).
fn hash_pair(left: [u32; 8], right: [u32; 8]) -> [u32; 8] {
    let mut combined: Array<u8> = ArrayTrait::new();
    append_hash_as_bytes(ref combined, left);
    append_hash_as_bytes(ref combined, right);
    double_sha256(combined.span())
}

/// Append 8×u32 (big-endian words) as 32 bytes to a byte array.
fn append_hash_as_bytes(ref arr: Array<u8>, hash: [u32; 8]) {
    let s = hash.span();
    let mut i: usize = 0;
    loop {
        if i >= 8 {
            break;
        }
        let w = *s[i];
        arr.append(((w / 0x1000000) & 0xff).try_into().unwrap());
        arr.append(((w / 0x10000) & 0xff).try_into().unwrap());
        arr.append(((w / 0x100) & 0xff).try_into().unwrap());
        arr.append((w & 0xff).try_into().unwrap());
        i += 1;
    };
}

/// Compare two [u32; 8] arrays for equality.
fn arrays_eq_8(a: [u32; 8], b: [u32; 8]) -> bool {
    let sa = a.span();
    let sb = b.span();
    *sa[0] == *sb[0]
        && *sa[1] == *sb[1]
        && *sa[2] == *sb[2]
        && *sa[3] == *sb[3]
        && *sa[4] == *sb[4]
        && *sa[5] == *sb[5]
        && *sa[6] == *sb[6]
        && *sa[7] == *sb[7]
}

// ─── Transaction parsing ──────────────────────────────────────────────────────

/// Parse a Bitcoin legacy or segwit transaction and extract the amount (in satoshis)
/// and scriptPubKey of output at `vout_index`.
///
/// Raw tx layout (legacy):
///   4B  version (LE)
///   varint  input count
///   inputs...
///     32B txid, 4B vout, varint script_len, script, 4B sequence
///   varint  output count
///   outputs...
///     8B amount (LE u64), varint script_len, script
///   4B  locktime
///
/// SegWit marker: if byte[4]==0x00 && byte[5]==0x01, skip marker+flag bytes.
///
/// Returns (amount_sats: u64, script: Span<u8>)
/// Panics if vout_index >= output count or malformed tx.
pub fn parse_output(raw_tx: Span<u8>, vout_index: u32) -> (u64, Span<u8>) {
    let mut cursor: usize = 4; // skip version

    // SegWit detection
    let is_segwit = *raw_tx[4] == 0x00 && *raw_tx[5] == 0x01;
    if is_segwit {
        cursor += 2; // skip marker + flag
    }

    // Skip inputs
    let (input_count, consumed) = read_varint(raw_tx, cursor);
    cursor += consumed;
    let mut vin: u64 = 0;
    loop {
        if vin >= input_count {
            break;
        }
        cursor += 32 + 4; // txid + vout
        let (script_len, c) = read_varint(raw_tx, cursor);
        cursor += c + script_len.try_into().unwrap();
        cursor += 4; // sequence
        vin += 1;
    };

    // Parse outputs
    let (output_count, consumed2) = read_varint(raw_tx, cursor);
    cursor += consumed2;
    assert(vout_index.into() < output_count, 'vout_index out of range');

    let mut vout: u32 = 0;
    let mut result_amount: u64 = 0;
    let mut script_start: usize = 0;
    let mut script_len_val: usize = 0;

    loop {
        if vout.into() >= output_count {
            break;
        }
        // Read 8-byte LE amount
        let amount = read_u64_le(raw_tx, cursor);
        cursor += 8;
        let (slen, c3) = read_varint(raw_tx, cursor);
        cursor += c3;
        if vout == vout_index {
            result_amount = amount;
            script_start = cursor;
            script_len_val = slen.try_into().unwrap();
        }
        cursor += slen.try_into().unwrap();
        vout += 1;
    };

    let script = raw_tx.slice(script_start, script_len_val);
    (result_amount, script)
}

/// Read a Bitcoin varint from raw_tx at offset.
/// Returns (value, bytes_consumed).
fn read_varint(data: Span<u8>, offset: usize) -> (u64, usize) {
    let first: u8 = *data[offset];
    if first < 0xfd {
        (first.into(), 1)
    } else if first == 0xfd {
        let v: u64 = (*data[offset + 1]).into() + (*data[offset + 2]).into() * 0x100_u64;
        (v, 3)
    } else if first == 0xfe {
        let v: u64 = (*data[offset + 1]).into()
            + (*data[offset + 2]).into() * 0x100_u64
            + (*data[offset + 3]).into() * 0x10000_u64
            + (*data[offset + 4]).into() * 0x1000000_u64;
        (v, 5)
    } else {
        // 0xff — 8-byte varint (very rare, tx count unlikely > 4B)
        let v: u64 = (*data[offset + 1]).into()
            + (*data[offset + 2]).into() * 0x100_u64
            + (*data[offset + 3]).into() * 0x10000_u64
            + (*data[offset + 4]).into() * 0x1000000_u64
            + (*data[offset + 5]).into() * 0x100000000_u64
            + (*data[offset + 6]).into() * 0x10000000000_u64
            + (*data[offset + 7]).into() * 0x1000000000000_u64
            + (*data[offset + 8]).into() * 0x100000000000000_u64;
        (v, 9)
    }
}

/// Read a little-endian u64 from raw_tx at offset.
fn read_u64_le(data: Span<u8>, offset: usize) -> u64 {
    (*data[offset]).into()
        + (*data[offset + 1]).into() * 0x100_u64
        + (*data[offset + 2]).into() * 0x10000_u64
        + (*data[offset + 3]).into() * 0x1000000_u64
        + (*data[offset + 4]).into() * 0x100000000_u64
        + (*data[offset + 5]).into() * 0x10000000000_u64
        + (*data[offset + 6]).into() * 0x1000000000000_u64
        + (*data[offset + 7]).into() * 0x100000000000000_u64
}

// ─── Script matching ──────────────────────────────────────────────────────────

/// Check that a scriptPubKey is P2WPKH paying to the given 20-byte pubkey hash.
/// P2WPKH scriptPubKey = 0x00 0x14 <20 bytes>  (22 bytes total)
/// @param script       - scriptPubKey bytes from the tx output
/// @param pubkey_hash  - 20-byte expected pubkey hash (from bech32 decode)
pub fn script_matches_p2wpkh(script: Span<u8>, pubkey_hash: Span<u8>) -> bool {
    if script.len() != 22 {
        return false;
    }
    if *script[0] != 0x00 || *script[1] != 0x14 {
        return false;
    }
    let mut i: usize = 0;
    let mut matches = true;
    loop {
        if i >= 20 {
            break;
        }
        if *script[i + 2] != *pubkey_hash[i] {
            matches = false;
            break;
        }
        i += 1;
    };
    matches
}

/// Check that a scriptPubKey is P2TR (Pay-to-Taproot) paying to the given
/// 32-byte tweaked public key.
///
/// P2TR scriptPubKey = 0x51 0x20 <32 bytes>  (34 bytes total)
///   0x51 = OP_1  (segwit version 1)
///   0x20 = OP_PUSHBYTES_32
///   32 bytes = tweaked x-only public key (output of TapTweak)
///
/// @param script    - scriptPubKey bytes from the tx output
/// @param tapkey    - 32-byte expected tweaked x-only public key
pub fn script_matches_p2tr(script: Span<u8>, tapkey: Span<u8>) -> bool {
    if script.len() != 34 {
        return false;
    }
    // 0x51 = OP_1, 0x20 = PUSH_32
    if *script[0] != 0x51 || *script[1] != 0x20 {
        return false;
    }
    let mut i: usize = 0;
    let mut matches = true;
    loop {
        if i >= 32 {
            break;
        }
        if *script[i + 2] != *tapkey[i] {
            matches = false;
            break;
        }
        i += 1;
    };
    matches
}
