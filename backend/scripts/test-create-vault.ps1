# Test Create Vault Endpoint
Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "Testing Create Vault (Deposit)" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

$bodyObject = @{
    userAddress = "0xtest123456789"
    amount = 2.5
    lockPeriod = 90
}

$body = $bodyObject | ConvertTo-Json

Write-Host "`n📨 Request Body:" -ForegroundColor Yellow
Write-Host $body

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/vaults" -Method Post -Body $body -ContentType "application/json"
    
    if ($response.success) {
        Write-Host "`n✅ Vault created successfully!" -ForegroundColor Green
        Write-Host "Vault ID: $($response.data.vaultId)" -ForegroundColor White
        Write-Host "Commitment: $($response.data.commitment)" -ForegroundColor White
        Write-Host "Amount: $($response.data.amount) BTC" -ForegroundColor White
        Write-Host "APY: $($response.data.apy * 100)%" -ForegroundColor White
        Write-Host "Lock Until: $(Get-Date -UnixTimeMilliseconds $response.data.lockUntil)" -ForegroundColor White
        Write-Host "Randomness: $($response.data.randomness)" -ForegroundColor Green
        
        # Save vault info for other tests
        $vaultInfo = @{
            vaultId = $response.data.vaultId
            randomness = $response.data.randomness
            userAddress = "0xtest123456789"
            amount = $response.data.amount
        }
        $vaultInfo | ConvertTo-Json | Out-File "scripts\last-vault.json"
        Write-Host "`n💾 Vault info saved to scripts\last-vault.json" -ForegroundColor Cyan
    } else {
        Write-Host "`n❌ Failed to create vault!" -ForegroundColor Red
        Write-Host "Error: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "`n❌ Request failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n====================================" -ForegroundColor Cyan
