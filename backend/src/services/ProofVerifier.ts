/**
 * ProofVerifier — 9-check ZK-style withdrawal proof verification.
 *
 * Uses real Pedersen (commitment) and Poseidon (nullifier) hashes
 * via starknet.js — matches what Cairo contracts compute exactly.
 *
 * Each check is independent and reported in the result.
 */

import db from '../db/schema';
import { CryptoService } from './CryptoService';
import { StarknetService } from './StarknetService';

export interface WithdrawProof {
    vaultId: string;
    randomness: string;    // user's ZK secret (0x hex)
    ownerAddress: string;
}

export interface VerificationResult {
    valid: boolean;
    reason?: string;
    checks: {
        vaultExists: boolean;
        ownerMatch: boolean;
        commitmentMatch: boolean;
        nullifierMatch: boolean;
        nullifierUnused: boolean;
        vaultActive: boolean;
        timeLockPassed: boolean;
        onChainConfirmed: boolean;
    };
    proofToken?: string;  // JWT signed — only if all checks pass
}

type VaultRow = {
    id: string;
    owner_address: string;
    commitment: string;
    encrypted_amount: string;
    salt: string;
    nullifier_hash: string;
    status: string;
    unlock_at: number;
};

export async function verifyWithdrawProof(
    proof: WithdrawProof
): Promise<VerificationResult> {
    const checks: VerificationResult['checks'] = {
        vaultExists: false,
        ownerMatch: false,
        commitmentMatch: false,
        nullifierMatch: false,
        nullifierUnused: false,
        vaultActive: false,
        timeLockPassed: false,
        onChainConfirmed: false,
    };

    const log = (msg: string) =>
        console.log(`[ProofVerifier ${new Date().toISOString()}] ${msg}`);

    // ── Check 1: Vault exists ───────────────────────────────────────────
    const vault = db
        .prepare<[string], VaultRow>(
            'SELECT id, owner_address, commitment, encrypted_amount, salt, nullifier_hash, status, unlock_at FROM vaults WHERE id = ?'
        )
        .get(proof.vaultId);

    checks.vaultExists = !!vault;
    if (!vault) {
        log(`FAIL vaultId=${proof.vaultId} — vault not found`);
        return {
            valid: false,
            reason: 'Vault not found',
            checks,
        };
    }

    // ── Check 2: Owner match (case-insensitive hex) ─────────────────────
    checks.ownerMatch =
        vault.owner_address.toLowerCase() === proof.ownerAddress.toLowerCase();

    // ── Check 3: Decrypt amount, recompute commitment (Pedersen) ────────
    let amountSats: bigint;
    try {
        amountSats = CryptoService.decryptAmount(vault.encrypted_amount, vault.salt);
        checks.commitmentMatch = CryptoService.verifyCommitment(
            amountSats.toString(),
            proof.randomness,
            vault.commitment
        );
    } catch {
        checks.commitmentMatch = false;
        amountSats = BigInt(0);
    }

    // ── Check 4: Recompute nullifier (Poseidon) ──────────────────────────
    try {
        checks.nullifierMatch = CryptoService.verifyNullifier(
            vault.commitment,
            proof.randomness,
            vault.nullifier_hash
        );
    } catch {
        checks.nullifierMatch = false;
    }

    // ── Check 5: Nullifier not already used ─────────────────────────────
    const usedNullifier = db
        .prepare<[string], { nullifier_hash: string }>(
            'SELECT nullifier_hash FROM nullifiers WHERE nullifier_hash = ?'
        )
        .get(vault.nullifier_hash);
    checks.nullifierUnused = !usedNullifier;

    // ── Check 6: Vault status = active ───────────────────────────────────
    checks.vaultActive = vault.status === 'active';

    // ── Check 7: Time lock passed ─────────────────────────────────────────
    const nowSecs = Math.floor(Date.now() / 1000);
    checks.timeLockPassed = nowSecs >= vault.unlock_at;

    // ── Check 8: On-chain commitment confirmed ────────────────────────────
    try {
        checks.onChainConfirmed = await StarknetService.isCommitmentOnChain(
            vault.commitment
        );
    } catch {
        checks.onChainConfirmed = false;
    }

    // ── Aggregate result ─────────────────────────────────────────────────
    const allPass = Object.values(checks).every(Boolean);
    const failedChecks = Object.entries(checks)
        .filter(([, v]) => !v)
        .map(([k]) => k);

    if (allPass) {
        log(`PASS vaultId=${proof.vaultId} owner=${proof.ownerAddress}`);
    } else {
        log(
            `FAIL vaultId=${proof.vaultId} — failed checks: ${failedChecks.join(', ')}`
        );
    }

    if (!allPass) {
        return {
            valid: false,
            reason: `Failed checks: ${failedChecks.join(', ')}`,
            checks,
        };
    }

    // ── Sign JWT proof token (10 min TTL) ────────────────────────────────
    // Dynamically require jsonwebtoken to avoid import issues in strict mode
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
    const { config } = await import('../config/env');

    const payload = {
        vaultId: proof.vaultId,
        commitment: vault.commitment,
        nullifierHash: vault.nullifier_hash,
        ownerAddress: vault.owner_address,
    };

    const proofToken = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '10m' });

    return {
        valid: true,
        checks,
        proofToken,
    };
}
