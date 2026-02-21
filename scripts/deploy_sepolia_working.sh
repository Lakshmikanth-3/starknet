#!/bin/bash

# Working deployment script for Sepolia testnet
# This script uses sncast with proper network flag

set -e

echo "🚀 Deploying PrivateBTC contracts to Sepolia"
echo ""

# Navigate to project directory
cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

# Build contracts
echo "📦 Building contracts..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

# Use sncast with --network flag instead of --url
echo "📝 Declaring MockBTC..."
SNCAST_OUTPUT=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account sepolia \
  declare \
  --network sepolia \
  --contract-name MockBTC 2>&1)

if echo "$SNCAST_OUTPUT" | grep -q "class_hash"; then
    MOCK_BTC_CLASS_HASH=$(echo "$SNCAST_OUTPUT" | grep -oP 'class_hash: 0x[0-9a-f]+' | cut -d' ' -f2)
    echo "✅ MockBTC declared: $MOCK_BTC_CLASS_HASH"
else
    echo "❌ Failed to declare MockBTC"
    echo "$SNCAST_OUTPUT"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Network flag didn't work. Let's try with explicit URL and accounts-file:"
    echo ""
    
    # Alternative: Use explicit URL and accounts-file
    /home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
      declare \
      --url https://starknet-sepolia.public.blastapi.io/rpc/v0_7 \
      --accounts-file devnet_accounts.json \
      --account admin \
      --contract-name MockBTC
    
    exit 0
fi

echo ""
echo "Next step: Deploy the contract with:"
echo "sncast --account sepolia deploy --network sepolia --class-hash <CLASS_HASH>"
