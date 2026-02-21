#!/bin/bash

# Manual deployment script using starkli for Sepolia
# This script uses manual steps to avoid keystore creation issues

set -e

echo "🚀 Manual Deployment Guide for PrivateBTC contracts to Sepolia using starkli"
echo ""

# Configuration
RPC_URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ"
ACCOUNT_ADDRESS="0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b"
CONTRACT_DIR="/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core"

cd "$CONTRACT_DIR"

echo "📋 Prerequisites:"
echo "1. Make sure you have built the contracts: scarb build"
echo "2. Make sure you have a starkli account set up"
echo ""

# Build contracts first
echo "📦 Building contracts..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

# Check if contracts are built
if [ ! -f "target/dev/private_btc_core_MockBTC.contract_class.json" ]; then
    echo "❌ Error: MockBTC contract not found. Run 'scarb build' first."
    exit 1
fi

if [ ! -f "target/dev/private_btc_core_PrivateBTCVault.contract_class.json" ]; then
    echo "❌ Error: PrivateBTCVault contract not found. Run 'scarb build' first."
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OPTION 1: Using starkli with pre-configured account"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "If you have a starkli account configured (~/.starknet_accounts/), run:"
echo ""
echo "# Declare MockBTC"
echo "starkli declare --rpc $RPC_URL \\"
echo "  --account ~/.starknet_accounts/starknet_open_zeppelin_accounts.json \\"
echo "  target/dev/private_btc_core_MockBTC.contract_class.json"
echo ""
echo "# Deploy MockBTC (use the class hash from above)"
echo "starkli deploy --rpc $RPC_URL \\"
echo "  --account ~/.starknet_accounts/starknet_open_zeppelin_accounts.json \\"
echo "  <MOCK_BTC_CLASS_HASH> \\"
echo "  $ACCOUNT_ADDRESS"
echo ""
echo "# Declare PrivateBTCVault"
echo "starkli declare --rpc $RPC_URL \\"
echo "  --account ~/.starknet_accounts/starknet_open_zeppelin_accounts.json \\"
echo "  target/dev/private_btc_core_PrivateBTCVault.contract_class.json"
echo ""
echo "# Deploy PrivateBTCVault (use the class hash from above and MockBTC address)"
echo "starkli deploy --rpc $RPC_URL \\"
echo "  --account ~/.starknet_accounts/starknet_open_zeppelin_accounts.json \\"
echo "  <VAULT_CLASS_HASH> \\"
echo "  <MOCK_BTC_ADDRESS>"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OPTION 2: Using sncast with config from snfoundry.toml"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Try without explicit --url flag (uses config from snfoundry.toml):"
echo ""
echo "# Declare MockBTC"
echo "sncast --account sepolia declare --contract-name MockBTC"
echo ""
echo "# Deploy MockBTC (if declare succeeds)"
echo "sncast --account sepolia deploy --class-hash <CLASS_HASH>"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OPTION 3: Using Starknet Remix or Voyager"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to Remix Starknet Plugin: https://remix.ethereum.org/"
echo "2. Upload contract files from target/dev/"
echo "3. Connect your wallet and deploy through the UI"
echo ""
