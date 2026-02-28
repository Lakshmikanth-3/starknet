$body = '{"ownerAddress":"0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1","amountSats":"1000000","lockDurationDays":30}'
$prep = Invoke-RestMethod -Uri "http://localhost:3001/api/vault/prepare-deposit" -Method POST -ContentType "application/json" -Body $body
$VAULT_ID = $prep.vaultId
$COMMITMENT = $prep.commitment
$body2 = "{`"vault_id`":`"$VAULT_ID`",`"commitment`":`"$COMMITMENT`",`"amount`":0.00001}"
try {
    $res = Invoke-RestMethod -Uri "http://localhost:3001/api/commitment/deposit" -Method POST -ContentType "application/json" -Body $body2
    $res | ConvertTo-Json -Depth 5
} catch {
    $_.ErrorDetails.Message
}
