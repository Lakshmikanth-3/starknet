/**
 * PrivateBTC Vault Backend — Production Entry Point
 *
 * Starknet Sepolia | Zero mock data | All live on-chain calls
 *
 * Routes mounted:
 *   GET  /health
 *   /api/vault/*
 *   /api/proof/*
 *   /api/withdraw/*
 *   /api/transactions/*
 *   /api/audit/*
 *   /api/debug/* (development only)
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import { config } from './config/env';
import db from './db/schema';
import { StarknetService } from './services/StarknetService';

// Middlewares
import { errorHandler } from './middleware/errorHandler';
import { validateBody } from './middleware/validateBody';
import { notFound } from './middleware/notFound';
import { methodNotAllowed } from './middleware/methodNotAllowed';
import { generalLimiter } from './middleware/rateLimiters';

// Routes
import vaultRouter from './routes/vault';
import proofRouter from './routes/proof';
import withdrawRouter from './routes/withdraw';
import transactionsRouter from './routes/transactions';
import auditRouter from './routes/audit';
import { htlcRouter } from './routes/htlc';
import { commitmentRouter } from './routes/commitment';
import sharpRouter from './routes/sharp';
import bridgeRouter from './routes/bridge';
import { privacyRouter } from './routes/privacy';
import { BitcoinHeaderRelayService } from './services/BitcoinHeaderRelayService';
import { WithdrawalProcessor } from './services/WithdrawalProcessor';

const app = express();

// ── Security & logging ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(morgan('combined'));
app.use(express.json({ limit: '2mb' })); // SPV raw tx calldata can be ~500kb as felt252 strings
app.use(express.urlencoded({ extended: true }));

// Apply General Limiter to all routes
app.use(generalLimiter);

// ── Health check — all LIVE data ─────────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
    try {
        const [blockNumber, vaultReachable, mockBtcReachable] = await Promise.all([
            StarknetService.getLiveBlockNumber().catch(() => 0),
            StarknetService.isContractReachable(config.VAULT_CONTRACT_ADDRESS).catch(() => false),
            StarknetService.isContractReachable(config.MOCKBTC_CONTRACT_ADDRESS).catch(() => false),
        ]);

        let dbConnected = false;
        try {
            db.prepare('SELECT 1').get();
            dbConnected = true;
        } catch {
            dbConnected = false;
        }

        // Get header relay status
        const { BitcoinHeaderRelayService } = await import('./services/BitcoinHeaderRelayService');
        const headerRelayStatus = BitcoinHeaderRelayService.getStatus();

        res.json({
            status: blockNumber > 0 ? 'ok' : 'degraded',
            starknet: {
                network: 'sepolia',
                blockNumber,
                vaultContractReachable: vaultReachable,
                mockBtcContractReachable: mockBtcReachable,
                circuit: StarknetService.getCircuitState(),
            },
            headerRelay: {
                running: headerRelayStatus.running,
                lastRelayedHeight: headerRelayStatus.lastRelayedHeight,
                pollIntervalSeconds: Math.round(headerRelayStatus.pollIntervalMs / 1000),
            },
            db: { connected: dbConnected },
            timestamp: Date.now(),
        });
    } catch (err) {
        console.error('❌ Health check failed:', err);
        res.status(500).json({
            status: 'error',
            error: err instanceof Error ? err.message : 'Health check failed',
            timestamp: Date.now(),
        });
    }
});

// ── API Routes ───────────────────────────────────────────────────────────────

// 1. Vault
app.use('/api/vault', vaultRouter);

// 2. HTLC
app.use('/api/htlc', htlcRouter);

// 3. Commitment
app.use('/api/commitment', commitmentRouter);

// 4. Bridge
app.use('/api/bridge', bridgeRouter);

// 5. SHARP
app.use('/api/sharp', sharpRouter);

// Other
app.use('/api/proof', proofRouter);
app.use('/api/withdraw', withdrawRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/privacy', privacyRouter);

// Debug routes — development only
if (config.NODE_ENV === 'development') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const debugRouter = require('./routes/debug').default as express.Router;
    app.use('/api/debug', debugRouter);
    console.log('🔧 Debug routes mounted (development mode)');
}

// ── Handlers ─────────────────────────────────────────────────────────────────
app.use(notFound);       // Catches all unmatched routes
app.use(errorHandler);   // Global error handler (must be last)

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.PORT, () => {
    console.log('');
    console.log('🚀 ═══════════════════════════════════════════════════════════');
    console.log('🚀  PrivateBTC Vault Backend — Starknet Sepolia — PRODUCTION');
    console.log('🚀 ═══════════════════════════════════════════════════════════');
    console.log(`🌐  Server:   http://localhost:${config.PORT}`);
    console.log(`📡  Health:   http://localhost:${config.PORT}/health`);
    console.log(`🔗  RPC:      ${config.STARKNET_RPC_URL}`);
    console.log(`🏦  Vault:    ${config.VAULT_CONTRACT_ADDRESS}`);
    console.log(`₿   MockBTC:  ${config.MOCKBTC_CONTRACT_ADDRESS}`);
    console.log(`📊  DB:       ${config.DB_PATH}`);
    console.log(`🌍  Network:  ${config.NODE_ENV}`);
    console.log(`🔗  HeaderStore: ${process.env.HEADER_STORE_CONTRACT_ADDRESS || '(not set — deploy then add to .env)'}`);
    console.log('🚀 ═══════════════════════════════════════════════════════════');
    console.log('');

    // Start Bitcoin header relay (posts Signet block Merkle roots to HeaderStore contract)
    if (process.env.HEADER_STORE_CONTRACT_ADDRESS) {
        BitcoinHeaderRelayService.start();
    } else {
        console.warn('⚠️  HEADER_STORE_CONTRACT_ADDRESS not set — header relay disabled. Deploy HeaderStore first.');
    }

    // Start Withdrawal Processor automatically
    const processor = new WithdrawalProcessor({
        pollIntervalMs: parseInt(process.env.WITHDRAWAL_PROCESSOR_INTERVAL_MS || '30000'),
        minConfirmations: parseInt(process.env.WITHDRAWAL_MIN_CONFIRMATIONS || '1'),
        useCovenants: process.env.USE_OPCAT_COVENANTS === 'true'
    });
    processor.start().catch((err) => console.error('Failed to start WithdrawalProcessor:', err));

    // Auto-sync: check all pending vaults against Starknet and activate confirmed ones
    setTimeout(async () => {
        try {
            const db = (await import('./db/schema')).default;
            const { StarknetService } = await import('./services/StarknetService');
            const pending = db.prepare(
                "SELECT id, deposit_tx_hash FROM vaults WHERE status = 'pending' AND deposit_tx_hash IS NOT NULL"
            ).all() as { id: string; deposit_tx_hash: string }[];

            if (pending.length > 0) {
                console.log(`🔄 Auto-syncing ${pending.length} pending vault(s) from Starknet...`);
                const provider = StarknetService.getProvider();
                for (const v of pending) {
                    try {
                        const receipt = await provider.getTransactionReceipt(v.deposit_tx_hash);
                        const exec = (receipt as any).execution_status;
                        const fin = (receipt as any).finality_status;
                        if (exec === 'SUCCEEDED' || fin === 'ACCEPTED_ON_L2') {
                            db.prepare("UPDATE vaults SET status = 'active' WHERE id = ?").run(v.id);
                            console.log(`  ✅ Vault ${v.id.slice(0, 8)}... → active`);
                        }
                    } catch { /* TX not found yet — leave as pending */ }
                }
                console.log('🔄 Auto-sync complete.');
            }
        } catch (e) {
            console.warn('⚠️  Auto-sync warning:', (e as Error).message);
        }
    }, 3000);
});

export default app;

