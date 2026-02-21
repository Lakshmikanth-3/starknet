# Run all test scripts in sequence
Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "║      PrivateBTC Backend - Complete Test Suite         ║" -ForegroundColor Magenta
Write-Host "║                                                        ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

$scriptsDir = $PSScriptRoot

Write-Host "`n🎯 Running all endpoint tests..." -ForegroundColor Cyan
Write-Host "Press any key to continue or Ctrl+C to cancel..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Test 1: Health Check
Write-Host "`n[1/6] Running Health Check Test..." -ForegroundColor Yellow
& "$scriptsDir\test-health.ps1"
Start-Sleep -Seconds 2

# Test 2: Create Vault
Write-Host "`n[2/6] Running Create Vault Test..." -ForegroundColor Yellow
& "$scriptsDir\test-create-vault.ps1"
Start-Sleep -Seconds 2

# Test 3: Get User Vaults
Write-Host "`n[3/6] Running Get User Vaults Test..." -ForegroundColor Yellow
& "$scriptsDir\test-get-vaults.ps1"
Start-Sleep -Seconds 2

# Test 4: Generate ZK Proof
Write-Host "`n[4/6] Running Generate Proof Test..." -ForegroundColor Yellow
& "$scriptsDir\test-generate-proof.ps1"
Start-Sleep -Seconds 2

# Test 5: Platform Stats
Write-Host "`n[5/6] Running Platform Stats Test..." -ForegroundColor Yellow
& "$scriptsDir\test-stats.ps1"
Start-Sleep -Seconds 2

# Test 6: Withdrawal (should fail - vault locked)
Write-Host "`n[6/6] Running Withdrawal Test..." -ForegroundColor Yellow
& "$scriptsDir\test-withdraw.ps1"

Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                        ║" -ForegroundColor Green
Write-Host "║            ✅ ALL TESTS COMPLETED!                    ║" -ForegroundColor Green
Write-Host "║                                                        ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📝 Summary:" -ForegroundColor Cyan
Write-Host "  - Health check validated" -ForegroundColor White
Write-Host "  - Vault creation tested" -ForegroundColor White
Write-Host "  - User vaults retrieval tested" -ForegroundColor White
Write-Host "  - ZK proof generation tested" -ForegroundColor White
Write-Host "  - Platform statistics tested" -ForegroundColor White
Write-Host "  - Withdrawal process tested" -ForegroundColor White

Write-Host "`n💡 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Review vault data in scripts\last-vault.json" -ForegroundColor White
Write-Host "  2. Check the database: privatebtc.db" -ForegroundColor White
Write-Host "  3. Build the frontend interface" -ForegroundColor White
Write-Host "  4. Deploy to production" -ForegroundColor White
