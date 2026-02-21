# Test Generate ZK Proof Endpoint
Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "Testing Generate ZK Proof" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

# Try to load last created vault
if (Test-Path "scripts\last-vault.json") {
    $vaultInfo = Get-Content "scripts\last-vault.json" | ConvertFrom-Json
    Write-Host "`n📂 Loaded vault info from last-vault.json" -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️  No vault info found. Please run test-create-vault.ps1 first!" -ForegroundColor Yellow
    Write-Host "Using default test values..." -ForegroundColor Yellow
    $vaultInfo = @{
        vaultId = "test"
        randomness = "abc123"
        amount = 1.5
    }
}

$bodyObject = @{
    vaultId = $vaultInfo.vaultId
    amount = $vaultInfo.amount
    randomness = $vaultInfo.randomness
}

$body = $bodyObject | ConvertTo-Json

Write-Host "`n📨 Request Body:" -ForegroundColor Yellow
Write-Host $body

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/vaults/generate-proof" -Method Post -Body $body -ContentType "application/json"
    
    if ($response.success) {
        Write-Host "`n✅ ZK Proof generated successfully!" -ForegroundColor Green
        Write-Host "Proof (truncated): $($response.data.proof.Substring(0, [Math]::Min(60, $response.data.proof.Length)))..." -ForegroundColor White
        Write-Host "Verified: $($response.data.verified)" -ForegroundColor Green
        
        # Update vault info with proof
        $vaultInfo | Add-Member -NotePropertyName "proof" -NotePropertyValue $response.data.proof -Force
        $vaultInfo | ConvertTo-Json | Out-File "scripts\last-vault.json"
        Write-Host "`n💾 Proof saved to scripts\last-vault.json" -ForegroundColor Cyan
    } else {
        Write-Host "`n❌ Failed to generate proof!" -ForegroundColor Red
        Write-Host "Error: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "`n❌ Request failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n====================================" -ForegroundColor Cyan
