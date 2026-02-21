# PrivateBTC Backend Test Scripts

This directory contains comprehensive test scripts for all backend API endpoints.

## 📦 Available Script Formats

- **Node.js** (`.js`) - Recommended, more reliable
- **PowerShell** (`.ps1`) - Windows alternative
- **Batch + Curl** (`.bat`) - Interactive menu

## 🚀 Quick Start

### Run All Tests

**Node.js** (recommended):
```bash
node scripts/test-all.js
```

**PowerShell**:
```powershell
.\scripts\test-all.ps1
```

**Interactive Menu**:
```batch
.\scripts\quick-test.bat
```

### Run Individual Tests

#### 1. Health Check
Tests the `/health` endpoint to verify the server is running.
```bash
node scripts/test-health.js
# Or PowerShell: .\scripts\test-health.ps1
```

#### 2. Create Vault (Deposit)
Creates a new BTC vault with a lock period.
```bash
node scripts/test-create-vault.js
# Or PowerShell: .\scripts\test-create-vault.ps1
```
**Output**: Saves vault info to `scripts/last-vault.json`

#### 3. Get User Vaults
Retrieves all vaults for a specific user address.
```bash
node scripts/test-get-vaults.js
# With custom address:
node scripts/test-get-vaults.js 0xYourAddress
```

#### 4. Generate ZK Proof
Generates zero-knowledge proof for a vault.
```bash
node scripts/test-generate-proof.js
# Or PowerShell: .\scripts\test-generate-proof.ps1
```
**Requires**: `last-vault.json` from test-create-vault

#### 5. Platform Statistics
Gets platform-wide statistics (TVL, active vaults, etc).
```bash
node scripts/test-stats.js
# Or PowerShell: .\scripts\test-stats.ps1
```

#### 6. Withdraw from Vault
Tests the withdrawal process (will fail if vault is still locked).
```bash
node scripts/test-withdraw.js
# Or PowerShell: .\scripts\test-withdraw.ps1
```
**Requires**: `last-vault.json` with proof from test-generate-proof

## 📋 Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| POST | `/api/vaults` | Create new vault (deposit) |
| GET | `/api/vaults/:userAddress` | Get user's vaults |
| POST | `/api/vaults/generate-proof` | Generate ZK proof |
| POST | `/api/vaults/:vaultId/withdraw` | Withdraw from vault |
| GET | `/api/stats` | Platform statistics |

## 🔄 Typical Test Flow

1. **Create Vault** → Saves vault ID and randomness
2. **Generate Proof** → Creates ZK proof for vault
3. **Withdraw** → Attempts withdrawal (will fail if locked)

The scripts automatically save and load vault information via `last-vault.json`, making it easy to chain tests together.

## 📝 Notes

- Make sure the backend is running on `http://localhost:3001`
- Start the server with: `npm run dev`
- Vault data persists in `privatebtc.db`
- ZK proofs are required for withdrawals
- Vaults are locked for the specified period (default 90 days)

## 🐛 Troubleshooting

### Server not responding
```powershell
# Check if server is running
curl http://localhost:3001/health
```

### Clear test data
Delete `scripts\last-vault.json` to start fresh

### View database
Use a SQLite viewer to inspect `privatebtc.db`

## 🎯 Example Usage

```powershell
# Full workflow test
.\scripts\test-all.ps1

# Custom vault creation
.\scripts\test-create-vault.ps1

# Check specific user's vaults
.\scripts\test-get-vaults.ps1 -userAddress "0xMyWallet"
```

## 📊 Output Format

All scripts provide colored, formatted output:
- ✅ Green = Success
- ❌ Red = Error
- ⚠️ Yellow = Warning
- ℹ️ Cyan = Info
