#!/bin/bash

# FINAL WORKING SOLUTION: Explicitly provide --url flag
set -e

echo "🚀 Deploying PrivateBTC contracts to Sepolia"
echo ""

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

# Build contracts
echo "📦 Building contracts..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

# Declare MockBTC with explicit URL (required by sncast)
echo "📝 Declaring MockBTC..."
/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account sepolia \
  declare \
  --url https://starknet-sepolia.public.blastapi.io/rpc/v0_7 \
  --contract-name MockBTC

echo ""
echo "✅ If successful, copy the class_hash from above"
echo ""
echo "Then deploy with:"
echo "sncast --account sepolia deploy \\"
echo "  --url https://starknet-sepolia.public.blastapi.io/rpc/v0_7 \\"
echo "  --class-hash <CLASS_HASH>"
