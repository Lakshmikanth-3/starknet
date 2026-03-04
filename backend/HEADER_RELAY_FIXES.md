# Critical Bug Fixes - Header Relay & SPV Deposit

## Issues Fixed

### 1. **"Block identifier unmanaged: pending" Error** ✅
**Root Cause**: Header relay service was using `getNonce('pending')` which caused Starknet RPC to reject transactions.

**Fix**: Changed to `getNonce('latest')` in [BitcoinHeaderRelayService.ts](src/services/BitcoinHeaderRelayService.ts#L166)
```typescript
// Before: const nonce = await account.getNonce('pending');
// After:  const nonce = await account.getNonce('latest');
```

### 2. **RPC Fetch Failures & Circuit Breaker Issues** ✅
**Root Cause**: 
- No retry logic for transient network failures
- Circuit breaker tripped on application errors (not network errors)
- Short RPC timeout (15s) caused unnecessary failures

**Fixes**:
- **Increased RPC timeout**: 15s → 30s for better reliability
- **Smart error categorization**: Circuit breaker now only trips on network errors, not application errors
- **Retry logic with exponential backoff**: 
  - Bitcoin API calls: 3 retries with 500ms → 2.5s backoff
  - Starknet transactions: 3 retries with 1s → 10s backoff
- **Better error messages**: Distinguishes network vs application errors

### 3. **Missing Error Handling in Header Relay** ✅
**Root Cause**: Relay cycle had insufficient error boundaries

**Fixes**:
- Top-level try-catch in `relayCycle()` to handle initialization failures
- Per-block error handling with detailed retry messages
- Graceful degradation - failed blocks retry in next cycle

### 4. **No Visibility into Header Relay Status** ✅
**Fix**: Added health check endpoint integration
- New `getHeaderRelayStatus()` function
- `/health` endpoint now reports:
  - Whether relay is running
  - Last relayed block height
  - Poll interval

## Changes Summary

### Files Modified

1. **[BitcoinHeaderRelayService.ts](src/services/BitcoinHeaderRelayService.ts)**
   - ✅ Fixed getNonce: `'pending'` → `'latest'`
   - ✅ Added retry logic to all Bitcoin API calls
   - ✅ Added retry logic to Starknet header relay transactions
   - ✅ Improved error logging with retry countdown
   - ✅ Added `getHeaderRelayStatus()` for monitoring
   - ✅ Increased transaction gap: 3s → 5s to reduce RPC load

2. **[StarknetService.ts](src/services/StarknetService.ts)**
   - ✅ Increased RPC timeout: 15s → 30s
   - ✅ Smart error categorization in circuit breaker
   - ✅ Network errors vs application errors now handled separately
   - ✅ Better logging for different error types

3. **[index.ts](src/index.ts)**
   - ✅ Enhanced `/health` endpoint with header relay status

## Error Handling Improvements

### Network Errors (Trigger Circuit Breaker)
- `fetch failed`
- `timed out`
- `ECONNREFUSED` / `ENOTFOUND` / `EAI_AGAIN`
- HTTP 502/503/504

### Application Errors (Don't Trigger Circuit Breaker)
- `insufficient balance`
- `Invalid transaction`
- `Validation failed`
- `Block header not relayed yet`

## Testing Recommendations

1. **Monitor logs** after restart - should see:
   ```
   [HeaderRelay] Starting Bitcoin Signet header relay service...
   [HeaderRelay] Relaying X block(s): NNNN → MMMM (tip: XXXX)
   [HeaderRelay] ✅ Stored block NNNN on Starknet. TX: 0x...
   ```

2. **Check health endpoint**: `GET http://localhost:PORT/health`
   - Should include `headerRelay.running: true`
   - Should show `lastRelayedHeight` increasing

3. **Test SPV deposits** - should now succeed once headers are relayed

## Expected Behavior

- **No more "Block identifier unmanaged: pending"** errors
- **No more "fetch failed"** cascading errors
- **Circuit breaker only trips on actual network issues**, not validation errors
- **Automatic retry** on transient failures
- **Better observability** via health endpoint

---

**Date**: 2026-03-03
**Status**: ✅ All critical bugs fixed, no compilation errors
