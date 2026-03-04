# CRITICAL FIX: Header Relay Race Condition

## Problem Analysis

### Root Cause
The "Block header not relayed yet" error occurs due to a **race condition** between:

1. **Bitcoin Transaction Confirmation** (User gets 6 confirmations)
2. **Header Relay Service** (Polls every 60 seconds, relays up to 5 blocks with 5-second gaps)
3. **SPV Deposit Submission** (User immediately tries to submit after confirmations)

**Timeline of Failure:**
```
T+0s    : Bitcoin tx confirmed in block N (6 confirmations)
T+1s    : Frontend detects confirmation → Enables "Submit to Starknet" button
T+2s    : User clicks submit → Calls /api/bridge/spv-deposit
T+3s    : Backend calls vault.deposit() → Checks is_header_stored(N)
T+3s    : ❌ ERROR: "Block header not relayed yet"
T+35s   : Header relay service runs next cycle → Relays block N
```

### Why This Happens

1. **60-second polling interval** - Header relay only checks for new blocks every minute
2. **No pre-flight checks** - Frontend doesn't verify header availability before submission
3. **No retry logic** - Single failure causes permanent error (user must refresh)
4. **No on-demand relay** - No way to trigger immediate header relay for pending deposits

## Comprehensive Fix

### Fix #1: Add Header Availability Check API ✅

**File:** `backend/src/services/StarknetService.ts`

Add a method to check if a block header is stored on HeaderStore:

```typescript
/**
 * Check if a Bitcoin block header has been relayed to HeaderStore contract.
 * Returns true if the header is available, false otherwise.
 */
static async isHeaderStored(blockHeight: number): Promise<boolean> {
    const headerStoreAddr = process.env.HEADER_STORE_CONTRACT_ADDRESS;
    if (!headerStoreAddr) {
        console.warn('[StarknetService] HEADER_STORE_CONTRACT_ADDRESS not set');
        return false;
    }

    try {
        const provider = this.getProvider();
        const result = await provider.callContract({
            contractAddress: headerStoreAddr,
            entrypoint: 'is_header_stored',
            calldata: [blockHeight.toString()],
        });
        
        // Result is a felt252 representing bool (0 = false, 1 = true)
        return result[0] !== '0x0' && result[0] !== '0';
    } catch (err) {
        console.error(`[StarknetService] Failed to check header ${blockHeight}:`, err);
        return false;
    }
}
```

### Fix #2: Add Retry Logic with Header Wait ✅

**File:** `backend/src/routes/bridge.ts`

Modify the `/api/bridge/spv-deposit` endpoint to wait for header availability:

```typescript
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
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { commitment, blockHeight, txPos, rawTxBytes, voutIndex, merkleProofWords, bitcoin_txid, vault_id } = parsed.data;

    try {
        // ✅ FIX: Wait for header to be available before submitting
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
                suggestion: 'The header relay service runs every 60 seconds. Please wait up to 2 minutes and retry.',
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
        
        // Better error handling
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
```

### Fix #3: Add Header Status Check Endpoint ✅

**File:** `backend/src/routes/bridge.ts`

Add a new endpoint to check header availability:

```typescript
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
```

### Fix #4: Improve Header Relay Service ✅

**File:** `backend/src/services/BitcoinHeaderRelayService.ts`

Reduce polling interval for faster header availability:

```typescript
// Change from 60 seconds to 30 seconds for faster response
const POLL_INTERVAL_MS = 30_000; // poll every 30s instead of 60s
```

Also increase blocks per cycle for catch-up:

```typescript
// In relayCycle() function, change:
// Relay at most 10 headers per cycle instead of 5 (faster catch-up)
const endHeight = Math.min(startHeight + 9, tipHeight);
```

### Fix #5: Frontend Pre-Check and Better UX ✅

**File:** `frontend/src/app/deposit/page.tsx`

Add header availability check before submission:

```typescript
const handleSubmitStarknet = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
        console.log('[DEPOSIT] Fetching SPV proof for TXID:', bitcoinTx);
        const proofRes = await fetch(`http://localhost:3001/api/bridge/spv-proof?txid=${bitcoinTx}`);

        if (!proofRes.ok) {
            const errorData = await proofRes.json();
            throw new Error(errorData.error || 'Failed to fetch SPV proof');
        }

        const proof = await proofRes.json();
        console.log('[DEPOSIT] SPV Proof successfully generated:', proof);

        // ✅ NEW: Check if header is available before submitting
        console.log('[DEPOSIT] Checking if block header is relayed...');
        const headerCheckRes = await fetch(`http://localhost:3001/api/bridge/header-status?height=${proof.blockHeight}`);
        
        if (headerCheckRes.ok) {
            const headerStatus = await headerCheckRes.json();
            
            if (!headerStatus.isStored) {
                const waitTime = headerStatus.estimatedWaitSeconds || 60;
                toast({
                    title: '⏳ Block Header Not Yet Relayed',
                    description: `Waiting for Bitcoin block ${proof.blockHeight} to be relayed to Starknet. Estimated wait: ${waitTime}s`,
                    variant: 'default',
                });
                
                // Show a loading indicator with estimated time
                console.log(`[DEPOSIT] Header not ready. Waiting ~${waitTime}s...`);
            } else {
                console.log('[DEPOSIT] ✅ Header is available. Proceeding with deposit...');
            }
        }

        console.log('[DEPOSIT] Calling backend SPV relayer...');
        const response = await fetch('http://localhost:3001/api/bridge/spv-deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vault_id: vaultId,
                commitment: commitment,
                blockHeight: proof.blockHeight,
                txPos: proof.txPos,
                rawTxBytes: proof.rawTxBytes,
                voutIndex: proof.voutIndex,
                merkleProofWords: proof.merkleProofWords,
                bitcoin_txid: bitcoinTx,
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            
            // ✅ NEW: Better error handling for header not relayed
            if (errorData.code === 'HEADER_NOT_RELAYED') {
                throw new Error(`${errorData.error}\n\nThe header relay service is syncing block ${errorData.blockHeight}. Please wait 1-2 minutes and try again.`);
            }
            
            throw new Error(errorData.error || 'SPV relayer submission failed.');
        }

        const data = await response.json();
        console.log('[DEPOSIT] Relayer success:', data);

        setTxHash(data.transaction_hash);
        setVoyagerUrl(data.voyager_url || `https://sepolia.voyager.online/tx/${data.transaction_hash}`);
        setSubmitSuccess(true);
        setStep(4);

        toast({
            title: '✓ SPV Proof Verified on Starknet',
            description: 'Your Bitcoin SPV proof was verified on-chain, and mBTC has been minted to the vault.',
        });
    } catch (err: any) {
        setSubmitError(err.message);
        toast({
            title: '✗ Submission Failed',
            description: err.message,
            variant: 'destructive',
        });
    } finally {
        setIsSubmitting(false);
    }
};
```

## Summary of Changes

| Component | Change | Impact |
|-----------|--------|--------|
| **StarknetService** | Added `isHeaderStored()` method | ✅ Can check header availability programmatically |
| **bridge.ts** | Added header wait loop in `/spv-deposit` | ✅ Automatic retry up to 2 minutes |
| **bridge.ts** | Added `/header-status` endpoint | ✅ Frontend can pre-check header status |
| **BitcoinHeaderRelayService** | Reduced interval to 30s | ✅ Faster header relay (50% faster) |
| **BitcoinHeaderRelayService** | Increased blocks/cycle to 10 | ✅ Faster catch-up during sync |
| **Frontend** | Added pre-check before submission | ✅ Better UX with wait time estimates |
| **Frontend** | Better error messages | ✅ User knows to wait and retry |

## Expected Behavior After Fix

**Before Fix:**
```
User submits → Immediate failure → "Block header not relayed yet" → User confused
```

**After Fix:**
```
User submits 
→ Backend checks header availability
→ If not available: Wait up to 2 minutes, checking every 5 seconds
→ If available: Proceed with deposit
→ Success ✅
```

## Testing Instructions

1. **Deploy a Bitcoin transaction** and get 6 confirmations
2. **Immediately submit to Starknet** (don't wait for header relay)
3. **Observe**: Backend should automatically wait for header (up to 2 minutes)
4. **Result**: Should succeed without user intervention

## Monitoring

Check `/health` endpoint to see header relay status:
```bash
curl http://localhost:3001/health | jq '.headerRelay'
```

Check specific header availability:
```bash
curl "http://localhost:3001/api/bridge/header-status?height=294000"
```

---

**Status:** ✅ READY TO IMPLEMENT
**Priority:** CRITICAL
**Risk:** LOW (All changes are additive/defensive)
