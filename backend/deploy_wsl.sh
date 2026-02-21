#!/bin/bash

# Configuration from DevNet Log (VERIFIED)
RPC_URL="http://127.0.0.1:5060"
# Confirmed from logs
ACCOUNT_ADDRESS="0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
PRIVATE_KEY="0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9"

echo "🚀 Deploying PrivateBTC Contracts to Local DevNet (WSL)..."

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

echo "🔨 Building contracts..."
source ~/.bashrc
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build

echo "---------------------------------------------------"
echo "👉 Step 1: Deploying MockBTC"

MOCK_BTC_FILE="target/dev/private_btc_core_MockBTC.contract_class.json"
if [ ! -f "$MOCK_BTC_FILE" ]; then
    echo "❌ MockBTC file not found at $MOCK_BTC_FILE"
    ls target/dev/
    exit 1
fi

echo "📋 Declaring MockBTC..."
MOCK_CLASS_HASH_OUT=$(~/.starkli/bin/starkli declare "$MOCK_BTC_FILE" --rpc "$RPC_URL" --account "$ACCOUNT_ADDRESS" --private-key "$PRIVATE_KEY" --watch 2>/dev/null)
# Extract hash usually from stderr or stdout depending on version, try to parse robustly
MOCK_CLASS_HASH=$(echo "$MOCK_CLASS_HASH_OUT" | grep -oP 'Class hash declared: \K0x[a-fA-F0-9]+')

# If empty, maybe it's already declared
if [ -z "$MOCK_CLASS_HASH" ]; then
     MOCK_CLASS_HASH=$(~/.starkli/bin/starkli class-hash "$MOCK_BTC_FILE")
     echo "⚠️ Already declared? Using computed class hash: $MOCK_CLASS_HASH"
fi
echo "✅ MockBTC Class Hash: $MOCK_CLASS_HASH"

echo "🚢 Deploying MockBTC..."
# Constructor args: recipient (using our account)
MOCK_DEPLOY_OUT=$(~/.starkli/bin/starkli deploy "$MOCK_CLASS_HASH" "$ACCOUNT_ADDRESS" --rpc "$RPC_URL" --account "$ACCOUNT_ADDRESS" --private-key "$PRIVATE_KEY" --watch 2>/dev/null)
MOCK_ADDRESS=$(echo "$MOCK_DEPLOY_OUT" | grep -oP 'The contract is deployed at: \K0x[a-fA-F0-9]+')
echo "✅ MockBTC Address: $MOCK_ADDRESS"

echo "---------------------------------------------------"
echo "👉 Step 2: Deploying PrivateBTCVault"

VAULT_FILE="target/dev/private_btc_core_PrivateBTCVault.contract_class.json"
if [ ! -f "$VAULT_FILE" ]; then
    echo "❌ PrivateBTCVault file not found at $VAULT_FILE"
    ls target/dev/
    exit 1
fi

echo "📋 Declaring PrivateBTCVault..."
VAULT_CLASS_HASH_OUT=$(~/.starkli/bin/starkli declare "$VAULT_FILE" --rpc "$RPC_URL" --account "$ACCOUNT_ADDRESS" --private-key "$PRIVATE_KEY" --watch 2>/dev/null)
VAULT_CLASS_HASH=$(echo "$VAULT_CLASS_HASH_OUT" | grep -oP 'Class hash declared: \K0x[a-fA-F0-9]+')

if [ -z "$VAULT_CLASS_HASH" ]; then
     VAULT_CLASS_HASH=$(~/.starkli/bin/starkli class-hash "$VAULT_FILE")
     echo "⚠️ Already declared? Using computed class hash: $VAULT_CLASS_HASH"
fi
echo "✅ PrivateBTCVault Class Hash: $VAULT_CLASS_HASH"

echo "🚢 Deploying PrivateBTCVault..."
# Constructor args: btc_token (MOCK_ADDRESS)
VAULT_DEPLOY_OUT=$(~/.starkli/bin/starkli deploy "$VAULT_CLASS_HASH" "$MOCK_ADDRESS" --rpc "$RPC_URL" --account "$ACCOUNT_ADDRESS" --private-key "$PRIVATE_KEY" --watch 2>/dev/null)
VAULT_ADDRESS=$(echo "$VAULT_DEPLOY_OUT" | grep -oP 'The contract is deployed at: \K0x[a-fA-F0-9]+')
echo "✅ PrivateBTCVault Address: $VAULT_ADDRESS"


echo "---------------------------------------------------"
echo "💾 Saving deployment info..."

OUTPUT_FILE="../privatebtc-backend/deployment-info.json"
cat > "$OUTPUT_FILE" <<EOF
{
  "network": "devnet-local",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "contracts": {
    "MockBTC": {
      "classHash": "$MOCK_CLASS_HASH",
      "address": "$MOCK_ADDRESS"
    },
    "PrivateBTCVault": {
      "classHash": "$VAULT_CLASS_HASH",
      "address": "$VAULT_ADDRESS"
    }
  }
}
EOF

echo "🎉 Deployment Complete!"
