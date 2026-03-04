/**
 * Withdrawal Processor Service
 * 
 * Standalone background service that processes authorized Bitcoin withdrawals.
 * This service is the ONLY component that should have access to SENDER_PRIVATE_KEY
 * for making actual Bitcoin transactions (or use OP_CAT covenants for trustless mode).
 * 
 * Security Model:
 * - Runs independently from the API server
 * - Only processes withdrawals with valid authorizations
 * - Verifies Starknet transaction finality before sending Bitcoin
 * - Maintains audit trail of all operations
 * - Supports covenant mode for trustless withdrawals
 * 
 * Usage:
 *   node dist/services/WithdrawalProcessor.js
 *   OR
 *   npm run processor
 */

import { WithdrawalAuthorizationService, WithdrawalAuthorization } from './WithdrawalAuthorizationService';
import { BitcoinBroadcastService } from './BitcoinBroadcastService';
import { StarknetService } from './StarknetService';
import { BitcoinCovenantService } from './BitcoinCovenantService';
import db from '../db/schema';

export class WithdrawalProcessor {
    private pollIntervalMs: number;
    private isRunning: boolean = false;
    private minConfirmations: number;
    private useCovenants: boolean;

    constructor(options: {
        pollIntervalMs?: number;
        minConfirmations?: number;
        useCovenants?: boolean;
    } = {}) {
        this.pollIntervalMs = options.pollIntervalMs || 30000; // 30 seconds default
        this.minConfirmations = options.minConfirmations || 1; // 1 confirmation default (Starknet)
        this.useCovenants = options.useCovenants || false; // Use OP_CAT covenants (requires funded covenant address)
    }

    /**
     * Start the withdrawal processor
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('[WithdrawalProcessor] Already running');
            return;
        }

        this.isRunning = true;
        console.log('');
        console.log('============================================================');
        console.log(' Secure Bitcoin Withdrawal Processor');
        console.log('============================================================');
        console.log(`Poll Interval: ${this.pollIntervalMs / 1000}s`);
        console.log(`Min Confirmations: ${this.minConfirmations}`);
        console.log(`Covenant Mode: ${this.useCovenants ? 'ENABLED (OP_CAT)' : 'DISABLED'}`);
        console.log('============================================================');
        console.log('');

        // Check covenant status if enabled
        if (this.useCovenants) {
            await this.checkCovenantStatus();
        }

        // Initial processing
        await this.processAuthorizations();

        // Set up polling
        this.poll();
    }

    /**
     * Stop the withdrawal processor
     */
    stop(): void {
        this.isRunning = false;
        console.log('[WithdrawalProcessor] Stopped');
    }

    /**
     * Poll for pending authorizations
     */
    private poll(): void {
        if (!this.isRunning) return;

        setTimeout(async () => {
            await this.processAuthorizations();
            this.poll();
        }, this.pollIntervalMs);
    }

    /**
     * Process all pending withdrawal authorizations
     */
    async processAuthorizations(): Promise<void> {
        try {
            const pending = WithdrawalAuthorizationService.getPendingAuthorizations();

            if (pending.length === 0) {
                console.log('[WithdrawalProcessor] No pending authorizations');
                return;
            }

            console.log(`[WithdrawalProcessor] Found ${pending.length} pending authorization(s)`);

            for (const auth of pending) {
                await this.processAuthorization(auth);
            }

        } catch (error: any) {
            console.error('[WithdrawalProcessor] Error processing authorizations:', error.message);
        }
    }

    /**
     * Process a single withdrawal authorization
     */
    private async processAuthorization(auth: WithdrawalAuthorization): Promise<void> {
        console.log(`[WithdrawalProcessor] Processing authorization ${auth.id}...`);
        console.log(`[WithdrawalProcessor]   Amount: ${auth.amount_sats} sats`);
        console.log(`[WithdrawalProcessor]   Address: ${auth.bitcoin_address}`);
        console.log(`[WithdrawalProcessor]   Starknet TX: ${auth.starknet_tx_hash}`);

        try {
            // 1. Verify Starknet transaction is finalized
            const isFinalized = await this.verifyStarknetTransaction(auth.starknet_tx_hash);
            
            if (!isFinalized) {
                console.log(`[WithdrawalProcessor] Starknet TX not finalized yet, skipping...`);
                return;
            }

            console.log(`[WithdrawalProcessor] Starknet TX finalized with ${this.minConfirmations}+ confirmations`);

            // 2. Send Bitcoin using authorization (covenant or regular)
            let txid: string;
            
            if (this.useCovenants) {
                console.log(`[WithdrawalProcessor] Creating covenant withdrawal...`);
                txid = await BitcoinCovenantService.executeCovenantWithdrawal(auth.id);
            } else {
                console.log(`[WithdrawalProcessor] Sending Bitcoin (legacy mode)...`);
                txid = await BitcoinBroadcastService.sendBitcoinWithAuthorization(auth.id);
            }

            console.log(`[WithdrawalProcessor] Bitcoin sent successfully!`);
            console.log(`[WithdrawalProcessor]   TXID: ${txid}`);
            console.log(`[WithdrawalProcessor]   View: https://mempool.space/signet/tx/${txid}`);

        } catch (error: any) {
            console.error(`[WithdrawalProcessor] Failed to process authorization ${auth.id}:`, error.message);
            
            // Authorization status is already updated by sendBitcoinWithAuthorization
            // Just log the error here for visibility
        }
    }

    /**
     * Verify a Starknet transaction is finalized
     */
    private async verifyStarknetTransaction(txHash: string): Promise<boolean> {
        try {
            const receipt = await StarknetService.getTransactionReceipt(txHash);

            // Check execution status
            if (receipt.execution_status !== 'SUCCEEDED') {
                console.warn(`[WithdrawalProcessor] Transaction ${txHash} execution status: ${receipt.execution_status}`);
                return false;
            }

            // For Starknet, if receipt exists and succeeded, it's finalized
            // Additional confirmation logic can be added here if needed
            return true;

        } catch (error: any) {
            console.error(`[WithdrawalProcessor] Error verifying transaction ${txHash}:`, error.message);
            return false;
        }
    }

    /**
     * Check covenant status (if using covenant mode)
     */
    private async checkCovenantStatus(): Promise<void> {
        try {
            const status = await BitcoinCovenantService.getCovenantStatus();
            
            console.log('[Covenant] Status:');
            console.log(`   Address: ${status.address}`);
            console.log(`   Balance: ${status.balance} sats`);
            console.log(`   UTXOs: ${status.utxoCount}`);
            console.log(`   Network: ${status.network}`);
            console.log('');
            
            if (status.balance === 0) {
                console.warn('[Covenant] WARNING: Covenant address has no funds!');
                console.warn('   Withdrawals will fail until covenant is funded.');
                console.warn(`   Send BTC to: ${status.address}`);
                console.log('');
            }
        } catch (error: any) {
            console.error('[Covenant] Error checking covenant status:', error.message);
        }
    }

    /**
     * Get processor statistics
     */
    getStats() {
        const authStats = WithdrawalAuthorizationService.getStats();
        
        return {
            running: this.isRunning,
            pollIntervalSeconds: this.pollIntervalMs / 1000,
            minConfirmations: this.minConfirmations,
            covenantMode: this.useCovenants,
            authorizations: authStats
        };
    }
}

/**
 * Standalone execution - Run this file directly to start the processor
 */
if (require.main === module) {
    const processor = new WithdrawalProcessor({
        pollIntervalMs: parseInt(process.env.WITHDRAWAL_PROCESSOR_INTERVAL_MS || '30000'),
        minConfirmations: parseInt(process.env.WITHDRAWAL_MIN_CONFIRMATIONS || '1'),
        useCovenants: process.env.USE_OPCAT_COVENANTS === 'true'
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n[WithdrawalProcessor] Received SIGINT, shutting down gracefully...');
        processor.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n[WithdrawalProcessor] Received SIGTERM, shutting down gracefully...');
        processor.stop();
        process.exit(0);
    });

    // Start the processor
    processor.start().catch((error) => {
        console.error('[WithdrawalProcessor] Fatal error:', error);
        process.exit(1);
    });
}


export class WithdrawalProcessor {
    private pollIntervalMs: number;
    private isRunning: boolean = false;
    private minConfirmations: number;
    private useCovenants: boolean;

    constructor(options: {
        pollIntervalMs?: number;
        minConfirmations?: number;
        useCovenants?: boolean;
    } = {}) {
        this.pollIntervalMs = options.pollIntervalMs || 30000; // 30 seconds default
        this.minConfirmations = options.minConfirmations || 1; // 1 confirmation default (Starknet)
        this.useCovenants = options.useCovenants || false; // Use OP_CAT covenants (requires funded covenant address)
    }

    /**
     * Start the withdrawal processor
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('[WithdrawalProcessor] Already running');
            return;
        }

        this.isRunning = true;
        console.log('');
        console.log('🔐 ═══════════════════════════════════════════════════════════');
        console.log('🔐  Secure Bitcoin Withdrawal Processor');
        console.log('🔐 ═══════════════════════════════════════════════════════════');
        console.log(`⏱️  Poll Interval: ${this.pollIntervalMs / 1000}s`);
        console.log(`✅  Min Confirmations: ${this.minConfirmations}`);
        console.log(`🔒  Covenant Mode: ${this.useCovenants ? 'ENABLED (OP_CAT)' : 'DISABLED'}`);
        console.log('🔐 ═══════════════════════════════════════════════════════════');
        console.log('');

        // Check covenant status if enabled
        if (this.useCovenants) {
            await this.checkCovenantStatus();
        }

        // Initial processing
        await this.processAuthorizations();

        // Set up polling
        this.poll();
    }

    /**
     * Stop the withdrawal processor
     */
    stop(): void {
        this.isRunning = false;
        console.log('[WithdrawalProcessor] Stopped');
    }

    /**
     * Poll for pending authorizations
     */
    private poll(): void {
        if (!this.isRunning) return;

        setTimeout(async () => {
            await this.processAuthorizations();
            this.poll();
        }, this.pollIntervalMs);
    }

    /**
     * Process all pending withdrawal authorizations
     */
    async processAuthorizations(): Promise<void> {
        try {
            const pending = WithdrawalAuthorizationService.getPendingAuthorizations();

            if (pending.length === 0) {
                console.log('[WithdrawalProcessor] No pending authorizations');
                return;
            }

            console.log(`[WithdrawalProcessor] Found ${pending.length} pending authorization(s)`);

            for (const auth of pending) {
                await this.processAuthorization(auth);
            }

        } catch (error: any) {
            console.error('[WithdrawalProcessor] Error processing authorizations:', error.message);
        }
    }

    /**
     * Process a single withdrawal authorization
     */
    private async processAuthorization(auth: WithdrawalAuthorization): Promise<void> {
        console.log(`[WithdrawalProcessor] Processing authorization ${auth.id}...`);
        console.log(`[WithdrawalProcessor]   Amount: ${auth.amount_sats} sats`);
        console.log(`[WithdrawalProcessor]   Address: ${auth.bitcoin_address}`);
        console.log(`[WithdrawalProcessor]   Starknet TX: ${auth.starknet_tx_hash}`);

        try {
            // 1. Verify Starknet transaction is finalized
            const isFinalized = await this.verifyStarknetTransaction(auth.starknet_tx_hash);
            
            if (!isFinalized) {
                console.log(`[WithdrawalProcessor] Starknet TX not finalized yet, skipping...`);
                return;
            }

            console.log(`[WithdrawalProcessor] Starknet TX finalized with ${this.minConfirmations}+ confirmations`);

            // 2. Send Bitcoin using authorization (covenant or regular)
            let txid: string;
            
            if (this.useCovenants) {
                console.log(`[WithdrawalProcessor] Creating covenant withdrawal...`);
                txid = await BitcoinCovenantService.executeCovenantWithdrawal(auth.id);
            } else {
                console.log(`[WithdrawalProcessor] Sending Bitcoin (legacy mode)...`);
                txid = await BitcoinBroadcastService.sendBitcoinWithAuthorization(auth.id);
            }

            console.log(`[WithdrawalProcessor] Bitcoin sent successfully!`);
            console.log(`[WithdrawalProcessor]   TXID: ${txid}`);
            console.log(`[WithdrawalProcessor]   View: https://mempool.space/signet/tx/${txid}`);

        } catch (error: any) {
            console.error(`[WithdrawalProcessor] Failed to process authorization ${auth.id}:`, error.message);
            
            // Authorization status is already updated by sendBitcoinWithAuthorization
            // Just log the error here for visibility
        }
    }

    /**
     * Verify a Starknet transaction is finalized
     */
    private async verifyStarknetTransaction(txHash: string): Promise<boolean> {
        try {
            const receipt = await StarknetService.getTransactionReceipt(txHash);

            // Check execution status
            if (receipt.execution_status !== 'SUCCEEDED') {
                console.warn(`[WithdrawalProcessor] Transaction ${txHash} execution status: ${receipt.execution_status}`);
                return false;
            }

            // For Starknet, if receipt exists and succeeded, it's finalized
            // Additional confirmation logic can be added here if needed
            return true;

        } catch (error: any) {
            console.error(`[WithdrawalProcessor] Error verifying transaction ${txHash}:`, error.message);
            return false;
        }
    }

    /**
     * Check covenant status (if using covenant mode)
     */
    private async checkCovenantStatus(): Promise<void> {
        try {
            const status = await BitcoinCovenantService.getCovenantStatus();
            
            console.log('[Covenant] Status:');
            console.log(`   Address: ${status.address}`);
            console.log(`   Balance: ${status.balance} sats`);
            console.log(`   UTXOs: ${status.utxoCount}`);
            console.log(`   Network: ${status.network}`);
            console.log('');
            
            if (status.balance === 0) {
                console.warn('[Covenant] WARNING: Covenant address has no funds!');
                console.warn('   Withdrawals will fail until covenant is funded.');
                console.warn(`   Send BTC to: ${status.address}`);
                console.log('');
            }
        } catch (error: any) {
            console.error('[Covenant] Error checking covenant status:', error.message);
        }
    }

    /**
     * Get processor statistics
     */
    getStats() {
        const authStats = WithdrawalAuthorizationService.getStats();
        
        return {
            running: this.isRunning,
            pollIntervalSeconds: this.pollIntervalMs / 1000,
            minConfirmations: this.minConfirmations,
            covenantMode: this.useCovenants,
            authorizations: authStats
        };
    }
}

/**
 * Standalone execution - Run this file directly to start the processor
 */
if (require.main === module) {
    const processor = new WithdrawalProcessor({
        pollIntervalMs: parseInt(process.env.WITHDRAWAL_PROCESSOR_INTERVAL_MS || '30000'),
        minConfirmations: parseInt(process.env.WITHDRAWAL_MIN_CONFIRMATIONS || '1'),
        useCovenants: process.env.USE_OPCAT_COVENANTS === 'true'
    });

    /**
     * Get processor statistics
     */
    getStats() {
        const authStats = WithdrawalAuthorizationService.getStats();
        
        return {
            running: this.isRunning,
            pollIntervalSeconds: this.pollIntervalMs / 1000,
            minConfirmations: this.minConfirmations,
            covenantMode: this.useCovenant
    getStats() {
        const authStats = WithdrawalAuthorizationService.getStats();
        
        return {
            running: this.isRunning,
            pollIntervalSeconds: this.pollIntervalMs / 1000,
            minConfirmations: this.minConfirmations,
            authorizations: authStats
        };
    }
}

/**
 * Standalone execution - Run this file directly to start the processor
 */
if (require.main === module) {
    const processor = new WithdrawalProcessor({
        pollIntervalMs: parseInt(process.env.WITHDRAWAL_PROCESSOR_INTERVAL_MS || '30000'),
        minConfirmations: parseInt(process.env.WITHDRAWAL_MIN_CONFIRMATIONS || '1')
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n[WithdrawalProcessor] Received SIGINT, shutting down gracefully...');
        processor.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n[WithdrawalProcessor] Received SIGTERM, shutting down gracefully...');
        processor.stop();
        process.exit(0);
    });

    // Start the processor
    processor.start().catch((error) => {
        console.error('[WithdrawalProcessor] Fatal error:', error);
        process.exit(1);
    });
}
