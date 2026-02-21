#!/bin/bash

# FINAL SOLUTION: Use scarb 2.8.2 to compile with Sierra 1.6.0
set -e

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

echo "🔧 Installing scarb 2.8.2 (produces Sierra 1.6.0)..."
asdf install scarb 2.8.2
asdf local scarb 2.8.2

echo "✅ Switched to scarb 2.8.2"
echo ""

echo "📦 Rebuilding with scarb 2.8.2..."
scarb build
echo "✅ Build complete with Sierra 1.6.0"
echo ""

KEYSTORE_PATH="$HOME/.starkli-wallets/deployer/keystore.json"
ACCOUNT_PATH="$HOME/.starkli-wallets/deployer/account.json"

echo "📝 Declaring MockBTC to Sepolia..."
starkli declare \
  --rpc https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ \
  --account "$ACCOUNT_PATH" \
  --keystore "$KEYSTORE_PATH" \
  target/dev/private_btc_core_MockBTC.contract_class.json

echo ""
echo "✅ SUCCESS! Class hash shown above."
echo ""
echo "To restore scarb 2.15.1: asdf local scarb 2.15.1"
