$body = '{"vault_id":"3e90202f-5187-4975-9aa8-908fd06a25ce","amountSats":"10000","starknetAddress":"0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1","bitcoinAddress":"tb1qj5p3krc3rtvcck50v0rdn3r63z4j89cdk53s8d"}'
try {
    $res = Invoke-RestMethod -Uri "http://localhost:3001/api/vault/withdraw" -Method POST -ContentType "application/json" -Body $body
    $res | ConvertTo-Json -Depth 5
}
catch {
    $_.ErrorDetails.Message
}
