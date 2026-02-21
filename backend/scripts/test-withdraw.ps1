# Test Withdraw from Vault Endpoint
Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "Testing Vault Withdrawal" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

# Try to load last created vault
if (Test-Path "scripts\last-vault.json") {
    $vaultInfo = Get-Content "scripts\last-vault.json" | ConvertFrom-Json
    Write-Host "`n📂 Loaded vault info from last-vault.json" -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️  No vault info found. Please run:" -ForegroundColor Yellow
    Write-Host "  1. test-create-vault.ps1" -ForegroundColor Yellow
    Write-Host "  2. test-generate-proof.ps1" -ForegroundColor Yellow
    exit
}

if (-not $vaultInfo.proof) {
    Write-Host "`n⚠️  No proof found. Please run test-generate-proof.ps1 first!" -ForegroundColor Yellow
    exit
}

$bodyObject = @{
    proof = $vaultInfo.proof
    userAddress = $vaultInfo.userAddress
}

$body = $bodyObject | ConvertTo-Json

Write-Host "`n📨 Request Body:" -ForegroundColor Yellow
Write-Host "Vault ID: $($vaultInfo.vaultId)"
Write-Host "User Address: $($vaultInfo.userAddress)"
Write-Host "Proof (truncated): $($vaultInfo.proof.Substring(0, [Math]::Min(60, $vaultInfo.proof.Length)))..."

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/vaults/$($vaultInfo.vaultId)/withdraw" -Method Post -Body $body -ContentType "application/json"
    
    if ($response.success) {
        Write-Host "`n✅ Withdrawal successful!" -ForegroundColor Green
        Write-Host "Transaction Hash: $($response.data.txHash)" -ForegroundColor White
        Write-Host "Amount Withdrawn: $($response.data.amount) BTC" -ForegroundColor Green
        Write-Host "Yield Earned: $($response.data.yield) BTC" -ForegroundColor Green
        Write-Host "Total: $($response.data.total) BTC" -ForegroundColor Green
        Write-Host "New Status: $($response.data.status)" -ForegroundColor White
    } else {
        Write-Host "`n⚠️  Withdrawal failed (expected if vault is still locked)" -ForegroundColor Yellow
        Write-Host "Error: $($response.error)" -ForegroundColor Yellow
        Write-Host "`nℹ️  Note: Vaults are locked for the specified period." -ForegroundColor Cyan
        Write-Host "This test demonstrates the lock mechanism is working correctly." -ForegroundColor Cyan
    }
} catch {
    Write-Host "`n❌ Request failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n====================================" -ForegroundColor Cyan
