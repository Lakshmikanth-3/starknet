#!/bin/bash

# FINAL FIX: Install starkli v0.3.5 (compatible with RPC v0.7)
set -e

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

echo "🔧 Installing starkli v0.3.5 (compatible with RPC v0.7.1)..."
echo ""

# Install specific version of starkli that supports v0.7
starkliup -v 0.3.5

echo "✅ Installed starkli v0.3.5"
echo ""

# Build
echo "📦 Building..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

# Declare MockBTC
KEYSTORE_PATH="$HOME/.starkli-wallets/deployer/keystore.json"
ACCOUNT_PATH="$HOME/.starkli-wallets/deployer/account.json"

echo "📝 Declaring MockBTC to Sepolia with RPC v0.7 compatible starkli..."
starkli declare \
  --rpc https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ \
  --account "$ACCOUNT_PATH" \
  --keystore "$KEYSTORE_PATH" \
  target/dev/private_btc_core_MockBTC.contract_class.json

echo ""
echo "✅ Declaration complete!"
