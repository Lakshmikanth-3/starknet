/**
 * BitcoinSignetService — Real-time Bitcoin Signet monitoring.
 *
 * Uses mempool.space public Signet API: https://mempool.space/signet/api
 * Goal: Detect native BTC locks on Signet for trust-minimized bridging.
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

const MEMPOOL_BASE = 'https://mempool.space/signet/api';
const TIMEOUT_MS = 10000;

export interface BitcoinBlock {
    height: number;
    hash: string;
    timestamp: number;
}

export interface BitcoinAddressStats {
    address: string;
    txCount: number;
    confirmedBalance: number;
    unconfirmedBalance: number;
    transactions: BitcoinTx[];
}

export interface BitcoinTx {
    txid: string;
    value: number;
    confirmed: boolean;
    block_height?: number;
}

export class BitcoinSignetService {
    /**
     * Get the latest block from Bitcoin Signet.
     */
    static async getCurrentBlock(): Promise<BitcoinBlock> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

            // 1. Get height
            const heightRes = await fetch(`${MEMPOOL_BASE}/blocks/tip/height`, { signal: controller.signal });
            const height = parseInt(await heightRes.text());

            // 2. Get hash
            const hashRes = await fetch(`${MEMPOOL_BASE}/blocks/tip/hash`, { signal: controller.signal });
            const hash = await hashRes.text();

            // 3. Get block details (for timestamp)
            const blockRes = await fetch(`${MEMPOOL_BASE}/block/${hash}`, { signal: controller.signal });
            const blockData = await blockRes.json() as { timestamp: number };

            clearTimeout(timeout);

            return {
                height,
                hash,
                timestamp: blockData.timestamp
            };
        } catch (err) {
            console.error('Failed to fetch Bitcoin Signet block:', err);
            throw new Error(`mempool.space unreachable: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Watch a specific address for activity on Signet.
     * Returns stats and last 5 transactions.
     */
    static async watchAddress(address: string): Promise<BitcoinAddressStats> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

            // 1. Get address stats
            const addrRes = await fetch(`${MEMPOOL_BASE}/address/${address}`, { signal: controller.signal });
            const addrData = await addrRes.json() as {
                address: string,
                chain_stats: { tx_count: number, funded_txo_sum: number, spent_txo_sum: number },
                mempool_stats: { tx_count: number, funded_txo_sum: number, spent_txo_sum: number }
            };

            // 2. Get last transactions
            const txsRes = await fetch(`${MEMPOOL_BASE}/address/${address}/txs`, { signal: controller.signal });
            const txsData = await txsRes.json() as Array<{
                txid: string,
                status: { confirmed: boolean, block_height?: number },
                vout: Array<{ scriptpubkey_address: string, value: number }>
            }>;

            clearTimeout(timeout);

            const transactions: BitcoinTx[] = txsData.slice(0, 5).map(tx => {
                // Find value sent TO this address
                const value = tx.vout.reduce((sum, out) => {
                    return out.scriptpubkey_address === address ? sum + out.value : sum;
                }, 0);

                return {
                    txid: tx.txid,
                    value,
                    confirmed: tx.status.confirmed,
                    block_height: tx.status.block_height
                };
            });

            return {
                address: addrData.address,
                txCount: addrData.chain_stats.tx_count + addrData.mempool_stats.tx_count,
                confirmedBalance: addrData.chain_stats.funded_txo_sum - addrData.chain_stats.spent_txo_sum,
                unconfirmedBalance: addrData.mempool_stats.funded_txo_sum - addrData.mempool_stats.spent_txo_sum,
                transactions
            };
        } catch (err) {
            console.error(`Failed to watch Bitcoin address ${address}:`, err);
            throw new Error(`Address watch failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Scan transactions for an output matching specific SAT amount.
     */
    static async detectLock(address: string, expectedAmountSats: number): Promise<{ detected: boolean, txid?: string, confirmations?: number }> {
        try {
            const { transactions } = await this.watchAddress(address);
            const currentBlock = await this.getCurrentBlock();

            const foundTx = transactions.find(tx => tx.value === expectedAmountSats && tx.confirmed);

            if (foundTx && foundTx.block_height) {
                return {
                    detected: true,
                    txid: foundTx.txid,
                    confirmations: currentBlock.height - foundTx.block_height + 1
                };
            }

            return { detected: false };
        } catch (err) {
            console.warn(`Detection scan failed for ${address}:`, err);
            return { detected: false };
        }
    }

    /**
     * Simulated lock for demo/fallback purposes.
     * Clearly labeled as simulated.
     */
    static simulateLock(address: string, amountSats: number) {
        return {
            simulated: true,
            address,
            amountSats,
            fakeTxid: `SIMULATED_${crypto.randomBytes(16).toString('hex')}`,
            confirmations: 6,
            message: "Real BTC lock detection live on Signet. Trustless bridge pending OP_CAT mainnet activation."
        };
    }
}
