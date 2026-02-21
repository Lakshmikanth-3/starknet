#!/bin/bash

# FINAL WORKING SOLUTION: Deploy using local accounts file
# This avoids the missing account file issue

set -e

echo "🚀 Deploying PrivateBTC contracts to Sepolia"
echo ""

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

# Build first
echo "📦 Building contracts..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

# Deploy using local devnet_accounts.json with admin account
echo "📝 Declaring MockBTC..."
/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  declare \
  --url https://starknet-sepolia.public.blastapi.io/rpc/v0_7 \
  --accounts-file devnet_accounts.json \
  --account admin \
  --contract-name MockBTC

echo ""
echo "✅ If declare succeeded, the class hash will be shown above"
echo "Copy it and deploy with:"
echo ""
echo "sncast deploy \\"
echo "  --url https://starknet-sepolia.public.blastapi.io/rpc/v0_7 \\"
echo "  --accounts-file devnet_accounts.json \\"
echo "  --account admin \\"
echo "  --class-hash <CLASS_HASH_FROM_ABOVE>"
