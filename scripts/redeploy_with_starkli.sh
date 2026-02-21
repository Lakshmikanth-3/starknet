#!/bin/bash
# scripts/redeploy_with_starkli.sh
# Build, Declare, and Deploy fixed contracts using starkli

set -e

# Configuration
PRIVATE_KEY="0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48"
ACCOUNT_PATH="/home/sl/.starkli-wallets/deployer/account.json"
RPC="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/PoSTfSa4MmSbEbXRWyHoQ"
STARKLI="/home/sl/.starkli/bin/starkli"
CONTRACTS_DIR="/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/contracts"
BACKEND_DIR="/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/backend"

# Set starkli environment
export STARKNET_RPC="$RPC"
export STARKNET_ACCOUNT="$ACCOUNT_PATH"
export STARKNET_PRIVATE_KEY="$PRIVATE_KEY"

echo "🚀 REDEPLOYING WITH STARKLI"
echo "----------------------------------------"

# 1. Build
echo "📦 Building..."
cd "$CONTRACTS_DIR"
/home/sl/.asdf/installs/scarb/2.15.2/bin/scarb build
echo "✅ Build complete!"

# 2. Declare MockBTC
echo "📜 Declaring MockBTC..."
MOCK_DECLARE_OUT=$($STARKLI declare \
  --casm-file target/dev/private_btc_core_MockBTC.compiled_contract_class.json \
  target/dev/private_btc_core_MockBTC.contract_class.json 2>&1 || true)

MOCK_CLASS_HASH=$(echo "$MOCK_DECLARE_OUT" | grep -oP '0x[a-fA-F0-9]{60,}' | head -1)

if [ -z "$MOCK_CLASS_HASH" ]; then
    # If already declared, starkli might show it in the error
    MOCK_CLASS_HASH=$(echo "$MOCK_DECLARE_OUT" | grep -oP 'already declared with class hash \K0x[a-fA-F0-9]+' | head -1)
fi

# Fallback: manually calculated or previous known hash if we must, 
# but we need the NEW one. If it failed to declare, it's a problem.
# Let's try to get it from the sierra file if everything else fails.
if [ -z "$MOCK_CLASS_HASH" ]; then
    echo "❌ Failed to capture MockBTC Class Hash. Output:"
    echo "$MOCK_DECLARE_OUT"
    exit 1
fi
echo "✅ MockBTC Class Hash: $MOCK_CLASS_HASH"

# 3. Deploy MockBTC
echo "🪙 Deploying MockBTC..."
# Recipient: User's wallet
MOCK_BTC_ADDR=$($STARKLI deploy "$MOCK_CLASS_HASH" 0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1 --watch 2>&1 | grep -oP 'contract_address: \K0x[a-fA-F0-9]+' | head -1)
echo "✅ MockBTC Address: $MOCK_BTC_ADDR"

# 4. Declare Vault
echo "📜 Declaring PrivateBTCVault..."
VAULT_DECLARE_OUT=$($STARKLI declare \
  --casm-file target/dev/private_btc_core_PrivateBTCVault.compiled_contract_class.json \
  target/dev/private_btc_core_PrivateBTCVault.contract_class.json 2>&1 || true)

VAULT_CLASS_HASH=$(echo "$VAULT_DECLARE_OUT" | grep -oP '0x[a-fA-F0-9]{60,}' | head -1)

if [ -z "$VAULT_CLASS_HASH" ]; then
    VAULT_CLASS_HASH=$(echo "$VAULT_DECLARE_OUT" | grep -oP 'already declared with class hash \K0x[a-fA-F0-9]+' | head -1)
fi

if [ -z "$VAULT_CLASS_HASH" ]; then
    echo "❌ Failed to capture Vault Class Hash."
    exit 1
fi
echo "✅ Vault Class Hash: $VAULT_CLASS_HASH"

# 5. Deploy Vault
echo "🏦 Deploying PrivateBTCVault..."
VAULT_ADDR=$($STARKLI deploy "$VAULT_CLASS_HASH" "$MOCK_BTC_ADDR" --watch 2>&1 | grep -oP 'contract_address: \K0x[a-fA-F0-9]+' | head -1)
echo "✅ Vault Address: $VAULT_ADDR"

# 6. Update .env
echo "📝 Updating backend .env..."
sed -i "s|MOCK_BTC_ADDR=.*|MOCK_BTC_ADDR=$MOCK_BTC_ADDR|" "$BACKEND_DIR/.env"
sed -i "s|VAULT_ADDR=.*|VAULT_ADDR=$VAULT_ADDR|" "$BACKEND_DIR/.env"

# 7. Update test history script
echo "📝 Updating test script..."
sed -i "s|MOCK_BTC=.*|MOCK_BTC=\"$MOCK_BTC_ADDR\"|" "/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/scripts/test_real_deposit_history.sh"
sed -i "s|VAULT=.*|VAULT=\"$VAULT_ADDR\"|" "/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/scripts/test_real_deposit_history.sh"

echo "----------------------------------------"
echo "🎉 REDEPLOYMENT COMPLETE!"
echo "MockBTC: $MOCK_BTC_ADDR"
echo "Vault:   $VAULT_ADDR"
