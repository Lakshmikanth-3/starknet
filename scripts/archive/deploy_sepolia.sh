#!/bin/bash

# Deployment script for PrivateBTC contracts using sncast with profile
# Uses the correctly formatted account file at ~/.starknet_accounts/sepolia_sncast.json

set -e

echo "🚀 Deploying PrivateBTC contracts to Sepolia using sncast"
echo ""

CONTRACT_DIR="/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core"
cd "$CONTRACT_DIR"

echo "📋 Using profile: sepolia"
echo "🌐 RPC URL: Alchemy Sepolia (v0.7)"
echo ""

# 1. Declare MockBTC
echo "📝 Declaring MockBTC..."
MOCK_BTC_OUTPUT=$(sncast --profile sepolia declare --contract-name MockBTC 2>&1)

if echo "$MOCK_BTC_OUTPUT" | grep -q "class_hash"; then
    MOCK_BTC_CLASS_HASH=$(echo "$MOCK_BTC_OUTPUT" | grep -oP 'class_hash: \K0x[0-9a-f]+' | head -1)
    echo "✅ MockBTC declared: $MOCK_BTC_CLASS_HASH"
else
    echo "❌ Failed to declare MockBTC"
    echo "$MOCK_BTC_OUTPUT"
    exit 1
fi
echo ""

# 2. Deploy MockBTC
echo "🚀 Deploying MockBTC..."
DEPLOYER_ADDRESS="0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b"

MOCK_BTC_DEPLOY_OUTPUT=$(sncast --profile sepolia deploy \
    --class-hash "$MOCK_BTC_CLASS_HASH" \
    --constructor-calldata "$DEPLOYER_ADDRESS" \
    2>&1)

if echo "$MOCK_BTC_DEPLOY_OUTPUT" | grep -q "contract_address"; then
    MOCK_BTC_ADDRESS=$(echo "$MOCK_BTC_DEPLOY_OUTPUT" | grep -oP 'contract_address: \K0x[0-9a-f]+' | head -1)
    echo "✅ MockBTC deployed at: $MOCK_BTC_ADDRESS"
else
    echo "❌ Failed to deploy MockBTC"
    echo "$MOCK_BTC_DEPLOY_OUTPUT"
    exit 1
fi
echo ""

# 3. Declare PrivateBTCVault
echo "📝 Declaring PrivateBTCVault..."
VAULT_OUTPUT=$(sncast --profile sepolia declare --contract-name PrivateBTCVault 2>&1)

if echo "$VAULT_OUTPUT" | grep -q "class_hash"; then
    VAULT_CLASS_HASH=$(echo "$VAULT_OUTPUT" | grep -oP 'class_hash: \K0x[0-9a-f]+' | head -1)
    echo "✅ PrivateBTCVault declared: $VAULT_CLASS_HASH"
else
    echo "❌ Failed to declare PrivateBTCVault"
    echo "$VAULT_OUTPUT"
    exit 1
fi
echo ""

# 4. Deploy PrivateBTCVault
echo "🚀 Deploying PrivateBTCVault..."
VAULT_DEPLOY_OUTPUT=$(sncast --profile sepolia deploy \
    --class-hash "$VAULT_CLASS_HASH" \
    --constructor-calldata "$MOCK_BTC_ADDRESS" \
    2>&1)

if echo "$VAULT_DEPLOY_OUTPUT" | grep -q "contract_address"; then
    VAULT_ADDRESS=$(echo "$VAULT_DEPLOY_OUTPUT" | grep -oP 'contract_address: \K0x[0-9a-f]+' | head -1)
    echo "✅ PrivateBTCVault deployed at: $VAULT_ADDRESS"
else
    echo "❌ Failed to deploy PrivateBTCVault"
    echo "$VAULT_DEPLOY_OUTPUT"
    exit 1
fi
echo ""

# 5. Output summary
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
echo ""
echo "🔍 View on Voyager:"
echo "   https://sepolia.voyager.online/contract/$MOCK_BTC_ADDRESS"
echo "   https://sepolia.voyager.online/contract/$VAULT_ADDRESS"
