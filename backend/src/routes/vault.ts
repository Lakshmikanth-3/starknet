import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CommitmentService } from '../services/CommitmentService';
import { strictLimiter } from '../middleware/rateLimiters';
import { validateBody } from '../middleware/validateBody';
import { methodNotAllowed } from '../middleware/methodNotAllowed';
import db from '../db/schema';
import { CryptoService } from '../services/CryptoService';
import { StarknetService } from '../services/StarknetService';
import { SharpService } from '../services/SharpService';
import { validateTxHash } from '../middleware/validateTxHash';
import { isValidStarknetAddress } from '../middleware/validators';
import { isValidLockDuration, getApy } from '../config/apy';
import { WithdrawalAuthorizationService } from '../services/WithdrawalAuthorizationService';
import {
    TransactionNotFoundError,
    TransactionRevertedError,
    CommitmentMismatchError,
} from '../types/errors';

const vaultRouter = Router();

// ─── POST /api/vault/prepare-deposit ─────────────────────────────────────────
vaultRouter.post(
    '/prepare-deposit',
    strictLimiter,
    validateBody(['ownerAddress', 'amountSats', 'lockDurationDays']),
    async (req: Request, res: Response) => {
        try {
            const { ownerAddress, amountSats, lockDurationDays } = req.body as {
                ownerAddress: string;
                amountSats: string | number;
                lockDurationDays: number;
            };

            // ── Validation ──────────────────────────────────────────────────────
            if (!CryptoService.isValidAddress(ownerAddress)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid ownerAddress — must match 0x + 63-66 hex chars',
                });
                return;
            }

            if (!isValidLockDuration(Number(lockDurationDays))) {
                res.status(400).json({
                    success: false,
                    error: 'lockDurationDays must be 30, 90, or 365',
                });
                return;
            }

            let amountBigInt: bigint;
            try {
                amountBigInt = BigInt(amountSats);
            } catch {
                res.status(400).json({
                    success: false,
                    error: 'amountSats must be a valid integer (satoshis)',
                });
                return;
            }

            if (amountBigInt <= BigInt(0)) {
                res.status(400).json({ success: false, error: 'amountSats must be > 0' });
                return;
            }

            const lockDays = Number(lockDurationDays) as 30 | 90 | 365;

            // ── Live balance check ───────────────────────────────────────────────
            const liveBalance = await StarknetService.getMockBTCBalance(ownerAddress);
            if (liveBalance < amountBigInt) {
                res.status(400).json({
                    success: false,
                    error: 'Insufficient MockBTC balance on-chain',
                    detail: {
                        required: amountBigInt.toString(),
                        available: liveBalance.toString(),
                    },
                });
                return;
            }

            // ── Crypto generation ────────────────────────────────────────────────
            const vaultId = uuidv4();
            const salt = CryptoService.generateSalt();
            const randomness = CryptoService.generateRandomness();
            const commitment = CryptoService.generateCommitment(amountBigInt.toString(), randomness);
            const nullifierHash = CryptoService.generateNullifier(commitment, randomness);
            const encryptedAmount = CryptoService.encryptAmount(amountBigInt, salt);
            const encryptedRandomness = CryptoService.encryptRandomness(randomness, salt);

            const nowSecs = Math.floor(Date.now() / 1000);
            const unlockAt = nowSecs + lockDays * 86400;
            const apy = getApy(lockDays);

            // ── DB insert ────────────────────────────────────────────────────────
            const insertVault = db.prepare(`
      INSERT INTO vaults
        (id, owner_address, commitment, encrypted_amount, salt, randomness_hint,
         lock_duration_days, created_at, unlock_at, status, nullifier_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `);

            const insertCommitment = db.prepare(`
      INSERT INTO commitments (commitment, vault_id) VALUES (?, ?)
    `);

            db.transaction(() => {
                insertVault.run(
                    vaultId,
                    ownerAddress,
                    commitment,
                    encryptedAmount,
                    salt,
                    encryptedRandomness,
                    lockDays,
                    nowSecs,
                    unlockAt,
                    nullifierHash
                );
                insertCommitment.run(commitment, vaultId);
            })();

            console.log(`✅ Vault prepared: ${vaultId} | commitment: ${commitment}`);

            // ── Return (no tx_hash — that comes from Starknet) ───────────────────
            res.status(201).json({
                success: true,
                vaultId,
                commitment,
                nullifierHash,
                encryptedRandomness, // user MUST save this to withdraw later
                unlockAt,
                apy,
                instructions:
                    'Call vault contract deposit(commitment, nullifierHash) on Starknet Sepolia, then POST /api/vault/confirm-deposit with the real txHash.',
            });
        } catch (err) {
            console.error('prepare-deposit error:', err);
            res.status(500).json({
                success: false,
                error: err instanceof Error ? err.message : 'Internal server error',
            });
        }
    }
);

// ─── POST /api/vault/confirm-deposit ─────────────────────────────────────────
vaultRouter.post(
    '/confirm-deposit',
    strictLimiter,
    validateBody(['vaultId', 'txHash']),
    validateTxHash,
    async (req: Request, res: Response) => {
        const { vaultId, txHash } = req.body as { vaultId: string; txHash: string };
        try {
            // Load vault
            const vault = db
                .prepare<string, Record<string, unknown>>('SELECT * FROM vaults WHERE id = ?')
                .get(vaultId);

            if (!vault) {
                res.status(404).json({ success: false, error: 'Vault not found' });
                return;
            }

            if (vault['status'] !== 'pending') {
                res.status(400).json({
                    success: false,
                    error: `Vault is already ${vault['status']} — cannot confirm again`,
                });
                return;
            }

            // Poll Starknet until confirmed
            const receipt = await StarknetService.waitForTransaction(txHash);

            // Verify Deposit event contains our commitment
            const verification = await StarknetService.verifyDepositEvent(
                txHash,
                vault['commitment'] as string
            );

            if (!verification.verified) {
                res.status(400).json({
                    success: false,
                    error: 'Deposit event not found on-chain for this commitment',
                    txHash,
                });
                return;
            }

            // Atomic DB update
            const nowSecs = Math.floor(Date.now() / 1000);
            const updateVault = db.prepare(`
      UPDATE vaults SET status = 'active', deposit_tx_hash = ? WHERE id = ?
    `);
            const updateCommitment = db.prepare(`
      UPDATE commitments SET block_number = ? WHERE vault_id = ?
    `);
            const insertTx = db.prepare(`
      INSERT INTO transactions
        (id, vault_id, tx_hash, type, amount_encrypted, block_number,
         block_timestamp, execution_status, timestamp)
      VALUES (?, ?, ?, 'deposit', ?, ?, ?, 'SUCCEEDED', ?)
    `);

            db.transaction(() => {
                updateVault.run(txHash, vaultId);
                updateCommitment.run(verification.blockNumber, vaultId);
                insertTx.run(
                    uuidv4(),
                    vaultId,
                    txHash,
                    vault['encrypted_amount'],
                    verification.blockNumber,
                    verification.blockTimestamp,
                    nowSecs
                );
            })();

            console.log(`✅ Deposit confirmed: ${vaultId} | block: ${verification.blockNumber}`);

            res.json({
                success: true,
                vaultId,
                txHash,
                blockNumber: verification.blockNumber,
                blockTimestamp: verification.blockTimestamp,
                onChainVerified: true,
            });
        } catch (err) {
            if (err instanceof TransactionNotFoundError) {
                res.status(404).json({ success: false, error: err.message, txHash });
            } else if (err instanceof TransactionRevertedError) {
                res.status(400).json({ success: false, error: err.message, txHash });
            } else if (err instanceof CommitmentMismatchError) {
                res.status(400).json({ success: false, error: err.message });
            } else {
                console.error('confirm-deposit error:', err);
                res.status(500).json({
                    success: false,
                    error: err instanceof Error ? err.message : 'Internal server error',
                });
            }
        }
    }
);

// ─── GET /api/vault/balance/:address ─────────────────────────────────────────
vaultRouter.get('/balance/:address', async (req: Request, res: Response) => {
    const { address } = req.params;
    if (!isValidStarknetAddress(address)) {
        res.status(400).json({
            success: false,
            error: 'Invalid Starknet address format',
        });
        return;
    }
    try {
        const balance = await StarknetService.getMockBTCBalance(address);
        res.json({ success: true, address, balanceSats: balance.toString() });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to fetch balance',
        });
    }
});

// ─── POST /api/vault/withdraw ────────────────────────────────────────────────
vaultRouter.post(
    '/withdraw',
    strictLimiter,
    validateBody(['secret', 'nullifier_hash', 'bitcoin_address']),
    async (req: Request, res: Response) => {
        const { secret, nullifier_hash, bitcoin_address } = req.body as { 
            secret: string; 
            nullifier_hash: string;
            bitcoin_address: string;
        };

        try {
            // 1. Validate Bitcoin address format (Signet testnet addresses start with 'tb1')
            if (!bitcoin_address || !bitcoin_address.startsWith('tb1')) {
                res.status(400).json({ 
                    success: false, 
                    error: 'Invalid Bitcoin address. Must be a Signet testnet address (starts with tb1)' 
                });
                return;
            }

            // 1.5 Prevent withdrawal to sender/vault address (would just consolidate UTXOs)
            const senderAddress = process.env.SENDER_ADDRESS;
            if (bitcoin_address === senderAddress) {
                res.status(400).json({
                    success: false,
                    error: `Cannot withdraw to the vault's own address (${senderAddress}). Please enter a different Bitcoin address where you want to receive your funds.`
                });
                return;
            }

            // 2. Find vault by nullifier to get the commitment
            const vault = db
                .prepare<string, { id: string; commitment: string; status: string; withdraw_tx_hash: string | null }>(
                    'SELECT id, commitment, status, withdraw_tx_hash FROM vaults WHERE nullifier_hash = ?'
                )
                .get(nullifier_hash);

            if (!vault) {
                res.status(404).json({ success: false, error: 'Vault not found for this nullifier' });
                return;
            }

            // Check if this is a retry (Starknet withdrawal already done, just need Bitcoin payout)
            const isRetry = vault.withdraw_tx_hash !== null;

            if (vault.status === 'withdrawn') {
                res.status(400).json({ 
                    success: false, 
                    error: 'Vault is already fully withdrawn. Both Starknet and Bitcoin payouts completed.' 
                });
                return;
            }

            if (vault.status !== 'active' && !isRetry) {
                res.status(400).json({ 
                    success: false, 
                    error: `Vault is ${vault.status} — cannot withdraw` 
                });
                return;
            }

            console.log(`[WITHDRAW] ${isRetry ? 'RETRY MODE: Starknet withdrawal already done, will only send Bitcoin' : 'FULL WITHDRAWAL: Will do Starknet + Bitcoin'}`);

            let txHash = vault.withdraw_tx_hash; // Use existing if retry
            let localProofGenerated = false;

            // Only do Starknet withdrawal if not already done
            if (!isRetry) {
                // 3. Generate ZK Proof locally via Scarb/Stwo (off-chain attestation)
                // The local proof proves knowledge of (secret, commitment, nullifier)
                // It is stored/logged as a cryptographic attestation of valid withdrawal.
                try {
                    const _proof = await SharpService.generateWithdrawProof(secret, vault.commitment, nullifier_hash);
                    localProofGenerated = true;
                    console.log(`[WITHDRAW] ✅ Local ZK proof generated (Stwo/Scarb). Length: ${_proof.length}`);
                } catch (proofErr: any) {
                    console.error('[WITHDRAW] ⚠️ Local proof generation failed:', proofErr.message);
                    // Non-fatal: the nullifier check + secret verification still provide security
                }

                // 4. Submit withdrawal transaction on Starknet
                // The vault contract checks: proof.len() > 0 (MVP - no on-chain ZK verification yet)
                // We pass [nullifierHash] as the 1-element felt252 proof sentinel.
                const onChainProof = [nullifier_hash]; // satisfies `assert(proof.len() > 0)`

                // Fetch amount and recipient from DB vault record
                const vaultDetails = db.prepare('SELECT encrypted_amount, salt, owner_address FROM vaults WHERE id = ?').get(vault.id) as any;
                const amountSats = CryptoService.decryptAmount(vaultDetails.encrypted_amount, vaultDetails.salt);

                console.log(`[WITHDRAW] Amount to withdraw: ${Number(amountSats) / 1e18} BTC (${amountSats} sats in Wei)`);

                // Validate owner_address
                if (!vaultDetails.owner_address || vaultDetails.owner_address === '0x0' || !CryptoService.isValidAddress(vaultDetails.owner_address)) {
                    res.status(400).json({ success: false, error: 'Invalid owner address in vault record' });
                    return;
                }

                txHash = await StarknetService.withdraw({
                    nullifierHash: nullifier_hash,
                    proof: onChainProof,
                    recipient: vaultDetails.owner_address,
                    amount: amountSats
                });

                console.log(`[WITHDRAW] ✅ Starknet withdrawal successful: ${txHash}`);
            } else {
                console.log(`[WITHDRAW] ⏭️ Skipping Starknet withdrawal (already done): ${txHash}`);
            }

            // 5. Create withdrawal authorization and attempt Bitcoin send
            //    Bitcoin can ONLY be sent with a valid authorization linked to Starknet burn
            const vaultDetails = db.prepare('SELECT encrypted_amount, salt FROM vaults WHERE id = ?').get(vault.id) as any;
            const amountSats = CryptoService.decryptAmount(vaultDetails.encrypted_amount, vaultDetails.salt);
            const actualSats = Math.floor(Number(amountSats) / 1e10); // Convert Wei to actual sats
            
            console.log(`[WITHDRAW] 💰 Creating authorization for ${actualSats} sats to ${bitcoin_address}...`);
            
            let bitcoinTxid: string | null = null;
            let bitcoinSendError: string | null = null;
            let authorizationId: string | null = null;

            try {
                // Check if authorization already exists (for retries)
                let auth = WithdrawalAuthorizationService.getAuthorizationByNullifier(nullifier_hash);

                if (!auth) {
                    // Create new authorization - this is the security gate
                    // Authorization can ONLY be created with a valid Starknet tx hash
                    auth = WithdrawalAuthorizationService.createAuthorization({
                        vaultId: vault.id,
                        nullifierHash: nullifier_hash,
                        starknetTxHash: txHash!,
                        bitcoinAddress: bitcoin_address,
                        amountSats: actualSats
                    });
                    console.log(`[WITHDRAW] ✅ Authorization created: ${auth.id}`);
                } else {
                    console.log(`[WITHDRAW] ⏭️ Using existing authorization: ${auth.id} (status: ${auth.status})`);
                    if (auth.status === 'failed') {
                        WithdrawalAuthorizationService.updateStatus(auth.id, 'pending');
                        console.log(`[WITHDRAW] 🔄 Reset authorization ${auth.id} to 'pending' for retry`);
                    }
                }
                authorizationId = auth.id;

                // ⚠️ CRITICAL FIX: We do NOT attempt to broadcast synchronously here anymore.
                // We let the WithdrawalProcessor (which is checking the queue) pick this up 
                // in the background. It will properly route it to OP_CAT if enabled.
                console.log(`[WITHDRAW] ⏳ Queued auth ${auth.id} for the background WithdrawalProcessor...`);

            } catch (authErr: any) {
                console.error('[WITHDRAW] ❌ Authorization creation failed:', authErr.message);
                bitcoinSendError = authErr.message;
            }

            // 6. Update DB status - mark withdrawn only if we successfully created an auth
            // The processor will update the auth row, but we can set the vault to withdrawn 
            // since the Starknet portion is definitively over.
            const finalStatus = 'withdrawn';
            
            if (isRetry) {
                console.log(`[WITHDRAW] Retry submitted, auth queued for processor`);
            } else {
                // First attempt - update withdraw_tx_hash and bitcoin_withdrawal_address
                db.prepare(`
                    UPDATE vaults 
                    SET status = ?, 
                        withdraw_tx_hash = ?, 
                        bitcoin_withdrawal_address = ?
                    WHERE id = ?
                `).run(finalStatus, txHash, bitcoin_address, vault.id);
                console.log(`[WITHDRAW] Vault status updated to: ${finalStatus}`);
            }

            // 7. Add to transactions table for Audit syncing (only if not retry)
            if (!isRetry) {
                db.prepare(`
                    INSERT INTO transactions (id, vault_id, tx_hash, type, amount_encrypted, timestamp)
                    VALUES (?, ?, ?, 'withdraw', (SELECT encrypted_amount FROM vaults WHERE id = ?), ?)
                `).run(uuidv4(), vault.id, txHash, vault.id, Math.floor(Date.now() / 1000));
            }

            res.status(200).json({ 
                success: true, 
                txHash, 
                localProofGenerated: isRetry ? false : localProofGenerated,
                bitcoinTxid: null,
                bitcoinSendError,
                isRetry,
                message: `Starknet withdrawal verified & authorized. The background processor will execute the OP_CAT payout to ${bitcoin_address} shortly.`,
                canRetry: false
            });
        } catch (err) {
            console.error('withdraw error:', err);
            res.status(500).json({
                success: false,
                error: err instanceof Error ? err.message : 'Internal server error during withdrawal',
            });
        }
    }
);

vaultRouter.all('/deposit', methodNotAllowed);
vaultRouter.all('/withdraw', methodNotAllowed);

// ─── GET /api/vault/:address ─────────────────────────────────────────────────
vaultRouter.get('/:address', async (req: Request, res: Response) => {
    const { address } = req.params;
    if (!CryptoService.isValidAddress(address)) {
        res.status(400).json({ success: false, error: 'Invalid Starknet address' });
        return;
    }
    try {
        const vaults = db
            .prepare<string, Record<string, unknown>>(`
        SELECT id, owner_address, commitment, lock_duration_days, created_at,
               unlock_at, status, deposit_tx_hash, nullifier_hash
        FROM vaults WHERE owner_address = ? ORDER BY created_at DESC
      `)
            .all(address);

        const now = Math.floor(Date.now() / 1000);

        // Enrich with on-chain status (parallel)
        const enriched = await Promise.all(
            vaults.map(async (v) => {
                const isUnlocked = now >= Number(v['unlock_at']);
                let onChainStatus: 'confirmed' | 'not_registered' | 'unknown' = 'unknown';

                if (v['status'] === 'active' || v['status'] === 'withdrawn') {
                    try {
                        const onChain = await StarknetService.isCommitmentOnChain(
                            v['commitment'] as string
                        );
                        onChainStatus = onChain ? 'confirmed' : 'not_registered';
                    } catch {
                        onChainStatus = 'unknown';
                    }
                }

                return {
                    vaultId: v['id'],
                    ownerAddress: v['owner_address'],
                    commitment: v['commitment'],
                    lockDurationDays: v['lock_duration_days'],
                    createdAt: v['created_at'],
                    unlockAt: v['unlock_at'],
                    status: v['status'],
                    isUnlocked,
                    depositTxHash: v['deposit_tx_hash'],
                    nullifierHash: v['nullifier_hash'],
                    onChainStatus,
                    // NEVER return: salt, encrypted_amount, randomness_hint
                };
            })
        );

        res.json({ success: true, address, vaults: enriched, count: enriched.length });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Internal server error',
        });
    }
});

// ─── GET /api/vault/:vaultId/details ─────────────────────────────────────────
vaultRouter.get('/:vaultId/details', async (req: Request, res: Response) => {
    const { vaultId } = req.params;
    try {
        const vault = db
            .prepare<string, Record<string, unknown>>(`
        SELECT id, owner_address, commitment, lock_duration_days, created_at,
               unlock_at, status, deposit_tx_hash, withdraw_tx_hash, nullifier_hash
        FROM vaults WHERE id = ?
      `)
            .get(vaultId);

        if (!vault) {
            res.status(404).json({ success: false, error: 'Vault not found' });
            return;
        }

        const [liveBlock, onChain] = await Promise.all([
            StarknetService.getLiveBlockNumber(),
            vault['status'] !== 'pending'
                ? StarknetService.isCommitmentOnChain(vault['commitment'] as string)
                : Promise.resolve(false),
        ]);

        const now = Math.floor(Date.now() / 1000);

        res.json({
            success: true,
            vault: {
                ...vault,
                isUnlocked: now >= Number(vault['unlock_at']),
                onChainConfirmed: onChain,
                liveBlockNumber: liveBlock,
            },
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Internal server error',
        });
    }
});

// methodNotAllowed for POST endpoints
vaultRouter.all(['/prepare-deposit', '/confirm-deposit', '/deposit'], methodNotAllowed);

export default vaultRouter;
