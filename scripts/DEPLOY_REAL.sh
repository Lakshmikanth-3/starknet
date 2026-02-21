#!/bin/bash
# DEPLOY USING SNCAST with working account

set -e

RPC="http://127.0.0.1:5060"
ACCOUNT="my_deployer_2"  # Already exists and funded

MOCK_HASH="0x04dbf6009feb48d7a1100d9c5aeb7607f7dfc02d8f984fe7f8ac8d7d79a5189b"
VAULT_HASH="0x067f2255713ea2c7abdafcfa8978013c0856e2f77841432e1b9598a66b0df9a2"

# Get account address for constructor
ACCT_ADDR=$(grep -A 10 "$ACCOUNT" ~/.starknet_accounts/starknet_open_zeppelin_accounts.json | grep '"address"' | cut -d '"' -f 4)

echo "🚀 DEPLOYING WITH SNCAST"
echo "Account: $ACCT_ADDR"
echo ""

# First deploy the account if not already deployed
echo "👤 Deploying account..."
/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  account deploy \
  --name "$ACCOUNT" \
  --url "$RPC" \
  --max-fee 1000000000000000 || echo "Account already deployed"

echo ""
echo "👉 Deploying MockBTC..."

# Deploy MockBTC (class hash already declared)
MOCK_OUTPUT=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  deploy \
  --class-hash "$MOCK_HASH" \
  --constructor-calldata "$ACCT_ADDR" \
  --url "$RPC" \
  --account "$ACCOUNT" \
  --fee-token eth)

echo "$MOCK_OUTPUT"

# Parse address
MOCK_ADDR=$(echo "$MOCK_OUTPUT" | grep -oP 'contract_address: 0x[a-fA-F0-9]+' | cut -d' ' -f2)

if [ -z "$MOCK_ADDR" ]; then
  echo "❌ Failed to get MockBTC address"
  exit 1
fi

echo "✅ MockBTC: $MOCK_ADDR"
echo ""
echo "👉 Deploying Vault..."

# Deploy Vault
VAULT_OUTPUT=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  deploy \
  --class-hash "$VAULT_HASH" \
  --constructor-calldata "$MOCK_ADDR" \
  --url "$RPC" \
  --account "$ACCOUNT" \
  --fee-token eth)

echo "$VAULT_OUTPUT"

VAULT_ADDR=$(echo "$VAULT_OUTPUT" | grep -oP 'contract_address: 0x[a-fA-F0-9]+' | cut -d' ' -f2)

if [ -z "$VAULT_ADDR" ]; then
  echo "❌ Failed to get Vault address"
  exit 1
fi

echo "✅ Vault: $VAULT_ADDR"
echo ""

# Save deployment info
cat > /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/privatebtc-backend/deployment-info.json <<EOF
{
  "network": "devnet-local",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "MockBTC": {
      "classHash": "$MOCK_HASH",
      "address": "$MOCK_ADDR"
    },
    "PrivateBTCVault": {
      "classHash": "$VAULT_HASH",
      "address": "$VAULT_ADDR"
    }
  }
}
EOF

echo "🎉 REAL DEPLOYMENT COMPLETE!"
echo ""
echo "📝 Addresses saved to deployment-info.json:"
echo "   MockBTC: $MOCK_ADDR"
echo "   Vault:   $VAULT_ADDR"
