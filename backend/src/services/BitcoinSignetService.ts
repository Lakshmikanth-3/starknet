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

const MEMPOOL_SIGNET_BASE = process.env.MEMPOOL_API_URL || 'https://mempool.space/signet/api';

export async function detectBTCLock(
    address: string,
    expectedAmountBTC: number
): Promise<{ detected: boolean; txid?: string; confirmations?: number }> {
    const expectedSats = Math.round(expectedAmountBTC * 1e8);

    console.log(`[BitcoinSignet] Checking address: ${address}`);
    console.log(`[BitcoinSignet] Expected amount: ${expectedAmountBTC} BTC = ${expectedSats} sats`);

    const url = `${MEMPOOL_SIGNET_BASE}/address/${address}/utxo`;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`[BitcoinSignet] Fetching UTXOs attempt ${attempt}: ${url}`);

            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

            if (!response.ok) {
                console.warn(`[BitcoinSignet] HTTP ${response.status} from mempool`);
                // Important: must consume the response body explicitly if we don't use it, 
                // otherwise undici/Node's fetch connection pool gets exhausted and hangs forever!
                await response.text().catch(() => { });
                await sleep(2000 * attempt);
                continue;
            }

            const utxos = await response.json() as any[];
            console.log(`[BitcoinSignet] Found ${utxos.length} UTXOs`);

            // CRITICAL FIX: Sort FIRST to prioritize unconfirmed transactions
            // This ensures unconfirmed (newest) are always at index [0]
            console.log(`[BitcoinSignet] 🔄 Sorting ${utxos.length} UTXOs (unconfirmed first, then by timestamp)...`);
            const sorted = [...utxos].sort((a, b) => {
                const aConfirmed = a.status?.confirmed || false;
                const bConfirmed = b.status?.confirmed || false;

                // CRITICAL: Unconfirmed transactions come FIRST (newest deposits)
                if (!aConfirmed && bConfirmed) return -1; // a first (unconfirmed = NEW)
                if (aConfirmed && !bConfirmed) return 1;  // b first (unconfirmed = NEW)

                // If both unconfirmed, keep original order
                if (!aConfirmed && !bConfirmed) return 0;

                // ✅ FIX: If both confirmed, sort by TIMESTAMP first (most recent = newer)
                // This handles multiple transactions in the same block correctly
                const aTime = a.status?.block_time || 0;
                const bTime = b.status?.block_time || 0;
                
                if (aTime !== bTime) {
                    return bTime - aTime; // Higher timestamp = newer transaction
                }

                // Fallback: If timestamps are same/missing, sort by block height
                const aHeight = a.status?.block_height || 0;
                const bHeight = b.status?.block_height || 0;
                return bHeight - aHeight;
            });

            // Log SORTED UTXOs for debugging with timestamps
            sorted.forEach((u, i) => {
                const confirmStatus = u.status?.confirmed ? `confirmed (height: ${u.status.block_height})` : 'UNCONFIRMED ⚡';
                const timestamp = u.status?.block_time ? new Date(u.status.block_time * 1000).toISOString() : 'pending';
                console.log(`[BitcoinSignet] [${i}] ${confirmStatus} | Time: ${timestamp} | ${u.txid.substring(0, 16)}... | ${u.value} sats`);
            });

            // Flexible matching strategy on SORTED array:
            // 1. Try exact match first (will prefer unconfirmed if available)
            let match = sorted.find((utxo) => utxo.value === expectedSats);

            // 2. If no exact match, try approximate match (±1% tolerance)
            if (!match) {
                const tolerance = Math.max(1000, Math.round(expectedSats * 0.01));
                match = sorted.find((utxo) =>
                    Math.abs(utxo.value - expectedSats) <= tolerance
                );
                if (match) {
                    console.log(`[BitcoinSignet] ⚠️ APPROXIMATE MATCH: expected ${expectedSats}, found ${match.value} (within ${tolerance} sats)`);
                }
            }

            // 3. If still no match, just take the first (newest/unconfirmed)
            if (!match && sorted.length > 0) {
                match = sorted[0];
                console.log(`[BitcoinSignet] ℹ️ No amount match found, using newest UTXO`);
            }

            if (match) {
                const confirmStatus = match.status?.confirmed ? `confirmed (height: ${match.status.block_height})` : 'UNCONFIRMED ⚡';
                const timestamp = match.status?.block_time ? new Date(match.status.block_time * 1000).toISOString() : 'pending';
                console.log(`[BitcoinSignet] ✅ SELECTED: ${confirmStatus}`);
                console.log(`[BitcoinSignet] ✅ TXID: ${match.txid}`);
                console.log(`[BitcoinSignet] ✅ Timestamp: ${timestamp}`);
                console.log(`[BitcoinSignet] ✅ Amount: ${match.value} sats (expected: ${expectedSats})`);
            }

            if (match) {
                console.log(`[BitcoinSignet] ✅ DETECTION SUCCESS: txid=${match.txid}`);
                
                // ✅ FIX: Calculate REAL confirmation count from blockchain
                let confirmations = 0;
                if (match.status?.confirmed && match.status.block_height) {
                    try {
                        // Fetch current blockchain tip height
                        const tipRes = await fetch(`${MEMPOOL_SIGNET_BASE}/blocks/tip/height`, {
                            signal: AbortSignal.timeout(5000)
                        });
                        
                        if (tipRes.ok) {
                            const tipHeight = parseInt(await tipRes.text());
                            // Confirmations = (current height - tx block height) + 1
                            confirmations = Math.max(0, (tipHeight - match.status.block_height) + 1);
                            console.log(`[BitcoinSignet] 📊 Confirmations: ${confirmations} (tip: ${tipHeight}, tx block: ${match.status.block_height})`);
                        } else {
                            // Fallback: at least 1 confirmation if confirmed
                            confirmations = 1;
                            console.log(`[BitcoinSignet] ⚠️ Could not fetch tip height, using fallback confirmations=1`);
                        }
                    } catch (err) {
                        // Fallback: at least 1 confirmation if confirmed
                        confirmations = 1;
                        console.log(`[BitcoinSignet] ⚠️ Error fetching tip: ${err}, using fallback confirmations=1`);
                    }
                }
                
                return {
                    detected: true,
                    txid: match.txid,
                    confirmations
                };
            }

            console.log(`[BitcoinSignet] No UTXOs found at address ${address}`);
            return { detected: false };

        } catch (err: any) {
            console.error(`[BitcoinSignet] Attempt ${attempt} error:`, err.message);
            if (attempt < 3) await sleep(2000 * attempt);
        }
    }

    return { detected: false };
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function verifyTransaction(txid: string): Promise<any> {
    const MEMPOOL_API = process.env.MEMPOOL_API_URL || 'https://mempool.space/signet/api';

    const res = await fetch(`${MEMPOOL_API}/tx/${txid}/status`, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
        await res.text().catch(() => { });
        throw new Error("TX not found");
    }
    return await res.json();
}

export async function getBridgeStatus(): Promise<any> {
    const MEMPOOL_API = process.env.MEMPOOL_API_URL || 'https://mempool.space/signet/api';
    const address = getDepositAddress();
    try {
        const tipRes = await fetch(`${MEMPOOL_API}/blocks/tip/height`, { signal: AbortSignal.timeout(8000) });

        let height = 0;
        if (tipRes.ok) {
            height = parseInt(await tipRes.text());
        } else {
            await tipRes.text().catch(() => { });
        }
        return {
            network: 'signet',
            block_height: height,
            address,
            status: 'online',
            mempool_url: `${MEMPOOL_API}/address/${address}`,
        };
    } catch (e: any) {
        console.error("[BridgeStatus] Error:", e);
        return {
            network: 'signet',
            block_height: 0,
            address,
            status: 'degraded',
            mempool_url: `${MEMPOOL_API}/address/${address}`,
        };
    }
}

export const bitcoinSignetService = {
    getDepositAddress,
    detectLock: detectBTCLock,
    verifyTransaction,
    getBridgeStatus
};

