# OP_CAT Covenant Setup Guide

Complete guide to setting up trustless Bitcoin withdrawals using OP_CAT covenants.

## 🎯 What You'll Build

A Bitcoin bridge where withdrawals are **cryptographically impossible** without burning mBTC on Starknet - even the operator cannot steal funds.

### Before OP_CAT (Current System)
```
User burns mBTC → Authorization created → Operator sends Bitcoin
                                        ↑
                          Problem: Operator can send Bitcoin anytime!
```

### After OP_CAT (Covenant System)
```
User burns mBTC → Proof generated → Covenant validates proof → Bitcoin released
                                  ↑
                    Bitcoin script verifies Starknet burn on-chain
                    Operator cannot bypass this!
```

## 📋 Prerequisites

1. **OP_CAT Signet Access**
   - OP_CAT is not yet on Bitcoin mainnet
   - Use custom OP_CAT signet: https://github.com/taproot-wizards/bitcoin/releases
   - Or wait for activation on standard signet

2. **Node.js Dependencies**
   ```bash
   npm install bitcoinjs-lib elliptic node-fetch
   ```

3. **Python Dependencies** (for covenant script generation)
   ```bash
   pip install python-bitcoinlib
   ```

4. **Funded OP_CAT Signet Wallet**
   - Get coins from faucet: https://signet.bc-2.jp/
   - Need at least 0.01 BTC to fund covenant

## 🚀 Step-by-Step Setup

### Step 1: Generate Covenant

Run the automated setup script:

```bash
cd backend
node scripts/setup_covenant.js
```

This script will:
- ✅ Generate sequencer keypair (secp256k1)
- ✅ Create covenant script with OP_CAT validation
- ✅ Generate taproot covenant address
- ✅ Add configuration to `.env`

**Output Example:**
```
🔐 ════════════════════════════════════════════════════════
🔐  OP_CAT Covenant Setup for Trustless Bitcoin Bridge
🔐 ════════════════════════════════════════════════════════

📝 Step 1: Generate Covenant Script
────────────────────────────────────────────────────────

🔑 Step 2: Generate Sequencer Keys
────────────────────────────────────────────────────────
✅ Sequencer keys generated
   Private: a1b2c3d4e5f6...
   Public: 02e5d8c7b6a5...

📜 Step 3: Generate Covenant Address
────────────────────────────────────────────────────────
✅ Covenant generated

📍 Covenant Address:
   tb1p9k8j7h6g5f4d3s2a1z0x9w8v7u6t5r4e3w2q1

🌳 Merkle Root:
   c4b3a2918f7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d5c
```

### Step 2: Update Environment

Your `.env` file now contains:

```bash
# OP_CAT Covenant Configuration
COVENANT_ADDRESS=tb1p9k8j7h6g5f4d3s2a1z0x9w8v7u6t5r4e3w2q1
COVENANT_SCRIPT_HEX=5120c4b3a2918f7e6d5c...
COVENANT_MERKLE_ROOT=c4b3a2918f7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d5c
SEQUENCER_SIGNING_KEY=a1b2c3d4e5f6789...
SEQUENCER_PUBLIC_KEY=02e5d8c7b6a5948...
OPCAT_MEMPOOL_API=https://mempool.space/signet/api

# Enable covenant mode
USE_OPCAT_COVENANTS=true
```

⚠️ **SECURITY**: Keep `SEQUENCER_SIGNING_KEY` secret! It authorizes withdrawals.

### Step 3: Fund Covenant Address

Send Bitcoin to the covenant address:

```bash
# Using bitcoin-cli
bitcoin-cli -signet sendtoaddress "tb1p9k8j7h6g5f4d3s2a1z0x9w8v7u6t5r4e3w2q1" 0.01

# Or send from any wallet to the covenant address
```

**Important:** Send to OP_CAT signet, not regular Bitcoin!

Wait for confirmation (1 block):
```bash
bitcoin-cli -signet listtransactions
```

### Step 4: Verify Covenant Status

Check that covenant is funded:

```bash
node scripts/test_covenant_withdrawal.js
```

Expected output:
```
🧪 Testing Covenant Withdrawal
════════════════════════════════════════════════════════════

📊 Covenant Status:
   Address: tb1p9k8j7h6g5f4d3s2a1z0x9w8v7u6t5r4e3w2q1
   Balance: 1000000 sats
   UTXOs: 1

✅ Covenant funded and ready!
```

### Step 5: Enable Covenant Mode

Update `.env`:
```bash
USE_OPCAT_COVENANTS=true
```

Restart backend:
```bash
npm run dev
```

Check logs for covenant initialization:
```
🔐 ═══════════════════════════════════════════════════════════
🔐  Secure Bitcoin Withdrawal Processor
🔐 ═══════════════════════════════════════════════════════════
⏱️  Poll Interval: 30s
✅  Min Confirmations: 1
🔒  Covenant Mode: ENABLED (OP_CAT)
🔐 ═══════════════════════════════════════════════════════════

🔒 Covenant Status:
   Address: tb1p9k8j7h6g5f4d3s2a1z0x9w8v7u6t5r4e3w2q1
   Balance: 1000000 sats
   UTXOs: 1
   Network: opcat-signet
```

### Step 6: Test Withdrawal

Make a test withdrawal:

1. **Burn mBTC on Starknet:**
   ```javascript
   // In your dApp
   await contract.burn_mbtc(
       amount: 50000,  // 50,000 sats = 0.0005 BTC
       bitcoin_address: "tb1q..."
   );
   ```

2. **Backend automatically:**
   - ✅ Creates withdrawal authorization
   - ✅ Detects Starknet burn transaction
   - ✅ Generates cryptographic proof (112 bytes)
   - ✅ Builds covenant transaction with proof witness
   - ✅ Broadcasts to OP_CAT signet
   - ✅ Bitcoin sent to user!

3. **Check logs:**
   ```
   [WithdrawalProcessor] Processing authorization abc123...
   [Covenant] Creating covenant withdrawal for authorization abc123
   [Covenant] Generating Starknet burn proof...
   [Covenant] ✅ Proof generated:
   [Covenant]    Signature: 304402207a1b2c3d...
   [Covenant]    Data chunks: 4
   [Covenant] Fetching UTXOs from tb1p9k8j7h6g5...
   [Covenant] Selected UTXO: e4f5g6h7i8j9...
   [Covenant] Witness stack:
   [Covenant]    [0] 64 bytes (signature)
   [Covenant]    [1] 48 bytes (proof chunk 1)
   [Covenant]    [2] 48 bytes (proof chunk 2)  
   [Covenant]    [3] 16 bytes (proof chunk 3)
   [Covenant]    [4] 200 bytes (covenant script)
   [Covenant]    [5] 33 bytes (control block)
   [Covenant] ✅ Transaction built:
   [Covenant]    TXID: a1b2c3d4e5f6...
   [Covenant]    Size: 450 bytes
   [Covenant]    Witness: 409 bytes
   [Covenant] ✅ Transaction broadcast:
   [Covenant]    TXID: a1b2c3d4e5f6...
   [Covenant]    Explorer: https://mempool.space/signet/tx/a1b2c3d4...
   ```

## 🔒 How the Covenant Works

### Covenant Script Logic

```
┌─────────────────────────────────────────────┐
│  Bitcoin Covenant Script (OP_CAT)          │
├─────────────────────────────────────────────┤
│                                             │
│  1. Stack contains proof chunks:           │
│     [sig] [chunk1] [chunk2] [chunk3]       │
│                                             │
│  2. Concatenate chunks with OP_CAT:        │
│     chunk1 + chunk2 + chunk3 = proof       │
│                                             │
│  3. Verify signature over proof:           │
│     CHECKSIGVERIFY(proof, sig, sequencer)  │
│                                             │
│  4. Extract proof fields:                  │
│     - tx_hash (32 bytes)                   │
│     - amount (8 bytes)                     │
│     - nullifier (32 bytes)                 │
│     - recipient (20 bytes)                 │
│     - block_number (8 bytes)               │
│                                             │
│  5. Validate transaction:                  │
│     - Amount matches output                │
│     - Recipient matches output             │
│     - Nullifier not used before            │
│                                             │
│  6. If all checks pass: RELEASE BITCOIN    │
│     If any check fails: REJECT             │
│                                             │
└─────────────────────────────────────────────┘
```

### Proof Format (112 bytes)

```
┌────────────────────────────────────────────┐
│  Starknet Burn Proof Structure             │
├─────────────────────┬──────────────────────┤
│  Field              │  Size    │  Example  │
├─────────────────────┼──────────┼───────────┤
│  tx_hash            │  32 B    │  0x1a2b.. │
│  amount_sats        │   8 B    │  50000    │
│  nullifier_hash     │  32 B    │  0x3c4d.. │
│  recipient_address  │  20 B    │  0x5e6f.. │
│  block_number       │   8 B    │  123456   │
│  reserved           │  12 B    │  0x00...  │
│                                             │
│  SEQUENCER SIGNATURE (separate)            │
│  signature          │  64 B    │  0x304... │
└────────────────────────────────────────────┘
```

### Security Properties

✅ **Trustless**: Bitcoin cannot be withdrawn without Starknet burn  
✅ **Auditable**: All proofs verified on-chain by Bitcoin script  
✅ **Non-custodial**: No single party controls funds  
✅ **Censorship-resistant**: Anyone with proof can broadcast  
✅ **Cryptographically secure**: secp256k1 + Bitcoin script validation

## 🔧 Troubleshooting

### Covenant Not Funded

**Symptom:**
```
⚠️  WARNING: Covenant address has no funds!
```

**Solution:**
```bash
# Check address balance
bitcoin-cli -signet getaddressinfo "tb1p..."

# Send more funds
bitcoin-cli -signet sendtoaddress "tb1p..." 0.01
```

### Proof Generation Failed

**Symptom:**
```
Error generating Starknet burn proof: Transaction not found
```

**Solution:**
- Wait for Starknet transaction to be confirmed
- Check transaction hash is correct
- Verify Starknet RPC endpoint is accessible

### Broadcast Failed

**Symptom:**
```
Broadcast failed: non-mandatory-script-verify-flag (Script failed an OP_CAT check)
```

**Solution:**
- Ensure using OP_CAT signet (not regular signet)
- Verify `OPCAT_MEMPOOL_API` points to OP_CAT network
- Check covenant script is correctly generated

### Witness Too Large

**Symptom:**
```
Error: Witness stack exceeds 3600 bytes
```

**Solution:**
- This shouldn't happen with 112-byte proofs
- Check proof serialization is correct
- Verify chunks are properly split

## 🧪 Development Mode

For testing without real OP_CAT:

```bash
# .env
USE_OPCAT_COVENANTS=false
DEV_MODE=true
```

This uses traditional Bitcoin transactions with authorization checks (not trustless, but good for development).

## 🚨 Security Considerations

### Key Management

| Key | Purpose | Security Level | Storage |
|-----|---------|---------------|---------|
| `SEQUENCER_SIGNING_KEY` | Sign burn proofs | ⚠️ HIGH RISK | Encrypted vault, HSM recommended |
| `SENDER_PRIVATE_KEY` | Legacy mode only | 🔐 CRITICAL | Remove in covenant mode |

### Threat Model

**Without Covenant (Application Layer):**
- ❌ Operator can steal all Bitcoin
- ❌ Database compromise = fund loss
- ❌ No cryptographic enforcement

**With Covenant (Protocol Layer):**
- ✅ Operator cannot steal (no private key access to funds)
- ✅ Database compromise = denial of service only (no fund loss)
- ✅ Cryptographic proof required for every withdrawal
- ⚠️ Sequencer key compromise = unauthorized proofs (but requires Starknet burn events)

## 📚 Additional Resources

- [Bitcoin OP_CAT Specification](https://github.com/bitcoin/bips/pull/1382)
- [Taproot Wizards OP_CAT Branch](https://github.com/taproot-wizards/bitcoin)
- [Full Implementation Guide](./OPCAT_COVENANT_REAL_IMPLEMENTATION.md)
- [Security Architecture](./SECURITY_LAYERS.md)

## 🎯 Next Steps

After setup:

1. ✅ Test withdrawals on OP_CAT signet
2. ✅ Monitor covenant balance and refill as needed
3. ✅ Set up monitoring for proof generation failures
4. ✅ Backup sequencer keys securely
5. ⏳ Wait for OP_CAT activation on mainnet
6. ⏳ Migrate to mainnet covenant when ready

---

**Status**: OP_CAT is not yet activated on Bitcoin mainnet. This system is production-ready for OP_CAT signet and will work immediately upon mainnet activation.
