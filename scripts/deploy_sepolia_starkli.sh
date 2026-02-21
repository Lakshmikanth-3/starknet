#!/bin/bash

# Deployment script using starkli for Sepolia
# Uses environment variables for account authentication

set -e

# Source starkli environment
. ~/.starkli/env

echo "🚀 Deploying PrivateBTC contracts to Sepolia using starkli"
echo ""

# Configuration
export STARKNET_RPC="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ"
export STARKNET_ACCOUNT_ADDR="0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b"
export STARKNET_KEYSTORE_PASSWORD="password123"
CONTRACT_DIR="/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core"

cd "$CONTRACT_DIR"

echo "📋 Using account: $STARKNET_ACCOUNT_ADDR"
echo "🌐 RPC URL: Alchemy Sepolia (v0.7)"
echo ""

# Create a temporary keystore file
TEMP_KEYSTORE=$(mktemp)
# Remove the file so starkli can create it
rm "$TEMP_KEYSTORE"
# Create a temporary account file
TEMP_ACCOUNT=$(mktemp)

# Create keystore non-interactively
# Use the --password flag and pipe the private key into the command
echo "0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48" | starkli signer keystore from-key "$TEMP_KEYSTORE" --password "$STARKNET_KEYSTORE_PASSWORD" > /dev/null

# Create account file non-interactively
cat > "$TEMP_ACCOUNT" << EOF
{
  "version": 1,
  "variant": {
    "type": "open_zeppelin",
    "version": 1,
    "publicKey": "0x9703eafeb58adbbd88c27b96962fff1812f27ee9e25a48751b0978cf2e6223",
    "address": "$STARKNET_ACCOUNT_ADDR"
  }
}
EOF

# Function to run starkli with password
run_starkli() {
    STARKNET_KEYSTORE_PASSWORD="$STARKNET_KEYSTORE_PASSWORD" starkli "$@"
}

echo "📝 Declaring MockBTC..."
MOCK_BTC_OUTPUT=$(run_starkli declare target/dev/private_btc_core_MockBTC.contract_class.json \
    --rpc "$STARKNET_RPC" \
    --account "$TEMP_ACCOUNT" \
    --keystore "$TEMP_KEYSTORE" \
    --watch 2>&1 || echo "FAILED")

if echo "$MOCK_BTC_OUTPUT" | grep -q "0x"; then
    MOCK_BTC_CLASS_HASH=$(echo "$MOCK_BTC_OUTPUT" | grep -oP '0x[0-9a-f]+' | head -1)
    echo "✅ MockBTC declared: $MOCK_BTC_CLASS_HASH"
else
    echo "❌ Failed to declare MockBTC"
    echo "$MOCK_BTC_OUTPUT"
    rm -f "$TEMP_KEYSTORE" "$TEMP_ACCOUNT"
    exit 1
fi
echo ""

echo "🚀 Deploying MockBTC..."
MOCK_BTC_DEPLOY_OUTPUT=$(run_starkli deploy "$MOCK_BTC_CLASS_HASH" \
    "$STARKNET_ACCOUNT_ADDR" \
    --rpc "$STARKNET_RPC" \
    --account "$TEMP_ACCOUNT" \
    --keystore "$TEMP_KEYSTORE" \
    --watch 2>&1 || echo "FAILED")

if echo "$MOCK_BTC_DEPLOY_OUTPUT" | grep -q "0x"; then
    MOCK_BTC_ADDRESS=$(echo "$MOCK_BTC_DEPLOY_OUTPUT" | grep -oP '0x[0-9a-f]+' | tail -1)
    echo "✅ MockBTC deployed at: $MOCK_BTC_ADDRESS"
else
    echo "❌ Failed to deploy MockBTC"
    echo "$MOCK_BTC_DEPLOY_OUTPUT"
    rm -f "$TEMP_KEYSTORE" "$TEMP_ACCOUNT"
    exit 1
fi
echo ""

echo "📝 Declaring PrivateBTCVault..."
VAULT_OUTPUT=$(run_starkli declare target/dev/private_btc_core_PrivateBTCVault.contract_class.json \
    --rpc "$STARKNET_RPC" \
    --account "$TEMP_ACCOUNT" \
    --keystore "$TEMP_KEYSTORE" \
    --watch 2>&1 || echo "FAILED")

if echo "$VAULT_OUTPUT" | grep -q "0x"; then
    VAULT_CLASS_HASH=$(echo "$VAULT_OUTPUT" | grep -oP '0x[0-9a-f]+' | head -1)
    echo "✅ PrivateBTCVault declared: $VAULT_CLASS_HASH"
else
    echo "❌ Failed to declare PrivateBTCVault"
    echo "$VAULT_OUTPUT"
    rm -f "$TEMP_KEYSTORE" "$TEMP_ACCOUNT"
    exit 1
fi
echo ""

echo "🚀 Deploying PrivateBTCVault..."
VAULT_DEPLOY_OUTPUT=$(run_starkli deploy "$VAULT_CLASS_HASH" \
    "$MOCK_BTC_ADDRESS" \
    --rpc "$STARKNET_RPC" \
    --account "$TEMP_ACCOUNT" \
    --keystore "$TEMP_KEYSTORE" \
    --watch 2>&1 || echo "FAILED")

if echo "$VAULT_DEPLOY_OUTPUT" | grep -q "0x"; then
    VAULT_ADDRESS=$(echo "$VAULT_DEPLOY_OUTPUT" | grep -oP '0x[0-9a-f]+' | tail -1)
    echo "✅ PrivateBTCVault deployed at: $VAULT_ADDRESS"
else
    echo "❌ Failed to deploy PrivateBTCVault"
    echo "$VAULT_DEPLOY_OUTPUT"
    rm -f "$TEMP_KEYSTORE" "$TEMP_ACCOUNT"
    exit 1
fi

# Clean up
rm -f "$TEMP_KEYSTORE" "$TEMP_ACCOUNT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 Contract Addresses:"
echo "   MockBTC:          $MOCK_BTC_ADDRESS"
echo "   PrivateBTCVault:  $VAULT_ADDRESS"
echo ""
echo "📋 Update your .env file with:"
echo "MOCK_BTC_ADDR=$MOCK_BTC_ADDRESS"
echo "VAULT_ADDR=$VAULT_ADDRESS"
