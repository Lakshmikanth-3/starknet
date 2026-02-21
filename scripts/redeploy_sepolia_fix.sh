#!/bin/bash
# scripts/redeploy_sepolia_fix.sh
# Build, Declare, and Deploy fixed contracts to Sepolia

set -e

# Configuration
ACCOUNT="sepolia"
CONTRACTS_DIR="/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/contracts"
BACKEND_DIR="/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/backend"

# Ensure STRK is used for fees
export STARKNET_FEE_TOKEN="strk"

echo "🚀 REDEPLOYING FIXED CONTRACTS TO SEPOLIA"
echo "----------------------------------------"

# 1. Build Contracts
echo "📦 Building contracts..."
cd "$CONTRACTS_DIR"
/home/sl/.asdf/installs/scarb/2.15.2/bin/scarb build
echo "✅ Build complete!"

# 2. Declare MockBTC
echo "📜 Declaring MockBTC..."
/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account "$ACCOUNT" \
  declare \
  --network sepolia \
  --contract-name MockBTC || echo "⚠️  Declaration might exist or failed..."

# Capture Class Hash
MOCK_DECLARE_OUT=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast --account "$ACCOUNT" declare --network sepolia --contract-name MockBTC --json || true)
MOCK_CLASS_HASH=$(echo "$MOCK_DECLARE_OUT" | grep -oP '"class_hash":"\K[^"]+' || echo "0x04dbf6009feb48d7a1100d9c5aeb7607f7dfc02d8f984fe7f8ac8d7d79a5189b")
echo "✅ MockBTC Class Hash: $MOCK_CLASS_HASH"

# 3. Deploy MockBTC
echo "🪙 Deploying MockBTC..."
MOCK_BTC_OUT=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account "$ACCOUNT" \
  deploy \
  --network sepolia \
  --class-hash "$MOCK_CLASS_HASH" \
  --constructor-calldata "0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1")
# Improved parsing to capture address even with more output
MOCK_BTC_ADDR=$(echo "$MOCK_BTC_OUT" | grep -oP '0x[a-fA-F0-9]{60,}' | head -1)
echo "✅ MockBTC Address: $MOCK_BTC_ADDR"

# 4. Declare PrivateBTCVault
echo "📜 Declaring PrivateBTCVault..."
/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account "$ACCOUNT" \
  declare \
  --network sepolia \
  --contract-name PrivateBTCVault || echo "⚠️  Declaration might exist or failed..."

VAULT_DECLARE_OUT=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast --account "$ACCOUNT" declare --network sepolia --contract-name PrivateBTCVault --json || true)
VAULT_CLASS_HASH=$(echo "$VAULT_DECLARE_OUT" | grep -oP '"class_hash":"\K[^"]+' || echo "0x067f2255713ea2c7abdafcfa8978013c0856e2f77841432e1b9598a66b0df9a2")
echo "✅ Vault Class Hash: $VAULT_CLASS_HASH"

echo "⏱️ Waiting for indexing..."
sleep 15

# 5. Deploy PrivateBTCVault
echo "🏦 Deploying PrivateBTCVault..."
VAULT_OUT=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account "$ACCOUNT" \
  deploy \
  --network sepolia \
  --class-hash "$VAULT_CLASS_HASH" \
  --constructor-calldata "$MOCK_BTC_ADDR")
VAULT_ADDR=$(echo "$VAULT_OUT" | grep -oP '0x[a-fA-F0-9]{60,}' | head -1)
echo "✅ Vault Address: $VAULT_ADDR"

# 6. Update .env
echo "📝 Updating backend .env..."
sed -i "s/MOCK_BTC_ADDR=.*/MOCK_BTC_ADDR=$MOCK_BTC_ADDR/" "$BACKEND_DIR/.env"
sed -i "s/VAULT_ADDR=.*/VAULT_ADDR=$VAULT_ADDR/" "$BACKEND_DIR/.env"

# 7. Update test script
echo "📝 Updating test script..."
sed -i "s/MOCK_BTC=.*/MOCK_BTC=\"$MOCK_BTC_ADDR\"/" "/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/scripts/test_real_deposit_history.sh"
sed -i "s/VAULT=.*/VAULT=\"$VAULT_ADDR\"/" "/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/scripts/test_real_deposit_history.sh"

echo "----------------------------------------"
echo "🎉 REDEPLOYMENT COMPLETE!"
echo "MockBTC: $MOCK_BTC_ADDR"
echo "Vault:   $VAULT_ADDR"
echo "Updated: $BACKEND_DIR/.env"
