import { Router, Request, Response } from 'express';
import db from '../db/schema';
import { StarknetService } from '../services/StarknetService';
import { config } from '../config/env';
import { TransactionNotFoundError } from '../types/errors';

const router = Router();

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{63,64}$/;

const VOYAGER_BASE = 'https://sepolia.voyager.online/tx';

// ─── GET /api/audit ───────────────────────────────────────────────────────────
router.get('/', (_req: Request, res: Response) => {
    try {
        const rows = db.prepare('SELECT id, deposit_tx_hash AS tx_hash, created_at, status, encrypted_amount AS amount FROM vaults WHERE deposit_tx_hash IS NOT NULL ORDER BY created_at DESC LIMIT 50').all() as Array<any>;

        const events = rows.map(row => ({
            id: row.id,
            type: 'DEPOSIT',
            tx_hash: row.tx_hash,
            status: row.status === 'pending' ? 'PENDING' : 'SUCCEEDED',
            amount: Number(row.amount),
            timestamp: new Date(row.created_at).toISOString(),
            voyager_url: row.tx_hash.startsWith('SIMULATED')
                ? null
                : `${VOYAGER_BASE}/${row.tx_hash}`,
        }));

        res.json({ events });
    } catch (err: unknown) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// ─── POST /api/audit/verify ───────────────────────────────────────────────────
router.post('/verify', async (_req: Request, res: Response) => {
    try {
        // 1. Fetch all hashes from vaults and htlcs
        const vaultRows = db.prepare('SELECT deposit_tx_hash AS tx_hash FROM vaults WHERE deposit_tx_hash IS NOT NULL').all() as { tx_hash: string }[];
        let htlcRows: { tx_hash: string }[] = [];
        try {
            htlcRows = db.prepare('SELECT claim_tx_hash AS tx_hash FROM htlcs WHERE claim_tx_hash IS NOT NULL').all() as { tx_hash: string }[];
        } catch { /* Ignore if schema doesn't match perfectly fallback */ }

        const allHashes = [...vaultRows, ...htlcRows].map(r => r.tx_hash);

        let verified = 0, pending = 0, failed = 0, simulated = 0;
        const results: Array<{
            tx_hash: string;
            status: string;
            voyager_url: string | null;
        }> = [];

        const provider = StarknetService.getProvider();

        for (const txHash of allHashes) {
            // 2. Skip SIMULATED hashes
            if (txHash.startsWith('SIMULATED')) {
                simulated++;
                results.push({ tx_hash: txHash, status: 'SIMULATED', voyager_url: null });
                continue;
            }

            try {
                // 3. Call Starknet RPC for live status
                const receipt = await provider.getTransactionReceipt(txHash);
                const status: string =
                    (receipt as any).execution_status ||
                    (receipt as any).finality_status ||
                    'PENDING';

                // 4. Update SQLite with latest status
                let dbStatus = 'pending';
                if (status === 'ACCEPTED_ON_L2' || status === 'SUCCEEDED') {
                    dbStatus = 'active';
                    verified++;
                } else if (status === 'REJECTED' || status === 'REVERTED') {
                    failed++;
                } else {
                    pending++;
                }

                db.prepare(`UPDATE vaults SET status = ? WHERE deposit_tx_hash = ?`).run(dbStatus, txHash);

                results.push({
                    tx_hash: txHash,
                    status,
                    voyager_url: `${VOYAGER_BASE}/${txHash}`,
                });
            } catch {
                pending++;
                results.push({
                    tx_hash: txHash,
                    status: 'PENDING',
                    voyager_url: `${VOYAGER_BASE}/${txHash}`,
                });
            }
        }

        res.status(200).json({
            verified,
            pending,
            failed,
            simulated,
            results,
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Verification failed';
        res.status(500).json({ error: message });
    }
});

// ─── GET /api/audit/verify-all-transactions ───────────────────────────────────
// Judge-facing endpoint: proves every stored tx hash is real on-chain.
router.get('/verify-all-transactions', async (_req: Request, res: Response) => {
    try {
        const rows = db
            .prepare<[], { id: string; tx_hash: string; type: string }>(`
        SELECT id, tx_hash, type FROM transactions ORDER BY timestamp DESC
      `)
            .all();

        let realOnChain = 0;
        let notFoundOnChain = 0;
        let fakeFormatDetected = 0;

        const results: Array<{
            txHash: string;
            type: string;
            format: 'valid' | 'fake';
            status: 'confirmed' | 'not_found' | 'error';
            blockNumber?: number;
        }> = [];

        for (const row of rows) {
            const isValidFormat = TX_HASH_REGEX.test(row.tx_hash);

            if (!isValidFormat) {
                fakeFormatDetected++;
                results.push({
                    txHash: row.tx_hash,
                    type: row.type,
                    format: 'fake',
                    status: 'error',
                });
                continue;
            }

            try {
                const receipt = await StarknetService.getTransactionReceipt(row.tx_hash);
                realOnChain++;
                results.push({
                    txHash: row.tx_hash,
                    type: row.type,
                    format: 'valid',
                    status: 'confirmed',
                    blockNumber: receipt.block_number,
                });
            } catch (e) {
                if (e instanceof TransactionNotFoundError) {
                    notFoundOnChain++;
                    results.push({
                        txHash: row.tx_hash,
                        type: row.type,
                        format: 'valid',
                        status: 'not_found',
                    });
                } else {
                    results.push({
                        txHash: row.tx_hash,
                        type: row.type,
                        format: 'valid',
                        status: 'error',
                    });
                }
            }
        }

        res.json({
            success: true,
            auditedAt: Date.now(),
            total: rows.length,
            realOnChain,
            notFoundOnChain,
            fakeFormatDetected,
            results,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Internal server error',
        });
    }
});

// ─── GET /api/audit/contract-status ──────────────────────────────────────────
router.get('/contract-status', async (_req: Request, res: Response) => {
    try {
        const [vaultReachable, mockBtcReachable, liveBlock] = await Promise.all([
            StarknetService.isContractReachable(config.VAULT_CONTRACT_ADDRESS),
            StarknetService.isContractReachable(config.MOCKBTC_CONTRACT_ADDRESS),
            StarknetService.getLiveBlockNumber(),
        ]);

        // Get MockBTC total supply by calling balanceOf with deployer address —
        // we don't have a totalSupply ABI, so we just report reachability.
        res.json({
            success: true,
            vault: {
                address: config.VAULT_CONTRACT_ADDRESS,
                reachable: vaultReachable,
                lastBlock: liveBlock,
            },
            mockBtc: {
                address: config.MOCKBTC_CONTRACT_ADDRESS,
                reachable: mockBtcReachable,
            },
            network: 'sepolia',
            checkedAt: Date.now(),
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Internal server error',
        });
    }
});

export default router;
