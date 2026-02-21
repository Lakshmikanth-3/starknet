import { Router, Request, Response } from 'express';
import db from '../db/schema';
import { StarknetService } from '../services/StarknetService';
import { config } from '../config/env';
import { TransactionNotFoundError } from '../types/errors';

const router = Router();

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{63,64}$/;

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
