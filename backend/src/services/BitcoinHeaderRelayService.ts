/**
 * BitcoinHeaderRelayService
 *
 * Polls the Bitcoin Signet chain for new blocks. For each new block, extracts
 * the Merkle root from the raw 80-byte block header and stores it in the
 * HeaderStore contract on Starknet via the relayer account.
 *
 * Bitcoin block header layout (80 bytes):
 *   [0..4]   version (LE u32)
 *   [4..36]  prev_block_hash (32 bytes, LE)
 *   [36..68] merkle_root (32 bytes, LE)
 *   [68..72] time (LE u32)
 *   [72..76] bits (LE u32)
 *   [76..80] nonce (LE u32)
 *
 * The Merkle root is stored in the header as 32 little-endian bytes.
 * We convert it to 8 × u32 big-endian words for the Cairo contract.
 */

import db from '../db/schema';
import { config } from '../config/env';
import { WalletService } from './WalletService';

const MEMPOOL_API = process.env.MEMPOOL_API_URL || 'https://explorer.bc-2.jp/api';
const POLL_INTERVAL_MS = 30_000; // ✅ OPTIMIZED: Poll every 30s instead of 60s for faster header availability

/** Convert 32-byte Merkle root (little-endian hex from block header) into 8×u32 big-endian. */
export function merkleRootToU32Array(merkleRootHex: string): bigint[] {
    // In Bitcoin block headers the merkle_root is stored in internal byte order
    // (which is little-endian compared to display hash). The mempool.space API
    // returns it in internal byte order already. We treat it as 32 raw bytes
    // and pack into 8×u32 big-endian words.
    const bytes = Buffer.from(merkleRootHex, 'hex');
    if (bytes.length !== 32) throw new Error(`Bad merkle root length: ${bytes.length}`);
    const words: bigint[] = [];
    for (let i = 0; i < 32; i += 4) {
        words.push(BigInt(bytes.readUInt32BE(i)));
    }
    return words;
}

/** Fetch the block hash at a given height from Signet with retry logic. */
async function fetchBlockHashAtHeight(height: number, retries = 3): Promise<string> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const res = await fetch(`${MEMPOOL_API}/block-height/${height}`, {
                signal: AbortSignal.timeout(10_000)
            });
            if (!res.ok) {
                await res.text().catch(() => { });
                throw new Error(`block-height fetch failed: ${res.status}`);
            }
            return res.text();
        } catch (err: any) {
            lastError = err;
            if (attempt < retries - 1) {
                const backoffMs = Math.min(500 * Math.pow(2, attempt), 5000);
                await new Promise(r => setTimeout(r, backoffMs));
            }
        }
    }
    throw lastError || new Error('Failed to fetch block hash');
}

/** Fetch the raw 80-byte block header hex for a given block hash with retry logic. */
async function fetchBlockHeader(blockHash: string, retries = 3): Promise<string> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const res = await fetch(`${MEMPOOL_API}/block/${blockHash}/header`, {
                signal: AbortSignal.timeout(10_000)
            });
            if (!res.ok) {
                await res.text().catch(() => { });
                throw new Error(`block header fetch failed: ${res.status}`);
            }
            return res.text();
        } catch (err: any) {
            lastError = err;
            if (attempt < retries - 1) {
                const backoffMs = Math.min(500 * Math.pow(2, attempt), 5000);
                await new Promise(r => setTimeout(r, backoffMs));
            }
        }
    }
    throw lastError || new Error('Failed to fetch block header');
}

/** Fetch current tip height with retry logic. */
async function fetchTipHeight(retries = 3): Promise<number> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const res = await fetch(`${MEMPOOL_API}/blocks/tip/height`, {
                signal: AbortSignal.timeout(10_000)
            });
            if (!res.ok) {
                await res.text().catch(() => { });
                throw new Error(`tip height fetch failed: ${res.status}`);
            }
            const text = await res.text();
            return parseInt(text.trim(), 10);
        } catch (err: any) {
            lastError = err;
            if (attempt < retries - 1) {
                const backoffMs = Math.min(500 * Math.pow(2, attempt), 5000);
                await new Promise(r => setTimeout(r, backoffMs));
            }
        }
    }
    throw lastError || new Error('Failed to fetch tip height');
}

/** Extract merkle_root from raw 80-byte block header hex. */
function parseMerkleRootFromHeader(headerHex: string): string {
    if (headerHex.length !== 160) throw new Error(`Bad header hex length: ${headerHex.length}`);
    // Merkle root is at bytes 36–68 (hex chars 72–136) in the header
    // It is stored in internal byte order (little-endian), which is what the API returns
    return headerHex.slice(72, 136);
}

/** Get the last relayed height from DB, defaulting to (tipHeight - 1) on first run. */
function getLastRelayedHeight(): number {
    try {
        const row = db.prepare(
            `SELECT value FROM kv_store WHERE key = 'header_relay_last_height'`
        ).get() as { value: string } | undefined;
        return row ? parseInt(row.value, 10) : -1;
    } catch {
        return -1;
    }
}

function setLastRelayedHeight(height: number): void {
    db.prepare(
        `INSERT INTO kv_store (key, value) VALUES ('header_relay_last_height', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(height.toString());
}

/** Post a block header's Merkle root to the HeaderStore contract on Starknet with retry logic. */
async function relayHeader(height: number, merkleRootHex: string, retries = 3): Promise<string> {
    const account = WalletService.getAccount();
    if (!account) throw new Error('No relayer account configured');

    const headerStoreAddr = process.env.HEADER_STORE_CONTRACT_ADDRESS;
    if (!headerStoreAddr) throw new Error('HEADER_STORE_CONTRACT_ADDRESS not set in .env');

    const words = merkleRootToU32Array(merkleRootHex);

    // Build calldata for store_header(height: u64, merkle_root: [u32; 8])
    const calldata = [
        BigInt(height).toString(),
        // [u32; 8] is serialized as 8 felt252 values
        ...words.map(w => w.toString()),
    ];

    const call = {
        contractAddress: headerStoreAddr,
        entrypoint: 'store_header',
        calldata,
    };

    // Use 'latest' instead of 'pending' to avoid "Block identifier unmanaged: pending" error
    // Retry with exponential backoff on failure
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const nonce = await account.getNonce('latest');
            const response = await account.execute([call], { nonce });
            return response.transaction_hash;
        } catch (err: any) {
            lastError = err;
            const isLastAttempt = attempt === retries - 1;
            
            // Don't retry on known permanent errors
            const errMsg = err?.message || '';
            if (errMsg.includes('insufficient') || errMsg.includes('balance is smaller')) {
                throw err; // Don't retry funding issues
            }
            
            if (!isLastAttempt) {
                const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
                console.log(`[HeaderRelay] Retry ${attempt + 1}/${retries} for block ${height} in ${backoffMs}ms...`);
                await new Promise(r => setTimeout(r, backoffMs));
            }
        }
    }
    throw lastError || new Error('Failed to relay header after retries');
}

/** Ensure the kv_store table exists (used to persist last relayed height). */
function ensureKvStore(): void {
    try {
        db.prepare(
            `CREATE TABLE IF NOT EXISTS kv_store (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )`
        ).run();
    } catch {
        // table already exists
    }
}

/** Single relay cycle: bring headers from lastRelayed+1 up to current tip. */
async function relayCycle(): Promise<void> {
    try {
        const tipHeight = await fetchTipHeight();
        const lastRelayed = getLastRelayedHeight();

        // Normal progression; but cap the lookback so it doesn't try to sync from genesis
        const startHeight = lastRelayed === -1 ? tipHeight : lastRelayed + 1;

        if (startHeight > tipHeight) {
            console.log(`[HeaderRelay] Up to date at block ${tipHeight}.`);
            return;
        }

        // ✅ OPTIMIZED: Relay at most 10 headers per cycle instead of 5 for faster catch-up
        const endHeight = Math.min(startHeight + 9, tipHeight);
        const blocksToRelay = endHeight - startHeight + 1;
        console.log(`[HeaderRelay] Relaying ${blocksToRelay} block(s): ${startHeight} → ${endHeight} (tip: ${tipHeight})`);

        for (let h = startHeight; h <= endHeight; h++) {
            try {
                const blockHash = await fetchBlockHashAtHeight(h);
                const headerHex = await fetchBlockHeader(blockHash.trim());
                const merkleRoot = parseMerkleRootFromHeader(headerHex.trim());

                console.log(`[HeaderRelay] Block ${h}: merkle_root=${merkleRoot.slice(0, 16)}...`);

                const txHash = await relayHeader(h, merkleRoot);
                console.log(`[HeaderRelay] ✅ Stored block ${h} on Starknet. TX: ${txHash}`);

                setLastRelayedHeight(h);

                // Increased gap between transactions to allow nonce to settle and reduce RPC load
                await new Promise(r => setTimeout(r, 5000));
            } catch (err: any) {
                console.error(`[HeaderRelay] ❌ Failed to relay block ${h}: ${err.message}`);
                console.error(`[HeaderRelay] Will retry block ${h} in next cycle (${POLL_INTERVAL_MS / 1000}s)`);
                break; // stop relay on error, retry next cycle
            }
        }
    } catch (err: any) {
        // Top-level errors (e.g., can't fetch tip height)
        console.error(`[HeaderRelay] ❌ Cycle initialization failed: ${err.message}`);
        console.error(`[HeaderRelay] Will retry in ${POLL_INTERVAL_MS / 1000}s`);
    }
}

let relayInterval: NodeJS.Timeout | null = null;

/** Get current status of header relay service for health checks. */
export function getHeaderRelayStatus(): {
    running: boolean;
    lastRelayedHeight: number;
    pollIntervalMs: number;
} {
    return {
        running: relayInterval !== null,
        lastRelayedHeight: getLastRelayedHeight(),
        pollIntervalMs: POLL_INTERVAL_MS,
    };
}

/** Start the header relay background loop. */
export function startHeaderRelay(): void {
    ensureKvStore();
    console.log('[HeaderRelay] Starting Bitcoin Signet header relay service...');

    // Run immediately, then on interval
    relayCycle().catch(err => console.error('[HeaderRelay] Initial cycle error:', err.message));
    relayInterval = setInterval(() => {
        relayCycle().catch(err => console.error('[HeaderRelay] Cycle error:', err.message));
    }, POLL_INTERVAL_MS);
}

export function stopHeaderRelay(): void {
    if (relayInterval) {
        clearInterval(relayInterval);
        relayInterval = null;
    }
}

export const BitcoinHeaderRelayService = {
    start: startHeaderRelay,
    stop: stopHeaderRelay,
    getStatus: getHeaderRelayStatus,
    merkleRootToU32Array,
};
