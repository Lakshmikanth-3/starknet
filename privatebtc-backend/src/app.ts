import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import Database from 'better-sqlite3';
import path from 'path';
import { VaultService } from './services/VaultService';
import { VaultController } from './controllers/VaultController';

// Initialize Express app
const app: Express = express();

// ============================================
// MIDDLEWARE - MUST BE FIRST
// ============================================

// Security middleware
app.use(helmet());

// CORS - Allow all origins for development
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser - CRITICAL for POST requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan('dev'));

// Debug logger - helps identify routing issues
app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`📨 ${req.method} ${req.path}`);
    if (req.method === 'POST') {
        console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// ============================================
// DATABASE INITIALIZATION
// ============================================

const dbPath = path.join(process.cwd(), 'privatebtc.db');
console.log(`📂 Database path: ${dbPath}`);

const db = new Database(dbPath);

// ============================================
// SERVICES & CONTROLLERS INITIALIZATION
// ============================================

const vaultService = new VaultService(db);
const vaultController = new VaultController(vaultService);

console.log('✅ Services and controllers initialized');

// ============================================
// ROUTES - MUST BE AFTER MIDDLEWARE, BEFORE ERROR HANDLERS
// ============================================

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    console.log('✅ Health check requested');
    res.status(200).json({
        status: 'ok',
        timestamp: Date.now(),
        service: 'PrivateBTC Vault Backend',
        version: '1.0.0'
    });
});

// API Routes
app.post('/api/vaults', vaultController.createVault);
app.get('/api/vaults/:userAddress', vaultController.getUserVaults);
app.post('/api/vaults/:vaultId/withdraw', vaultController.withdrawFromVault);
app.post('/api/vaults/generate-proof', vaultController.generateProof);
app.get('/api/stats', vaultController.getStats);

console.log('✅ Routes registered:');
console.log('   GET  /health');
console.log('   POST /api/vaults');
console.log('   GET  /api/vaults/:userAddress');
console.log('   POST /api/vaults/:vaultId/withdraw');
console.log('   POST /api/vaults/generate-proof');
console.log('   GET  /api/stats');

// ============================================
// ERROR HANDLERS - MUST BE LAST
// ============================================

// 404 handler - for undefined routes
app.use((req: Request, res: Response) => {
    console.log(`❌ Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        error: 'Route not found',
        requestedRoute: `${req.method} ${req.path}`,
        availableRoutes: [
            'GET  /health',
            'POST /api/vaults',
            'GET  /api/vaults/:userAddress',
            'POST /api/vaults/:vaultId/withdraw',
            'POST /api/vaults/generate-proof',
            'GET  /api/stats'
        ],
        hint: 'Make sure you are using the correct HTTP method and endpoint'
    });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('💥 Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ═══════════════════════════════════════════════════════');
    console.log('� PrivateBTC Vault Backend is RUNNING!');
    console.log('🚀 ═══════════════════════════════════════════════════════');
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`📊 Database: ${dbPath}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/health`);
    console.log('🚀 ═══════════════════════════════════════════════════════');
    console.log('');
});

export default app;
