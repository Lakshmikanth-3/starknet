# Test Get User Vaults Endpoint
param(
    [string]$userAddress = "0xtest123456789"
)

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "Testing Get User Vaults" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

Write-Host "`n🔍 Fetching vaults for: $userAddress" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/vaults/$userAddress" -Method Get
    
    if ($response.success) {
        Write-Host "`n✅ Found $($response.count) vault(s)!" -ForegroundColor Green
        
        $response.data | ForEach-Object {
            Write-Host "`n📦 Vault Details:" -ForegroundColor Cyan
            Write-Host "  ID: $($_.vaultId)" -ForegroundColor White
            Write-Host "  Status: $($_.status)" -ForegroundColor $(if ($_.status -eq 'active') {'Green'} else {'Yellow'})
            Write-Host "  Amount: $($_.amount) BTC" -ForegroundColor White
            Write-Host "  Lock Period: $($_.lockPeriod) days" -ForegroundColor White
            Write-Host "  Days Remaining: $($_.daysRemaining)" -ForegroundColor White
            Write-Host "  APY: $($_.apy * 100)%" -ForegroundColor White
            Write-Host "  Projected Yield: $($_.projectedYield) BTC" -ForegroundColor Green
            Write-Host "  Total Withdrawal: $($_.totalWithdrawal) BTC" -ForegroundColor Green
            Write-Host "  Created: $(Get-Date -UnixTimeMilliseconds $_.createdAt)" -ForegroundColor White
        }
    } else {
        Write-Host "`n❌ Failed to get vaults!" -ForegroundColor Red
        Write-Host "Error: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "`n❌ Request failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n====================================" -ForegroundColor Cyan
