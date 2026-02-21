#!/bin/bash

# SOLUTION: Use starkli v0.3.5 with explicit compiler version
set -e

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

echo "📦 Building..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

KEYSTORE_PATH="$HOME/.starkli-wallets/deployer/keystore.json"
ACCOUNT_PATH="$HOME/.starkli-wallets/deployer/account.json"

echo "📝 Declaring MockBTC with Sierra 1.7.0 compiler..."
starkli declare \
  --rpc https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ \
  --account "$ACCOUNT_PATH" \
  --keystore "$KEYSTORE_PATH" \
  --compiler-version 2.9.2 \
  target/dev/private_btc_core_MockBTC.contract_class.json

echo ""
echo "✅ Declaration complete! Copy the class hash above."
