#!/bin/bash

# Use scarb 2.8.2 directly to build and declare
set -e

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

echo "📦 Building with scarb 2.8.2 (Sierra 1.6.0)..."
~/.asdf/installs/scarb/2.8.2/bin/scarb build
echo "✅ Build complete"
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
echo "✅ SUCCESS! Copy the class hash above."
