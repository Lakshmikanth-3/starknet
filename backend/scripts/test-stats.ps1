# Test Platform Stats Endpoint
Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "Testing Platform Statistics" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/stats" -Method Get
    
    if ($response.success) {
        Write-Host "`n✅ Platform Stats Retrieved!" -ForegroundColor Green
        Write-Host "`n📊 Statistics:" -ForegroundColor Cyan
        Write-Host "  Total Vaults: $($response.data.totalVaults)" -ForegroundColor White
        Write-Host "  Active Vaults: $($response.data.activeVaults)" -ForegroundColor Green
        Write-Host "  Completed Vaults: $($response.data.completedVaults)" -ForegroundColor Yellow
        Write-Host "  Total Value Locked: $($response.data.totalValueLocked) BTC" -ForegroundColor Green
        Write-Host "  Total Withdrawals: $($response.data.totalWithdrawals)" -ForegroundColor White
        Write-Host "  Average APY: $($response.data.averageApy * 100)%" -ForegroundColor Cyan
    } else {
        Write-Host "`n❌ Failed to get stats!" -ForegroundColor Red
        Write-Host "Error: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "`n❌ Request failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n====================================" -ForegroundColor Cyan
