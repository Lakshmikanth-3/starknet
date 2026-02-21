#!/bin/bash
# SEPOLIA DEPLOYMENT using sncast (the tool that actually works)

set -e

RPC="https://free-rpc.nethermind.io/sepolia-juno/v0_7"
ACCOUNT="sepolia"  # Your existing account

echo "🚀 DEPLOYING TO SEPOLIA TESTNET"
echo "   Account: $ACCOUNT"
echo "   RPC: $RPC"
echo ""

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/contracts

# Build contracts first
echo "🔨 Building contracts..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build

echo "✅ Contracts built"
echo ""

# Declare and deploy MockBTC
echo "---------------------------------------------------"
echo "👉 Step 1: MockBTC"
echo ""

echo "📋 Declaring MockBTC..."
MOCK_OUTPUT=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account "$ACCOUNT" \
  --url "$RPC" \
  declare \
  --contract-name MockBTC 2>&1)

echo "$MOCK_OUTPUT"

# Parse class hash from output
MOCK_HASH=$(echo "$MOCK_OUTPUT" | grep -oP 'class_hash: 0x[a-fA-F0-9]+' | cut -d' ' -f2 | head -1)

if [ -z "$MOCK_HASH" ]; then
  echo "⚠️  Could not parse class hash, checking if already declared..."
  # If already declared, it should still be in output somewhere
  MOCK_HASH=$(echo "$MOCK_OUTPUT" | grep -oP '0x[a-fA-F0-9]{63,64}' | head -1)
fi

echo "✅ MockBTC Class Hash: $MOCK_HASH"
echo ""

echo "🚢 Deploying MockBTC..."
# Get account address for constructor
ACCT_ADDR=$(grep -A 10 "\"$ACCOUNT\"" ~/.starknet_accounts/starknet_open_zeppelin_accounts.json | grep '"address"' | cut -d '"' -f 4 | head -1)

MOCK_DEPLOY=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account "$ACCOUNT" \
  --url "$RPC" \
  deploy \
  --class-hash "$MOCK_HASH" \
  --constructor-calldata "$ACCT_ADDR" 2>&1)

echo "$MOCK_DEPLOY"

MOCK_ADDR=$(echo "$MOCK_DEPLOY" | grep -oP 'contract_address: 0x[a-fA-F0-9]+' | cut -d' ' -f2)

if [ -z "$MOCK_ADDR" ]; then
  echo "❌ Failed to deploy MockBTC"
  exit 1
fi

echo "✅ MockBTC Address: $MOCK_ADDR"
echo ""

# Declare and deploy Vault
echo "---------------------------------------------------"
echo "👉 Step 2: PrivateBTCVault"
echo ""

echo "📋 Declaring Vault..."
VAULT_OUTPUT=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account "$ACCOUNT" \
  --url "$RPC" \
  declare \
  --contract-name PrivateBTCVault 2>&1)

echo "$VAULT_OUTPUT"

VAULT_HASH=$(echo "$VAULT_OUTPUT" | grep -oP 'class_hash: 0x[a-fA-F0-9]+' | cut -d' ' -f2 | head -1)

if [ -z "$VAULT_HASH" ]; then
  VAULT_HASH=$(echo "$VAULT_OUTPUT" | grep -oP '0x[a-fA-F0-9]{63,64}' | head -1)
fi

echo "✅ Vault Class Hash: $VAULT_HASH"
echo ""

echo "🚢 Deploying Vault..."
VAULT_DEPLOY=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account "$ACCOUNT" \
  --url "$RPC" \
  deploy \
  --class-hash "$VAULT_HASH" \
  --constructor-calldata "$MOCK_ADDR" 2>&1)

echo "$VAULT_DEPLOY"

VAULT_ADDR=$(echo "$VAULT_DEPLOY" | grep -oP 'contract_address: 0x[a-fA-F0-9]+' | cut -d' ' -f2)

if [ -z "$VAULT_ADDR" ]; then
  echo "❌ Failed to deploy Vault"
  exit 1
fi

echo "✅ Vault Address: $VAULT_ADDR"
echo ""

# Save deployment info
cat > /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/backend/deployment-info.json <<EOF
{
  "network": "sepolia-testnet",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "MockBTC": {
      "classHash": "$MOCK_HASH",
      "address": "$MOCK_ADDR"
    },
    "PrivateBTCVault": {
      "classHash": "$VAULT_HASH",
      "address":  "$VAULT_ADDR"
    }
  },
  "explorer": {
    "mockBtc": "https://sepolia.voyager.online/contract/$MOCK_ADDR",
    "vault": "https://sepolia.voyager.online/contract/$VAULT_ADDR"
  }
}
EOF

echo "═══════════════════════════════════════════════"
echo "🎉 SEPOLIA DEPLOYMENT COMPLETE!"
echo "═══════════════════════════════════════════════"
echo ""
echo "📝 Contract Addresses:"
echo "   MockBTC:  $MOCK_ADDR"
echo "   Vault:    $VAULT_ADDR"
echo ""
echo "🔍 Voyager Explorer:"
echo "   https://sepolia.voyager.online/contract/$MOCK_ADDR"
echo "   https://sepolia.voyager.online/contract/$VAULT_ADDR"
echo ""
echo "✅ Saved to deployment-info.json"
