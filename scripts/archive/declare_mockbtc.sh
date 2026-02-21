#!/bin/bash

# Use existing keystore to declare contracts
set -e

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

echo "🚀 Declaring contracts to Sepolia..."
echo ""

# Build
echo "📦 Building..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

# Declare MockBTC
echo "📝 Declaring MockBTC..."
starkli declare \
  --rpc https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ \
  --account ~/.starkli-wallets/deployer/account.json \
  --keystore ~/.starkli-wallets/deployer/keystore.json \
  target/dev/private_btc_core_MockBTC.contract_class.json

echo ""
echo "✅ Done! Copy the class hash from above."
