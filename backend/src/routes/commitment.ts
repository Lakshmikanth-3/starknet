/**
 * Commitment Routes — Pedersen commitment + Poseidon nullifier API
 *
 * POST /api/commitment/create   — commit(secret, salt) → commitment + nullifier_hash
 * POST /api/commitment/verify   — verify that (secret, salt) → expectedCommitment
 * GET  /api/commitment/nullifiers — list all commitments (audit)
 * GET  /api/commitment/nullifier/:hash — check if a specific nullifier is used
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CommitmentService } from '../services/CommitmentService';
import { CryptoService } from '../services/CryptoService';
import { StarknetService } from '../services/StarknetService';
import { SharpService } from '../services/SharpService';
import { config } from '../config/env';
import { strictLimiter } from '../middleware/rateLimiters';
import { validateBody } from '../middleware/validateBody';
import { methodNotAllowed } from '../middleware/methodNotAllowed';

export const commitmentRouter = Router();

commitmentRouter.post('/deposit', strictLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const schema = z.object({
            vault_id: z.string().uuid(),
            commitment: z.string().startsWith('0x'),
            amount: z.number().positive(),
            owner_address: z.string().startsWith('0x').optional(),
            bitcoin_txid: z.string().optional(),
            // secret and salt are passed so we can generate the ZK proof
            secret: z.string().optional(),
            salt: z.string().optional(),
            randomness_hint: z.string().optional(),
        });
        const { vault_id, commitment, amount, owner_address, bitcoin_txid, secret, salt, randomness_hint } = schema.parse(req.body);

        // Use provided owner_address or fallback to relayer account address
        const actualOwnerAddress = owner_address || config.STARKNET_ACCOUNT_ADDRESS;

        // GUARD: reject any simulated hashes at entry
        if (commitment.startsWith('SIMULATED')) {
            res.status(400).json({
                error: 'Simulated commitments are not accepted. Use a real commitment.',
                code: 'SIMULATED_REJECTED',
            });
            return;
        }

        // Generate salt and randomness_hint if not provided by client
        const actualSalt = salt || CryptoService.generateSalt();
        const actualRandomnessHint = randomness_hint || CryptoService.generateRandomness();

        // Calculate the nullifier if secret is provided (which it always is from the new UI)
        let actualNullifier = null;
        if (secret) {
            actualNullifier = CryptoService.generateNullifier(commitment, secret);
        }

        // 1. Execute real Starknet deposit (mint sBTC)
        const amountInWei = BigInt(Math.floor(amount * 1e18));
        const encryptedAmount = CryptoService.encryptAmount(amountInWei, actualSalt);
        const txHash = await StarknetService.executeDeposit({
            commitment,
            amount: amountInWei,
            vault_id,
        });

        // 2. CRITICAL: never store if no real hash
        if (!txHash || txHash.startsWith('SIMULATED')) {
            res.status(502).json({
                error: 'Starknet returned no valid transaction hash',
                code: 'TX_HASH_MISSING',
                action: 'Check SEPOLIA_PRIVATE_KEY and account ETH balance',
                faucet: 'https://starknet-faucet.vercel.app',
            });
            return;
        }

        // 3. Wait for transaction confirmation before storing
        console.log(`[DEPOSIT] Waiting for transaction confirmation: ${txHash}`);
        await StarknetService.waitForTransaction(txHash);
        console.log(`[DEPOSIT] Transaction confirmed on Starknet: ${txHash}`);

        // 4. Store both hashes — Starknet + Bitcoin linked with 'active' status
        const dbModule = await import('../db/schema');
        const db = dbModule.default;
        try {
            db.transaction(() => {
                db.prepare(
                    `INSERT INTO vaults (id, owner_address, commitment, encrypted_amount, salt, randomness_hint, lock_duration_days, created_at, unlock_at, status, deposit_tx_hash, bitcoin_txid, nullifier_hash)
                     VALUES (?, ?, ?, ?, ?, ?, 30, ?, ?, 'active', ?, ?, ?)`
                ).run(vault_id, actualOwnerAddress, commitment, encryptedAmount, actualSalt, actualRandomnessHint, Date.now(), Date.now() + 86400, txHash, bitcoin_txid ?? null, actualNullifier);

                db.prepare(
                    `INSERT INTO transactions (id, vault_id, tx_hash, type, amount_encrypted, timestamp)
                     VALUES (?, ?, ?, 'deposit', ?, ?)`
                ).run(vault_id, vault_id, txHash, encryptedAmount, Date.now());
            })();
        } catch (e: any) {
            if (e.message.includes('UNIQUE constraint')) {
                db.transaction(() => {
                    db.prepare(`UPDATE vaults SET deposit_tx_hash = ?, bitcoin_txid = ?, nullifier_hash = COALESCE(nullifier_hash, ?), status = 'active' WHERE id = ?`)
                        .run(txHash, bitcoin_txid ?? null, actualNullifier, vault_id);
                    // Add to transactions on update if it somehow missed
                    try {
                        db.prepare(
                            `INSERT INTO transactions (id, vault_id, tx_hash, type, amount_encrypted, timestamp)
                             VALUES (?, ?, ?, 'deposit', ?, ?)`
                        ).run(vault_id, vault_id, txHash, encryptedAmount, Date.now());
                    } catch { /* Ignore if transaction already exists too */ }
                })();
            } else {
                throw e;
            }
        }

        console.log('[DEPOSIT] Stored vault record with active status:', {
            vault_id,
            tx_hash: txHash,
            bitcoin_txid: bitcoin_txid ?? 'not provided',
            status: 'active'
        });

        // 5. Generate ZK proof (non-blocking background task)
        // Use secret+salt if provided; fall back to a deterministic pair derived from commitment
        let proofJobKey: string | null = null;
        const proofSecret = secret ?? commitment;              // commitment itself as the felt252 secret
        const proofSalt = actualSalt; // Use the actual salt (either provided or generated)

        // Fire-and-forget — we don't await so the HTTP response is instant
        SharpService.submitProof(proofSecret, proofSalt)
            .then(({ jobKey }) => {
                proofJobKey = jobKey;
                console.log(`[ZK PROOF] Generated for vault ${vault_id} — jobKey: ${jobKey}`);
                // Persist proof jobKey to vault record if column exists
                try { db.prepare(`UPDATE vaults SET proof_job_key = ? WHERE id = ?`).run(jobKey, vault_id); } catch { /* column may not exist, safe to ignore */ }
            })
            .catch((err) => {
                console.error(`[ZK PROOF] Failed for vault ${vault_id}:`, err);
            });

        res.status(200).json({
            transaction_hash: txHash,
            status: 'submitted',
            vault_id,
            bitcoin_txid: bitcoin_txid ?? null,
            voyager_url: `https://sepolia.voyager.online/tx/${txHash}`,
            zk_proof_status: 'generating',
            zk_proof_note: 'Scarb 2.12.2 is generating a local Stwo ZK proof in the background. Check /api/sharp/status/{jobKey}.',
            timestamp: new Date().toISOString(),
        });

    } catch (err: unknown) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: (err as any).errors });
            return;
        }
        const message = err instanceof Error ? err.message : 'Deposit failed';
        console.error('[DEPOSIT] Error:', message);

        // Surface funding errors clearly to the frontend
        const isFundingError = message.includes('INSUFFICIENT SEPOLIA ETH');
        res.status(isFundingError ? 402 : 500).json({
            error: message,
            code: isFundingError ? 'INSUFFICIENT_GAS' : 'DEPOSIT_FAILED',
            ...(isFundingError && {
                faucets: [
                    'https://starknet-faucet.vercel.app',
                    'https://blastapi.io/faucets/starknet-testnet-eth',
                ],
                account: process.env.STARKNET_ACCOUNT_ADDRESS,
            }),
        });
    }
});

commitmentRouter.post('/create', strictLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('[commitment/create] body:', req.body);
        console.log('Content-Type:', req.headers['content-type']);

        const { amount, secret } = req.body;

        // Validate presence
        if (!amount || !secret) {
            res.status(400).json({
                error: 'Missing required fields: amount and secret'
            });
            return;
        }

        // Validate amount is a parseable number
        const amountFloat = parseFloat(amount);
        if (isNaN(amountFloat) || amountFloat <= 0) {
            res.status(400).json({
                error: 'Invalid amount: must be a positive number'
            });
            return;
        }

        // Validate secret is a non-empty string
        if (typeof secret !== 'string' || secret.length < 10) {
            res.status(400).json({
                error: 'Invalid secret: must be a hex string'
            });
            return;
        }

        const commitment_hash = CryptoService.generateCommitment(amountFloat.toString(), secret);
        const nullifier_hash = CryptoService.generateNullifier(commitment_hash, secret);

        // API.ts expects success/data wrapper or direct property mapping
        res.status(200).json({
            success: true,
            data: {
                commitment: commitment_hash,
                nullifier_hash
            },
            // Fallbacks for direct access
            commitment: commitment_hash,
            nullifier_hash
        });
    } catch (err: any) {
        console.error('[commitment/create] error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── Verify commitment ────────────────────────────────────────────────────────
commitmentRouter.post('/verify', strictLimiter, validateBody(['secret', 'salt', 'commitment']), (req: Request, res: Response): void => {
    try {
        const schema = z.object({
            secret: z.string().min(1),
            salt: z.string().min(1),
            commitment: z.string().min(1),
        });
        const { secret, salt, commitment } = schema.parse(req.body);

        const verified = CommitmentService.verify(secret, salt, commitment);

        res.json({ success: true, data: { verified } });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err instanceof Error ? err.message : 'Verification failed',
        });
    }
});

// ── List all (audit) ─────────────────────────────────────────────────────────
commitmentRouter.get('/nullifiers', (_req: Request, res: Response): void => {
    const all = CommitmentService.listAll();
    res.json({
        success: true,
        data: all.map(({ id, commitment, nullifier_hash, used, created_at }) => ({
            id, commitment, nullifier_hash, used: used === 1, created_at,
        })),
    });
});

// ── Check single nullifier ────────────────────────────────────────────────────
commitmentRouter.get('/nullifier/:hash', (req: Request, res: Response): void => {
    const nullifier_hash = req.params.hash;
    const record = CommitmentService.getByNullifier(nullifier_hash);
    if (!record) {
        res.json({ success: true, data: { found: false, used: false } });
        return;
    }
    res.json({
        success: true,
        data: {
            found: true,
            commitment: record.commitment,
            nullifier_hash: record.nullifier_hash,
            used: record.used === 1,
            created_at: record.created_at,
        },
    });
});

// methodNotAllowed for POST endpoints
commitmentRouter.all(['/create', '/verify'], methodNotAllowed);
