import { Router, Request, Response } from 'express';
import db from '../db/schema';
import { StarknetService } from '../services/StarknetService';
import { validateTxHash } from '../middleware/validateTxHash';
import { TransactionNotFoundError } from '../types/errors';
import { config } from '../config/env';

const router = Router();

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{63,64}$/;

// ─── GET /api/transactions/:address ──────────────────────────────────────────
router.get('/:address', async (req: Request, res: Response) => {
    const { address } = req.params;
    const { cursor, type } = req.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '20', 10), 100);

    try {
        // Get vault ids for this address
        const vaultIds = db
            .prepare<[string], { id: string }>('SELECT id FROM vaults WHERE owner_address = ?')
            .all(address)
            .map((r) => r.id);

        if (vaultIds.length === 0) {
            res.json({ success: true, transactions: [], nextCursor: null });
            return;
        }

        const placeholders = vaultIds.map(() => '?').join(', ');
        let query = `
      SELECT id, vault_id, tx_hash, type, block_number, block_timestamp,
             execution_status, timestamp
      FROM transactions
      WHERE vault_id IN (${placeholders})
    `;
        const params: (string | number)[] = [...vaultIds];

        if (type && (type === 'deposit' || type === 'withdraw')) {
            query += ' AND type = ?';
            params.push(type);
        }

        if (cursor) {
            query += ' AND timestamp < ?';
            params.push(parseInt(cursor, 10));
        }

        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);

        const rows = db
            .prepare<typeof params, {
                id: string;
                vault_id: string;
                tx_hash: string;
                type: string;
                block_number: number | null;
                block_timestamp: number | null;
                execution_status: string | null;
                timestamp: number;
            }>(query)
            .all(...params);

        // Enrich with live on-chain receipts (parallel, non-blocking)
        const enriched = await Promise.all(
            rows.map(async (row) => {
                let onChainStatus: 'confirmed' | 'not_found' | 'pending' = 'pending';
                let liveBlockNumber = row.block_number;
                let liveExecutionStatus = row.execution_status;

                try {
                    const receipt = await StarknetService.getTransactionReceipt(row.tx_hash);
                    onChainStatus = 'confirmed';
                    liveBlockNumber = receipt.block_number;
                    liveExecutionStatus = receipt.execution_status;
                } catch (e) {
                    if (e instanceof TransactionNotFoundError) {
                        onChainStatus = 'not_found';
                    }
                }

                return {
                    id: row.id,
                    vaultId: row.vault_id,
                    txHash: row.tx_hash,
                    type: row.type,
                    blockNumber: liveBlockNumber,
                    blockTimestamp: row.block_timestamp,
                    executionStatus: liveExecutionStatus,
                    onChainStatus,
                    timestamp: row.timestamp,
                };
            })
        );

        const nextCursor =
            rows.length === limit ? String(rows[rows.length - 1]!.timestamp) : null;

        res.json({ success: true, transactions: enriched, nextCursor });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Internal server error',
        });
    }
});

// ─── GET /api/transactions/tx/:txHash ────────────────────────────────────────
router.get('/tx/:txHash', validateTxHash, async (req: Request, res: Response) => {
    const { txHash } = req.params;

    const local = db
        .prepare<[string], Record<string, unknown>>(
            'SELECT * FROM transactions WHERE tx_hash = ?'
        )
        .get(txHash);

    let onChain: unknown = null;
    try {
        const receipt = await StarknetService.getTransactionReceipt(txHash);
        onChain = {
            blockNumber: receipt.block_number,
            blockHash: receipt.block_hash,
            executionStatus: receipt.execution_status,
            events: receipt.events,
            actualFee: receipt.actual_fee,
        };
    } catch (e) {
        if (e instanceof TransactionNotFoundError) {
            onChain = { status: 'not_found_on_chain' };
        } else {
            onChain = { error: e instanceof Error ? e.message : 'unknown error' };
        }
    }

    res.json({ success: true, local: local ?? null, onChain });
});

// ─── GET /api/transactions/verify/:txHash ────────────────────────────────────
router.get('/verify/:txHash', validateTxHash, async (req: Request, res: Response) => {
    const { txHash } = req.params;

    try {
        const receipt = await StarknetService.getTransactionReceipt(txHash);
        const vaultAddr = config.VAULT_CONTRACT_ADDRESS.toLowerCase();

        // Check if any event comes from our vault contract
        const isVaultEvent = receipt.events.some(
            (ev) => ev.from_address.toLowerCase() === vaultAddr
        );

        let type: 'deposit' | 'withdraw' | 'unknown' = 'unknown';
        if (isVaultEvent) {
            // Heuristic: deposits have commitment in data, withdrawals have nullifier
            // For now, look up in our DB
            const dbRow = db
                .prepare<[string], { type: string }>(
                    'SELECT type FROM transactions WHERE tx_hash = ?'
                )
                .get(txHash);
            if (dbRow) {
                type = dbRow.type as 'deposit' | 'withdraw';
            }
        }

        res.json({
            success: true,
            txHash,
            isRealVaultTx: isVaultEvent,
            type,
            details: {
                blockNumber: receipt.block_number,
                executionStatus: receipt.execution_status,
                eventCount: receipt.events.length,
            },
        });
    } catch (e) {
        if (e instanceof TransactionNotFoundError) {
            res.json({
                success: true,
                txHash,
                isRealVaultTx: false,
                type: 'unknown',
                details: { status: 'not_found_on_chain' },
            });
        } else {
            res.status(500).json({
                success: false,
                error: e instanceof Error ? e.message : 'Internal server error',
            });
        }
    }
});

export default router;
