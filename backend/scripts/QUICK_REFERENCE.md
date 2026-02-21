# PrivateBTC Backend Test Scripts - Quick Reference

## 📦 Created Scripts

All test scripts are in the `/scripts` directory in 3 formats:

### Node.js Scripts (.js) - **Recommended**
- ✅ `test-health.js` - Test health check endpoint
- ✅ `test-create-vault.js` - Create a new vault (deposit)
- ✅ `test-get-vaults.js` - Get user's vaults
- ✅ `test-generate-proof.js` - Generate ZK proof
- ✅ `test-withdraw.js` - Test withdrawal
- ✅ `test-stats.js` - Get platform statistics
- ✅ `test-all.js` - Run all tests in sequence

### PowerShell Scripts (.ps1) - Windows Alternative
- Same scripts with `.ps1` extension
- Color-coded output
- Data persistence via `last-vault.json`

### Batch Script (.bat) - Interactive
- `quick-test.bat` - Interactive menu for testing

## ⚡ Quick Usage

### Test Single Endpoint
```bash
# Health check
node scripts/test-health.js

# Create vault
node scripts/test-create-vault.js

# Get vaults
node scripts/test-get-vaults.js

# Platform stats
node scripts/test-stats.js
```

### Test Complete Workflow
```bash
# Run all tests
node scripts/test-all.js
```

### Interactive Testing
```batch
.\scripts\quick-test.bat
```

## 🔄 Workflow

The scripts follow this workflow:

1. **test-create-vault.js** → Creates vault, saves data to `last-vault.json`
2. **test-generate-proof.js** → Loads vault data, generates proof, updates `last-vault.json`
3. **test-withdraw.js** → Loads proof, attempts withdrawal

This allows you to chain tests together seamlessly!

## 📋 All Available Endpoints

| Method | Endpoint | Test Script |
|--------|----------|-------------|
| GET | `/health` | `test-health.js` |
| POST | `/api/vaults` | `test-create-vault.js` |
| GET | `/api/vaults/:address` | `test-get-vaults.js` |
| POST | `/api/vaults/generate-proof` | `test-generate-proof.js` |
| POST | `/api/vaults/:id/withdraw` | `test-withdraw.js` |
| GET | `/api/stats` | `test-stats.js` |

## 💡 Tips

- Scripts automatically save/load vault data
- Server must be running on `http://localhost:3001`
- Use `npm run dev` to start the backend
- Check `scripts/last-vault.json` for saved vault data
- All scripts have descriptive console output

## 🎯 Example Commands

```bash
# Full test suite
node scripts/test-all.js

# Test specific user's vaults
node scripts/test-get-vaults.js 0xMyWalletAddress

# Quick health check
node scripts/test-health.js
```

## 📝 Notes

- Data persists in `privatebtc.db`
- Vaults are locked for the specified period
- Withdrawal will fail on locked vaults (expected behavior)
- All responses are in JSON format

---

✅ **All scripts tested and working!**  
📖 See [README.md](README.md) for detailed documentation
