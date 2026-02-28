import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { bitcoinSignetService } from '../services/BitcoinSignetService';
import { BitcoinBroadcastService } from '../services/BitcoinBroadcastService';

const router = Router();

// GET /api/bridge/deposit-address
router.get('/deposit-address', (req: Request, res: Response) => {
    const { vault_id } = req.query;
    if (!vault_id || typeof vault_id !== 'string') {
        return res.status(400).json({ error: 'vault_id is required' });
    }
    try {
        const address = bitcoinSignetService.getDepositAddress();
        return res.status(200).json({
            address,
            network: 'signet',
            vault_id,
            mempool_url: `https://mempool.space/signet/address/${address}`,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed';
        return res.status(500).json({ error: message });
    }
});

// GET /api/bridge/detect-lock
router.get('/detect-lock', async (req: Request, res: Response) => {
    try {
        const address = req.query.address as string;
        const amountRaw = req.query.amount as string;

        console.log('[bridge/detect-lock] Incoming:', { address, amountRaw });

        if (!address || !amountRaw) {
            return res.status(400).json({
                error: 'Missing required params: address and amount'
            });
        }

        const amountBTC = parseFloat(amountRaw);
        if (isNaN(amountBTC) || amountBTC <= 0) {
            return res.status(400).json({
                error: 'Invalid amount parameter'
            });
        }

        const result = await bitcoinSignetService.detectLock(address, amountBTC);
        console.log('[bridge/detect-lock] Result:', result);

        return res.status(200).json(result);
    } catch (err: any) {
        console.error('[bridge/detect-lock] Error:', err.message);
        return res.status(500).json({ detected: false, error: err.message });
    }
});

// GET /api/bridge/verify-tx
router.get('/verify-tx', async (req: Request, res: Response) => {
    const { txid } = req.query;
    if (!txid || typeof txid !== 'string') {
        return res.status(400).json({ error: 'txid is required' });
    }
    try {
        const result = await bitcoinSignetService.verifyTransaction(txid);
        return res.status(200).json({ txid, ...result });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed';
        return res.status(500).json({ error: message });
    }
});

// GET /api/bridge/status
router.get('/status', async (_req: Request, res: Response) => {
    const status = await bitcoinSignetService.getBridgeStatus();
    return res.status(status.status === 'online' ? 200 : 503).json(status);
});

// GET /api/bridge/sender-balance - Check if auto-broadcast is available
router.get('/sender-balance', async (_req: Request, res: Response) => {
    try {
        const senderAddress = process.env.SENDER_ADDRESS;
        if (!senderAddress) {
            return res.status(500).json({ 
                error: 'SENDER_ADDRESS not configured',
                hasFunds: false,
                balance: 0
            });
        }

        const MEMPOOL_API = process.env.MEMPOOL_API_URL || 'https://mempool.space/signet/api';
        const utxoRes = await fetch(`${MEMPOOL_API}/address/${senderAddress}/utxo`);
        
        if (!utxoRes.ok) {
            throw new Error(`Failed to fetch UTXOs: ${utxoRes.statusText}`);
        }

        const utxos = await utxoRes.json() as any[];
        const totalBalance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
        const minRequired = 51000; // 50k sats + minimal fee

        return res.json({
            hasFunds: totalBalance >= minRequired,
            balance: totalBalance,
            balanceBTC: (totalBalance / 100000000).toFixed(8),
            minRequired,
            address: senderAddress,
            utxoCount: utxos.length,
            canBroadcast: totalBalance >= minRequired,
            message: totalBalance === 0 
                ? 'No funds available for auto-broadcast. Please fund the sender address or use manual deposit.'
                : totalBalance < minRequired
                ? `Insufficient funds (${totalBalance} sats). Need at least ${minRequired} sats.`
                : 'Auto-broadcast available'
        });
    } catch (error: any) {
        console.error('[bridge/sender-balance] Error:', error.message);
        return res.status(500).json({ 
            error: error.message,
            hasFunds: false,
            balance: 0
        });
    }
});

router.post('/broadcast', async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        const amountSats = Math.round(parseFloat(amount) * 100000000);
        console.log(`[bridge/broadcast] Request to broadcast ${amount} BTC (${amountSats} sats)`);

        const txid = await BitcoinBroadcastService.broadcastSignetTransaction(amountSats);

        res.json({
            success: true,
            txid,
            message: 'Transaction broadcasted successfully'
        });
    } catch (error: any) {
        console.error('[bridge/broadcast] Error:', error.message);
        
        // Provide helpful error messages
        let userMessage = error.message;
        if (error.message.includes('No UTXOs found')) {
            userMessage = 'Auto-broadcast unavailable: Sender wallet has no funds. Please use manual deposit or fund the sender address.';
        } else if (error.message.includes('Insufficient funds')) {
            userMessage = `Insufficient funds in sender wallet. ${error.message}`;
        }
        
        res.status(500).json({ 
            error: userMessage,
            technicalError: error.message
        });
    }
});

export default router;
