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

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

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
            console.log(`[BitcoinSignet] 🔄 Sorting ${utxos.length} UTXOs (unconfirmed first)...`);
            const sorted = [...utxos].sort((a, b) => {
                const aConfirmed = a.status?.confirmed || false;
                const bConfirmed = b.status?.confirmed || false;
                
                // CRITICAL: Unconfirmed transactions come FIRST (newest deposits)
                if (!aConfirmed && bConfirmed) return -1; // a first (unconfirmed = NEW)
                if (aConfirmed && !bConfirmed) return 1;  // b first (unconfirmed = NEW)
                
                // If both unconfirmed, keep original order
                if (!aConfirmed && !bConfirmed) return 0;
                
                // If both confirmed, sort by block height (higher = newer)
                const aHeight = a.status?.block_height || 0;
                const bHeight = b.status?.block_height || 0;
                return bHeight - aHeight;
            });

            // Log SORTED UTXOs for debugging
            sorted.forEach((u, i) => {
                const confirmStatus = u.status?.confirmed ? `confirmed (height: ${u.status.block_height})` : 'UNCONFIRMED ⚡';
                console.log(`[BitcoinSignet] [${i}] ${confirmStatus} - ${u.txid.substring(0, 16)}... - ${u.value} sats`);
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
                console.log(`[BitcoinSignet] ✅ SELECTED: ${confirmStatus}`);
                console.log(`[BitcoinSignet] ✅ TXID: ${match.txid}`);
                console.log(`[BitcoinSignet] ✅ Amount: ${match.value} sats (expected: ${expectedSats})`);
            }

            if (match) {
                console.log(`[BitcoinSignet] ✅ DETECTION SUCCESS: txid=${match.txid}`);
                return {
                    detected: true,
                    txid: match.txid,
                    confirmations: match.status?.confirmed ? (match.status.block_height ? 1 : 0) : 0
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${MEMPOOL_API}/tx/${txid}/status`, { signal: controller.signal });
    clearTimeout(timeoutId);

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const tipRes = await fetch(`${MEMPOOL_API}/blocks/tip/height`, { signal: controller.signal });
        clearTimeout(timeoutId);

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
    } catch {
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

