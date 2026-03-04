import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { bitcoinSignetService } from '../services/BitcoinSignetService';
import { BitcoinBroadcastService } from '../services/BitcoinBroadcastService';
import { BitcoinProofService } from '../services/BitcoinProofService';
import { StarknetService } from '../services/StarknetService';

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

/**
 * GET /api/bridge/spv-proof?txid=<txid>
 *
 * Fetches the Bitcoin SPV proof for a given txid from the Signet mempool API.
 * Returns blockHeight, txPos, rawTxHex, merkleProof (as 8×u32 word arrays), voutIndex, amountSats.
 * The frontend passes this data to /api/bridge/spv-deposit.
 */
router.get('/spv-proof', async (req: Request, res: Response) => {
    const txid = req.query.txid as string;
    if (!txid || !/^[0-9a-fA-F]{64}$/.test(txid)) {
        return res.status(400).json({ error: 'txid must be a 64-char hex string' });
    }

    try {
        // P2WPKH scriptPubKey for the vault address: OP_0 OP_PUSH20 <pubkey_hash>
        // Vault address: tb1qgua8e2zpmq79zvmnequka5w53wse3ffuws00gs
        // pubkey_hash (20 bytes): 473a7ca841d83c513373c8396ed1d48ba198a53c
        const VAULT_SCRIPT_PUBKEY = process.env.VAULT_BITCOIN_SCRIPT_PUBKEY
            || '0014473a7ca841d83c513373c8396ed1d48ba198a53c';

        const proof = await BitcoinProofService.buildSpvProof(txid, VAULT_SCRIPT_PUBKEY);
        const { rawTxBytes, merkleProofWords } = BitcoinProofService.encodeSpvProofAsCalldata(proof);

        return res.status(200).json({
            success: true,
            txid,
            blockHeight: proof.blockHeight,
            txPos: proof.txPos,
            rawTxHex: proof.rawTxHex,
            rawTxBytes,
            merkleProof: proof.merkleProof,
            merkleProofWords,
            voutIndex: proof.voutIndex,
            amountSats: proof.amountSats,
            amountBTC: (proof.amountSats / 1e8).toFixed(8),
        });
    } catch (err: any) {
        console.error('[bridge/spv-proof] Error:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/bridge/header-status?height=<height>
 * 
 * Check if a Bitcoin block header has been relayed to HeaderStore.
 * Used by frontend to pre-validate before attempting SPV deposit.
 */
router.get('/header-status', async (req: Request, res: Response) => {
    const height = parseInt(req.query.height as string);
    
    if (isNaN(height) || height <= 0) {
        return res.status(400).json({ error: 'Invalid height parameter' });
    }
    
    try {
        const { BitcoinHeaderRelayService } = await import('../services/BitcoinHeaderRelayService');
        const isStored = await StarknetService.isHeaderStored(height);
        const relayStatus = BitcoinHeaderRelayService.getStatus();
        
        return res.status(200).json({
            blockHeight: height,
            isStored,
            headerRelay: {
                running: relayStatus.running,
                lastRelayedHeight: relayStatus.lastRelayedHeight,
                pollIntervalSeconds: Math.round(relayStatus.pollIntervalMs / 1000),
            },
            estimatedWaitSeconds: isStored ? 0 : 
                relayStatus.lastRelayedHeight >= height ? 0 :
                Math.max(0, 60 - ((Date.now() % 60000) / 1000)),
        });
    } catch (err: any) {
        console.error('[bridge/header-status] Error:', err.message);
        return res.status(500).json({
            error: err.message,
            blockHeight: height,
            isStored: false,
        });
    }
});

/**
 * POST /api/bridge/spv-deposit
 *
 * Submits a Bitcoin SPV deposit to the Starknet vault contract.
 * The vault verifies the Merkle proof on-chain before minting mBTC.
 *
 * CRITICAL FIX: Now waits for the block header to be relayed before attempting
 * the deposit. This prevents "Block header not relayed yet" errors.
 *
 * Body: { commitment, blockHeight, txPos, rawTxBytes, voutIndex, merkleProofWords, bitcoin_txid }
 */
router.post('/spv-deposit', async (req: Request, res: Response) => {
    const schema = z.object({
        commitment: z.string().startsWith('0x'),
        blockHeight: z.number().int().positive(),
        txPos: z.number().int().min(0),
        rawTxBytes: z.array(z.number().int().min(0).max(255)),
        voutIndex: z.number().int().min(0),
        merkleProofWords: z.array(z.array(z.number()).length(8)),
        bitcoin_txid: z.string().optional(),
        vault_id: z.string().uuid().optional(),
        // ✅ NEW: Accept secret and nullifier_hash for database storage
        secret: z.string().optional(),
        nullifier_hash: z.string().optional(),
        amount: z.number().positive().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { commitment, blockHeight, txPos, rawTxBytes, voutIndex, merkleProofWords, bitcoin_txid, vault_id, secret, nullifier_hash, amount } = parsed.data;

    try {
        // ✅ CRITICAL FIX: Wait for header to be available before submitting
        const maxWaitSeconds = 120; // 2 minutes max wait
        const checkIntervalMs = 5000; // Check every 5 seconds
        const maxAttempts = Math.ceil((maxWaitSeconds * 1000) / checkIntervalMs);
        
        console.log(`[bridge/spv-deposit] Checking if header ${blockHeight} is relayed...`);
        
        let headerAvailable = false;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            headerAvailable = await StarknetService.isHeaderStored(blockHeight);
            
            if (headerAvailable) {
                console.log(`[bridge/spv-deposit] ✅ Header ${blockHeight} is available (attempt ${attempt + 1}/${maxAttempts})`);
                break;
            }
            
            if (attempt < maxAttempts - 1) {
                console.log(`[bridge/spv-deposit] ⏳ Waiting for header ${blockHeight}... (attempt ${attempt + 1}/${maxAttempts})`);
                await new Promise(r => setTimeout(r, checkIntervalMs));
            }
        }
        
        if (!headerAvailable) {
            return res.status(503).json({
                success: false,
                error: `Bitcoin block header ${blockHeight} not yet relayed to Starknet. Please wait a moment and try again.`,
                code: 'HEADER_NOT_RELAYED',
                blockHeight,
                suggestion: 'The header relay service runs every 30 seconds. Please wait up to 2 minutes and retry.',
            });
        }

        // Proceed with deposit
        const txHash = await StarknetService.executeSpvDeposit({
            commitment,
            blockHeight,
            txPos,
            rawTxBytes,
            voutIndex,
            merkleProofWords,
        });

        await StarknetService.waitForTransaction(txHash);

        // ✅ CRITICAL FIX: Store vault in database with nullifier for withdrawal
        // This was missing - SPV deposits weren't being saved to DB!
        if (vault_id && nullifier_hash) {
            console.log(`[bridge/spv-deposit] Storing vault in database...`);
            const dbModule = await import('../db/schema');
            const db = dbModule.default;
            const { CryptoService } = await import('../services/CryptoService');
            const { config } = await import('../config/env');
            
            const actualOwnerAddress = config.STARKNET_ACCOUNT_ADDRESS;
            const actualSalt = CryptoService.generateSalt();
            const actualRandomnessHint = CryptoService.generateRandomness();
            const amountInWei = amount ?  BigInt(Math.floor(amount * 1e18)) : BigInt(0);
            const encryptedAmount = CryptoService.encryptAmount(amountInWei, actualSalt);
            
            try {
                db.prepare(
                    `INSERT INTO vaults (id, owner_address, commitment, encrypted_amount, salt, randomness_hint, lock_duration_days, created_at, unlock_at, status, deposit_tx_hash, bitcoin_txid, nullifier_hash)
                     VALUES (?, ?, ?, ?, ?, ?, 30, ?, ?, 'active', ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET 
                        deposit_tx_hash = ?,
                        bitcoin_txid = ?,
                        nullifier_hash = COALESCE(nullifier_hash, ?),
                        status = 'active'`
                ).run(
                    vault_id, actualOwnerAddress, commitment, encryptedAmount, actualSalt, actualRandomnessHint, 
                    Date.now(), Date.now() + 86400 * 30, txHash, bitcoin_txid ?? null, nullifier_hash,
                    // ON CONFLICT values
                    txHash, bitcoin_txid ?? null, nullifier_hash
                );
                console.log(`[bridge/spv-deposit] ✅ Vault stored with nullifier: ${nullifier_hash.substring(0, 32)}...`);
            } catch (dbErr: any) {
                console.error(`[bridge/spv-deposit] ⚠️  Failed to store vault in database:`, dbErr.message);
                // Non-fatal: Starknet deposit succeeded, but DB storage failed
            }
        } else {
            console.warn(`[bridge/spv-deposit] ⚠️  No vault_id or nullifier_hash provided - vault not stored in database. Withdrawal will fail!`);
        }

        return res.status(200).json({
            success: true,
            transaction_hash: txHash,
            bitcoin_txid: bitcoin_txid ?? null,
            vault_id: vault_id ?? null,
            voyager_url: `https://sepolia.voyager.online/tx/${txHash}`,
            message: 'Bitcoin SPV proof verified on-chain. mBTC minted to vault.',
        });
    } catch (err: any) {
        console.error('[bridge/spv-deposit] Error:', err.message);
        
        // Better error handling for header not relayed
        if (err.message.includes('Block header not relayed')) {
            return res.status(503).json({
                success: false,
                error: 'Bitcoin block header not yet available on Starknet. Please wait and retry.',
                code: 'HEADER_NOT_RELAYED',
                technicalError: err.message,
            });
        }
        
        const isFunding = err.message.includes('INSUFFICIENT SEPOLIA ETH');
        return res.status(isFunding ? 402 : 500).json({
            success: false,
            error: err.message,
            code: isFunding ? 'INSUFFICIENT_GAS' : 'SPV_DEPOSIT_FAILED',
        });
    }
});

export default router;
