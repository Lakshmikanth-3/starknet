import Database from 'better-sqlite3';
import { CryptoService } from './CryptoService';
import { v4 as uuidv4 } from 'uuid';
import { CreateVaultParams, WithdrawParams, VaultResponse } from '../types';
import { APY_RATES, MIN_DEPOSIT_AMOUNT, MAX_DEPOSIT_AMOUNT, VALID_LOCK_PERIODS, VAULT_STATUS, TX_TYPES } from '../utils/constants';

export class VaultService {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    /**
     * Create a new vault with deposit
     */
    async createVault(params: CreateVaultParams) {
        const { userAddress, amount, lockPeriod } = params;

        // Validate amount
        if (amount < MIN_DEPOSIT_AMOUNT || amount > MAX_DEPOSIT_AMOUNT) {
            throw new Error(`Amount must be between ${MIN_DEPOSIT_AMOUNT} and ${MAX_DEPOSIT_AMOUNT} BTC`);
        }

        // Validate lock period
        if (!VALID_LOCK_PERIODS.includes(lockPeriod as any)) {
            throw new Error(`Invalid lock period. Must be one of: ${VALID_LOCK_PERIODS.join(', ')} days`);
        }

        // Generate vault data
        const vaultId = uuidv4();
        const randomness = CryptoService.generateRandomness();
        const commitment = CryptoService.generateCommitment(amount, randomness, userAddress);
        const createdAt = Date.now();
        const unlockAt = createdAt + (lockPeriod * 24 * 60 * 60 * 1000);
        const apy = APY_RATES[lockPeriod as keyof typeof APY_RATES];

        // Insert vault
        const insertVault = this.db.prepare(`
      INSERT INTO vaults (vault_id, user_address, commitment, lock_period, created_at, unlock_at, status, apy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

        insertVault.run(
            vaultId,
            userAddress,
            commitment,
            lockPeriod,
            createdAt,
            unlockAt,
            VAULT_STATUS.LOCKED,
            apy
        );

        // Store commitment details
        const insertCommitment = this.db.prepare(`
      INSERT INTO commitments (vault_id, commitment, randomness, amount, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

        insertCommitment.run(vaultId, commitment, randomness, amount, createdAt);

        // Log deposit transaction
        const txHash = CryptoService.generateTxHash();
        const insertTx = this.db.prepare(`
      INSERT INTO transactions (vault_id, tx_type, tx_hash, amount, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

        insertTx.run(vaultId, TX_TYPES.DEPOSIT, txHash, amount, createdAt);

        return {
            vaultId,
            commitment,
            randomness,
            unlockAt,
            apy,
            txHash,
            message: 'Vault created successfully. Your balance is now encrypted. SAVE YOUR RANDOMNESS - you will need it for withdrawal!'
        };
    }

    /**
     * Get all vaults for a user
     */
    getUserVaults(userAddress: string): VaultResponse[] {
        const query = this.db.prepare(`
      SELECT 
        v.vault_id,
        v.commitment,
        v.lock_period,
        v.created_at,
        v.unlock_at,
        v.status,
        v.apy,
        v.is_withdrawn,
        c.amount,
        c.randomness
      FROM vaults v
      LEFT JOIN commitments c ON v.vault_id = c.vault_id
      WHERE v.user_address = ?
      ORDER BY v.created_at DESC
    `);

        const vaults = query.all(userAddress) as any[];

        return vaults.map(vault => {
            const now = Date.now();
            const isUnlocked = now >= vault.unlock_at;
            const daysRemaining = Math.max(0, Math.ceil((vault.unlock_at - now) / (24 * 60 * 60 * 1000)));

            // Calculate projected yield
            const daysLocked = vault.lock_period;
            const projectedYield = vault.amount * vault.apy * (daysLocked / 365);
            const totalWithdrawal = vault.amount + projectedYield;

            // Determine actual status
            let status = vault.status;
            if (!vault.is_withdrawn && isUnlocked) {
                status = VAULT_STATUS.UNLOCKED;
            }

            return {
                vaultId: vault.vault_id,
                commitment: vault.commitment,
                lockPeriod: vault.lock_period,
                createdAt: vault.created_at,
                unlockAt: vault.unlock_at,
                status,
                apy: vault.apy,
                daysRemaining,
                amount: vault.amount,
                projectedYield: projectedYield.toFixed(8),
                totalWithdrawal: totalWithdrawal.toFixed(8)
            };
        });
    }

    /**
     * Withdraw from vault with ZK proof
     */
    async withdrawFromVault(params: WithdrawParams) {
        const { vaultId, proof, userAddress } = params;

        // Get vault
        const getVault = this.db.prepare(`
      SELECT v.*, c.amount, c.randomness
      FROM vaults v
      LEFT JOIN commitments c ON v.vault_id = c.vault_id
      WHERE v.vault_id = ? AND v.user_address = ?
    `);

        const vault = getVault.get(vaultId, userAddress) as any;

        if (!vault) {
            throw new Error('Vault not found or unauthorized');
        }

        // Check if already withdrawn
        if (vault.is_withdrawn) {
            throw new Error('Vault already withdrawn (nullifier exists)');
        }

        // Check if unlocked
        const now = Date.now();
        if (now < vault.unlock_at) {
            const unlockDate = new Date(vault.unlock_at).toISOString();
            const daysRemaining = Math.ceil((vault.unlock_at - now) / (24 * 60 * 60 * 1000));
            throw new Error(`Vault is still locked. Unlocks in ${daysRemaining} days (${unlockDate})`);
        }

        // Verify ZK proof (simulated)
        const isValidProof = CryptoService.verifyProof(proof, [vaultId]);
        if (!isValidProof) {
            throw new Error('Invalid ZK proof');
        }

        // Calculate final amount
        const daysLocked = vault.lock_period;
        const yield_ = vault.amount * vault.apy * (daysLocked / 365);
        const totalAmount = vault.amount + yield_;

        // Update vault status (set nullifier)
        const updateVault = this.db.prepare(`
      UPDATE vaults
      SET status = ?, is_withdrawn = 1, withdrawn_at = ?
      WHERE vault_id = ?
    `);

        updateVault.run(VAULT_STATUS.WITHDRAWN, now, vaultId);

        // Log withdrawal transaction
        const txHash = CryptoService.generateTxHash();
        const insertTx = this.db.prepare(`
      INSERT INTO transactions (vault_id, tx_type, tx_hash, amount, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

        insertTx.run(vaultId, TX_TYPES.WITHDRAW, txHash, totalAmount, now);

        return {
            success: true,
            vaultId,
            principal: vault.amount,
            yield: yield_.toFixed(8),
            totalAmount: totalAmount.toFixed(8),
            txHash,
            message: 'Withdrawal successful. BTC sent to your wallet.'
        };
    }

    /**
     * Get vault statistics
     */
    getStats() {
        const totalVaults = this.db.prepare('SELECT COUNT(*) as count FROM vaults').get() as any;
        const totalLocked = this.db.prepare(`
      SELECT SUM(amount) as total 
      FROM commitments c 
      JOIN vaults v ON c.vault_id = v.vault_id 
      WHERE v.is_withdrawn = 0
    `).get() as any;
        const totalWithdrawn = this.db.prepare('SELECT COUNT(*) as count FROM vaults WHERE is_withdrawn = 1').get() as any;

        return {
            totalVaults: totalVaults.count,
            activeVaults: totalVaults.count - totalWithdrawn.count,
            totalValueLocked: (totalLocked.total || 0).toFixed(8),
            totalWithdrawals: totalWithdrawn.count
        };
    }
}
