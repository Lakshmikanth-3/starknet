import { config as env } from '../config/env';

export const getDepositAddress = (): string => {
    const addr = env.XVERSE_WALLET_ADDRESS || process.env.BTC_VAULT_ADDRESS;
    if (!addr || !addr.startsWith('tb1')) {
        throw new Error(
            'XVERSE_WALLET_ADDRESS not configured in .env\n' +
            'Open Xverse → Settings → switch to Signet → copy tb1q... address'
        );
    }
    return addr;
};

const MEMPOOL_SIGNET_BASE = process.env.MEMPOOL_API_URL || 'https://explorer.bc-2.jp/api';

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch already-known bitcoin txids from the vaults DB so we can skip them.
 * Imported lazily to avoid circular dependency.
 */
async function getKnownTxids(): Promise<Set<string>> {
    try {
        const dbModule = await import('../db/schema');
        const db = dbModule.default;
        const rows = db.prepare(`SELECT bitcoin_txid FROM vaults WHERE bitcoin_txid IS NOT NULL`).all() as { bitcoin_txid: string }[];
        return new Set(rows.map(r => r.bitcoin_txid));
    } catch {
        return new Set();
    }
}

export async function detectBTCLock(
    address: string,
    expectedAmountBTC: number,
    sinceMs?: number   // only consider UTXOs/txns AFTER this unix-ms timestamp
): Promise<{ detected: boolean; txid?: string; confirmations?: number }> {
    const expectedSats = Math.round(expectedAmountBTC * 1e8);
    const sinceSeconds = sinceMs ? Math.floor(sinceMs / 1000) : 0;

    console.log(`[BitcoinSignet] Checking address: ${address}`);
    console.log(`[BitcoinSignet] Expected amount: ${expectedAmountBTC} BTC = ${expectedSats} sats`);
    if (sinceSeconds) console.log(`[BitcoinSignet] Only showing UTXOs since: ${new Date(sinceMs!).toISOString()}`);

    // 0. Load txids already used so we don't return stale deposits
    const knownTxids = await getKnownTxids();
    console.log(`[BitcoinSignet] Ignoring ${knownTxids.size} already-known txid(s)`);

    // ── STEP 1: Check mempool (unconfirmed) transactions FIRST ───────────────
    // This guarantees we return a brand-new deposit the moment it hits the
    // mempool, even before it is mined and shows up in the UTXO set.
    try {
        const mempoolUrl = `${MEMPOOL_SIGNET_BASE}/address/${address}/txs/mempool`;
        console.log(`[BitcoinSignet] Checking mempool: ${mempoolUrl}`);
        const mempoolRes = await fetch(mempoolUrl, { signal: AbortSignal.timeout(8000) });

        if (mempoolRes.ok) {
            const mempoolTxs = await mempoolRes.json() as any[];
            console.log(`[BitcoinSignet] Mempool: ${mempoolTxs.length} unconfirmed txn(s)`);

            for (const tx of mempoolTxs) {
                if (knownTxids.has(tx.txid)) continue; // skip stale
                // Optionally check first_seen if available (bc-2.jp may expose it)
                const txSeen = tx.status?.block_time || 0;
                if (sinceSeconds && txSeen && txSeen < sinceSeconds) continue;
                // Look for an output paying to our address with the right amount
                const matchingVout = (tx.vout || []).find((vout: any) =>
                    vout.scriptpubkey_address === address &&
                    (vout.value === expectedSats ||
                        Math.abs(vout.value - expectedSats) <= Math.max(1000, Math.round(expectedSats * 0.01)))
                );
                if (matchingVout) {
                    console.log(`[BitcoinSignet] ⚡ MEMPOOL HIT: txid=${tx.txid}, value=${matchingVout.value} sats`);
                    return { detected: true, txid: tx.txid, confirmations: 0 };
                }
            }

            if (mempoolTxs.length > 0) {
                console.log(`[BitcoinSignet] Mempool txns found but none matched amount ${expectedSats} sats`);
            }
        } else {
            await mempoolRes.text().catch(() => {});
            console.warn(`[BitcoinSignet] Mempool endpoint returned HTTP ${mempoolRes.status}`);
        }
    } catch (err: any) {
        console.warn(`[BitcoinSignet] Mempool check failed: ${err.message} — falling back to UTXO endpoint`);
    }

    // ── STEP 2: Fall back to confirmed UTXO set ──────────────────────────────
    // Sort by newest block first. Skip any txids already tracked in DB.
    const utxoUrl = `${MEMPOOL_SIGNET_BASE}/address/${address}/utxo`;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`[BitcoinSignet] Fetching UTXOs attempt ${attempt}: ${utxoUrl}`);
            const response = await fetch(utxoUrl, { signal: AbortSignal.timeout(8000) });

            if (!response.ok) {
                console.warn(`[BitcoinSignet] HTTP ${response.status} from mempool`);
                await response.text().catch(() => {});
                await sleep(2000 * attempt);
                continue;
            }

            const utxos = await response.json() as any[];
            console.log(`[BitcoinSignet] Found ${utxos.length} UTXOs`);

            // Filter out known/already-used txids AND txns older than sinceSeconds
            const freshUtxos = utxos.filter(u => {
                if (knownTxids.has(u.txid)) return false;
                // Unconfirmed: always include
                if (!u.status?.confirmed) return true;
                // Confirmed: only include if block_time >= sinceSeconds
                if (sinceSeconds && u.status.block_time < sinceSeconds) return false;
                return true;
            });
            console.log(`[BitcoinSignet] ${freshUtxos.length} fresh UTXO(s) after excluding known txids`);

            if (freshUtxos.length === 0) {
                console.log(`[BitcoinSignet] No fresh UTXOs – new deposit not yet indexed`);
                return { detected: false };
            }

            // Sort: unconfirmed first, then by newest block time
            const sorted = [...freshUtxos].sort((a, b) => {
                const aConfirmed = a.status?.confirmed || false;
                const bConfirmed = b.status?.confirmed || false;
                if (!aConfirmed && bConfirmed) return -1;
                if (aConfirmed && !bConfirmed) return 1;
                if (!aConfirmed && !bConfirmed) return 0;
                // Both confirmed → newest block wins
                const aTime = a.status?.block_time || 0;
                const bTime = b.status?.block_time || 0;
                if (aTime !== bTime) return bTime - aTime;
                return (b.status?.block_height || 0) - (a.status?.block_height || 0);
            });

            sorted.forEach((u, i) => {
                const s = u.status?.confirmed ? `confirmed (height: ${u.status.block_height})` : 'UNCONFIRMED ⚡';
                const ts = u.status?.block_time ? new Date(u.status.block_time * 1000).toISOString() : 'pending';
                console.log(`[BitcoinSignet] [${i}] ${s} | ${ts} | ${u.txid.substring(0, 16)}... | ${u.value} sats`);
            });

            // Exact match first, then ±1% tolerance, then newest
            let match = sorted.find(u => u.value === expectedSats);
            if (!match) {
                const tol = Math.max(1000, Math.round(expectedSats * 0.01));
                match = sorted.find(u => Math.abs(u.value - expectedSats) <= tol);
                if (match) console.log(`[BitcoinSignet] ⚠️ Approximate match: expected ${expectedSats}, found ${match.value}`);
            }
            if (!match && sorted.length > 0) {
                match = sorted[0];
                console.log(`[BitcoinSignet] ℹ️ No amount match, using newest fresh UTXO`);
            }

            if (match) {
                const s = match.status?.confirmed ? `confirmed (height: ${match.status.block_height})` : 'UNCONFIRMED ⚡';
                console.log(`[BitcoinSignet] ✅ SELECTED: ${s}`);
                console.log(`[BitcoinSignet] ✅ TXID: ${match.txid}`);
                console.log(`[BitcoinSignet] ✅ Amount: ${match.value} sats (expected: ${expectedSats})`);

                let confirmations = 0;
                if (match.status?.confirmed && match.status.block_height) {
                    try {
                        const tipRes = await fetch(`${MEMPOOL_SIGNET_BASE}/blocks/tip/height`, {
                            signal: AbortSignal.timeout(5000)
                        });
                        if (tipRes.ok) {
                            const tipHeight = parseInt(await tipRes.text());
                            confirmations = Math.max(0, (tipHeight - match.status.block_height) + 1);
                            console.log(`[BitcoinSignet] 📊 Confirmations: ${confirmations} (tip: ${tipHeight}, tx block: ${match.status.block_height})`);
                        } else {
                            confirmations = 1;
                        }
                    } catch {
                        confirmations = 1;
                    }
                }

                return { detected: true, txid: match.txid, confirmations };
            }

            console.log(`[BitcoinSignet] No matching UTXOs at address ${address}`);
            return { detected: false };

        } catch (err: any) {
            console.error(`[BitcoinSignet] Attempt ${attempt} error:`, err.message);
            if (attempt < 3) await sleep(2000 * attempt);
        }
    }

    return { detected: false };
}

export async function verifyTransaction(txid: string): Promise<any> {
    const MEMPOOL_API = process.env.MEMPOOL_API_URL || 'https://explorer.bc-2.jp/api';
    const res = await fetch(`${MEMPOOL_API}/tx/${txid}/status`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
        await res.text().catch(() => {});
        throw new Error("TX not found");
    }
    return await res.json();
}

export async function getBridgeStatus(): Promise<any> {
    const MEMPOOL_API = process.env.MEMPOOL_API_URL || 'https://explorer.bc-2.jp/api';
    const address = getDepositAddress();
    try {
        const tipRes = await fetch(`${MEMPOOL_API}/blocks/tip/height`, { signal: AbortSignal.timeout(8000) });
        let height = 0;
        if (tipRes.ok) {
            height = parseInt(await tipRes.text());
        } else {
            await tipRes.text().catch(() => {});
        }
        return { network: 'signet', block_height: height, address, status: 'online' };
    } catch (e: any) {
        console.error("[BridgeStatus] Error:", e);
        return { network: 'signet', block_height: 0, address, status: 'degraded' };
    }
}

export const bitcoinSignetService = {
    getDepositAddress,
    detectLock: detectBTCLock,
    verifyTransaction,
    getBridgeStatus
};
