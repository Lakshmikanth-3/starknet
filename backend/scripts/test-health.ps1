# Test Health Check Endpoint
Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "Testing Health Check Endpoint" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "`n✅ Health check passed!" -ForegroundColor Green
    Write-Host "Status: $($response.status)" -ForegroundColor White
    Write-Host "Service: $($response.service)" -ForegroundColor White
    Write-Host "Version: $($response.version)" -ForegroundColor White
    Write-Host "Timestamp: $(Get-Date -UnixTimeMilliseconds $response.timestamp)" -ForegroundColor White
} catch {
    Write-Host "`n❌ Health check failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n====================================" -ForegroundColor Cyan
